/** Planetographic coordinates in degrees, east-positive longitude (MOON_ME frame). */
export interface LatLon {
  lat: number;
  lon: number;
}

// 1e-4° is ~3 m on the Moon: plenty for a click, and keeps the URL readable.
export const roundCoord = (v: number) => Math.round(v * 1e4) / 1e4;
