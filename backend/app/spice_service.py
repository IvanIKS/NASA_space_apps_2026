"""
Thin wrapper around sun_earth_positions so the SPICE kernels are loaded once
at import time and callers only deal with plain dicts.
"""
from pathlib import Path
import numpy as np
import spiceypy as spice

KERNEL_DIR = Path(__file__).parent.parent / "kernels"

_LOADED = False

LUNAR_DAY_S = 29.530589 * 86_400  # synodic month in seconds (~29.53 Earth days)

def _ensure_kernels():
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


def query_surface(
    utc: str,
    lat_deg: float,
    lon_deg: float,
    alt_km: float = 0.0,
    frame: str = "MOON_ME",
    abcorr: str = "LT+S",
) -> dict:
    _ensure_kernels()
    et = spice.str2et(utc)

    radii = spice.bodvrd("MOON", "RADII", 3)[1]
    re = radii[0]
    f = (radii[0] - radii[2]) / radii[0]
    lon, lat = np.radians(lon_deg), np.radians(lat_deg)
    obspos = spice.georec(lon, lat, alt_km, re, f)

    east  = np.array([-np.sin(lon),  np.cos(lon), 0.0])
    north = np.array([-np.sin(lat)*np.cos(lon), -np.sin(lat)*np.sin(lon), np.cos(lat)])
    up    = np.array([ np.cos(lat)*np.cos(lon),  np.cos(lat)*np.sin(lon), np.sin(lat)])

    result = {}
    for name in ("EARTH", "SUN"):
        state, lt = spice.spkcpo(name, et, frame, "OBSERVER", abcorr,
                                 obspos, "MOON", "MOON_ME")
        pos = np.array(state[:3])
        e, n, u = pos @ east, pos @ north, pos @ up
        result[name.lower()] = {
            "azimuth_deg": float(np.degrees(np.arctan2(e, n)) % 360),
            "elevation_deg": float(np.degrees(np.arcsin(u / np.linalg.norm(pos)))),
            "range_km": float(np.linalg.norm(pos)),
            "lighttime_s": float(lt),
        }

    result["insolation_watts"] = calculate_insolation(utc, lat_deg, lon_deg)
    et_from = et - LUNAR_DAY_S
    et_to = et + LUNAR_DAY_S
    result["insolation_graph"] = calculate_insolation_series(
        et_from, et_to, lat_deg, lon_deg
    )
    return result

# -------------------------- INSOLATION --------------------------------------------------
def calculate_insolation(utc: str, latitude : float,  longitude : float, abcorr: str = "LT+S") -> float:
    zenith_angle = calculate_zenith_angle(
        np.radians(latitude),
        np.radians(calculate_declination(utc, abcorr)),
        np.radians(calculate_hour_angle(utc, longitude, abcorr)),
    )
    cos_zenith = np.cos(zenith_angle)
    print(cos_zenith, zenith_angle)
    if cos_zenith < 0:
        return 0.0
    else:
        return solar_constant(utc, abcorr) * cos_zenith

def calculate_zenith_angle(latitude, declination, hour_angle):
    cos_zenith = (np.sin(latitude) * np.sin(declination)) + (np.cos(latitude) * np.cos(declination) * np.cos(hour_angle))
    return np.arccos(cos_zenith)

def calculate_declination(utc: str, abcorr: str = "LT+S") -> float:
    _ensure_kernels()
    et = spice.str2et(utc)
    pos, _ = spice.spkpos("SUN", et, "MOON_ME", abcorr, "MOON")
    pos = np.array(pos)
    return float(np.degrees(np.arcsin(pos[2] / np.linalg.norm(pos))))


def calculate_hour_angle(utc: str, lon_deg: float, abcorr: str = "LT+S") -> float:
    _ensure_kernels()
    et = spice.str2et(utc)
    pos, _ = spice.spkpos("SUN", et, "MOON_ME", abcorr, "MOON")
    subsolar_lon_deg = np.degrees(np.arctan2(pos[1], pos[0]))
    h = lon_deg - subsolar_lon_deg
    return float(((h + 180) % 360) - 180)

def calculate_insolation_series(
    et_start: float | str,
    et_end: float | str,
    latitude: float,
    longitude: float,
    step_s: float = 3600.0,
    abcorr: str = "LT+S",
) -> list[dict]:
    _ensure_kernels()

    if (isinstance(et_start, str)):
        et_start = spice.str2et(et_start)
    if (isinstance(et_end, str)):
        et_end = spice.str2et(et_end)
    if (step_s <= 0):
        raise ValueError(
            f"step_s must be a positive number, got {step_s} (type: {type(step_s)})"
        )

    lat_rad  = np.radians(latitude)

    results = []
    for et in np.arange(et_start, et_end + step_s, step_s):
        pos, _ = spice.spkpos("SUN", et, "MOON_ME", abcorr, "MOON")
        pos = np.array(pos)

        declination_rad = np.arcsin(pos[2] / np.linalg.norm(pos))
        h_deg = ((longitude - np.degrees(np.arctan2(pos[1], pos[0])) + 180) % 360) - 180
        zenith_angle = calculate_zenith_angle(lat_rad, declination_rad, np.radians(h_deg))
        cos_zenith = np.cos(zenith_angle)

        results.append({
            "utc": spice.et2utc(et, "ISOC", 0),
            "insolation_watts": 0.0 if cos_zenith < 0 else float(solar_constant() * cos_zenith),
        })

    return results

def solar_constant(utc: str = "", abcorr: str = "LT+S") -> float:
    return 1367.0 #for now ignore the changes throughout the year



# -------------------------- RADIOWINDOWS --------------------------------------------------
def earth_visibility_windows(lat_deg, lon_deg, start_utc, end_utc, step_s=3600):
    _ensure_kernels()
    et_start = spice.str2et(start_utc)
    et_end   = spice.str2et(end_utc)
    times = np.arange(et_start, et_end, step_s)
    windows = []
    in_view = False
    """
    for et in times: 
        utc = spice.et2utc(et, "ISOC", 0)
        el = query_surface(utc, lat_deg, lon_deg)["earth"]["elevation_deg"]
        if el > 0 and not in_view:
            windows.append({"rise": utc})
            in_view = True
        elif el <= 0 and in_view:
            windows[-1]["set"] = utc
            in_view = False
    """
    return windows

