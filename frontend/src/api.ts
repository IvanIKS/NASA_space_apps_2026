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
  alt_km = 0,
  signal?: AbortSignal
): Promise<SurfaceQueryResponse> {
  const res = await fetch(`${BASE}/positions/surface`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utc, lat_deg, lon_deg, alt_km }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

// FastAPI returns { detail: string } for 400 and { detail: [{ msg }] } for 422.
async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const { detail } = JSON.parse(text);
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  } catch {
    // not JSON — fall through to raw text
  }
  return text || `HTTP ${res.status}`;
}
