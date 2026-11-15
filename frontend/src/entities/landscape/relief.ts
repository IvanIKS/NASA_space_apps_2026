import type { LandscapeGrid } from "./api";

const GLD100_MIN_M = -9150;
const GLD100_MAX_M = 10760;
const METRES_PER_LEVEL = (GLD100_MAX_M - GLD100_MIN_M) / 255;
const LIGHT_AZIMUTH_DEG = 315;
const LIGHT_ALTITUDE_DEG = 40;
const VERTICAL_EXAGGERATION = 6;
const FLAT_BRIGHTNESS = 0.96;
const SHADE_RANGE = 0.9;

function hillshade(grid: LandscapeGrid): Float32Array {
  const { width, height, data } = grid;
  const cellM = grid.resolution_km * 1000;
  const zenith = ((90 - LIGHT_ALTITUDE_DEG) * Math.PI) / 180;
  const azimuth = ((360 - LIGHT_AZIMUTH_DEG + 90) * Math.PI) / 180;
  const flat = Math.cos(zenith);
  const out = new Float32Array(width * height).fill(FLAT_BRIGHTNESS);
  const latStep = (grid.lat_start - grid.lat_end) / height;

  for (let y = 1; y < height - 1; y += 1) {
    const lat = grid.lat_start - (y + 0.5) * latStep;
    const dx = Math.max(cellM * Math.cos((lat * Math.PI) / 180), cellM * 0.05);
    const up = data[y - 1];
    const row = data[y];
    const down = data[y + 1];
    for (let x = 0; x < width; x += 1) {
      const left = row[(x - 1 + width) % width];
      const right = row[(x + 1) % width];
      const c = row[x];
      if (!c || !left || !right || !up[x] || !down[x]) continue;
      const dzdx = ((right - left) * METRES_PER_LEVEL * VERTICAL_EXAGGERATION) / (2 * dx);
      const dzdy = ((up[x] - down[x]) * METRES_PER_LEVEL * VERTICAL_EXAGGERATION) / (2 * cellM);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const shade = Math.cos(zenith) * Math.cos(slope) + Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect);
      out[y * width + x] = Math.min(1, Math.max(0, FLAT_BRIGHTNESS + (shade - flat) * SHADE_RANGE));
    }
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function rollToDateline(grid: LandscapeGrid): LandscapeGrid {
  const shift = Math.round((((grid.lon_start + 180) % 360) + 360) % 360 / 360 * grid.width) % grid.width;
  if (shift === 0) return grid;
  const data = grid.data.map((row) => [...row.slice(shift), ...row.slice(0, shift)]);
  return { ...grid, data, lon_start: -180, lon_end: 180 };
}

export const SEA_LEVEL = Math.round((0 - GLD100_MIN_M) / METRES_PER_LEVEL) / 255;
export const RELIEF_RANGE_KM = (GLD100_MAX_M - GLD100_MIN_M) / 1000;

function fillPolarRows(grid: LandscapeGrid): number[][] {
  const rows = grid.data.map((row) => [...row]);
  const valid = (row: number[]) => row.some((v) => v !== 0);
  const first = rows.findIndex(valid);
  const last = rows.length - 1 - [...rows].reverse().findIndex(valid);
  if (first < 0) return rows;
  for (let y = 0; y < first; y += 1) rows[y] = rows[first];
  for (let y = last + 1; y < rows.length; y += 1) rows[y] = rows[last];
  const level = Math.round(SEA_LEVEL * 255);
  return rows.map((row) => row.map((v) => (v === 0 ? level : v)));
}

export function buildDisplacementTexture(source: LandscapeGrid): string {
  const grid = rollToDateline(source);
  const rows = fillPolarRows(grid);
  const canvas = document.createElement("canvas");
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(grid.width, grid.height);
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const i = (y * grid.width + x) * 4;
      const v = rows[y][x];
      pixels.data[i] = v;
      pixels.data[i + 1] = v;
      pixels.data[i + 2] = v;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const smooth = document.createElement("canvas");
  smooth.width = grid.width * 2;
  smooth.height = grid.height * 2;
  const smoothCtx = smooth.getContext("2d")!;
  smoothCtx.imageSmoothingEnabled = true;
  smoothCtx.imageSmoothingQuality = "high";
  smoothCtx.filter = "blur(1.5px)";
  smoothCtx.drawImage(canvas, 0, 0, smooth.width, smooth.height);
  return smooth.toDataURL("image/png");
}

export async function buildReliefTexture(source: LandscapeGrid, colorSrc: string): Promise<string> {
  const grid = rollToDateline(source);
  const color = await loadImage(colorSrc);
  const shade = hillshade(grid);

  const shadeCanvas = document.createElement("canvas");
  shadeCanvas.width = grid.width;
  shadeCanvas.height = grid.height;
  const shadeCtx = shadeCanvas.getContext("2d")!;
  const pixels = shadeCtx.createImageData(grid.width, grid.height);
  for (let i = 0; i < shade.length; i += 1) {
    const v = Math.round(shade[i] * 255);
    pixels.data[i * 4] = v;
    pixels.data[i * 4 + 1] = v;
    pixels.data[i * 4 + 2] = v;
    pixels.data[i * 4 + 3] = 255;
  }
  shadeCtx.putImageData(pixels, 0, 0);

  const out = document.createElement("canvas");
  out.width = color.naturalWidth;
  out.height = color.naturalHeight;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(color, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "multiply";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(shadeCanvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.92);
}
