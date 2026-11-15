from pydantic import BaseModel, Field


class BodyResult(BaseModel):
    azimuth_deg: float
    elevation_deg: float
    range_km: float
    lighttime_s: float

class InsolationResult(BaseModel):
    insolation_watts: float
    insolation_graph: list[dict]

class SlopeResult(BaseModel):
    slope_deg: float
    aspect_deg: float


class RadioWindowResult(BaseModel):
    pass

class SurfaceQueryRequest(BaseModel):
    utc: str = Field(..., example="2026-10-18T05:15:00")
    lat_deg: float = Field(..., ge=-90, le=90)
    lon_deg: float = Field(..., ge=-180, le=180)
    alt_km: float = Field(default=0.0, ge=0)

class SurfaceQueryResponse(BaseModel):
    earth: BodyResult
    sun: BodyResult
    insolation: InsolationResult
    slope: SlopeResult | None = None
    warnings: list[str] = []


