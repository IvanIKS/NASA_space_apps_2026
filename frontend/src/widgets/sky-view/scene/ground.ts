import * as THREE from "three";
import { TEXTURES } from "@/shared/config";
import { MOON_RADIUS_KM } from "./skyMath";

const GROUND_SIZE = 500;
const GROUND_SEGMENTS = 256;
const HEIGHT_PER_LEVEL_KM = 0.075;
const GROUND_OFFSET_KM = -0.00005;

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

function sampleElevation(data: Uint8ClampedArray, width: number, height: number, u: number, v: number): number {
  const x = ((((u % 1) + 1) % 1) * width);
  const x0 = Math.floor(x);
  const x1 = (x0 + 1) % width;
  const y = THREE.MathUtils.clamp((1 - v) * (height - 1), 0, height - 1);
  const y0 = Math.floor(y);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const pixel = (px: number, py: number) => data[(py * width + px) * 4];
  const top = THREE.MathUtils.lerp(pixel(x0, y0), pixel(x1, y0), tx);
  const bottom = THREE.MathUtils.lerp(pixel(x0, y1), pixel(x1, y1), tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

function applyElevationMap(
  geometry: THREE.PlaneGeometry,
  latitudeDeg: number,
  longitudeDeg: number,
  image: CanvasImageSource
): void {
  const canvas = document.createElement("canvas");
  const imageSize = image as { width: number; height: number };
  canvas.width = imageSize.width;
  canvas.height = imageSize.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0 || canvas.height === 0) {
    throw new Error("The lunar elevation image could not be read.");
  }
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const centerLatitude = THREE.MathUtils.degToRad(latitudeDeg);
  const centerLongitude = THREE.MathUtils.degToRad(longitudeDeg);
  const referenceElevation = sampleElevation(
    data,
    canvas.width,
    canvas.height,
    (centerLongitude + Math.PI) / (2 * Math.PI),
    (centerLatitude + Math.PI / 2) / Math.PI
  );
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");

  for (let i = 0; i < positions.count; i += 1) {
    const elevation = sampleElevation(data, canvas.width, canvas.height, uvs.getX(i), uvs.getY(i));
    positions.setZ(i, (elevation - referenceElevation) * HEIGHT_PER_LEVEL_KM);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

export interface Ground {
  mesh: THREE.Mesh;
  dispose(): void;
}

export function createGround(
  latitudeDeg: number,
  longitudeDeg: number,
  maxAnisotropy: number,
  onTextureError: (texture: "color" | "elevation") => void
): Ground {
  const geometry = createGroundGeometry(latitudeDeg, longitudeDeg);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
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
    () => active && onTextureError("color")
  );
  const elevationMap = new THREE.TextureLoader().load(
    TEXTURES.elevation,
    (texture) => {
      if (!active) {
        texture.dispose();
        return;
      }
      try {
        applyElevationMap(geometry, latitudeDeg, longitudeDeg, texture.image);
      } catch (error) {
        console.error("Could not apply the lunar elevation map.", error);
        onTextureError("elevation");
        texture.dispose();
      }
    },
    undefined,
    () => active && onTextureError("elevation")
  );

  return {
    mesh,
    dispose() {
      active = false;
      geometry.dispose();
      material.dispose();
      colorMap.dispose();
      elevationMap.dispose();
    },
  };
}
