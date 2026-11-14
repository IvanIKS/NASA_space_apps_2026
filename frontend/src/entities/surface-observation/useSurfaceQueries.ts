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
