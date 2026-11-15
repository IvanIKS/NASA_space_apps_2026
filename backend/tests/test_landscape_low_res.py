import asyncio
from pathlib import Path

from fastapi import HTTPException
import pytest

import app.service.landscape_service as landscape_service
from app.routers.positions import get_landscape_low_res
from app.schemas import LandscapeMapResponse

_APP_MOON_MAP = Path(__file__).resolve().parent.parent / "app" / "moon-map"


@pytest.fixture(scope="module")
def loaded_map():
    if not _APP_MOON_MAP.exists() or not any(_APP_MOON_MAP.glob("WAC_GLD100_*.TIF")):
        pytest.skip("GLD100 moon-map tiles not present")
    landscape_service.load_map(_APP_MOON_MAP)
    return landscape_service


def test_low_res_matches_strided_full_res(loaded_map):
    full = loaded_map.get_landscape_map(10.0, 0.0, 0.0, 10.0)
    low = loaded_map.get_landscape_map_low_res(10.0, 0.0, 0.0, 10.0, resolution_km=10.0)

    expected = full[::100, ::100]
    assert low.shape == expected.shape
    assert (low == expected).all()


def test_global_low_res_dimensions(loaded_map):
    low = loaded_map.get_landscape_map_low_res()
    # 180 deg / ~0.3298 deg ~= 546 rows, 360 deg / ~0.3298 deg ~= 1092 cols
    assert low.shape == (546, 1092)


def test_low_res_endpoint(loaded_map):
    resp = asyncio.run(
        get_landscape_low_res(
            lat_start=5.0,
            lon_start=0.0,
            lat_end=0.0,
            lon_end=5.0,
            resolution_km=10.0,
        )
    )
    assert isinstance(resp, LandscapeMapResponse)
    assert resp.resolution_km == 10.0
    assert resp.height == len(resp.data)
    assert resp.width == len(resp.data[0])
    assert resp.height > 0 and resp.width > 0

    # Verify JSON round-trip
    roundtrip = LandscapeMapResponse.model_validate_json(resp.model_dump_json())
    assert roundtrip.width == resp.width
    assert roundtrip.height == resp.height

    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_landscape_low_res(resolution_km=0.0))
    assert exc.value.status_code == 400


def test_low_res_endpoint_global(loaded_map):
    resp = asyncio.run(
        get_landscape_low_res(
            lat_start=90.0,
            lon_start=-180.0,
            lat_end=-90.0,
            lon_end=180.0,
            resolution_km=10.0,
        )
    )
    assert resp.width == 1092
    assert resp.height == 546
    assert resp.resolution_km == 10.0
