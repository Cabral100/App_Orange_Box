from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Receive, Scope, Send

from .config import Settings
from .image_processing import (
    InvalidImageError,
    annotate_as_data_url,
    assess_quality,
    decode_and_sanitize_image,
)
from .inference import (
    ModelIntegrityError,
    ModelLoadError,
    ModelService,
    ModelUnavailableError,
)
from .schemas import HealthResponse, ImageLocation, InferenceResponse, ModelMetadata


LOGGER = logging.getLogger("citroscan")
FRONTEND_SOURCE_DIR = Path(__file__).resolve().parents[2] / "frontend"
FRONTEND_DIR = (
    FRONTEND_SOURCE_DIR / "dist"
    if (FRONTEND_SOURCE_DIR / "dist" / "index.html").is_file()
    else FRONTEND_SOURCE_DIR
)


class _RequestTooLarge(Exception):
    pass


class ContentLengthLimitMiddleware:
    def __init__(self, app: ASGIApp, max_upload_bytes: int) -> None:
        self.app = app
        # Multipart acrescenta cabeçalhos e delimitadores pequenos ao arquivo.
        self.max_request_bytes = max_upload_bytes + 1024 * 1024

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope.get("path") == "/api/infer":
            headers = dict(scope.get("headers", []))
            raw_length = headers.get(b"content-length")
            if raw_length:
                try:
                    parsed_length = int(raw_length)
                    too_large = (
                        parsed_length < 0 or parsed_length > self.max_request_bytes
                    )
                except ValueError:
                    too_large = True
                if too_large:
                    await self._reject(scope, receive, send)
                    return

            received_bytes = 0

            async def limited_receive():  # type: ignore[no-untyped-def]
                nonlocal received_bytes
                message = await receive()
                if message.get("type") == "http.request":
                    received_bytes += len(message.get("body", b""))
                    if received_bytes > self.max_request_bytes:
                        raise _RequestTooLarge
                return message

            try:
                await self.app(scope, limited_receive, send)
            except _RequestTooLarge:
                await self._reject(scope, receive, send)
            return

        await self.app(scope, receive, send)

    async def _reject(self, scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse(
            status_code=413,
            content={
                "detail": {
                    "code": "request_too_large",
                    "message": "A requisição excede o limite permitido.",
                }
            },
        )
        await response(scope, receive, send)


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope):  # type: ignore[no-untyped-def]
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if (
                exc.status_code == 404
                and scope.get("method") in {"GET", "HEAD"}
                and not path.startswith("api/")
            ):
                return await super().get_response("index.html", scope)
            raise


settings = Settings.from_env()
model_service = ModelService(settings)

app = FastAPI(
    title="CYF Vision API",
    version="1.0.0",
    description="Inferência local para detecção em citros.",
)
app.state.settings = settings
app.state.model_service = model_service
app.add_middleware(ContentLengthLimitMiddleware, max_upload_bytes=settings.max_upload_bytes)
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
async def health(request: Request) -> HealthResponse:
    service: ModelService = request.app.state.model_service
    # Verifica o arquivo sem carregar o runtime YOLO; assim “ok” não mascara
    # um checkpoint alterado ou corrompido.
    metadata = await run_in_threadpool(
        lambda: service.metadata(verify_checksum=True)
    )
    healthy = metadata.exists and metadata.checksum.status != "mismatch"
    return HealthResponse(status="ok" if healthy else "degraded", model=metadata)


@app.get("/api/model", response_model=ModelMetadata, tags=["system"])
async def model_metadata(
    request: Request,
    verify_checksum: Annotated[
        bool,
        Query(description="Calcula e compara o SHA-256 sem carregar o YOLO."),
    ] = False,
) -> ModelMetadata:
    service: ModelService = request.app.state.model_service
    return await run_in_threadpool(
        lambda: service.metadata(verify_checksum=verify_checksum)
    )


@app.post("/api/infer", response_model=InferenceResponse, tags=["inference"])
async def infer(
    request: Request,
    file: Annotated[UploadFile, File(description="Imagem JPEG, PNG ou WebP.")],
    conf_query: Annotated[
        float | None,
        Query(alias="conf", ge=0.0, le=1.0, description="Limiar de confiança."),
    ] = None,
    conf_form: Annotated[
        float | None,
        Form(alias="conf", ge=0.0, le=1.0, description="Limiar de confiança."),
    ] = None,
    confidence_form: Annotated[
        float | None,
        Form(alias="confidence", ge=0.0, le=1.0),
    ] = None,
    annotated: Annotated[
        bool,
        Query(
            description=(
                "Inclui uma cópia JPEG anotada. Use false na varredura ao vivo "
                "para reduzir latência e tráfego."
            )
        ),
    ] = True,
    latitude: Annotated[
        float | None,
        Form(ge=-90.0, le=90.0, description="Latitude capturada pelo aparelho."),
    ] = None,
    longitude: Annotated[
        float | None,
        Form(ge=-180.0, le=180.0, description="Longitude capturada pelo aparelho."),
    ] = None,
    accuracy_m: Annotated[
        float | None,
        Form(
            ge=0.0,
            le=100_000.0,
            description="Precisão horizontal informada pelo aparelho, em metros.",
        ),
    ] = None,
) -> InferenceResponse:
    request_started = time.perf_counter()
    current_settings: Settings = request.app.state.settings
    service: ModelService = request.app.state.model_service
    confidence = next(
        (
            value
            for value in (conf_query, conf_form, confidence_form)
            if value is not None
        ),
        current_settings.default_confidence,
    )

    coordinates_are_incomplete = (latitude is None) != (longitude is None)
    if coordinates_are_incomplete or (
        accuracy_m is not None and latitude is None
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "incomplete_location",
                "message": (
                    "Envie latitude e longitude juntas; accuracy_m só pode ser "
                    "usada com ambas."
                ),
            },
        )

    try:
        payload = await file.read(current_settings.max_upload_bytes + 1)
    finally:
        await file.close()

    try:
        decoded = await run_in_threadpool(
            decode_and_sanitize_image,
            payload,
            file.content_type,
            current_settings,
        )
        quality = await run_in_threadpool(
            assess_quality, decoded.image, current_settings
        )
        prediction = await run_in_threadpool(
            service.predict, decoded.image, confidence
        )
        annotated_image = None
        if annotated:
            annotated_image = await run_in_threadpool(
                annotate_as_data_url,
                decoded.image,
                prediction.detections,
                current_settings.annotated_jpeg_quality,
            )
    except InvalidImageError as exc:
        status_code = 413 if exc.code == "file_too_large" else 415 if exc.code in {
            "unsupported_media_type",
            "unsupported_image_format",
        } else 400
        raise HTTPException(
            status_code=status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "model_unavailable", "message": str(exc)},
        ) from exc
    except ModelIntegrityError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "model_integrity_error", "message": str(exc)},
        ) from exc
    except ModelLoadError as exc:
        LOGGER.exception("Falha na execução do modelo")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "inference_failed",
                "message": "Não foi possível analisar a imagem.",
            },
        ) from exc

    if quality.status == "inadequate":
        status = "inconclusive"
    elif prediction.detections:
        status = "detected"
    else:
        status = "no_detection"

    latency_ms = (time.perf_counter() - request_started) * 1000
    device_location = (
        ImageLocation(
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            source="device",
        )
        if latitude is not None and longitude is not None
        else None
    )
    return InferenceResponse(
        status=status,
        detections=prediction.detections,
        detection_count=len(prediction.detections),
        confidence_threshold=confidence,
        image_size=current_settings.image_size,
        latency_ms=round(latency_ms, 2),
        inference_ms=round(prediction.inference_ms, 2),
        quality=quality,
        sanitization=decoded.sanitization,
        # Para imagens importadas, o local gravado na própria foto é a fonte
        # mais fiel. Quadros de canvas/câmera não carregam EXIF e usam o GPS
        # enviado pelo navegador como fallback.
        location=decoded.location or device_location,
        annotated_image=annotated_image,
    )


@app.api_route(
    "/api/{unknown_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
async def unknown_api_route(unknown_path: str) -> Any:
    raise HTTPException(
        status_code=404,
        detail={"code": "not_found", "message": "Endpoint não encontrado."},
    )


if (FRONTEND_DIR / "index.html").is_file():
    app.mount(
        "/",
        SPAStaticFiles(directory=FRONTEND_DIR, html=True),
        name="frontend",
    )
else:

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {
            "service": "CYF Vision API",
            "docs": "/docs",
            "health": "/api/health",
        }
