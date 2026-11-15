import { useEffect, useState } from "react";
import { TEXTURES } from "@/shared/config";
import { queryLowResLandscape } from "./api";
import { buildHeatPoints, buildReliefTexture, type HeatPoint } from "./relief";

const RESOLUTION_KM = 10;

export interface ReliefState {
  url: string | null;
  heatPoints: HeatPoint[] | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: ReliefState = { url: null, heatPoints: null, loading: false, error: null };

let cached: Pick<ReliefState, "url" | "heatPoints"> | null = null;

export function useReliefTexture(enabled: boolean): ReliefState {
  const [state, setState] = useState<ReliefState>(cached ? { ...EMPTY, ...cached } : EMPTY);

  useEffect(() => {
    if (!enabled || cached) return;
    const ctrl = new AbortController();
    setState({ ...EMPTY, loading: true });
    queryLowResLandscape(RESOLUTION_KM, ctrl.signal)
      .then(async (grid) => ({ url: await buildReliefTexture(grid, TEXTURES.color), heatPoints: buildHeatPoints(grid) }))
      .then((textures) => {
        cached = textures;
        setState({ ...EMPTY, ...textures });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setState({ ...EMPTY, error: e.message });
      });
    return () => ctrl.abort();
  }, [enabled]);

  return enabled ? state : EMPTY;
}
