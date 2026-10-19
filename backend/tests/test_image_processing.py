from __future__ import annotations

from backend.app.image_processing import GPS_INFO_EXIF_TAG, _extract_gps, _gps_degrees


def test_gps_degrees_handles_hemispheres() -> None:
    assert _gps_degrees((23, 33, 0), "S") == -23.55
    assert _gps_degrees((46, 38, 0), "W") == -(46 + 38 / 60)
    assert _gps_degrees((23, 33, 0), "N") == 23.55


def test_gps_degrees_rejects_invalid_reference() -> None:
    assert _gps_degrees((23, 33, 0), None) is None
    assert _gps_degrees((23, 33), "S") is None


def test_extract_gps_returns_minimized_location() -> None:
    class FakeExif:
        def get_ifd(self, tag: int) -> dict[int, object]:
            assert tag == GPS_INFO_EXIF_TAG
            return {
                1: "S",
                2: (23, 33, 0),
                3: "W",
                4: (46, 38, 0),
                5: b"\x00",
                6: 642,
            }

    location = _extract_gps(FakeExif())  # type: ignore[arg-type]
    assert location is not None
    assert location.latitude == -23.55
    assert location.longitude == -46.6333333
    assert location.altitude_m == 642
    assert location.source == "exif"
