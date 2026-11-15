import { getJson } from "@/shared/api";

export interface LandscapeGrid {
  width: number;
  height: number;
  resolution_km: number;
  lat_start: number;
  lon_start: number;
  lat_end: number;
  lon_end: number;
  data: number[][];
}

export function queryLowResLandscape(resolutionKm: number, signal?: AbortSignal): Promise<LandscapeGrid> {
  return getJson("/positions/landscape/low-res", { resolution_km: resolutionKm, lon_start: 0, lon_end: 360 }, signal);
}
