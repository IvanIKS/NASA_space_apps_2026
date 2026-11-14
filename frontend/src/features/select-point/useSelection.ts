import { useEffect, useMemo, useState } from "react";
import { MAX_POINTS } from "@/shared/config";
import { nowUtc, roundCoord, type LatLon } from "@/shared/lib";

/** "globe" is the map page; "surface" is the first-person view from the active point. */
export type ViewMode = "globe" | "surface";

export interface Selection {
  /** Up to MAX_POINTS points, all evaluated at the same `utc` so they can be compared. */
  points: LatLon[];
  /** Index into `points` of the point the form, the pin animation and the surface view follow. */
  active: number;
  /** UTC in the backend's format: YYYY-MM-DDTHH:MM:SS, no timezone suffix. */
  utc: string;
  view: ViewMode;
  /** True while "Add point" is waiting for a click: the next pick becomes a new point instead of moving the active one. */
  adding: boolean;
}

export interface SelectionActions {
  /** A click on the globe (or a typed coordinate): moves the active point, or adds one while `adding`. */
  place(point: LatLon): void;
  /** Form submit: the active point's coordinates and the shared time. */
  apply(point: LatLon | null, utc: string): void;
  activate(index: number): void;
  remove(index: number): void;
  startAdd(): void;
  cancelAdd(): void;
  toggleView(): void;
}

/** "A", "B", "C", … — short labels for pins, chips and chart legends. */
export const pointLabel = (index: number) => String.fromCharCode(65 + index);

export const activePoint = (s: Selection): LatLon | null => s.points[s.active] ?? null;

const round = ({ lat, lon }: LatLon): LatLon => ({ lat: roundCoord(lat), lon: roundCoord(lon) });

function parsePoints(params: URLSearchParams): LatLon[] {
  const points: LatLon[] = [];
  for (const pair of (params.get("pts") ?? "").split(";")) {
    const [lat, lon] = pair.split(",").map(parseFloat);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
  }
  // Links from before multi-point support carried a single lat/lon.
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  if (points.length === 0 && Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
  return points.slice(0, MAX_POINTS);
}

function readUrl(): Selection {
  const params = new URLSearchParams(window.location.search);
  const points = parsePoints(params);
  const active = Math.min(parseInt(params.get("active") ?? "0", 10) || 0, points.length - 1);
  return {
    points,
    active,
    utc: params.get("utc") ?? nowUtc(),
    // The surface view needs a point to stand on.
    view: points.length > 0 && params.get("view") === "surface" ? "surface" : "globe",
    adding: false,
  };
}

function writeUrl(s: Selection) {
  const params = new URLSearchParams();
  if (s.points.length > 0) {
    params.set("pts", s.points.map((p) => `${p.lat},${p.lon}`).join(";"));
    if (s.active > 0) params.set("active", String(s.active));
  }
  params.set("utc", s.utc);
  if (s.view !== "globe") params.set("view", s.view);
  window.history.replaceState(null, "", `?${params}`);
}

function withPoint(s: Selection, point: LatLon): Selection {
  const p = round(point);
  if (s.adding || s.points.length === 0) {
    if (s.points.length >= MAX_POINTS) return { ...s, adding: false };
    return { ...s, points: [...s.points, p], active: s.points.length, adding: false };
  }
  return { ...s, points: s.points.map((q, i) => (i === s.active ? p : q)) };
}

/** Selected points, time and view, mirrored into the URL so a comparison can be shared by link. */
export function useSelection(): [Selection, SelectionActions] {
  const [selection, setSelection] = useState(readUrl);

  useEffect(() => writeUrl(selection), [selection]);

  const actions = useMemo<SelectionActions>(
    () => ({
      place: (point) => setSelection((s) => withPoint(s, point)),
      apply: (point, utc) => setSelection((s) => ({ ...(point ? withPoint(s, point) : s), utc })),
      activate: (index) => setSelection((s) => (index < s.points.length ? { ...s, active: index, adding: false } : s)),
      remove: (index) =>
        setSelection((s) => {
          const points = s.points.filter((_, i) => i !== index);
          const active = Math.max(0, Math.min(s.active > index ? s.active - 1 : s.active, points.length - 1));
          return { ...s, points, active, view: points.length > 0 ? s.view : "globe" };
        }),
      startAdd: () => setSelection((s) => (s.points.length < MAX_POINTS ? { ...s, adding: true, view: "globe" } : s)),
      cancelAdd: () => setSelection((s) => ({ ...s, adding: false })),
      toggleView: () => setSelection((s) => ({ ...s, view: s.view === "surface" ? "globe" : "surface" })),
    }),
    []
  );

  return [selection, actions];
}
