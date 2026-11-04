import * as THREE from "three";
import type { BodyResult } from "@/entities/surface-observation";
import { createGround } from "./ground";
import { createCompass, createEarth, createStars, createSun, EARTH_LAYER } from "./sky";
import { apparentRadius, azimuthToYaw, BODY_RADIUS_KM, skyDirection, skyPosition, yawToHeadingDeg } from "./skyMath";

/** Radians of camera rotation per pixel of drag. */
const LOOK_SPEED = 0.004;
/** Stop just short of straight up/down so the horizon never flips. */
const MAX_PITCH = Math.PI / 2 - 0.05;
const EYE_HEIGHT = 1.7;
/** Sunlight on the Moon is either on or off: no atmosphere, so no dusk. */
const SUN_INTENSITY = 1.8;
/** Earthshine: a full Earth lights the lunar night noticeably. */
const EARTHSHINE_INTENSITY = 0.35;
const AMBIENT_INTENSITY = 0.03;

export interface SkyBodies {
  earth: BodyResult | null;
  sun: BodyResult | null;
}

export interface SkyScene {
  update(bodies: SkyBodies): void;
  /** Turn the camera towards an azimuth/elevation, animated. */
  lookAt(azimuthDeg: number, elevationDeg: number): void;
  dispose(): void;
}

interface Callbacks {
  onHeading(headingDeg: number): void;
  onTextureError(): void;
}

/**
 * First-person scene standing on the lunar surface: textured ground lit by the Sun, a starfield,
 * the Sun and Earth at their true azimuth/elevation and angular size, compass labels on the
 * horizon, and click-drag to look around.
 */
export function createSkyScene(
  container: HTMLElement,
  latitudeDeg: number,
  longitudeDeg: number,
  { onHeading, onTextureError }: Callbacks
): SkyScene {
  const scene = new THREE.Scene();
  // No scene.background: a Color background makes every render() force-clear, which would
  // wipe the first of the two passes below. The clear colour is set on the renderer instead.
  scene.fog = new THREE.Fog(0x000000, 90, 230);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
  camera.position.set(0, EYE_HEIGHT, 0);
  camera.rotation.order = "YXZ";

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic tone mapping keeps the sunlit regolith from clipping to flat white.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Two render passes (see animate): layers select lights per pass, so the ground and Earth are lit independently.
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  // --- lights -------------------------------------------------------------------------------
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 0);
  const earthshine = new THREE.DirectionalLight(0x7fa6e6, 0);
  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
  // Lights Earth only, always from the Sun's direction (see createEarth).
  const earthLight = new THREE.DirectionalLight(0xffffff, 3.5);
  earthLight.layers.set(EARTH_LAYER);
  scene.add(sunLight, sunLight.target, earthshine, earthshine.target, ambient, earthLight, earthLight.target);

  // --- objects ------------------------------------------------------------------------------
  const ground = createGround(latitudeDeg, longitudeDeg, renderer.capabilities.getMaxAnisotropy(), onTextureError);
  const stars = createStars();
  const sun = createSun();
  const earth = createEarth();
  const compass = createCompass();
  sun.group.visible = false;
  earth.mesh.visible = false;
  scene.add(ground.mesh, stars, sun.group, earth.mesh, compass.group);

  // --- look controls ------------------------------------------------------------------------
  // Click-drag, Street View style: you grab the world and pull it, so dragging right turns
  // the camera left. YXZ order keeps yaw level and pitch free of roll.
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

  // --- sizing & render loop -----------------------------------------------------------------
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
    // three.js applies every light the camera can see to every object it draws, so the
    // Earth-only light would wash out the ground. Draw the ground sky (layer 0, Sun + earthshine
    // lights) first, then Earth (its own layer and light) over it, sharing the depth buffer.
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
      // Earthshine only matters at night; by day the Sun swamps it.
      const night = !sunBody || sunBody.elevation_deg <= 0;
      earthshine.intensity = night && earthBody && earthBody.elevation_deg > 0 ? EARTHSHINE_INTENSITY : 0;
    },

    lookAt(azimuthDeg, elevationDeg) {
      // Take the short way round.
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
      stars.geometry.dispose();
      (stars.material as THREE.Material).dispose();
      sun.dispose();
      earth.dispose();
      compass.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
