import { useEffect, useRef, useState } from "react";
import type { LatLon } from "@/shared/lib";
import { querySurface, type SurfaceQueryResponse } from "./api";

export interface SurfaceQueryState {
  data: SurfaceQueryResponse | null;
  loading: boolean;
  error: string | null;
}

const LOADING: SurfaceQueryState = { data: null, loading: true, error: null };

const keyOf = (p: LatLon, utc: string) => `${p.lat},${p.lon}@${utc}`;

/**
 * Fetches /positions/surface for every point at the shared time, one result per point in the
 * same order. Results are cached by (point, time), so adding a point or switching the active one
 * only requests what is new; changing the time refetches all of them. Requests for points that
 * disappear from the list are aborted.
 */
export function useSurfaceQueries(points: LatLon[], utc: string): SurfaceQueryState[] {
  const [results, setResults] = useState<Record<string, SurfaceQueryState>>({});
  const inflight = useRef(new Map<string, AbortController>());
  const keys = points.map((p) => keyOf(p, utc));
  const signature = keys.join("|");

  useEffect(() => {
    for (const [i, key] of keys.entries()) {
      if (results[key] || inflight.current.has(key)) continue;
      const ctrl = new AbortController();
      inflight.current.set(key, ctrl);
      const { lat, lon } = points[i];
      querySurface(utc, lat, lon, 0, ctrl.signal)
        .then((data) => setResults((r) => ({ ...r, [key]: { data, loading: false, error: null } })))
        .catch((e: Error) => {
          if (!ctrl.signal.aborted) setResults((r) => ({ ...r, [key]: { data: null, loading: false, error: e.message } }));
        })
        .finally(() => {
          // Only clear our own entry: an aborted request may settle after a newer one took the key.
          if (inflight.current.get(key) === ctrl) inflight.current.delete(key);
        });
    }
    for (const [key, ctrl] of inflight.current) {
      if (!keys.includes(key)) {
        ctrl.abort();
        inflight.current.delete(key);
      }
    }
    // Keep the cache to what is on screen, so a time change does not pile up old series.
    setResults((r) => {
      const kept = Object.fromEntries(Object.entries(r).filter(([k]) => keys.includes(k)));
      return Object.keys(kept).length === Object.keys(r).length ? r : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const map = inflight.current;
    return () => {
      for (const ctrl of map.values()) ctrl.abort();
      map.clear();
    };
  }, []);

  return keys.map((key) => results[key] ?? LOADING);
}
