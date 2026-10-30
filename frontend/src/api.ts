const BASE = "/api";

export interface BodyResult {
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
  lighttime_s: number;
}

export interface InsolationPoint {
  utc: string;
  insolation_watts: number;
}

export interface SurfaceQueryResponse {
  earth: BodyResult;
  sun: BodyResult;
  insolation: {
    insolation_watts: number;
    insolation_graph: InsolationPoint[];
  };
}

export async function querySurface(
  utc: string,
  lat_deg: number,
  lon_deg: number,
  alt_km = 0
): Promise<SurfaceQueryResponse> {
  const res = await fetch(`${BASE}/positions/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utc, lat_deg, lon_deg, alt_km }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

