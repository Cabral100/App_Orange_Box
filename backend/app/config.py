from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
EXPECTED_MODEL_SHA256 = (
    "84FB5A7EDE6CDF6F351866E5FE5C113DEDFB68787AA29012BD84C4EEAAD4AE6A"
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} deve ser true/false.")


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    value = int(os.getenv(name, str(default)))
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} deve estar entre {minimum} e {maximum}.")
    return value


def _env_float(
    name: str, default: float, *, minimum: float, maximum: float
) -> float:
    value = float(os.getenv(name, str(default)))
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} deve estar entre {minimum} e {maximum}.")
    return value


def _env_origins(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(name)
    if raw is None:
        return default
    return tuple(
        origin.strip().rstrip("/")
        for origin in raw.split(",")
        if origin.strip()
    )


@dataclass(frozen=True, slots=True)
class Settings:
    model_path: Path
    expected_model_sha256: str | None
    verify_model_sha256: bool
    default_confidence: float
    image_size: int
    max_upload_bytes: int
    max_image_pixels: int
    min_image_side: int
    min_brightness: float
    max_brightness: float
    min_contrast: float
    annotated_jpeg_quality: int
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        raw_model_path = os.getenv("CITROSCAN_MODEL_PATH")
        if raw_model_path:
            model_path = Path(raw_model_path).expanduser()
            if not model_path.is_absolute():
                model_path = BACKEND_DIR / model_path
        else:
            model_path = BACKEND_DIR / "models" / "best.pt"

        raw_sha = os.getenv("CITROSCAN_MODEL_SHA256", EXPECTED_MODEL_SHA256).strip()
        expected_sha = raw_sha.upper() or None
        if expected_sha is not None and (
            len(expected_sha) != 64
            or any(character not in "0123456789ABCDEF" for character in expected_sha)
        ):
            raise ValueError("CITROSCAN_MODEL_SHA256 deve ser um SHA-256 hexadecimal.")

        min_brightness = _env_float(
            "CITROSCAN_MIN_BRIGHTNESS", 35.0, minimum=0.0, maximum=255.0
        )
        max_brightness = _env_float(
            "CITROSCAN_MAX_BRIGHTNESS", 220.0, minimum=0.0, maximum=255.0
        )
        if min_brightness >= max_brightness:
            raise ValueError(
                "CITROSCAN_MIN_BRIGHTNESS deve ser menor que "
                "CITROSCAN_MAX_BRIGHTNESS."
            )

        return cls(
            model_path=model_path.resolve(),
            expected_model_sha256=expected_sha,
            verify_model_sha256=_env_bool("CITROSCAN_VERIFY_MODEL_SHA256", True),
            default_confidence=_env_float(
                "CITROSCAN_DEFAULT_CONFIDENCE", 0.5, minimum=0.0, maximum=1.0
            ),
            image_size=_env_int(
                "CITROSCAN_IMAGE_SIZE", 640, minimum=32, maximum=4096
            ),
            max_upload_bytes=_env_int(
                "CITROSCAN_MAX_UPLOAD_MB", 10, minimum=1, maximum=100
            )
            * 1024
            * 1024,
            max_image_pixels=_env_int(
                "CITROSCAN_MAX_IMAGE_PIXELS",
                25_000_000,
                minimum=1_000_000,
                maximum=100_000_000,
            ),
            min_image_side=_env_int(
                "CITROSCAN_MIN_IMAGE_SIDE", 320, minimum=32, maximum=4096
            ),
            min_brightness=min_brightness,
            max_brightness=max_brightness,
            min_contrast=_env_float(
                "CITROSCAN_MIN_CONTRAST", 20.0, minimum=0.0, maximum=127.5
            ),
            annotated_jpeg_quality=_env_int(
                "CITROSCAN_ANNOTATED_JPEG_QUALITY", 88, minimum=50, maximum=95
            ),
            cors_origins=_env_origins(
                "CITROSCAN_CORS_ORIGINS",
                ("http://localhost:5173", "http://127.0.0.1:5173"),
            ),
        )
