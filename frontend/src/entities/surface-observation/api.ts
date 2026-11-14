import type { InsolationPoint } from "@/entities/insolation";
import { getJson, postJson } from "@/shared/api";
import { shiftUtc } from "@/shared/lib";

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

export async function queryObservation(
  utc: string,
  days: number,
  lat_deg: number,
  lon_deg: number,
  signal?: AbortSignal
): Promise<SurfaceQueryResponse> {
  const [surface, graph] = await Promise.all([
    querySurface(utc, lat_deg, lon_deg, 0, signal),
    queryInsolation(utc, days, lat_deg, lon_deg, signal),
  ]);
  return { ...surface, insolation: { ...surface.insolation, insolation_graph: graph } };
}
