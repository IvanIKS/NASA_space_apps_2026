"""
Thin wrapper around sun_earth_positions so the SPICE kernels are loaded once
at import time and callers only deal with plain dicts.
"""
from pathlib import Path
import numpy as np
import spiceypy as spice

KERNEL_DIR = Path(__file__).parent.parent / "kernels"

_LOADED = False


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

    return result


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

def solar_constant(utc: str, abcorr: str = "LT+S") -> float:
    return 1367.0 #for now ignore the changes throughout the year



