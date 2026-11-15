import * as THREE from "three";
import { TEXTURES } from "@/shared/config";
import { MOON_RADIUS_KM } from "./skyMath";

const GROUND_SIZE = 500;
const GROUND_SEGMENTS = 256;
export const LANDSCAPE_SAMPLES = GROUND_SEGMENTS + 1;
const HEIGHT_PER_LEVEL_KM = (10760 + 9150) / 255 / 1000;
const RELIEF_TINT_RANGE_KM = 0.8;
const RELIEF_TINT_STRENGTH = 0.45;
const GROUND_OFFSET_KM = -0.00005;

export interface LandscapeBounds {
  lat_start: number;
  lon_start: number;
  lat_end: number;
  lon_end: number;
}

export interface LandscapeData {
  values: number[][];
  bounds: LandscapeBounds;
  centerLatitudeDeg: number;
  centerLongitudeDeg: number;
}

export function getLandscapeBounds(latitudeDeg: number, longitudeDeg: number): LandscapeBounds {
  const angularDistance = (GROUND_SIZE / Math.SQRT2) / MOON_RADIUS_KM;
  const latitude = THREE.MathUtils.degToRad(latitudeDeg);
  const latMin = Math.max(-Math.PI / 2, latitude - angularDistance);
  const latMax = Math.min(Math.PI / 2, latitude + angularDistance);
  const ratio = Math.sin(angularDistance) / Math.max(Math.cos(latitude), 0);
  const longitudeDelta = ratio >= 1 ? Math.PI : Math.asin(ratio);

  return {
    lat_start: THREE.MathUtils.radToDeg(latMax),
    lon_start: longitudeDeg - THREE.MathUtils.radToDeg(longitudeDelta),
    lat_end: THREE.MathUtils.radToDeg(latMin),
    lon_end: longitudeDeg + THREE.MathUtils.radToDeg(longitudeDelta),
  };
}

export function createGroundGeometry(latitudeDeg: number, longitudeDeg: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  const centerLatitude = THREE.MathUtils.degToRad(latitudeDeg);
  const centerLongitude = THREE.MathUtils.degToRad(longitudeDeg);

  for (let i = 0; i < positions.count; i += 1) {
    const eastKm = positions.getX(i);
    const northKm = positions.getY(i);
    const angularDistance = Math.hypot(eastKm, northKm) / MOON_RADIUS_KM;
    const bearing = Math.atan2(eastKm, northKm);

    const latitude = Math.asin(
      Math.sin(centerLatitude) * Math.cos(angularDistance) +
        Math.cos(centerLatitude) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const longitude =
      centerLongitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatitude),
        Math.cos(angularDistance) - Math.sin(centerLatitude) * Math.sin(latitude)
      );
    const longitudeOffset = Math.atan2(Math.sin(longitude - centerLongitude), Math.cos(longitude - centerLongitude));

    uvs.setXY(i, (centerLongitude + longitudeOffset + Math.PI) / (2 * Math.PI), (latitude + Math.PI / 2) / Math.PI);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function sampleElevation(data: LandscapeData, latitude: number, longitude: number): number | null {
  const { values, bounds } = data;
  const height = values.length;
  const width = values[0]?.length ?? 0;
  const row = THREE.MathUtils.clamp(
    ((bounds.lat_start - latitude) / (bounds.lat_start - bounds.lat_end)) * (height - 1),
    0,
    height - 1
  );
  const span = bounds.lon_end - bounds.lon_start;
  const offset =
    Math.abs(span) >= 360
      ? (((longitude % 360) + 360) % 360)
      : ((((longitude - bounds.lon_start) % 360) + 360) % 360);
  const x = Math.abs(span) >= 360 ? (offset / 360) * width : (offset / span) * (width - 1);
  const y0 = Math.floor(row);
  const y1 = Math.min(y0 + 1, height - 1);
  const x0 = Math.floor(x) % width;
  const x1 = (x0 + 1) % width;
  const tx = x - Math.floor(x);
  const ty = row - y0;
  const samples = [
    { value: values[y0][x0], weight: (1 - tx) * (1 - ty) },
    { value: values[y0][x1], weight: tx * (1 - ty) },
    { value: values[y1][x0], weight: (1 - tx) * ty },
    { value: values[y1][x1], weight: tx * ty },
  ].filter(({ value, weight }) => value !== 0 && weight > 0);
  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  if (totalWeight === 0) return null;
  return samples.reduce((sum, sample) => sum + sample.value * sample.weight, 0) / totalWeight;
}

function applyLandscape(geometry: THREE.PlaneGeometry, data: LandscapeData): void {
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  const colors = new Float32Array(positions.count * 3);
  const sampledCenter = sampleElevation(data, data.centerLatitudeDeg, data.centerLongitudeDeg);
  const validValues = sampledCenter === null ? data.values.flat().filter((value) => value !== 0) : [];
  const centerElevation =
    sampledCenter ?? (validValues.length ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length : 0);

  for (let i = 0; i < positions.count; i += 1) {
    const latitude = THREE.MathUtils.radToDeg(uvs.getY(i) * Math.PI - Math.PI / 2);
    const longitude = THREE.MathUtils.radToDeg(uvs.getX(i) * 2 * Math.PI - Math.PI);
    const elevation = sampleElevation(data, latitude, longitude);
    const heightKm = elevation === null ? 0 : (elevation - centerElevation) * HEIGHT_PER_LEVEL_KM;
    positions.setZ(i, heightKm);
    const relief = THREE.MathUtils.clamp(heightKm / RELIEF_TINT_RANGE_KM, -1, 1);
    const tint = 1 + relief * RELIEF_TINT_STRENGTH;
    colors.set([tint, tint, tint], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

export interface Ground {
  mesh: THREE.Mesh;
  setLandscape(data: LandscapeData): void;
  dispose(): void;
}

export function createGround(
  latitudeDeg: number,
  longitudeDeg: number,
  maxAnisotropy: number,
  onTextureError: () => void
): Ground {
  const geometry = createGroundGeometry(latitudeDeg, longitudeDeg);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = GROUND_OFFSET_KM;

  let active = true;
  const colorMap = new THREE.TextureLoader().load(
    TEXTURES.color,
    (texture) => {
      if (!active) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = maxAnisotropy;
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => active && onTextureError()
  );

  return {
    mesh,
    setLandscape(data) {
      if (active) applyLandscape(geometry, data);
    },
    dispose() {
      active = false;
      geometry.dispose();
      material.dispose();
      colorMap.dispose();
    },
  };
}
