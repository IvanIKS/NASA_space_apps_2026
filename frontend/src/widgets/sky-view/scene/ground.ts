import * as THREE from "three";
import { TEXTURES } from "@/shared/config";
import { MOON_RADIUS_KM } from "./skyMath";

/** Side of the ground plane in scene units (≈ km); the fog hides its edge well before that. */
const GROUND_SIZE = 500;
/** Regolith grain: a small noise tile repeated across the plane so sunlight has something to shade. */
const GRAIN_TILE = 256;
const GRAIN_REPEAT = 120;

/**
 * A flat plane whose UVs are remapped so the equirectangular LROC texture is centred on the
 * observer: each vertex's east/north offset is projected onto the sphere to find its lat/lon.
 */
export function createGroundGeometry(latitudeDeg: number, longitudeDeg: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 128, 128);
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

function createGrainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GRAIN_TILE;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 110 + Math.random() * 70;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GRAIN_REPEAT, GRAIN_REPEAT);
  return texture;
}

export interface Ground {
  mesh: THREE.Mesh;
  dispose(): void;
}

export function createGround(
  latitudeDeg: number,
  longitudeDeg: number,
  maxAnisotropy: number,
  onTextureError: () => void
): Ground {
  const geometry = createGroundGeometry(latitudeDeg, longitudeDeg);
  const grain = createGrainTexture();
  // Near-white base: the colour comes from the LROC map, the shading from the Sun light.
  const material = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 1, bumpMap: grain, bumpScale: 0.5 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.05;

  let active = true;
  const colorMap = new THREE.TextureLoader().load(
    TEXTURES.color,
    (texture) => {
      if (!active) return;
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
    dispose() {
      active = false;
      geometry.dispose();
      material.dispose();
      grain.dispose();
      colorMap.dispose();
    },
  };
}
