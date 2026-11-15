export const formatDeg = (v: number) => `${v.toFixed(2)}°`;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export const compassPoint = (azimuthDeg: number) => COMPASS[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8];

export const formatSlope = (slopeDeg: number, aspectDeg: number) =>
  slopeDeg < 0.05 ? "flat" : `${slopeDeg.toFixed(1)}° facing ${compassPoint(aspectDeg)} (${Math.round(aspectDeg)}°)`;
