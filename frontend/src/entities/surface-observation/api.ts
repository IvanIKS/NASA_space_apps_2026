import type { InsolationPoint } from "@/entities/insolation";
import { postJson } from "@/shared/api";

export interface BodyResult {
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
  lighttime_s: number;
}

export interface SurfaceQueryResponse {
  earth: BodyResult;
  sun: BodyResult;
  insolation: {
    insolation_watts: number;
    insolation_graph: InsolationPoint[];
  };
}

/** Sun/Earth positions and insolation (now + ±1 lunar day series) for a point on the surface. */
export function querySurface(
  utc: string,
  lat_deg: number,
  lon_deg: number,
  alt_km = 0,
  signal?: AbortSignal
): Promise<SurfaceQueryResponse> {
  return postJson("/positions/surface", { utc, lat_deg, lon_deg, alt_km }, signal);
}
