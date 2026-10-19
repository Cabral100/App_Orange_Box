from __future__ import annotations

import base64
import io
import warnings
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

from .config import Settings
from .schemas import (
    BoundingBox,
    Detection,
    ImageLocation,
    ImageSanitization,
    QualityAssessment,
    QualityMetrics,
)


ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/octet-stream",
}
GPS_INFO_EXIF_TAG = 34853


class InvalidImageError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class DecodedImage:
    image: Image.Image
    sanitization: ImageSanitization
    location: ImageLocation | None


def decode_and_sanitize_image(
    payload: bytes, content_type: str | None, settings: Settings
) -> DecodedImage:
    if not payload:
        raise InvalidImageError("empty_file", "O arquivo de imagem está vazio.")
    if len(payload) > settings.max_upload_bytes:
        raise InvalidImageError(
            "file_too_large",
            f"A imagem excede o limite de {settings.max_upload_bytes // (1024 * 1024)} MB.",
        )

    normalized_content_type = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized_content_type and normalized_content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidImageError(
            "unsupported_media_type", "Envie uma imagem JPEG, PNG ou WebP."
        )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as probe:
                image_format = (probe.format or "").upper()
                width, height = probe.size
                if image_format not in ALLOWED_IMAGE_FORMATS:
                    raise InvalidImageError(
                        "unsupported_image_format", "Envie uma imagem JPEG, PNG ou WebP."
                    )
                if width <= 0 or height <= 0:
                    raise InvalidImageError("invalid_dimensions", "Dimensões inválidas.")
                if width * height > settings.max_image_pixels:
                    raise InvalidImageError(
                        "too_many_pixels",
                        f"A imagem excede o limite de {settings.max_image_pixels} pixels.",
                    )
                probe.verify()

            with Image.open(io.BytesIO(payload)) as source:
                exif = source.getexif()
                had_exif = bool(exif)
                had_gps = GPS_INFO_EXIF_TAG in exif
                location = _extract_gps(exif) if had_gps else None
                oriented = ImageOps.exif_transpose(source)
                oriented.load()
                rgb = Image.new("RGB", oriented.size)
                rgb.paste(oriented.convert("RGB"))
                rgb.info.clear()
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise InvalidImageError(
            "invalid_image", "O arquivo não contém uma imagem válida."
        ) from exc
    except Image.DecompressionBombWarning as exc:
        raise InvalidImageError(
            "too_many_pixels", "A imagem tem dimensões excessivas."
        ) from exc

    return DecodedImage(
        image=rgb,
        sanitization=ImageSanitization(
            exif_removed=had_exif,
            gps_removed=had_gps,
        ),
        location=location,
    )


def assess_quality(image: Image.Image, settings: Settings) -> QualityAssessment:
    sample = image.copy()
    sample.thumbnail((512, 512), Image.Resampling.LANCZOS)
    luminance = np.asarray(sample.convert("L"), dtype=np.float32)
    brightness = float(luminance.mean())
    contrast = float(luminance.std())

    quality_warnings: list[str] = []
    width, height = image.size
    if min(width, height) < settings.min_image_side:
        quality_warnings.append("low_resolution")
    if brightness < settings.min_brightness:
        quality_warnings.append("too_dark")
    elif brightness > settings.max_brightness:
        quality_warnings.append("too_bright")
    if contrast < settings.min_contrast:
        quality_warnings.append("low_contrast")

    return QualityAssessment(
        status="inadequate" if quality_warnings else "adequate",
        warnings=quality_warnings,
        metrics=QualityMetrics(
            width=width,
            height=height,
            brightness=round(brightness, 2),
            contrast=round(contrast, 2),
        ),
    )


def annotate_as_data_url(
    image: Image.Image,
    detections: Iterable[Detection],
    jpeg_quality: int,
) -> str:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    font = ImageFont.load_default()
    line_width = max(2, min(image.size) // 300)

    for detection in detections:
        box: BoundingBox = detection.bbox
        color = _class_color(detection.class_id)
        draw.rectangle(
            (box.x1, box.y1, box.x2, box.y2),
            outline=color,
            width=line_width,
        )
        label = f"{detection.class_name} {detection.confidence:.0%}"
        text_box = draw.textbbox((box.x1, box.y1), label, font=font)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]
        label_y = max(0.0, box.y1 - text_height - 6)
        draw.rectangle(
            (box.x1, label_y, box.x1 + text_width + 6, label_y + text_height + 6),
            fill=color,
        )
        draw.text(
            (box.x1 + 3, label_y + 3),
            label,
            fill=(255, 255, 255),
            font=font,
        )

    buffer = io.BytesIO()
    annotated.save(
        buffer,
        format="JPEG",
        quality=jpeg_quality,
        optimize=True,
        exif=b"",
    )
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def _class_color(class_id: int) -> tuple[int, int, int]:
    palette = (
        (238, 107, 35),
        (31, 143, 97),
        (33, 110, 180),
        (160, 77, 166),
        (201, 147, 20),
        (190, 58, 73),
    )
    return palette[class_id % len(palette)]


def _extract_gps(exif: Image.Exif) -> ImageLocation | None:
    """Lê apenas coordenadas úteis e descarta o restante dos metadados EXIF."""
    try:
        gps = exif.get_ifd(GPS_INFO_EXIF_TAG)
        latitude = _gps_degrees(gps.get(2), gps.get(1))
        longitude = _gps_degrees(gps.get(4), gps.get(3))
        if latitude is None or longitude is None:
            return None

        altitude = None
        if gps.get(6) is not None:
            altitude = float(gps[6])
            altitude_reference = gps.get(5, 0)
            if isinstance(altitude_reference, bytes):
                altitude_reference = altitude_reference[0] if altitude_reference else 0
            if int(altitude_reference) == 1:
                altitude = -altitude
        return ImageLocation(
            latitude=round(latitude, 7),
            longitude=round(longitude, 7),
            altitude_m=round(altitude, 2) if altitude is not None else None,
        )
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None


def _gps_degrees(value: object, reference: object) -> float | None:
    if not isinstance(value, (tuple, list)) or len(value) != 3:
        return None
    degrees, minutes, seconds = (float(component) for component in value)
    decimal = degrees + minutes / 60 + seconds / 3600
    normalized_reference = str(reference or "").upper()
    if normalized_reference in {"S", "W"}:
        decimal = -decimal
    elif normalized_reference not in {"N", "E"}:
        return None
    return decimal
