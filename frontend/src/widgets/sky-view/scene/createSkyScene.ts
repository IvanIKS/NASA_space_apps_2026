import * as THREE from "three";
import type { BodyResult } from "@/entities/surface-observation";
import { createGround } from "./ground";
import { createCompass, createEarth, createSun, EARTH_LAYER } from "./sky";
import { apparentRadius, azimuthToYaw, BODY_RADIUS_KM, skyDirection, skyPosition, yawToHeadingDeg } from "./skyMath";

const LOOK_SPEED = 0.004;
const MAX_PITCH = Math.PI / 2 - 0.05;
const EYE_HEIGHT = 1.7;
const BASE_INTENSITY = 0.9;
const SUN_INTENSITY = 1.4;
const EARTHSHINE_INTENSITY = 0.25;

export interface SkyBodies {
  earth: BodyResult | null;
  sun: BodyResult | null;
}

export interface SkyScene {
  update(bodies: SkyBodies): void;
  lookAt(azimuthDeg: number, elevationDeg: number): void;
  dispose(): void;
}

interface Callbacks {
  onHeading(headingDeg: number): void;
  onTextureError(): void;
}

export function createSkyScene(
  container: HTMLElement,
  latitudeDeg: number,
  longitudeDeg: number,
  { onHeading, onTextureError }: Callbacks
): SkyScene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 90, 230);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.order = "YXZ";

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const sunLight = new THREE.DirectionalLight(0xfff4e0, 0);
  const earthshine = new THREE.DirectionalLight(0x7fa6e6, 0);
  const base = new THREE.HemisphereLight(0xffffff, 0x666666, BASE_INTENSITY);
  const earthLight = new THREE.DirectionalLight(0xffffff, 3.5);
  earthLight.layers.set(EARTH_LAYER);
  scene.add(sunLight, sunLight.target, earthshine, earthshine.target, base, earthLight, earthLight.target);

  const ground = createGround(latitudeDeg, longitudeDeg, renderer.capabilities.getMaxAnisotropy(), onTextureError);
  const sun = createSun();
  const earth = createEarth();
  const compass = createCompass();
  sun.group.visible = false;
  earth.mesh.visible = false;
  scene.add(ground.mesh, sun.group, earth.mesh, compass.group);

  let yaw = 0;
  let pitch = 0;
  let target: { yaw: number; pitch: number } | null = null;
  let last: { x: number; y: number } | null = null;
  let lastHeading = -1;

  const applyRotation = () => {
    camera.rotation.set(pitch, yaw, 0);
    const heading = Math.round(yawToHeadingDeg(yaw));
    if (heading !== lastHeading) {
      lastHeading = heading;
      onHeading(heading);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    target = null;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!last) return;
    yaw += (e.clientX - last.x) * LOOK_SPEED;
    pitch = THREE.MathUtils.clamp(pitch + (e.clientY - last.y) * LOOK_SPEED, -MAX_PITCH, MAX_PITCH);
    last = { x: e.clientX, y: e.clientY };
    applyRotation();
  };
  const onPointerUp = () => {
    last = null;
    canvas.style.cursor = "grab";
  };
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  let frame = 0;
  const animate = () => {
    frame = window.requestAnimationFrame(animate);
    if (target) {
      yaw += (target.yaw - yaw) * 0.12;
      pitch += (target.pitch - pitch) * 0.12;
      if (Math.abs(target.yaw - yaw) < 1e-3 && Math.abs(target.pitch - pitch) < 1e-3) target = null;
      applyRotation();
    }
    renderer.clear();
    camera.layers.set(0);
    renderer.render(scene, camera);
    camera.layers.set(EARTH_LAYER);
    renderer.render(scene, camera);
  };
  applyRotation();
  animate();

  return {
    update({ earth: earthBody, sun: sunBody }) {
      sun.group.visible = sunBody !== null;
      if (sunBody) {
        sun.group.position.copy(skyPosition(sunBody.azimuth_deg, sunBody.elevation_deg));
        sun.setRadius(apparentRadius(BODY_RADIUS_KM.sun, sunBody.range_km));
        const dir = skyDirection(sunBody.azimuth_deg, sunBody.elevation_deg);
        sunLight.position.copy(dir).multiplyScalar(100);
        earthLight.position.copy(dir).multiplyScalar(100);
        sunLight.intensity = sunBody.elevation_deg > 0 ? SUN_INTENSITY : 0;
      } else {
        sunLight.intensity = 0;
      }

      earth.mesh.visible = earthBody !== null;
      if (earthBody) {
        earth.mesh.position.copy(skyPosition(earthBody.azimuth_deg, earthBody.elevation_deg));
        earth.mesh.scale.setScalar(apparentRadius(BODY_RADIUS_KM.earth, earthBody.range_km));
        earthshine.position.copy(skyDirection(earthBody.azimuth_deg, earthBody.elevation_deg)).multiplyScalar(100);
      }
      const night = !sunBody || sunBody.elevation_deg <= 0;
      earthshine.intensity = night && earthBody && earthBody.elevation_deg > 0 ? EARTHSHINE_INTENSITY : 0;
    },

    lookAt(azimuthDeg, elevationDeg) {
      let targetYaw = azimuthToYaw(azimuthDeg);
      targetYaw += Math.round((yaw - targetYaw) / (2 * Math.PI)) * 2 * Math.PI;
      target = {
        yaw: targetYaw,
        pitch: THREE.MathUtils.clamp(THREE.MathUtils.degToRad(elevationDeg), -MAX_PITCH, MAX_PITCH),
      };
    },

    dispose() {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      ground.dispose();
      sun.dispose();
      earth.dispose();
      compass.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
