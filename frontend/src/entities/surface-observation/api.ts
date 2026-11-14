import type { InsolationPoint } from "@/entities/insolation";
import { postJson } from "@/shared/api";

export interface BodyResult {
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
  lighttime_s: number;
}

export interface EarthVisibilityWindow {
  rise_utc: string;
  set_utc: string;
  duration_s: number;
  max_elevation_deg: number;
  clipped_start: boolean;
  clipped_end: boolean;
}

export interface EarthVisibilityResult {
  windows: EarthVisibilityWindow[];
  total_visible_s: number;
  visible_fraction: number;
  always_visible: boolean;
  never_visible: boolean;
}

export interface SurfaceQueryResponse {
  earth: BodyResult;
  sun: BodyResult;
  insolation: {
    insolation_watts: number;
    insolation_graph: InsolationPoint[];
  };
  earth_visibility: EarthVisibilityResult;
}

export function querySurface(
  utc: string,
  lat_deg: number,
  lon_deg: number,
  alt_km = 0,
  signal?: AbortSignal
): Promise<SurfaceQueryResponse> {
  return postJson("/positions/surface", { utc, lat_deg, lon_deg, alt_km }, signal);
}
