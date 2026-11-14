from fastapi import APIRouter, HTTPException, Query
from ..schemas import SurfaceQueryRequest, SurfaceQueryResponse, BodyResult, InsolationResult
from app.service.spice_service import query_surface, calculate_insolation_series
from app.service.landscape_service import get_landscape_map

router = APIRouter(prefix="/positions", tags=["positions"])


@router.post("/surface", response_model=SurfaceQueryResponse)
async def surface_query(req: SurfaceQueryRequest):
    try:
        raw = query_surface(req.utc, req.lat_deg, req.lon_deg, req.alt_km)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
    )

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