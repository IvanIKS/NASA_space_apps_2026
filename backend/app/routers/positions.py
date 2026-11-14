from fastapi import APIRouter, HTTPException
from ..schemas import (
    BodyResult,
    EarthVisibilityRequest,
    EarthVisibilityResponse,
    InsolationRequest,
    InsolationResult,
    SurfaceQueryRequest,
    SurfaceQueryResponse,
)
from service.spice_service import (
    calculate_insolation_series,
    earth_visibility_windows,
    query_surface,
)

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
        earth_visibility=EarthVisibilityResponse(**raw["earth_visibility"]),
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
async def insolation(req: InsolationRequest):
    try:
        series = calculate_insolation_series(req.utc_from, req.utc_to, req.lat_deg, req.lon_deg, req.step_s)
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    return series

