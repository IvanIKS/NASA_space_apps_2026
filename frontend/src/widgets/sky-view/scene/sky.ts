import * as THREE from "three";
import { skyPosition } from "./skyMath";

export const EARTH_LAYER = 1;

function createRadialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export interface SunObject {
  group: THREE.Group;
  setRadius(radius: number): void;
  dispose(): void;
}

export function createSun(): SunObject {
  const group = new THREE.Group();
  const discGeometry = new THREE.SphereGeometry(1, 24, 16);
  const discMaterial = new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false });
  const disc = new THREE.Mesh(discGeometry, discMaterial);

  const glareTexture = createRadialTexture([
    [0, "rgba(255,244,214,1)"],
    [0.12, "rgba(255,220,150,0.55)"],
    [0.4, "rgba(255,190,90,0.12)"],
    [1, "rgba(255,170,60,0)"],
  ]);
  const glareMaterial = new THREE.SpriteMaterial({
    map: glareTexture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const glare = new THREE.Sprite(glareMaterial);
  group.add(disc, glare);

  return {
    group,
    setRadius(radius) {
      disc.scale.setScalar(radius);
      glare.scale.setScalar(radius * 40);
    },
    dispose() {
      discGeometry.dispose();
      discMaterial.dispose();
      glareMaterial.dispose();
      glareTexture.dispose();
    },
  };
}

export interface EarthObject {
  mesh: THREE.Mesh;
  dispose(): void;
}

export function createEarth(): EarthObject {
  const geometry = new THREE.SphereGeometry(1, 32, 24);
  const material = new THREE.MeshStandardMaterial({
    color: 0x5a9af0,
    emissive: 0x0a1830,
    roughness: 0.6,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.layers.set(EARTH_LAYER);
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function createTextSprite(text: string): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 84px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(text, size / 2, size / 2);
  ctx.fillStyle = text === "N" ? "#f5a000" : "#e6e8ec";
  ctx.fillText(text, size / 2, size / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(2.6);
  return sprite;
}

export function createCompass(): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const sprites = (["N", "E", "S", "W"] as const).map((label, i) => {
    const sprite = createTextSprite(label);
    sprite.position.copy(skyPosition(i * 90, 2.2).multiplyScalar(0.95));
    return sprite;
  });
  group.add(...sprites);
  return {
    group,
    dispose() {
      for (const s of sprites) {
        s.material.map?.dispose();
        s.material.dispose();
      }
    },
  };
}
