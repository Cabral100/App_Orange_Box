from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np
from PIL import Image

from .config import Settings
from .schemas import BoundingBox, ChecksumMetadata, Detection, ModelMetadata


class ModelUnavailableError(RuntimeError):
    pass


class ModelIntegrityError(RuntimeError):
    pass


class ModelLoadError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class Prediction:
    detections: list[Detection]
    inference_ms: float


YoloFactory = Callable[[Path], Any]


def _default_yolo_factory(model_path: Path) -> Any:
    # Importar aqui mantém /health e os testes leves e não carrega pesos no startup.
    from ultralytics import YOLO

    return YOLO(str(model_path), task="detect")


class ModelService:
    """Singleton-friendly, lazy and thread-safe wrapper around Ultralytics YOLO."""

    def __init__(
        self, settings: Settings, yolo_factory: YoloFactory | None = None
    ) -> None:
        self.settings = settings
        self._yolo_factory = yolo_factory or _default_yolo_factory
        self._model: Any | None = None
        self._load_lock = threading.RLock()
        self._inference_lock = threading.Lock()
        self._actual_sha256: str | None = None
        self._checksum_status = "not_checked"
        self._checksum_fingerprint: tuple[int, int] | None = None

    def metadata(self, *, verify_checksum: bool = False) -> ModelMetadata:
        if verify_checksum:
            self.verify_checksum()

        with self._load_lock:
            exists = self.settings.model_path.is_file()
            self._invalidate_stale_checksum_locked()
            if not exists:
                checksum_status = "missing"
                actual_sha256 = None
            elif self.settings.expected_model_sha256 is None:
                checksum_status = "not_configured"
                actual_sha256 = self._actual_sha256
            else:
                checksum_status = self._checksum_status
                actual_sha256 = self._actual_sha256

            return ModelMetadata(
                path=str(self.settings.model_path),
                filename=self.settings.model_path.name,
                exists=exists,
                loaded=self._model is not None,
                classes=self._class_names() if self._model is not None else None,
                default_confidence=self.settings.default_confidence,
                image_size=self.settings.image_size,
                checksum=ChecksumMetadata(
                    expected_sha256=self.settings.expected_model_sha256,
                    actual_sha256=actual_sha256,
                    status=checksum_status,
                    enforced_on_load=self.settings.verify_model_sha256,
                ),
            )

    def verify_checksum(self) -> ChecksumMetadata:
        with self._load_lock:
            path = self.settings.model_path
            if not path.is_file():
                self._actual_sha256 = None
                self._checksum_fingerprint = None
                self._checksum_status = "missing"
            elif self.settings.expected_model_sha256 is None:
                self._actual_sha256 = None
                self._checksum_fingerprint = None
                self._checksum_status = "not_configured"
            else:
                digest = _sha256(path)
                stat = path.stat()
                self._actual_sha256 = digest
                self._checksum_fingerprint = (stat.st_size, stat.st_mtime_ns)
                self._checksum_status = (
                    "verified"
                    if digest.upper() == self.settings.expected_model_sha256.upper()
                    else "mismatch"
                )

            return ChecksumMetadata(
                expected_sha256=self.settings.expected_model_sha256,
                actual_sha256=self._actual_sha256,
                status=self._checksum_status,
                enforced_on_load=self.settings.verify_model_sha256,
            )

    def predict(self, image: Image.Image, confidence: float) -> Prediction:
        model = self._get_or_load_model()
        source = np.asarray(image, dtype=np.uint8)

        started = time.perf_counter()
        try:
            with self._inference_lock:
                results = model.predict(
                    source=source,
                    conf=confidence,
                    imgsz=self.settings.image_size,
                    verbose=False,
                )
        except Exception as exc:  # Ultralytics expõe exceções de vários backends.
            raise ModelLoadError("O modelo falhou durante a inferência.") from exc
        inference_ms = (time.perf_counter() - started) * 1000

        result = results[0] if results else None
        detections = self._extract_detections(result)
        return Prediction(detections=detections, inference_ms=inference_ms)

    def _get_or_load_model(self) -> Any:
        if self._model is not None:
            return self._model

        with self._load_lock:
            if self._model is not None:
                return self._model
            path = self.settings.model_path
            if not path.is_file():
                raise ModelUnavailableError(
                    f"Modelo não encontrado em {path}. Copie best.pt para esse caminho."
                )
            if self.settings.verify_model_sha256:
                checksum = self.verify_checksum()
                if checksum.status == "mismatch":
                    raise ModelIntegrityError(
                        "O SHA-256 de best.pt não corresponde ao valor esperado."
                    )
            try:
                self._model = self._yolo_factory(path)
            except Exception as exc:
                raise ModelLoadError("Não foi possível carregar o modelo YOLO.") from exc
            return self._model

    def _class_names(self) -> list[str] | None:
        names = getattr(self._model, "names", None)
        if isinstance(names, dict):
            return [str(names[key]) for key in sorted(names)]
        if isinstance(names, (list, tuple)):
            return [str(name) for name in names]
        return None

    def _extract_detections(self, result: Any | None) -> list[Detection]:
        if result is None:
            return []
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return []

        coordinates = _to_list(getattr(boxes, "xyxy", []))
        confidences = _to_list(getattr(boxes, "conf", []))
        class_ids = _to_list(getattr(boxes, "cls", []))
        names = getattr(result, "names", None) or getattr(self._model, "names", {})

        detections: list[Detection] = []
        for coordinate, score, raw_class_id in zip(
            coordinates, confidences, class_ids, strict=False
        ):
            class_id = int(raw_class_id)
            class_name = _class_name(names, class_id)
            x1, y1, x2, y2 = (float(value) for value in coordinate[:4])
            detections.append(
                Detection(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=round(float(score), 6),
                    bbox=BoundingBox(
                        x1=round(x1, 2),
                        y1=round(y1, 2),
                        x2=round(x2, 2),
                        y2=round(y2, 2),
                    ),
                )
            )
        detections.sort(key=lambda detection: detection.confidence, reverse=True)
        return detections

    def _invalidate_stale_checksum_locked(self) -> None:
        if self._checksum_fingerprint is None:
            return
        try:
            stat = self.settings.model_path.stat()
        except FileNotFoundError:
            self._actual_sha256 = None
            self._checksum_fingerprint = None
            self._checksum_status = "missing"
            return
        if (stat.st_size, stat.st_mtime_ns) != self._checksum_fingerprint:
            self._actual_sha256 = None
            self._checksum_fingerprint = None
            self._checksum_status = "not_checked"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _to_list(value: Any) -> list[Any]:
    for method_name in ("detach", "cpu"):
        method = getattr(value, method_name, None)
        if callable(method):
            value = method()
    tolist = getattr(value, "tolist", None)
    if callable(tolist):
        return tolist()
    if isinstance(value, Sequence):
        return list(value)
    return []


def _class_name(names: Any, class_id: int) -> str:
    if isinstance(names, dict):
        return str(names.get(class_id, f"class_{class_id}"))
    if isinstance(names, (list, tuple)) and 0 <= class_id < len(names):
        return str(names[class_id])
    return f"class_{class_id}"
