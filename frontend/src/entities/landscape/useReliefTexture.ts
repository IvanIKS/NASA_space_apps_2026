import { useEffect, useState } from "react";
import { TEXTURES } from "@/shared/config";
import { queryLowResLandscape } from "./api";
import { buildDisplacementTexture, buildReliefTexture } from "./relief";

const RESOLUTION_KM = 10;

export interface ReliefState {
  url: string | null;
  displacementUrl: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: ReliefState = { url: null, displacementUrl: null, loading: false, error: null };

let cached: Pick<ReliefState, "url" | "displacementUrl"> | null = null;

export function useReliefTexture(enabled: boolean): ReliefState {
  const [state, setState] = useState<ReliefState>(cached ? { ...EMPTY, ...cached } : EMPTY);

  useEffect(() => {
    if (!enabled || cached) return;
    const ctrl = new AbortController();
    setState({ ...EMPTY, loading: true });
    queryLowResLandscape(RESOLUTION_KM, ctrl.signal)
      .then(async (grid) => ({ url: await buildReliefTexture(grid, TEXTURES.color), displacementUrl: buildDisplacementTexture(grid) }))
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
