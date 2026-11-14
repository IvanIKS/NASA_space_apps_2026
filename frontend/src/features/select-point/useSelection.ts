import { useEffect, useMemo, useState } from "react";
import { DEFAULT_GRAPH_DAYS, GRAPH_WINDOWS_DAYS, MAX_POINTS } from "@/shared/config";
import { nowUtc, roundCoord, type LatLon } from "@/shared/lib";

export type ViewMode = "globe" | "surface";

export interface Selection {
  points: LatLon[];
  active: number;
  utc: string;
  days: number;
  view: ViewMode;
  adding: boolean;
  revision: number;
}

export interface SelectionActions {
  place(point: LatLon): void;
  apply(point: LatLon | null, utc: string): void;
  activate(index: number): void;
  remove(index: number): void;
  startAdd(): void;
  cancelAdd(): void;
  toggleView(): void;
  setDays(days: number): void;
}

export const pointLabel = (index: number) => String.fromCharCode(65 + index);

export const activePoint = (s: Selection): LatLon | null => s.points[s.active] ?? null;

const round = ({ lat, lon }: LatLon): LatLon => ({ lat: roundCoord(lat), lon: roundCoord(lon) });

function parsePoints(params: URLSearchParams): LatLon[] {
  const points: LatLon[] = [];
  for (const pair of (params.get("pts") ?? "").split(";")) {
    const [lat, lon] = pair.split(",").map(parseFloat);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
  }
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  if (points.length === 0 && Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
  return points.slice(0, MAX_POINTS);
}

function parseDays(raw: string | null): number {
  const days = parseInt(raw ?? "", 10);
  return (GRAPH_WINDOWS_DAYS as readonly number[]).includes(days) ? days : DEFAULT_GRAPH_DAYS;
}

function readUrl(): Selection {
  const params = new URLSearchParams(window.location.search);
  const points = parsePoints(params);
  const active = Math.max(0, Math.min(parseInt(params.get("active") ?? "0", 10) || 0, points.length - 1));
  return {
    points,
    active,
    utc: params.get("utc") ?? nowUtc(),
    days: parseDays(params.get("days")),
    view: points.length > 0 && params.get("view") === "surface" ? "surface" : "globe",
    adding: false,
    revision: 0,
  };
}

function writeUrl(s: Selection) {
  const params = new URLSearchParams();
  if (s.points.length > 0) {
    params.set("pts", s.points.map((p) => `${p.lat},${p.lon}`).join(";"));
    if (s.active > 0) params.set("active", String(s.active));
  }
  params.set("utc", s.utc);
  if (s.days !== DEFAULT_GRAPH_DAYS) params.set("days", String(s.days));
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

export function useSelection(): [Selection, SelectionActions] {
  const [selection, setSelection] = useState(readUrl);

  useEffect(() => writeUrl(selection), [selection]);

  const actions = useMemo<SelectionActions>(
    () => ({
      place: (point) => setSelection((s) => withPoint(s, point)),
      apply: (point, utc) =>
        setSelection((s) => ({ ...(point ? withPoint(s, point) : s), utc, revision: s.revision + 1 })),
      activate: (index) => setSelection((s) => (index < s.points.length ? { ...s, active: index, adding: false } : s)),
      remove: (index) =>
        setSelection((s) => {
          const points = s.points.filter((_, i) => i !== index);
          const active = Math.max(0, Math.min(s.active > index ? s.active - 1 : s.active, points.length - 1));
          return { ...s, points, active, view: points.length > 0 ? s.view : "globe" };
        }),
      startAdd: () => setSelection((s) => (s.points.length < MAX_POINTS ? { ...s, adding: true, view: "globe" } : s)),
      cancelAdd: () => setSelection((s) => ({ ...s, adding: false })),
      setDays: (days) => setSelection((s) => ({ ...s, days })),
      toggleView: () =>
        setSelection((s) => ({ ...s, view: s.view === "surface" ? "globe" : "surface", adding: false })),
    }),
    []
  );

  return [selection, actions];
}
