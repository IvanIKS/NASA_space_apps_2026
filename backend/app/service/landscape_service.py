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

# Equirectangular tiles covering the central +-60 deg latitude band.
_LANDSCAPE_MAP: "list[_Tile]" = []
# Polar stereographic disc tiles covering the regions beyond +-60 deg.
_POLAR_MAPS: "list[_PolarTile]" = []

_MAP_LOADED = False
_MOON_RADIUS_KM = 1737.4
_MOON_RADIUS_M = _MOON_RADIUS_KM * 1000.0
# Degrees of arc per metre on the surface, used to convert the GeoTIFF's
# equirectangular (metre) projection coordinates into lat/lon.
_DEG_PER_M = 180.0 / (math.pi * _MOON_RADIUS_M)

# The GLD100 mosaic tiles live next to the backend package, in backend/moon-map.
_MAP_DIR = Path(__file__).resolve().parent.parent.parent / "moon-map"
_TILE_GLOB = "WAC_GLD100_*.TIF"

# TIFF tag type -> (struct code, byte size).
_TIFF_TYPES = {1: ("B", 1), 3: ("H", 2), 4: ("I", 4), 12: ("d", 8)}

# GeoTIFF ProjCoordTransGeoKey value identifying a polar stereographic raster.
_CT_POLAR_STEREOGRAPHIC = 15

# Pixel value the GLD100 byte product uses for "no coverage": outside the
# polar discs and in the caps right at the poles (beyond about +-79 deg).
_NODATA = 0


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


class _PolarTile:
    """A polar GLD100 DEM tile, memory-mapped lazily like ``_Tile``.

    The raster is a square in polar stereographic projection (sphere, true
    scale at the pole, 0 deg meridian straight down for the north / up for the
    south disc). Valid data forms a disc centred on the pole whose edge meets
    the +-60 deg boundary of the equirectangular tiles; pixels outside the
    disc -- and in a cap right at the pole (beyond about +-79 deg) where the
    GLD100 has no stereo coverage -- hold the 0 nodata value.
    """

    __slots__ = (
        "path", "width", "height", "data_offset", "hemisphere",
        "m_per_px_x", "m_per_px_y", "topleft_x", "topleft_y",
        "lat_edge", "rho_clamp", "_mm",
    )

    def __init__(self, path, width, height, data_offset, hemisphere,
                 m_per_px_x, m_per_px_y, topleft_x, topleft_y):
        self.path = path
        self.width = width
        self.height = height
        self.data_offset = data_offset
        self.hemisphere = hemisphere  # +1.0 north disc, -1.0 south disc
        self.m_per_px_x = m_per_px_x
        self.m_per_px_y = m_per_px_y
        self.topleft_x = topleft_x
        self.topleft_y = topleft_y
        # Latitude (absolute) of the disc edge: where the stereographic radius
        # rho equals the raster's half-extent.
        rho_max = min(abs(topleft_x), abs(topleft_y))
        self.lat_edge = 90.0 - 2.0 * math.degrees(
            math.atan(rho_max / (2.0 * _MOON_RADIUS_M)))
        # The rasterized data circle stops a couple of pixels short of the
        # nominal disc edge; clamp sampling that far inside so points right at
        # the +-60 deg seam still land on data pixels instead of the nodata rim.
        self.rho_clamp = rho_max - 3.0 * max(m_per_px_x, m_per_px_y)
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

    def project(self, lat: float, lon: float) -> "tuple[float, float]":
        """Forward polar stereographic: lat/lon degrees -> projected metres."""
        lam = math.radians(lon)
        rho = 2.0 * _MOON_RADIUS_M * math.tan(
            math.pi / 4.0 - self.hemisphere * math.radians(lat) / 2.0)
        rho = min(rho, self.rho_clamp)
        return rho * math.sin(lam), -self.hemisphere * rho * math.cos(lam)

    def contains(self, lat: float, lon: float) -> bool:
        return self.hemisphere * lat >= self.lat_edge

    def pixel_index(self, lat: float, lon: float) -> "tuple[int, int]":
        """Return the (row, col) pixel covering the given lat/lon, clamped
        to the raster bounds."""
        x, y = self.project(lat, lon)
        col = int((x - self.topleft_x) / self.m_per_px_x)
        row = int((self.topleft_y - y) / self.m_per_px_y)
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

        # GeoKey directory (tag 34735): 4-value header, then (KeyID, TagLoc,
        # Count, Value) entries; double values live in GeoDoubleParams (34736).
        # It tells the equirectangular tiles apart from the polar ones.
        proj_ct = None
        origin_lat = None
        if 34735 in entries:
            keys = values(34735)
            doubles = values(34736) if 34736 in entries else ()
            for k in range(4, len(keys) - 3, 4):
                key_id, loc, _count, val = keys[k:k + 4]
                if key_id == 3075 and loc == 0:        # ProjCoordTransGeoKey
                    proj_ct = val
                elif key_id == 3081 and loc == 34736:  # ProjNatOriginLatGeoKey
                    origin_lat = doubles[val]

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

    return dict(
        path=path, width=width, height=height, data_offset=data_offset,
        sx=sx, sy=sy, topleft_x=topleft_x, topleft_y=topleft_y,
        proj_ct=proj_ct, origin_lat=origin_lat,
    )


def _make_tile(meta: dict):
    """Build the right tile type from raw GeoTIFF metadata: a polar
    stereographic disc for the P900 tiles, an equirectangular band otherwise."""
    if meta["proj_ct"] == _CT_POLAR_STEREOGRAPHIC:
        origin_lat = meta["origin_lat"]
        if origin_lat is None:
            raise ValueError(
                f"{meta['path'].name}: polar stereographic tile without a "
                f"ProjNatOriginLat geokey; cannot tell which pole it covers")
        return _PolarTile(
            path=meta["path"], width=meta["width"], height=meta["height"],
            data_offset=meta["data_offset"],
            hemisphere=1.0 if origin_lat >= 0 else -1.0,
            m_per_px_x=meta["sx"], m_per_px_y=meta["sy"],
            topleft_x=meta["topleft_x"], topleft_y=meta["topleft_y"],
        )

    deg_per_px_x = meta["sx"] * _DEG_PER_M
    deg_per_px_y = meta["sy"] * _DEG_PER_M
    lon_min = meta["topleft_x"] * _DEG_PER_M
    lat_max = meta["topleft_y"] * _DEG_PER_M
    return _Tile(
        path=meta["path"], width=meta["width"], height=meta["height"],
        data_offset=meta["data_offset"],
        lon_min=lon_min, lon_max=lon_min + meta["width"] * deg_per_px_x,
        lat_min=lat_max - meta["height"] * deg_per_px_y, lat_max=lat_max,
        deg_per_px_x=deg_per_px_x, deg_per_px_y=deg_per_px_y,
    )


def load_map(map_dir=None) -> "list[_Tile]":
    """Discover the GLD100 tiles and register them for lazy memory-mapping.

    Equirectangular band tiles go into ``_LANDSCAPE_MAP`` and the two polar
    stereographic discs into ``_POLAR_MAPS``. Only the small TIFF headers are
    read here; the ~473 MB of pixel data per tile is not touched until a
    tile's ``.array`` is accessed. Idempotent: a second call returns the
    already-loaded equirectangular registry without re-scanning.
    """
    global _MAP_LOADED
    if _LANDSCAPE_MAP or _POLAR_MAPS:
        return _LANDSCAPE_MAP

    base = Path(map_dir) if map_dir is not None else _MAP_DIR
    paths = sorted(base.glob(_TILE_GLOB))
    if not paths:
        dotenv_path = Path(__file__).resolve().parent.parent / ".env"
        load_dotenv(dotenv_path=dotenv_path)

        #This is dumb, but bool("False") is True in Python.
        _SHOULD_DOWNLOAD_MAP = os.getenv(_dotenv_map_var_name)
        if _SHOULD_DOWNLOAD_MAP is not None and _SHOULD_DOWNLOAD_MAP == "True":
            _download_map_from_nasa_site()
            paths = sorted(base.glob(_TILE_GLOB))
        else:
            print("No map found. Please download it from NASA site to have it available in the backend."
                  " For now all functionality related to landscape will be disabled.")
            return

    for path in paths:
        tile = _make_tile(_read_tiff_metadata(path))
        if isinstance(tile, _PolarTile):
            _POLAR_MAPS.append(tile)
        else:
            _LANDSCAPE_MAP.append(tile)
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
        #northern and southern pole areas
        "WAC_GLD100_P900N0000_100M",
        "WAC_GLD100_P900S0000_100M"
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


def _find_tile(lat: float, lon: float):
    """Return the tile covering a point: the central equirectangular band if
    it reaches the latitude, otherwise the matching polar disc."""
    if not _LANDSCAPE_MAP and not _POLAR_MAPS:
        load_map()
    lon = _normalize_lon(lon)
    for tile in _LANDSCAPE_MAP:
        if tile.contains(lat, lon):
            return tile
    for tile in _POLAR_MAPS:
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


def has_map_data(lat: float, lon: float) -> bool:
    """Whether real landscape data exists for a point: the mosaic is loaded,
    a tile covers the point, and the sampled pixel is not the nodata value
    (the GLD100 has no coverage right at the poles, beyond about +-79 deg)."""
    if not _MAP_LOADED:
        return False
    try:
        return get_elevation(lat, lon) != _NODATA
    except ValueError:
        return False


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
    # antimeridian. Rows beyond the +-60 deg equirectangular bands are
    # resampled from the polar stereographic discs onto the same grid. Returns
    # a newly-assembled (rows, cols) uint8 array; pixels with no coverage
    # anywhere (e.g. right at the poles) are left as 0 (the GLD100 nodata).
    #
    # The band tiles share one exact global equirectangular pixel grid (each is
    # exactly tile.width px per 90 deg lon and tile.height px per 60 deg lat),
    # so we resolve everything in integer global pixel coordinates and copy the
    # intersection of each tile with the request. Only the touched windows are
    # read from the memmaps.
    if not _MAP_LOADED:
        raise ValueError("Moon map is not present in folder.")

    tiles = _LANDSCAPE_MAP
    if not tiles:
        raise ValueError("No equirectangular tiles loaded; the landscape map "
                         "grid is derived from them.")
    dppx = tiles[0].deg_per_px_x
    dppy = tiles[0].deg_per_px_y
    north_top = 90.0
    global_width = int(round(360.0 / dppx))
    global_rows_total = int(round(180.0 / dppy))

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

    # Fill rows outside the equirectangular bands from the polar discs by
    # projecting every output pixel's lat/lon into the disc raster (nearest
    # neighbour). Rows are in descending latitude, so each polar region is a
    # contiguous block at the top/bottom of the output.
    if _POLAR_MAPS and out_rows and out_cols:
        equi_top = max(t.lat_max for t in tiles)
        equi_bot = min(t.lat_min for t in tiles)
        row_lats = north_top - np.arange(gr0, gr1 + 1) * dppy
        col_lons = np.empty(out_cols, dtype=np.float64)
        for gc0, gc1, dcol in col_plan:
            col_lons[dcol:dcol + gc1 - gc0 + 1] = np.arange(gc0, gc1 + 1) * dppx

        for ptile in _POLAR_MAPS:
            if ptile.hemisphere > 0:
                n = int(np.count_nonzero(row_lats > equi_top))
                sub, lats = out[:n], row_lats[:n]
            else:
                n = int(np.count_nonzero(row_lats < equi_bot))
                sub, lats = out[out_rows - n:], row_lats[out_rows - n:]
            if n == 0:
                continue
            phi = np.radians(lats)[:, None]
            lam = np.radians(col_lons)[None, :]
            rho = np.minimum(
                2.0 * _MOON_RADIUS_M * np.tan(
                    np.pi / 4.0 - ptile.hemisphere * phi / 2.0),
                ptile.rho_clamp)
            x = rho * np.sin(lam)
            y = -ptile.hemisphere * rho * np.cos(lam)
            cc = ((x - ptile.topleft_x) / ptile.m_per_px_x).astype(np.int64)
            rr = ((ptile.topleft_y - y) / ptile.m_per_px_y).astype(np.int64)
            # Only fill pixels still holding nodata, so band data already
            # copied at the seam row is never overwritten.
            fill = ((rr >= 0) & (rr < ptile.height)
                    & (cc >= 0) & (cc < ptile.width)
                    & (sub == _NODATA))
            sub[fill] = ptile.array[rr[fill], cc[fill]]
    return out
