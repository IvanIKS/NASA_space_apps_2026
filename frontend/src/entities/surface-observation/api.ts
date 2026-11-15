import type { InsolationPoint } from "@/entities/insolation";
import { getJson, postJson } from "@/shared/api";
import { shiftUtc } from "@/shared/lib";

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

export interface EarthElevationPoint {
  utc: string;
  elevation_deg: number;
}

export interface EarthVisibilityResult {
  windows: EarthVisibilityWindow[];
  total_visible_s: number;
  visible_fraction: number;
  always_visible: boolean;
  never_visible: boolean;
  elevation_graph: EarthElevationPoint[];
}

export interface SlopeResult {
  slope_deg: number;
  aspect_deg: number;
}

export interface SurfaceQueryResponse {
  earth: BodyResult;
  sun: BodyResult;
  insolation: {
    insolation_watts: number;
    insolation_graph: InsolationPoint[];
  };
  earth_visibility: EarthVisibilityResult;
  slope: SlopeResult | null;
}

export const GRAPH_STEP_S = 3600;

export function querySurface(
  utc: string,
  lat_deg: number,
  lon_deg: number,
  alt_km = 0,
  signal?: AbortSignal
): Promise<SurfaceQueryResponse> {
  return postJson("/positions/surface", { utc, lat_deg, lon_deg, alt_km }, signal);
}

export function queryInsolation(
  utc: string,
  days: number,
  lat_deg: number,
  lon_deg: number,
  signal?: AbortSignal
): Promise<InsolationPoint[]> {
  const half = (days * 24) / 2;
  return getJson(
    "/positions/insolation",
    { utc_from: shiftUtc(utc, -half), utc_to: shiftUtc(utc, half), lat_deg, lon_deg, step_s: GRAPH_STEP_S },
    signal
  );
}

export function queryEarthVisibility(
  utc: string,
  days: number,
  lat_deg: number,
  lon_deg: number,
  signal?: AbortSignal
): Promise<EarthVisibilityResult> {
  const half = (days * 24) / 2;
  return postJson(
    "/positions/earth-visibility",
    { utc_from: shiftUtc(utc, -half), utc_to: shiftUtc(utc, half), lat_deg, lon_deg, step_s: GRAPH_STEP_S },
    signal
  );
}

export async function queryObservation(
  utc: string,
  days: number,
  lat_deg: number,
  lon_deg: number,
  signal?: AbortSignal
): Promise<SurfaceQueryResponse> {
  const [surface, graph, earth_visibility] = await Promise.all([
    querySurface(utc, lat_deg, lon_deg, 0, signal),
    queryInsolation(utc, days, lat_deg, lon_deg, signal),
    queryEarthVisibility(utc, days, lat_deg, lon_deg, signal),
  ]);
  return { ...surface, insolation: { ...surface.insolation, insolation_graph: graph }, earth_visibility };
}
