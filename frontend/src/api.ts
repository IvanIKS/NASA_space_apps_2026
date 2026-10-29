const BASE = "/api";

export interface BodyResult {
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
  lighttime_s: number;
}

export interface SurfaceQueryResponse {
  earth: BodyResult;
  sun: BodyResult;
  insolation: { insolation_watts: number };
}

export interface Observation {
  id: number;
  utc: string;
  lat_deg: number;
  lon_deg: number;
  alt_km: number;
  label: string | null;
  earth_az: number | null;
  earth_el: number | null;
  earth_range_km: number | null;
  sun_az: number | null;
  sun_el: number | null;
  sun_range_km: number | null;
  created_at: string;
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

export async function getObservations(): Promise<Observation[]> {
  const res = await fetch(`${BASE}/observations/`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveObservation(
  data: Omit<Observation, "id" | "created_at">
): Promise<Observation> {
  const res = await fetch(`${BASE}/observations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteObservation(id: number): Promise<void> {
  await fetch(`${BASE}/observations/${id}`, { method: "DELETE" });
}
