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
    rise_utc: str
    set_utc: str
    duration_s: float
    max_elevation_deg: float
    clipped_start: bool = False
    clipped_end: bool = False


class EarthElevationPoint(BaseModel):
    utc: str
    elevation_deg: float


class EarthVisibilityResponse(BaseModel):
    windows: list[RadioWindowResult]
    total_visible_s: float
    visible_fraction: float
    always_visible: bool
    never_visible: bool
    elevation_graph: list[EarthElevationPoint] = []


class EarthVisibilityRequest(BaseModel):
    utc_from: str = Field(..., example="2026-10-18T05:15:00")
    utc_to: str = Field(..., example="2026-11-17T05:15:00")
    lat_deg: float = Field(..., ge=-90, le=90)
    lon_deg: float = Field(..., ge=-180, le=180)
    alt_km: float = Field(default=0.0, ge=0)
    step_s: float = Field(default=3600.0, gt=0)
    min_elevation_deg: float = Field(default=0.0, ge=-90, le=90)

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
    earth_visibility: EarthVisibilityResponse


