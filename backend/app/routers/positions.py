from fastapi import APIRouter, HTTPException, Query
from ..schemas import (
    BodyResult,
    EarthVisibilityRequest,
    EarthVisibilityResponse,
    InsolationResult,
    LandscapeMapResponse,
    SurfaceQueryRequest,
    SurfaceQueryResponse,
)
from app.service.spice_service import (
    calculate_insolation_series,
    earth_visibility_windows,
    query_surface,
)
from app.service.landscape_service import (
    get_landscape_map,
    get_landscape_map_low_res,
    has_map_data,
)

router = APIRouter(prefix="/positions", tags=["positions"])

_NO_LANDSCAPE_DATA_WARNING = ("This doesn't account for landscape since no map "
                              "data was available for this region")


@router.post("/surface", response_model=SurfaceQueryResponse)
async def surface_query(req: SurfaceQueryRequest):
    try:
        raw = query_surface(req.utc, req.lat_deg, req.lon_deg, req.alt_km)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    warnings = []
    if not has_map_data(req.lat_deg, req.lon_deg):
        warnings.append(_NO_LANDSCAPE_DATA_WARNING)

    return SurfaceQueryResponse(
        earth=BodyResult(
            azimuth_deg=raw["earth"]["azimuth_deg"],
            elevation_deg=raw["earth"]["elevation_deg"],
            range_km=raw["earth"]["range_km"],
            lighttime_s=raw["earth"]["lighttime_s"],
        ),
        sun=BodyResult(
            azimuth_deg=raw["sun"]["azimuth_deg"],
            elevation_deg=raw["sun"]["elevation_deg"],
            range_km=raw["sun"]["range_km"],
            lighttime_s=raw["sun"]["lighttime_s"],
        ),
        insolation=InsolationResult(
            insolation_watts=raw["insolation_watts"],
            insolation_graph=raw["insolation_graph"]
        ),
        earth_visibility=EarthVisibilityResponse(**raw["earth_visibility"]),
        warnings=warnings,
    )


@router.post("/earth-visibility", response_model=EarthVisibilityResponse)
async def earth_visibility(req: EarthVisibilityRequest):
    try:
        result = earth_visibility_windows(
            req.lat_deg,
            req.lon_deg,
            req.utc_from,
            req.utc_to,
            alt_km=req.alt_km,
            step_s=req.step_s,
            min_elevation_deg=req.min_elevation_deg,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return EarthVisibilityResponse(**result)


@router.get("/insolation")
async def insolation(
    utc_from: str = Query(..., example="2026-10-18T05:15:00"),
    utc_to: str = Query(..., example="2026-10-18T05:15:00"),
    lat_deg: float = Query(..., ge=-90, le=90),
    lon_deg: float = Query(..., ge=-180, le=180),
    step_s: float = Query(default=3600.0, ge=0),
):
    try:
        series = calculate_insolation_series(utc_from, utc_to, lat_deg, lon_deg, step_s)
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    return series

@router.get("/landscape")
async def get_landscape(lat_start, lon_start, lat_end, lon_end):
    try:
        return get_landscape_map(lat_start, lon_start, lat_end, lon_end)
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))


@router.get("/landscape/low-res", response_model=LandscapeMapResponse)
async def get_landscape_low_res(
    lat_start: float = Query(default=90.0, ge=-90, le=90),
    lon_start: float = Query(default=-180.0, ge=-180, le=360),
    lat_end: float = Query(default=-90.0, ge=-90, le=90),
    lon_end: float = Query(default=180.0, ge=-180, le=360),
    resolution_km: float = Query(default=10.0, gt=0),
):
    try:
        arr = get_landscape_map_low_res(
            lat_start=lat_start,
            lon_start=lon_start,
            lat_end=lat_end,
            lon_end=lon_end,
            resolution_km=resolution_km,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return LandscapeMapResponse(
        width=int(arr.shape[1]),
        height=int(arr.shape[0]),
        resolution_km=resolution_km,
        lat_start=lat_start,
        lon_start=lon_start,
        lat_end=lat_end,
        lon_end=lon_end,
        data=arr.tolist(),
    )