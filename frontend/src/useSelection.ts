import { useEffect, useState } from "react";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Selection {
  point: LatLon | null;
  /** UTC in the backend's format: YYYY-MM-DDTHH:MM:SS, no timezone suffix. */
  utc: string;
}

export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19);
}

function readUrl(): Selection {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  return {
    point: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null,
    utc: params.get("utc") ?? nowUtc(),
  };
}

/** Selected point and time, mirrored into the URL so a view can be shared by link. */
export function useSelection() {
  const [selection, setSelection] = useState(readUrl);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selection.point) {
      params.set("lat", String(selection.point.lat));
      params.set("lon", String(selection.point.lon));
    }
    params.set("utc", selection.utc);
    window.history.replaceState(null, "", `?${params}`);
  }, [selection]);

  return [selection, setSelection] as const;
}
