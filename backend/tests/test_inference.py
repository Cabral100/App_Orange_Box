from __future__ import annotations

import hashlib
from dataclasses import replace
from pathlib import Path

import numpy as np
from PIL import Image

from backend.app.config import Settings
from backend.app.inference import ModelService


class FakeBoxes:
    xyxy = np.array([[10.0, 20.0, 110.0, 120.0]])
    conf = np.array([0.91])
    cls = np.array([1.0])


class FakeResult:
    boxes = FakeBoxes()
    names = {0: "saudavel", 1: "doente"}


class FakeUnsortedBoxes:
    xyxy = np.array(
        [[1.0, 2.0, 30.0, 40.0], [10.0, 20.0, 110.0, 120.0]]
    )
    conf = np.array([0.21, 0.96])
    cls = np.array([0.0, 1.0])


class FakeUnsortedResult:
    boxes = FakeUnsortedBoxes()
    names = {0: "saudavel", 1: "doente"}


class FakeYolo:
    names = {0: "saudavel", 1: "doente"}

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def predict(self, **kwargs):  # type: ignore[no-untyped-def]
        self.calls.append(kwargs)
        return [FakeResult()]


class FakeUnsortedYolo(FakeYolo):
    def predict(self, **kwargs):  # type: ignore[no-untyped-def]
        self.calls.append(kwargs)
        return [FakeUnsortedResult()]


def make_settings(model_path: Path, expected_hash: str) -> Settings:
    base = Settings.from_env()
    return replace(
        base,
        model_path=model_path,
        expected_model_sha256=expected_hash,
        verify_model_sha256=True,
    )


def test_model_is_lazy_singleton_and_uses_detection_parameters(tmp_path: Path) -> None:
    model_path = tmp_path / "best.pt"
    model_bytes = b"fake-yolo-weights"
    model_path.write_bytes(model_bytes)
    expected_hash = hashlib.sha256(model_bytes).hexdigest().upper()
    fake_model = FakeYolo()
    factory_calls: list[Path] = []

    def factory(path: Path) -> FakeYolo:
        factory_calls.append(path)
        return fake_model

    service = ModelService(make_settings(model_path, expected_hash), factory)
    assert service.metadata().loaded is False
    assert factory_calls == []

    image = Image.new("RGB", (640, 480), "orange")
    first = service.predict(image, 0.5)
    second = service.predict(image, 0.7)

    assert factory_calls == [model_path]
    assert len(first.detections) == 1
    assert first.detections[0].class_name == "doente"
    assert len(second.detections) == 1
    assert fake_model.calls[0]["conf"] == 0.5
    assert fake_model.calls[0]["imgsz"] == service.settings.image_size
    assert fake_model.calls[0]["verbose"] is False
    assert service.metadata().checksum.status == "verified"


def test_checksum_can_be_reported_without_loading_model(tmp_path: Path) -> None:
    model_path = tmp_path / "best.pt"
    model_path.write_bytes(b"unexpected")
    service = ModelService(make_settings(model_path, "0" * 64), lambda _: FakeYolo())

    metadata = service.metadata(verify_checksum=True)

    assert metadata.loaded is False
    assert metadata.checksum.status == "mismatch"
    assert metadata.checksum.actual_sha256 is not None


def test_detections_are_sorted_by_descending_confidence(tmp_path: Path) -> None:
    model_path = tmp_path / "best.pt"
    model_bytes = b"fake-yolo-weights"
    model_path.write_bytes(model_bytes)
    expected_hash = hashlib.sha256(model_bytes).hexdigest().upper()
    fake_model = FakeUnsortedYolo()
    service = ModelService(
        make_settings(model_path, expected_hash), lambda _: fake_model
    )

    prediction = service.predict(Image.new("RGB", (640, 480), "orange"), 0.05)

    assert [item.confidence for item in prediction.detections] == [0.96, 0.21]
    assert prediction.detections[0].class_name == "doente"
