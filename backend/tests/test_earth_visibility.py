import asyncio
import sys
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parent.parent / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

import app.service.spice_service as spice_service  # noqa: E402
from app.routers.positions import earth_visibility, surface_query  # noqa: E402
from app.schemas import EarthVisibilityRequest, SurfaceQueryRequest  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _load_spice():
    spice_service.load_kernels()


def test_nearside_always_visible():
    res = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=0.0,
        start_utc="2026-10-01T00:00:00",
        end_utc="2026-10-31T00:00:00",
    )
    assert res["always_visible"] is True
    assert res["never_visible"] is False
    assert res["visible_fraction"] == pytest.approx(1.0)
    assert len(res["windows"]) == 1
    w = res["windows"][0]
    assert w["clipped_start"] is True
    assert w["clipped_end"] is True
    assert w["max_elevation_deg"] > 70.0


def test_farside_never_visible():
    res = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=180.0,
        start_utc="2026-10-01T00:00:00",
        end_utc="2026-10-31T00:00:00",
    )
    assert res["always_visible"] is False
    assert res["never_visible"] is True
    assert res["visible_fraction"] == 0.0
    assert res["total_visible_s"] == 0.0
    assert res["windows"] == []


def test_limb_libration_windows_and_boundary_accuracy():
    res = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=88.0,
        start_utc="2026-09-18T05:15:00",
        end_utc="2026-11-17T05:15:00",
    )
    assert res["always_visible"] is False
    assert res["never_visible"] is False
    assert 0.0 < res["visible_fraction"] < 1.0
    assert len(res["windows"]) >= 1
    assert len(res["elevation_graph"]) > 100
    assert any(p["elevation_deg"] > 0 for p in res["elevation_graph"])
    assert any(p["elevation_deg"] <= 0 for p in res["elevation_graph"])

    obspos, _, _, up = spice_service._observer_frame(0.0, 88.0, 0.0)
    for w in res["windows"]:
        assert w["duration_s"] > 0
        assert w["max_elevation_deg"] > 0.0
        if not w["clipped_start"]:
            el_rise = spice_service._body_elevation_deg(
                "EARTH", spice_service.spice.str2et(w["rise_utc"]), obspos, up
            )
            assert abs(el_rise) < 0.05
        if not w["clipped_end"]:
            el_set = spice_service._body_elevation_deg(
                "EARTH", spice_service.spice.str2et(w["set_utc"]), obspos, up
            )
            assert abs(el_set) < 0.05


def test_min_elevation_threshold():
    res_zero = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=85.0,
        start_utc="2026-10-01T00:00:00",
        end_utc="2026-10-31T00:00:00",
        min_elevation_deg=0.0,
    )
    res_high = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=85.0,
        start_utc="2026-10-01T00:00:00",
        end_utc="2026-10-31T00:00:00",
        min_elevation_deg=10.0,
    )
    assert res_high["total_visible_s"] < res_zero["total_visible_s"]


def test_invalid_arguments():
    with pytest.raises(ValueError):
        spice_service.earth_visibility_windows(0.0, 0.0, "2026-10-02T00:00:00", "2026-10-01T00:00:00")
    with pytest.raises(ValueError):
        spice_service.earth_visibility_windows(0.0, 0.0, "2026-10-01T00:00:00", "2026-10-02T00:00:00", step_s=0)


def test_api_endpoints():
    res1 = asyncio.run(
        earth_visibility(
            EarthVisibilityRequest(
                utc_from="2026-09-18T05:15:00",
                utc_to="2026-11-17T05:15:00",
                lat_deg=0.0,
                lon_deg=88.0,
            )
        )
    )
    assert len(res1.windows) >= 1
    assert 0.0 < res1.visible_fraction < 1.0

    res2 = asyncio.run(
        surface_query(
            SurfaceQueryRequest(
                utc="2026-10-18T05:15:00",
                lat_deg=0.0,
                lon_deg=88.0,
            )
        )
    )
    assert len(res2.earth_visibility.windows) >= 1
    assert 0.0 < res2.earth_visibility.visible_fraction < 1.0


def test_landscape_horizon_obstruction(monkeypatch):
    res_flat = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=85.0,
        start_utc="2026-10-01T00:00:00",
        end_utc="2026-10-31T00:00:00",
    )

    monkeypatch.setattr(
        spice_service.landscape_service,
        "get_horizon_profile",
        lambda *args, **kwargs: [10.0] * 360,
    )
    res_obstructed = spice_service.earth_visibility_windows(
        lat_deg=0.0,
        lon_deg=85.0,
        start_utc="2026-10-01T00:00:00",
        end_utc="2026-10-31T00:00:00",
    )
    assert res_obstructed["total_visible_s"] < res_flat["total_visible_s"]
