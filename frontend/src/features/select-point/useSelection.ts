import { useEffect, useState } from "react";
import { nowUtc, type LatLon } from "@/shared/lib";

/** "globe" is the map page; "surface" is the first-person view from the selected point. */
export type ViewMode = "globe" | "surface";

export interface Selection {
  point: LatLon | null;
  /** UTC in the backend's format: YYYY-MM-DDTHH:MM:SS, no timezone suffix. */
  utc: string;
  view: ViewMode;
}

function readUrl(): Selection {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  const point = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  return {
    point,
    utc: params.get("utc") ?? nowUtc(),
    // The surface view needs a point to stand on.
    view: point && params.get("view") === "surface" ? "surface" : "globe",
  };
}

/** Selected point, time and view, mirrored into the URL so a view can be shared by link. */
export function useSelection() {
  const [selection, setSelection] = useState(readUrl);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selection.point) {
      params.set("lat", String(selection.point.lat));
      params.set("lon", String(selection.point.lon));
    }
    params.set("utc", selection.utc);
    if (selection.view !== "globe") params.set("view", selection.view);
    window.history.replaceState(null, "", `?${params}`);
  }, [selection]);

  return [selection, setSelection] as const;
}
