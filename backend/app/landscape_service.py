import math
import os
import struct
from pathlib import Path

from dotenv import load_dotenv, dotenv_values
import numpy as np
from numpy import sqrt
import shutil
import urllib.request

_dotenv_map_var_name = "SHOULD_DOWNLOAD_MAP"

_LANDSCAPE_MAP: "list[_Tile]" = []

_MAP_LOADED = False
_MOON_RADIUS_KM = 1737.4
_MOON_RADIUS_M = _MOON_RADIUS_KM * 1000.0
# Degrees of arc per metre on the surface, used to convert the GeoTIFF's
# equirectangular (metre) projection coordinates into lat/lon.
_DEG_PER_M = 180.0 / (math.pi * _MOON_RADIUS_M)

# The GLD100 mosaic tiles live next to the backend package, in backend/moon-map.
_MAP_DIR = Path(__file__).resolve().parent.parent / "moon-map"
_TILE_GLOB = "WAC_GLD100_*.TIF"

# TIFF tag type -> (struct code, byte size).
_TIFF_TYPES = {1: ("B", 1), 3: ("H", 2), 4: ("I", 4), 12: ("d", 8)}


class _Tile:
    """A single GLD100 DEM tile, memory-mapped lazily on first access.

    The pixel data is raw, uncompressed, single-band uint8 with one row per
    strip laid out contiguously, so the whole image can be mapped as a single
    (height, width) ``np.memmap`` at a fixed byte offset. Nothing is read from
    disk until ``.array`` is touched; the OS then pages in only the rows that
    are actually indexed.
    """

    __slots__ = (
        "path", "width", "height", "data_offset",
        "lon_min", "lon_max", "lat_min", "lat_max",
        "deg_per_px_x", "deg_per_px_y", "_mm",
    )

    def __init__(self, path, width, height, data_offset,
                 lon_min, lon_max, lat_min, lat_max,
                 deg_per_px_x, deg_per_px_y):
        self.path = path
        self.width = width
        self.height = height
        self.data_offset = data_offset
        self.lon_min = lon_min
        self.lon_max = lon_max
        self.lat_min = lat_min
        self.lat_max = lat_max
        self.deg_per_px_x = deg_per_px_x
        self.deg_per_px_y = deg_per_px_y
        self._mm = None

    @property
    def array(self) -> np.memmap:
        """The tile's pixel data as a lazily-created read-only memmap."""
        if self._mm is None:
            self._mm = np.memmap(
                self.path, dtype=np.uint8, mode="r",
                offset=self.data_offset, shape=(self.height, self.width),
            )
        return self._mm

    def contains(self, lat: float, lon: float) -> bool:
        return (self.lat_min <= lat <= self.lat_max
                and self.lon_min <= lon <= self.lon_max)

    def pixel_index(self, lat: float, lon: float) -> "tuple[int, int]":
        """Return the (row, col) pixel covering the given lat/lon, clamped
        to the tile bounds."""
        col = int((lon - self.lon_min) / self.deg_per_px_x)
        row = int((self.lat_max - lat) / self.deg_per_px_y)
        col = min(max(col, 0), self.width - 1)
        row = min(max(row, 0), self.height - 1)
        return row, col


def _read_tiff_metadata(path: Path) -> dict:
    """Parse just enough of the (classic, uncompressed) GeoTIFF header to
    locate the pixel data and derive geographic bounds. Avoids a GDAL/rasterio
    dependency for what is a very regular, known file layout."""
    with open(path, "rb") as fh:
        header = fh.read(8)
        if header[:2] == b"II":
            bo = "<"
        elif header[:2] == b"MM":
            bo = ">"
        else:
            raise ValueError(f"Not a TIFF file: {path}")
        if struct.unpack(bo + "H", header[2:4])[0] != 42:
            raise ValueError(f"Unsupported TIFF variant (BigTIFF?): {path}")

        ifd_offset = struct.unpack(bo + "I", header[4:8])[0]
        fh.seek(ifd_offset)
        entry_count = struct.unpack(bo + "H", fh.read(2))[0]
        entries = {}
        for _ in range(entry_count):
            tag, typ, count = struct.unpack(bo + "HHI", fh.read(8))
            entries[tag] = (typ, count, fh.read(4))

        def values(tag):
            typ, count, raw = entries[tag]
            code, size = _TIFF_TYPES[typ]
            total = size * count
            if total <= 4:
                buf = raw[:total]
            else:
                off = struct.unpack(bo + "I", raw)[0]
                here = fh.tell()
                fh.seek(off)
                buf = fh.read(total)
                fh.seek(here)
            return struct.unpack(bo + str(count) + code, buf)

        width = values(256)[0]
        height = values(257)[0]
        bits = values(258)[0]
        compression = values(259)[0]
        samples = values(277)[0] if 277 in entries else 1
        strip_offsets = values(273)
        strip_bytecounts = values(279)
        pixel_scale = values(33550)   # ModelPixelScaleTag: (sx, sy, sz)
        tiepoint = values(33922)      # ModelTiepointTag: (i, j, k, X, Y, Z)

    if not (bits == 8 and samples == 1 and compression == 1):
        raise ValueError(
            f"{path.name}: expected 8-bit, single-band, uncompressed raster "
            f"(got bits={bits}, samples={samples}, compression={compression})"
        )

    data_offset = strip_offsets[0]
    # A single whole-image memmap is only valid when the strips sit back to
    # back with no gaps or padding.
    row_bytes = width * samples
    contiguous = (all(b == row_bytes for b in strip_bytecounts)
                  and all(off == data_offset + i * row_bytes
                          for i, off in enumerate(strip_offsets)))
    if not contiguous:
        raise ValueError(f"{path.name}: strips are not contiguous; cannot memmap as one block")

    sx, sy = pixel_scale[0], pixel_scale[1]
    i, j, _k, model_x, model_y = tiepoint[:5]
    # Model (projected, metre) coordinates of the top-left pixel (0, 0).
    topleft_x = model_x - i * sx
    topleft_y = model_y + j * sy

    deg_per_px_x = sx * _DEG_PER_M
    deg_per_px_y = sy * _DEG_PER_M
    lon_min = topleft_x * _DEG_PER_M
    lat_max = topleft_y * _DEG_PER_M
    lon_max = lon_min + width * deg_per_px_x
    lat_min = lat_max - height * deg_per_px_y

    return dict(
        path=path, width=width, height=height, data_offset=data_offset,
        lon_min=lon_min, lon_max=lon_max, lat_min=lat_min, lat_max=lat_max,
        deg_per_px_x=deg_per_px_x, deg_per_px_y=deg_per_px_y,
    )


def load_map(map_dir=None) -> "list[_Tile]":
    """Discover the GLD100 tiles and register them for lazy memory-mapping.

    Only the small TIFF headers are read here; the ~473 MB of pixel data per
    tile is not touched until a tile's ``.array`` is accessed. Idempotent: a
    second call returns the already-loaded registry without re-scanning.
    """
    global _MAP_LOADED
    if _LANDSCAPE_MAP:
        return _LANDSCAPE_MAP

    base = Path(map_dir) if map_dir is not None else _MAP_DIR
    paths = sorted(base.glob(_TILE_GLOB))
    if not paths:
        dotenv_path = Path(__file__).resolve().parent.parent / ".env"
        load_dotenv(dotenv_path=dotenv_path)
        _SHOULD_DOWNLOAD_MAP = bool(os.getenv(_dotenv_map_var_name))
        if _SHOULD_DOWNLOAD_MAP is not None and _SHOULD_DOWNLOAD_MAP:
            _download_map_from_nasa_site()
            paths = sorted(base.glob(_TILE_GLOB))
        else:
            print("No map found. Please download it from NASA site to have it available in the backend."
                  " For now all functionality related to landscape will be disabled.")
            return

    for path in paths:
        _LANDSCAPE_MAP.append(_Tile(**_read_tiff_metadata(path)))
    _MAP_LOADED = True
    return _LANDSCAPE_MAP


def _download_map_from_nasa_site():
    """Download the GLD100 mosaic tiles from the NASA LROC site into
    ``moon-map``.

    https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_GLD100/
    """

    file_server_url = "https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_GLD100/"

    required_map_addresses = [
        "WAC_GLD100_E300N2250_100M",
        "WAC_GLD100_E300N3150_100M",
        "WAC_GLD100_E300N0450_100M",
        "WAC_GLD100_E300N1350_100M",
        "WAC_GLD100_E300S2250_100M",
        "WAC_GLD100_E300S3150_100M",
        "WAC_GLD100_E300S0450_100M",
        "WAC_GLD100_E300S1350_100M",
    ]

    _MAP_DIR.mkdir(parents=True, exist_ok=True)

    for address in required_map_addresses:
        # The BROWSE path serves the raster at "<name>.TIF" (and 302-redirects
        # to NASA's S3 store, which urlopen follows automatically).
        url = file_server_url + address + ".TIF"
        # Name the file so load_map()'s WAC_GLD100_*.TIF glob picks it up.
        dest = _MAP_DIR / f"{address}.TIF"
        if dest.exists():
            print(f"Already have {dest.name}, skipping.")
            continue

        print(f"Downloading {url} -> {dest.name}")
        tmp = dest.with_suffix(dest.suffix + ".part")
        try:
            with urllib.request.urlopen(url) as response, open(tmp, "wb") as fh:
                # Fail loudly on an error/redirect page rather than saving HTML
                # into a .TIF (which later trips the TIFF magic-byte check).
                magic = response.read(2)
                if magic not in (b"II", b"MM"):
                    raise ValueError(
                        f"{url} did not return a TIFF (first bytes {magic!r}); "
                        f"got content-type {response.headers.get('Content-Type')!r}"
                    )
                fh.write(magic)
                shutil.copyfileobj(response, fh)
            tmp.replace(dest)
        except Exception as exc:
            if tmp.exists():
                tmp.unlink()
            print(f"Failed to download {url}: {exc}")
            raise



def _normalize_lon(lon: float) -> float:
    """Normalize longitude into the tiles' [0, 360) east-positive range."""
    return lon % 360.0


def _find_tile(lat: float, lon: float) -> _Tile:
    if not _LANDSCAPE_MAP:
        load_map()
    lon = _normalize_lon(lon)
    for tile in _LANDSCAPE_MAP:
        if tile.contains(lat, lon):
            return tile
    raise ValueError(f"No tile covers lat={lat}, lon={lon}")


def get_elevation(lat: float, lon: float) -> int:
    """Return the raw 8-bit DEM value at a lat/lon via the lazy memmap.

    NOTE: this is the product's byte-scaled value, not metres. Converting to a
    true height needs the dataset's byte->metre scale/offset (TODO)."""
    if not _MAP_LOADED:
        raise ValueError("Moon map is not present in folder.")

    lon = _normalize_lon(lon)
    tile = _find_tile(lat, lon)
    row, col = tile.pixel_index(lat, lon)
    return int(tile.array[row, col])


"""This function returns the maximum distance to a landscape point that the sun could be obstructed by
base on the altitude of observer and possible height of the landscape objects that could rise from
beyond the horizon."""
def _get_max_distance_to_obstructing_landscape_point(alt_km: float) -> float:
    horizon_distance = sqrt(alt_km * ((2 * _MOON_RADIUS_KM) + alt_km))
    # A distance beyond the horizon where high mountains and crater walls could still be visible because of how high they are.
    # TODO : Calculate it somehow.
    distance_beyond_horizon = 0
    return horizon_distance + distance_beyond_horizon


"""
When a sun is above the horizon, the sun's obstruction coefficient is 1.
When a sun is below the horizon, the sun's obstruction coefficient is 0.
Horizon could be different depending on landscape: there could be mountains,
crater walls, etc.
If sun is setting just above the horizon we try to calculate which part of it is obstructed.
EARTH OBSTRUCTION COEFFICIENT IS NOT IMPLEMENTED YET AND IS OUT OF SCOPE OF THIS COMMIT.
"""
def get_obstruction_coefficient(lat, lon, azimuth, elevation, observer_alt_km=0) -> float:
    if not _MAP_LOADED:
        return 1

    distance_on_map = _get_max_distance_to_obstructing_landscape_point(observer_alt_km)
    # 1. Get all points on map that are within distance_on_map from observer in the direction of sun azimuth.
    # 2. Get all points that have higher alt than observer_alt_km.
    # 3. For each point higher alt than observer_alt_km:
    #    3.1. point.alt is cathetus, distance to point is cathetus.
    #    Sun elevation angle where sun stops being visible is atan(point.alt/distance to point) - sun size on the sky. Denote it as min_visibility_angle.
    #    angles_above_min = min_visibility_angle - sun_size_on_the_sky.
    #    max_obs_coefficient = angles_above_min / (sun_size) or previous max_obs_coefficient if it's larger.
    #    If coefficient is < 0, set in to 0. If coefficient is > 1, set it to 1.
    #    If at any point min_coefficient is < 0, return 0.
    #4. return coefficient -- we should return the maximum coefficient.
    return 1


"""
Returns a map of landscape points that are within the given area,
where lat_start, lon_start are the top left corner of the area.
"""
def get_landscape_map(lat_start, lon_start, lat_end, lon_end):
    # Stitches across tile boundaries: the requested box may span the equator
    # (north/south tiles), a 90 deg longitude seam, or wrap across the 0/360
    # antimeridian. Returns a newly-assembled (rows, cols) uint8 array; pixels
    # outside the mosaic's +-60 deg coverage are left as 0 (the GLD100 nodata).
    #
    # All tiles share one exact global equirectangular pixel grid (each band is
    # exactly tile.width px per 90 deg lon and tile.height px per 60 deg lat),
    # so we resolve everything in integer global pixel coordinates and copy the
    # intersection of each tile with the request. Only the touched windows are
    # read from the memmaps.
    if not _MAP_LOADED:
        raise ValueError("Moon map is not present in folder.")

    if not _LANDSCAPE_MAP:
        load_map()
    tiles = _LANDSCAPE_MAP
    dppx = tiles[0].deg_per_px_x
    dppy = tiles[0].deg_per_px_y
    north_top = max(t.lat_max for t in tiles)
    global_width = int(round(360.0 / dppx))
    global_rows_total = max(int(round((north_top - t.lat_max) / dppy)) + t.height
                            for t in tiles)

    def to_col(lon):
        # Expects lon already in [0, 360]; the 360 endpoint must map to the east
        # edge rather than wrapping back to column 0.
        return int(round(lon / dppx))

    def to_row(lat):
        return int(round((north_top - lat) / dppy))

    # Row range (inclusive), clamped to the mosaic's latitude coverage.
    lat_hi, lat_lo = max(lat_start, lat_end), min(lat_start, lat_end)
    gr0 = min(max(to_row(lat_hi), 0), global_rows_total - 1)
    gr1 = min(max(to_row(lat_lo), 0), global_rows_total - 1)
    out_rows = gr1 - gr0 + 1

    # Longitude segments, split so each is monotonic (handles 0/360 wrap).
    span = lon_end - lon_start
    if abs(span) >= 360.0:
        segments = [(0.0, 360.0)]
    else:
        west, east = _normalize_lon(lon_start), _normalize_lon(lon_end)
        segments = [(west, 360.0), (0.0, east)] if east < west else [(west, east)]

    # Lay the segments out side by side across the output columns.
    col_plan = []  # (global_col_start, global_col_end_inclusive, dst_col_start)
    dst_col = 0
    for west, east in segments:
        gc0 = min(max(to_col(west), 0), global_width - 1)
        gc1 = min(max(to_col(east), 0), global_width - 1)
        if gc1 < gc0:
            continue
        col_plan.append((gc0, gc1, dst_col))
        dst_col += gc1 - gc0 + 1
    out_cols = dst_col

    out = np.zeros((out_rows, out_cols), dtype=np.uint8)

    for tile in tiles:
        tgr0, tgc0 = to_row(tile.lat_max), to_col(tile.lon_min)
        tgr1, tgc1 = tgr0 + tile.height - 1, tgc0 + tile.width - 1
        rr0, rr1 = max(gr0, tgr0), min(gr1, tgr1)
        if rr0 > rr1:
            continue
        for gc0, gc1, dcol in col_plan:
            cc0, cc1 = max(gc0, tgc0), min(gc1, tgc1)
            if cc0 > cc1:
                continue
            out[rr0 - gr0:rr1 - gr0 + 1,
                dcol + cc0 - gc0:dcol + cc1 - gc0 + 1] = \
                tile.array[rr0 - tgr0:rr1 - tgr0 + 1, cc0 - tgc0:cc1 - tgc0 + 1]
    return out
