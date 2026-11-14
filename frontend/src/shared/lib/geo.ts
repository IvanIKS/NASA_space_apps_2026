export interface LatLon {
  lat: number;
  lon: number;
}

export const roundCoord = (v: number) => Math.round(v * 1e4) / 1e4;
