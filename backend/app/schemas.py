from pydantic import BaseModel, Field


class BodyResult(BaseModel):
    azimuth_deg: float
    elevation_deg: float
    range_km: float
    lighttime_s: float

class InsolationResult(BaseModel):
    insolation_watts: float
    insolation_graph: list[dict]

class RadioWindowResult(BaseModel):
    pass

class SurfaceQueryRequest(BaseModel):
    utc: str = Field(..., example="2026-10-18T05:15:00")
    lat_deg: float = Field(..., ge=-90, le=90)
    lon_deg: float = Field(..., ge=-180, le=180)
    alt_km: float = Field(default=0.0, ge=0)

class InsolationRequest(BaseModel):
    utc_from: str = Field(..., example="2026-10-18T05:15:00")
    utc_to: str = Field(..., example="2026-10-18T05:15:00")
    lat_deg: float = Field(..., ge=-90, le=90)
    lon_deg: float = Field(..., ge=-180, le=180)
    step_s: float = Field(default=3600.0, ge=0)


class SurfaceQueryResponse(BaseModel):
    earth: BodyResult
    sun: BodyResult
    insolation: InsolationResult


