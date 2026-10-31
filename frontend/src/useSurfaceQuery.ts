import { useEffect, useState } from "react";
import { querySurface, type SurfaceQueryResponse } from "./api";
import type { LatLon } from "./useSelection";

export interface SurfaceQueryState {
  data: SurfaceQueryResponse | null;
  loading: boolean;
  error: string | null;
}

/** Fetches /positions/surface for the point; a newer selection aborts the request in flight. */
export function useSurfaceQuery(point: LatLon | null, utc: string): SurfaceQueryState {
  const [state, setState] = useState<SurfaceQueryState>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!point) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    querySurface(utc, point.lat, point.lon, 0, ctrl.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setState({ data: null, loading: false, error: e.message });
      });
    return () => ctrl.abort();
  }, [point, utc]);

  return state;
}
