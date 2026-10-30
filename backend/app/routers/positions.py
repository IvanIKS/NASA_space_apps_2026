from fastapi import APIRouter, HTTPException
from ..schemas import SurfaceQueryRequest, SurfaceQueryResponse, BodyResult, InsolationResult
from ..spice_service import query_surface

router = APIRouter(prefix="/positions", tags=["positions"])


@router.post("/surface", response_model=SurfaceQueryResponse)
def surface_query(req: SurfaceQueryRequest):
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
