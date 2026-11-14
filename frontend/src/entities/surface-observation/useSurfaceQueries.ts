import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLon } from "@/shared/lib";
import { queryObservation, type SurfaceQueryResponse } from "./api";

export interface SurfaceQueryState {
  data: SurfaceQueryResponse | null;
  loading: boolean;
  error: string | null;
}

const pointKey = (p: LatLon) => `${p.lat},${p.lon}`;
const keyOf = (p: LatLon, utc: string, days: number) => `${pointKey(p)}@${utc}/${days}`;

export function useSurfaceQueries(points: LatLon[], utc: string, days: number, revision = 0): SurfaceQueryState[] {
  const [results, setResults] = useState<Record<string, SurfaceQueryState>>({});
  const [previous, setPrevious] = useState<Record<string, SurfaceQueryResponse>>({});
  const inflight = useRef(new Map<string, AbortController>());
  const keys = points.map((p) => keyOf(p, utc, days));
  const signature = keys.join("|");

  useEffect(() => {
    for (const [i, key] of keys.entries()) {
      const cached = results[key];
      if ((cached && !cached.error) || inflight.current.has(key)) continue;
      const ctrl = new AbortController();
      inflight.current.set(key, ctrl);
      if (cached) setResults((r) => ({ ...r, [key]: { data: null, loading: true, error: null } }));
      const { lat, lon } = points[i];
      queryObservation(utc, days, lat, lon, ctrl.signal)
        .then((data) => setResults((r) => ({ ...r, [key]: { data, loading: false, error: null } })))
        .catch((e: Error) => {
          if (!ctrl.signal.aborted) setResults((r) => ({ ...r, [key]: { data: null, loading: false, error: e.message } }));
        })
        .finally(() => {
          if (inflight.current.get(key) === ctrl) inflight.current.delete(key);
        });
    }
    for (const [key, ctrl] of inflight.current) {
      if (!keys.includes(key)) {
        ctrl.abort();
        inflight.current.delete(key);
      }
    }
    setResults((r) => {
      const kept = Object.fromEntries(Object.entries(r).filter(([k]) => keys.includes(k)));
      return Object.keys(kept).length === Object.keys(r).length ? r : kept;
    });
  }, [signature, revision]);

  useEffect(() => {
    const fresh: Record<string, SurfaceQueryResponse> = {};
    for (const [key, result] of Object.entries(results)) {
      if (result.data) fresh[key.slice(0, key.indexOf("@"))] = result.data;
    }
    const current = new Set(points.map(pointKey));
    setPrevious((p) => ({ ...Object.fromEntries(Object.entries(p).filter(([k]) => current.has(k))), ...fresh }));
  }, [results, signature]);

  useEffect(() => {
    const map = inflight.current;
    return () => {
      for (const ctrl of map.values()) ctrl.abort();
      map.clear();
    };
  }, []);

  return useMemo(
    () => points.map((p, i) => results[keys[i]] ?? { data: previous[pointKey(p)] ?? null, loading: true, error: null }),
    [results, previous, signature]
  );
}
