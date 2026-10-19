from __future__ import annotations

import io
from dataclasses import replace

from fastapi.testclient import TestClient
from PIL import Image

from backend.app.inference import Prediction
from backend.app.main import app
from backend.app.schemas import BoundingBox, Detection, ModelMetadata


class FakeModelService:
    def metadata(self, *, verify_checksum: bool = False) -> ModelMetadata:
        return ModelMetadata(
            path="/tmp/best.pt",
            filename="best.pt",
            exists=True,
            loaded=False,
            classes=None,
            default_confidence=0.5,
            image_size=640,
            checksum={
                "expected_sha256": "A" * 64,
                "actual_sha256": "A" * 64 if verify_checksum else None,
                "status": "verified" if verify_checksum else "not_checked",
                "enforced_on_load": True,
            },
        )

    def predict(self, image: Image.Image, confidence: float) -> Prediction:
        return Prediction(
            detections=[
                Detection(
                    class_id=0,
                    class_name="laranja",
                    confidence=0.93,
                    bbox=BoundingBox(x1=5, y1=5, x2=100, y2=100),
                )
            ],
            inference_ms=12.34,
        )


class FakeNoDetectionService(FakeModelService):
    def predict(self, image: Image.Image, confidence: float) -> Prediction:
        return Prediction(detections=[], inference_ms=8.0)


def png_bytes(size: tuple[int, int] = (640, 480)) -> bytes:
    image = Image.new("RGB", size, (220, 110, 20))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_infer_returns_detections_quality_and_annotation() -> None:
    original_service = app.state.model_service
    original_settings = app.state.settings
    app.state.model_service = FakeModelService()
    app.state.settings = replace(
        original_settings,
        min_brightness=0,
        max_brightness=255,
        min_contrast=0,
    )
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/infer?conf=0.6",
                files={"file": ("orange.png", png_bytes(), "image/png")},
            )
    finally:
        app.state.model_service = original_service
        app.state.settings = original_settings

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "detected"
    assert body["detection_count"] == 1
    assert body["detections"][0]["class_name"] == "laranja"
    assert body["confidence_threshold"] == 0.6
    assert body["quality"]["status"] == "adequate"
    assert body["location"] is None
    assert body["annotated_image"].startswith("data:image/jpeg;base64,")


def test_live_scan_can_skip_annotation_and_use_device_location() -> None:
    original_service = app.state.model_service
    original_settings = app.state.settings
    app.state.model_service = FakeModelService()
    app.state.settings = replace(
        original_settings,
        min_brightness=0,
        max_brightness=255,
        min_contrast=0,
    )
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/infer?conf=0.05&annotated=false",
                files={"file": ("frame.jpg", png_bytes(), "image/png")},
                data={
                    "latitude": "-23.55052",
                    "longitude": "-46.633308",
                    "accuracy_m": "4.8",
                },
            )
    finally:
        app.state.model_service = original_service
        app.state.settings = original_settings

    assert response.status_code == 200
    body = response.json()
    assert body["confidence_threshold"] == 0.05
    assert body["annotated_image"] is None
    assert body["location"] == {
        "latitude": -23.55052,
        "longitude": -46.633308,
        "altitude_m": None,
        "accuracy_m": 4.8,
        "source": "device",
    }


def test_device_location_requires_a_coordinate_pair() -> None:
    original_service = app.state.model_service
    app.state.model_service = FakeModelService()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/infer?annotated=false",
                files={"file": ("frame.jpg", png_bytes(), "image/png")},
                data={"latitude": "-23.55052"},
            )
    finally:
        app.state.model_service = original_service

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "incomplete_location"


def test_low_quality_is_inconclusive_even_with_detection() -> None:
    original_service = app.state.model_service
    app.state.model_service = FakeModelService()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/infer",
                files={"file": ("tiny.png", png_bytes((64, 64)), "image/png")},
            )
    finally:
        app.state.model_service = original_service

    assert response.status_code == 200
    assert response.json()["status"] == "inconclusive"
    assert "low_resolution" in response.json()["quality"]["warnings"]


def test_no_detection_is_not_inconclusive_when_image_is_adequate() -> None:
    original_service = app.state.model_service
    original_settings = app.state.settings
    app.state.model_service = FakeNoDetectionService()
    app.state.settings = replace(
        original_settings,
        min_brightness=0,
        max_brightness=255,
        min_contrast=0,
    )
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/infer?conf=0.99",
                files={"file": ("orange.png", png_bytes(), "image/png")},
            )
    finally:
        app.state.model_service = original_service
        app.state.settings = original_settings

    assert response.status_code == 200
    assert response.json()["status"] == "no_detection"
    assert response.json()["quality"]["status"] == "adequate"


def test_invalid_file_is_rejected_before_model() -> None:
    original_service = app.state.model_service
    app.state.model_service = FakeModelService()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/infer",
                files={"file": ("not-image.txt", b"hello", "text/plain")},
            )
    finally:
        app.state.model_service = original_service

    assert response.status_code == 415
    assert response.json()["detail"]["code"] == "unsupported_media_type"


def test_health_does_not_load_model() -> None:
    original_service = app.state.model_service
    app.state.model_service = FakeModelService()
    try:
        with TestClient(app) as client:
            response = client.get("/api/health")
    finally:
        app.state.model_service = original_service

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["model"]["loaded"] is False


def test_declared_oversized_request_is_rejected_before_parsing() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/infer",
            content=b"",
            headers={"content-length": str(1024 * 1024 * 1024)},
        )

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "request_too_large"


def test_vite_development_origin_is_allowed_by_cors() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/infer",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:5173"
    )
