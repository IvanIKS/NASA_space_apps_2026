import { getJson } from "@/shared/api";
import { getLandscapeBounds, LANDSCAPE_SAMPLES, type LandscapeData } from "./scene/ground";

export function queryLandscape(
  latitudeDeg: number,
  longitudeDeg: number,
  signal?: AbortSignal
): Promise<LandscapeData> {
  const bounds = getLandscapeBounds(latitudeDeg, longitudeDeg);
  return getJson<number[][]>(
    "/positions/landscape",
    { ...bounds, samples: LANDSCAPE_SAMPLES },
    signal
  ).then((values) => {
    if (
      values.length !== LANDSCAPE_SAMPLES ||
      values.some((row) => row.length !== LANDSCAPE_SAMPLES)
    ) {
      throw new Error("The lunar landscape response has an invalid grid size.");
    }
    return { values, bounds, centerLatitudeDeg: latitudeDeg, centerLongitudeDeg: longitudeDeg };
  });
}
