import { useEffect, useState } from "react";
import { TEXTURES } from "@/shared/config";
import { queryLowResLandscape } from "./api";
import { buildReliefTexture } from "./relief";

const RESOLUTION_KM = 10;

export interface ReliefState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

let cached: string | null = null;

export function useReliefTexture(enabled: boolean): ReliefState {
  const [state, setState] = useState<ReliefState>({ url: cached, loading: false, error: null });

  useEffect(() => {
    if (!enabled || cached) return;
    const ctrl = new AbortController();
    setState({ url: null, loading: true, error: null });
    queryLowResLandscape(RESOLUTION_KM, ctrl.signal)
      .then((grid) => buildReliefTexture(grid, TEXTURES.color))
      .then((url) => {
        cached = url;
        setState({ url, loading: false, error: null });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setState({ url: null, loading: false, error: e.message });
      });
    return () => ctrl.abort();
  }, [enabled]);

  return enabled ? state : { url: null, loading: false, error: null };
}
