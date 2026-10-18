from pathlib import Path
import numpy as np
import spiceypy as spice

KERNEL_DIR = Path(__file__).parent / "kernels"

for k in [
    "naif0012.tls",                  # leapseconds
    "de440s.bsp",                    # planetary/lunar ephemerides
    "pck00011.tpc",                  # body radii, constants
    "moon_de440_250416.tf",          # lunar frame kernel (defines MOON_ME, MOON_PA)
    "moon_pa_de440_200625.bpc",      # lunar orientation (high precision)
]:
    spice.furnsh(str(KERNEL_DIR / k))

class EarthSunPosition:
    def __init__(self, earth_state, sun_state):
        self.earth_pos_km =  earth_state[:3]
        self.earth_vel_kms = earth_state[3:]
        self.sun_pos_km = sun_state[:3]
        self.sun_vel_kms = sun_state[3:]

def earth_sun_from_moon(utc: str, frame: str = "J2000", abcorr: str = "NONE"):
    """
    utc — time, for example "2026-10-18T08:15:00" (UTC)
    Returns relative positions of Earth and Sun relative to the center of the Moon.
    """
    et = spice.str2et(utc)  # UTC -> ephemeride time (TDB)

    earth_state, lt_e = spice.spkezr("EARTH", et, frame, abcorr, "MOON")
    sun_state,   lt_s = spice.spkezr("SUN",   et, frame, abcorr, "MOON")

    return EarthSunPosition(earth_state, sun_state)

def earth_sun_from_moon_surface(utc, lat_deg, lon_deg, alt_km=0.0,
                                frame="MOON_ME", abcorr="LT+S"):
    """
    Position of Earth and Sun relative to a point on the Moon's surface.
    lat/lon are selenographic (degrees, east-positive longitude) in the
    Mean Earth / rotation-axis frame (MOON_ME).
    Returns positions in km in `frame`, plus local azimuth/elevation.
    """
    et = spice.str2et(utc)

    # Observer position relative to the Moon's center, in the body-fixed frame
    radii = spice.bodvrd("MOON", "RADII", 3)[1]
    re = radii[0]
    f = (radii[0] - radii[2]) / radii[0]          # ~0 for the Moon
    lon, lat = np.radians(lon_deg), np.radians(lat_deg)
    obspos = spice.georec(lon, lat, alt_km, re, f)

    out = {}
    for name in ("EARTH", "SUN"):
        # outref=frame, refloc="OBSERVER": the frame is evaluated at the observer's epoch
        state, lt = spice.spkcpo(name, et, frame, "OBSERVER", abcorr,
                                 obspos, "MOON", "MOON_ME")
        pos = np.array(state[:3])

        # Local East/North/Up basis (spherical Moon, good enough in practice)
        east  = np.array([-np.sin(lon),  np.cos(lon), 0.0])
        north = np.array([-np.sin(lat)*np.cos(lon), -np.sin(lat)*np.sin(lon), np.cos(lat)])
        up    = np.array([ np.cos(lat)*np.cos(lon),  np.cos(lat)*np.sin(lon), np.sin(lat)])

        e, n, u = pos @ east, pos @ north, pos @ up
        out[name.lower()] = {
            "pos_km": pos,
            "range_km": np.linalg.norm(pos),
            "azimuth_deg": np.degrees(np.arctan2(e, n)) % 360,
            "elevation_deg": np.degrees(np.arcsin(u / np.linalg.norm(pos))),
            "lighttime_s": lt,
        }
    return out

# Example: near Shackleton crater (south pole), 2026-10-18 05:15 UTC
res = earth_sun_from_moon_surface("2026-10-18T05:15:00", lat_deg=-89.9, lon_deg=0.0)
for body, d in res.items():
    print(body, d["pos_km"], f"az={d['azimuth_deg']:.1f} el={d['elevation_deg']:.1f}")
