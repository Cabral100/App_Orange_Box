from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChecksumMetadata(BaseModel):
    expected_sha256: str | None
    actual_sha256: str | None
    status: Literal["not_configured", "not_checked", "verified", "mismatch", "missing"]
    enforced_on_load: bool


class ModelMetadata(BaseModel):
    path: str
    filename: str
    exists: bool
    loaded: bool
    task: Literal["detect"] = "detect"
    classes: list[str] | None = None
    default_confidence: float
    image_size: int
    checksum: ChecksumMetadata


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: Literal["citroscan-api"] = "citroscan-api"
    model: ModelMetadata


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: BoundingBox


class QualityMetrics(BaseModel):
    width: int
    height: int
    brightness: float = Field(description="Média de luminância, de 0 a 255.")
    contrast: float = Field(description="Desvio padrão da luminância.")


class QualityAssessment(BaseModel):
    status: Literal["adequate", "inadequate"]
    warnings: list[
        Literal["low_resolution", "too_dark", "too_bright", "low_contrast"]
    ]
    metrics: QualityMetrics


class ImageSanitization(BaseModel):
    exif_removed: bool
    gps_removed: bool


class ImageLocation(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float | None = None
    accuracy_m: float | None = None
    source: Literal["exif", "device"] = "exif"


class InferenceResponse(BaseModel):
    status: Literal["detected", "no_detection", "inconclusive"]
    detections: list[Detection]
    detection_count: int
    confidence_threshold: float
    image_size: int
    latency_ms: float
    inference_ms: float
    quality: QualityAssessment
    sanitization: ImageSanitization
    location: ImageLocation | None = None
    annotated_image: str | None = Field(
        default=None,
        description=(
            "Imagem JPEG em data URL, quando solicitada com annotated=true."
        ),
    )


class ErrorDetail(BaseModel):
    code: str
    message: str
