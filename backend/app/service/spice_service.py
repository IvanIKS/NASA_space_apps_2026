"""
Thin wrapper around sun_earth_positions so the SPICE kernels are loaded once
at import time and callers only deal with plain dicts.
"""
from pathlib import Path
import numpy as np
import spiceypy as spice

import app.service.landscape_service as landscape_service

KERNEL_DIR = Path(__file__).parent.parent.parent / "kernels"

_LOADED = False

LUNAR_DAY_S = 29.530589 * 86_400  # synodic month in seconds (~29.53 Earth days)
_SUN_RADIUS_KM = 696_340.0

def load_kernels():
    global _LOADED
    if _LOADED:
        return
    for k in [
        "naif0012.tls",
        "de440s.bsp",
        "pck00011.tpc",
        "moon_de440_250416.tf",
        "moon_pa_de440_200625.bpc",
    ]:
        spice.furnsh(str(KERNEL_DIR / k))
    _LOADED = True


def _observer_frame(
    lat_deg: float, lon_deg: float, alt_km: float = 0.0
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return observer body-fixed position and local (east, north, up) unit vectors."""
    radii = spice.bodvrd("MOON", "RADII", 3)[1]
    re = radii[0]
    f = (radii[0] - radii[2]) / radii[0]
    lon, lat = np.radians(lon_deg), np.radians(lat_deg)
    obspos = spice.georec(lon, lat, alt_km, re, f)

    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    return obspos, east, north, up


def _body_elevation_deg(
    target: str,
    et: float,
    obspos: np.ndarray,
    up: np.ndarray,
    frame: str = "MOON_ME",
    abcorr: str = "LT+S",
) -> float:
    """Return apparent elevation angle (deg) of `target` above the local horizon."""
    state, _ = spice.spkcpo(target, et, frame, "OBSERVER", abcorr, obspos, "MOON", "MOON_ME")
    pos = np.array(state[:3])
    return float(np.degrees(np.arcsin(np.clip((pos @ up) / np.linalg.norm(pos), -1.0, 1.0))))


def _body_az_el_deg(
    target: str,
    et: float,
    obspos: np.ndarray,
    east: np.ndarray,
    north: np.ndarray,
    up: np.ndarray,
    frame: str = "MOON_ME",
    abcorr: str = "LT+S",
) -> tuple[float, float]:
    """Return apparent (azimuth_deg, elevation_deg) of `target` in the local ENU frame."""
    state, _ = spice.spkcpo(target, et, frame, "OBSERVER", abcorr, obspos, "MOON", "MOON_ME")
    pos = np.array(state[:3])
    r = float(np.linalg.norm(pos))
    e, n, u = float(pos @ east), float(pos @ north), float(pos @ up)
    az_deg = float(np.degrees(np.arctan2(e, n)) % 360.0)
    el_deg = float(np.degrees(np.arcsin(np.clip(u / r, -1.0, 1.0))))
    return az_deg, el_deg


def query_surface(
    utc: str,
    lat_deg: float,
    lon_deg: float,
    alt_km: float = 0.0,
    frame: str = "MOON_ME",
    abcorr: str = "LT+S",
) -> dict:
    et = spice.str2et(utc)
    obspos, east, north, up = _observer_frame(lat_deg, lon_deg, alt_km)

    result = {}
    for name in ("EARTH", "SUN"):
        state, lt = spice.spkcpo(name, et, frame, "OBSERVER", abcorr,
                                 obspos, "MOON", "MOON_ME")
        pos = np.array(state[:3])
        e, n, u = pos @ east, pos @ north, pos @ up
        result[name.lower()] = {
            "azimuth_deg": float(np.degrees(np.arctan2(e, n)) % 360),
            "elevation_deg": float(np.degrees(np.arcsin(np.clip(u / np.linalg.norm(pos), -1.0, 1.0)))),
            "range_km": float(np.linalg.norm(pos)),
            "lighttime_s": float(lt),
        }
    result["insolation_watts"] = calculate_insolation(
        utc, lat_deg, lon_deg, abcorr=abcorr, alt_km=alt_km,
        sun_az_deg=result["sun"]["azimuth_deg"],
        sun_el_deg=result["sun"]["elevation_deg"],
        sun_range_km=result["sun"]["range_km"],
    )
    et_from = et - LUNAR_DAY_S
    et_to = et + LUNAR_DAY_S
    result["insolation_graph"] = calculate_insolation_series(
        et_from, et_to, lat_deg, lon_deg, abcorr=abcorr, alt_km=alt_km
    )
    result["earth_visibility"] = earth_visibility_windows(
        lat_deg, lon_deg, et_from, et_to, alt_km=alt_km, frame=frame, abcorr=abcorr
    )
    return result

# -------------------------- INSOLATION --------------------------------------------------
def _enu_basis(lat_deg: float, lon_deg: float):
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    return east, north, up


def _sun_enu_vector(az_deg: float, el_deg: float) -> np.ndarray:
    az = np.radians(az_deg)
    el = np.radians(el_deg)
    cos_el = np.cos(el)
    return np.array([cos_el * np.sin(az), cos_el * np.cos(az), np.sin(el)])


def calculate_insolation(
    utc: str,
    latitude: float,
    longitude: float,
    abcorr: str = "LT+S",
    alt_km: float = 0.0,
    sun_az_deg: float | None = None,
    sun_el_deg: float | None = None,
    sun_range_km: float | None = None,
) -> float:
    if sun_az_deg is None or sun_el_deg is None or sun_range_km is None:
        et = spice.str2et(utc)
        radii = spice.bodvrd("MOON", "RADII", 3)[1]
        re = radii[0]
        f = (radii[0] - radii[2]) / radii[0]
        obspos = spice.georec(np.radians(longitude), np.radians(latitude), alt_km, re, f)
        east, north, up = _enu_basis(latitude, longitude)
        state, _ = spice.spkcpo("SUN", et, "MOON_ME", "OBSERVER", abcorr,
                                obspos, "MOON", "MOON_ME")
        pos = np.array(state[:3])
        sun_range_km = float(np.linalg.norm(pos))
        e, n, u = pos @ east, pos @ north, pos @ up
        sun_az_deg = float(np.degrees(np.arctan2(e, n)) % 360.0)
        sun_el_deg = float(np.degrees(np.arcsin(np.clip(u / sun_range_km, -1.0, 1.0))))

    sun_enu = _sun_enu_vector(sun_az_deg, sun_el_deg)
    normal_enu = (
        landscape_service.get_surface_normal_enu(latitude, longitude)
        if alt_km == 0.0
        else np.array([0.0, 0.0, 1.0])
    )
    cos_incidence = float(np.dot(normal_enu, sun_enu))
    if cos_incidence <= 0.0:
        return 0.0

    sun_ang_rad_deg = float(np.degrees(np.arcsin(min(1.0, _SUN_RADIUS_KM / sun_range_km))))
    vis_coeff = landscape_service.get_obstruction_coefficient(
        latitude,
        longitude,
        sun_az_deg,
        sun_el_deg,
        observer_alt_km=alt_km,
        sun_angular_radius_deg=sun_ang_rad_deg,
    )
    if vis_coeff <= 0.0:
        return 0.0

    return float(solar_constant(utc, abcorr) * cos_incidence * vis_coeff)

def calculate_zenith_angle(latitude, declination, hour_angle):
    cos_zenith = (np.sin(latitude) * np.sin(declination)) + (np.cos(latitude) * np.cos(declination) * np.cos(hour_angle))
    return np.arccos(cos_zenith)

def calculate_declination(utc: str, abcorr: str = "LT+S") -> float:
    et = spice.str2et(utc)
    pos, _ = spice.spkpos("SUN", et, "MOON_ME", abcorr, "MOON")
    pos = np.array(pos)
    return float(np.degrees(np.arcsin(pos[2] / np.linalg.norm(pos))))


def calculate_hour_angle(utc: str, lon_deg: float, abcorr: str = "LT+S") -> float:
    et = spice.str2et(utc)
    pos, _ = spice.spkpos("SUN", et, "MOON_ME", abcorr, "MOON")
    subsolar_lon_deg = np.degrees(np.arctan2(pos[1], pos[0]))
    h = lon_deg - subsolar_lon_deg
    return float(((h + 180) % 360) - 180)

def _interp_horizon(horizon_profile: np.ndarray, azimuth_deg: float) -> float:
    """Linearly interpolate a 360-degree horizon profile at azimuth_deg [0, 360)."""
    n = len(horizon_profile)
    idx_f = (azimuth_deg % 360.0) / 360.0 * n
    i0 = int(np.floor(idx_f)) % n
    i1 = (i0 + 1) % n
    frac = idx_f - np.floor(idx_f)
    return float(horizon_profile[i0] * (1.0 - frac) + horizon_profile[i1] * frac)


def calculate_insolation_series(
    et_start: float | str,
    et_end: float | str,
    latitude: float,
    longitude: float,
    step_s: float = 3600.0,
    abcorr: str = "LT+S",
    alt_km: float = 0.0,
) -> list[dict]:
    if (isinstance(et_start, str)):
        et_start = spice.str2et(et_start)
    if (isinstance(et_end, str)):
        et_end = spice.str2et(et_end)
    if (step_s <= 0):
        raise ValueError(
            f"step_s must be a positive number, got {step_s} (type: {type(step_s)})"
        )

    radii = spice.bodvrd("MOON", "RADII", 3)[1]
    re = radii[0]
    f = (radii[0] - radii[2]) / radii[0]
    obspos = spice.georec(np.radians(longitude), np.radians(latitude), alt_km, re, f)
    east, north, up = _enu_basis(latitude, longitude)

    normal_enu = (
        landscape_service.get_surface_normal_enu(latitude, longitude)
        if alt_km == 0.0
        else np.array([0.0, 0.0, 1.0])
    )
    horizon_profile = landscape_service.get_horizon_profile(
        latitude, longitude, observer_alt_km=alt_km, num_azimuths=360
    )
    s0 = solar_constant()

    results = []
    for et in np.arange(et_start, et_end + step_s, step_s):
        state, _ = spice.spkcpo("SUN", et, "MOON_ME", "OBSERVER", abcorr,
                                obspos, "MOON", "MOON_ME")
        pos = np.array(state[:3])
        r = float(np.linalg.norm(pos))
        e, n, u = pos @ east, pos @ north, pos @ up
        sun_enu = np.array([e / r, n / r, u / r])
        cos_incidence = float(np.dot(normal_enu, sun_enu))

        if cos_incidence <= 0.0:
            watts = 0.0
        else:
            if horizon_profile is not None:
                az_deg = float(np.degrees(np.arctan2(e, n)) % 360.0)
                el_deg = float(np.degrees(np.arcsin(np.clip(u / r, -1.0, 1.0))))
                sun_ang_rad_deg = float(np.degrees(np.arcsin(min(1.0, _SUN_RADIUS_KM / r))))
                horizon_deg = _interp_horizon(horizon_profile, az_deg)
                vis_coeff = landscape_service.obstruction_from_horizon(
                    horizon_deg, el_deg, sun_ang_rad_deg
                )
            else:
                vis_coeff = 1.0
            watts = float(s0 * cos_incidence * vis_coeff)

        results.append({
            "utc": spice.et2utc(et, "ISOC", 0),
            "insolation_watts": watts,
        })

    return results

def solar_constant(utc: str = "", abcorr: str = "LT+S") -> float:
    return 1367.0 #for now ignore the changes throughout the year



# -------------------------- RADIOWINDOWS --------------------------------------------------
def _refine_crossing(
    t_lo: float,
    t_hi: float,
    el_lo: float,
    threshold_deg: float,
    eval_el,
    iterations: int = 20,
) -> float:
    """Bisect [t_lo, t_hi] to locate where Earth elevation crosses threshold_deg."""
    above_lo = el_lo > threshold_deg
    for _ in range(iterations):
        t_mid = 0.5 * (t_lo + t_hi)
        if (eval_el(t_mid) > threshold_deg) == above_lo:
            t_lo = t_mid
        else:
            t_hi = t_mid
    return 0.5 * (t_lo + t_hi)


def earth_visibility_windows(
    lat_deg: float,
    lon_deg: float,
    start_utc: str | float,
    end_utc: str | float,
    alt_km: float = 0.0,
    step_s: float = 3600.0,
    min_elevation_deg: float = 0.0,
    frame: str = "MOON_ME",
    abcorr: str = "LT+S",
) -> dict:
    """Compute direct line-of-sight visibility windows of Earth from a lunar surface point."""
    et_start = spice.str2et(start_utc) if isinstance(start_utc, str) else float(start_utc)
    et_end = spice.str2et(end_utc) if isinstance(end_utc, str) else float(end_utc)
    if step_s <= 0:
        raise ValueError(f"step_s must be positive, got {step_s}")
    if et_end <= et_start:
        raise ValueError("end_utc must be strictly after start_utc")

    obspos, east, north, up = _observer_frame(lat_deg, lon_deg, alt_km)
    horizon_profile = landscape_service.get_horizon_profile(
        lat_deg, lon_deg, observer_alt_km=alt_km, num_azimuths=360
    )

    def eval_el_and_margin(et: float) -> tuple[float, float]:
        if horizon_profile is None:
            el = _body_elevation_deg("EARTH", et, obspos, up, frame=frame, abcorr=abcorr)
            return el, el - min_elevation_deg
        az, el = _body_az_el_deg("EARTH", et, obspos, east, north, up, frame=frame, abcorr=abcorr)
        threshold = max(min_elevation_deg, _interp_horizon(horizon_profile, az))
        return el, el - threshold

    def eval_margin(et: float) -> float:
        return eval_el_and_margin(et)[1]

    times = np.arange(et_start, et_end, step_s, dtype=float)
    if len(times) == 0 or times[-1] < et_end:
        times = np.append(times, et_end)

    samples = [eval_el_and_margin(float(t)) for t in times]
    elevations = [s[0] for s in samples]
    margins = [s[1] for s in samples]

    raw_windows = []
    in_view = margins[0] > 0.0
    current_rise = float(times[0]) if in_view else None
    current_max_el = elevations[0] if in_view else -90.0
    clipped_start = in_view

    for idx in range(1, len(times)):
        t_prev, m_prev = float(times[idx - 1]), margins[idx - 1]
        t_curr, m_curr = float(times[idx]), margins[idx]
        el_curr = elevations[idx]

        if not in_view and m_curr > 0.0:
            current_rise = _refine_crossing(t_prev, t_curr, m_prev, 0.0, eval_margin)
            current_max_el = el_curr
            in_view = True
        elif in_view and m_curr <= 0.0:
            set_et = _refine_crossing(t_prev, t_curr, m_prev, 0.0, eval_margin)
            raw_windows.append((current_rise, set_et, current_max_el, clipped_start, False))
            clipped_start = False
            in_view = False
        elif in_view and el_curr > current_max_el:
            current_max_el = el_curr

    if in_view and current_rise is not None:
        raw_windows.append((current_rise, float(et_end), current_max_el, clipped_start, True))

    windows = [
        {
            "rise_utc": spice.et2utc(rise_et, "ISOC", 0),
            "set_utc": spice.et2utc(set_et, "ISOC", 0),
            "duration_s": float(set_et - rise_et),
            "max_elevation_deg": float(max_el),
            "clipped_start": c_start,
            "clipped_end": c_end,
        }
        for rise_et, set_et, max_el, c_start, c_end in raw_windows
    ]

    total_visible_s = sum(w["duration_s"] for w in windows)
    span_s = float(et_end - et_start)
    visible_fraction = min(1.0, max(0.0, total_visible_s / span_s))
    always_visible = (
        len(windows) == 1 and windows[0]["clipped_start"] and windows[0]["clipped_end"]
    )
    never_visible = len(windows) == 0

    elevation_graph = [
        {
            "utc": spice.et2utc(float(t), "ISOC", 0),
            "elevation_deg": float(el),
        }
        for t, el in zip(times, elevations)
    ]

    return {
        "windows": windows,
        "total_visible_s": float(total_visible_s),
        "visible_fraction": float(visible_fraction),
        "always_visible": always_visible,
        "never_visible": never_visible,
        "elevation_graph": elevation_graph,
    }

