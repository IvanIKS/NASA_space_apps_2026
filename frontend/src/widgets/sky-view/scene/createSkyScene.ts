import * as THREE from "three";
import type { BodyResult } from "@/entities/surface-observation";
import { createGround, type LandscapeData } from "./ground";
import { createCompass, createEarth, createSun, EARTH_LAYER } from "./sky";
import { apparentRadius, azimuthToYaw, BODY_RADIUS_KM, skyDirection, skyPosition, yawToHeadingDeg } from "./skyMath";

const LOOK_SPEED = 0.004;
const MAX_PITCH = Math.PI / 2 - 0.05;
const EYE_HEIGHT_KM = 0.0017;
const SUN_INTENSITY = 2.4;
const NIGHT_FILL_INTENSITY = 0.12;

export interface SkyBodies {
  earth: BodyResult | null;
  sun: BodyResult | null;
}

export interface SkyScene {
  update(bodies: SkyBodies): void;
  updateLandscape(data: LandscapeData): void;
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

  const camera = new THREE.PerspectiveCamera(70, 1, 0.001, 500);
  camera.position.set(0, EYE_HEIGHT_KM, 0);
  camera.rotation.order = "YXZ";

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const sunLight = new THREE.DirectionalLight(0xfff0d8, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 250;
  sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.shadow.bias = -0.0001;
  sunLight.shadow.normalBias = 0.002;
  const nightFill = new THREE.HemisphereLight(0x899bc2, 0x332a20, NIGHT_FILL_INTENSITY);
  const earthLight = new THREE.DirectionalLight(0xffffff, 3.5);
  earthLight.layers.set(EARTH_LAYER);
  scene.add(sunLight, sunLight.target, nightFill, earthLight, earthLight.target);

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
      }
    },

    updateLandscape(data) {
      ground.setLandscape(data);
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
