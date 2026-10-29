from datetime import datetime
from pydantic import BaseModel, Field


class BodyResult(BaseModel):
    azimuth_deg: float
    elevation_deg: float
    range_km: float
    lighttime_s: float

class InsolationResult(BaseModel):
    insolation_watts: float

class SurfaceQueryRequest(BaseModel):
    utc: str = Field(..., example="2026-10-18T05:15:00")
    lat_deg: float = Field(..., ge=-90, le=90)
    lon_deg: float = Field(..., ge=-180, le=180)
    alt_km: float = Field(default=0.0, ge=0)

    insolation: InsolationResult = Field(default=None)

class SurfaceQueryResponse(BaseModel):
    earth: BodyResult
    sun: BodyResult
    insolation: InsolationResult


class ObservationCreate(BaseModel):
    utc: str
    lat_deg: float
    lon_deg: float
    alt_km: float = 0.0
    label: str | None = None
    earth_az: float | None = None
    earth_el: float | None = None
    earth_range_km: float | None = None
    sun_az: float | None = None
    sun_el: float | None = None
    sun_range_km: float | None = None


class ObservationOut(ObservationCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
