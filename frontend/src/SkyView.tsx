import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import type { BodyResult } from "./api";

const SKY_SHELL_RADIUS = 80;
const MOON_RADIUS_KM = 1737.4;
const GROUND_SIZE_KM = 500;
const BODY_RADIUS_KM = {
  earth: 6371,
  sun: 696340,
};

// The main app supplies a callback so the viewer can switch back to the regular page.
interface SkyViewProps {
  onExit: () => void;
  earth: BodyResult | null;
  sun: BodyResult | null;
  latitudeDeg: number;
  longitudeDeg: number;
}

function createGroundGeometry(latitudeDeg: number, longitudeDeg: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(GROUND_SIZE_KM, GROUND_SIZE_KM, 128, 128);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  const centerLatitude = THREE.MathUtils.degToRad(latitudeDeg);
  const centerLongitude = THREE.MathUtils.degToRad(longitudeDeg);

  for (let i = 0; i < positions.count; i += 1) {
    const eastKm = positions.getX(i);
    const northKm = positions.getY(i);
    const distanceKm = Math.hypot(eastKm, northKm);
    const angularDistance = distanceKm / MOON_RADIUS_KM;
    const bearing = Math.atan2(eastKm, northKm);

    // Project local east/north ground offsets onto the Moon's spherical latitude/longitude map.
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
    const longitudeOffset = Math.atan2(
      Math.sin(longitude - centerLongitude),
      Math.cos(longitude - centerLongitude)
    );
    const u = (centerLongitude + longitudeOffset + Math.PI) / (2 * Math.PI);
    const v = (latitude + Math.PI / 2) / Math.PI;

    uvs.setXY(i, u, v);
  }

  uvs.needsUpdate = true;
  return geometry;
}

function getSkyPosition(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  const azimuth = THREE.MathUtils.degToRad(azimuthDeg);
  const elevation = THREE.MathUtils.degToRad(elevationDeg);
  const horizontalDistance = Math.cos(elevation);

  // The backend measures azimuth clockwise from north; Three.js uses +Y as up and -Z as north.
  return new THREE.Vector3(
    Math.sin(azimuth) * horizontalDistance,
    Math.sin(elevation),
    -Math.cos(azimuth) * horizontalDistance
  ).multiplyScalar(SKY_SHELL_RADIUS);
}

function getApparentMarkerRadius(bodyRadiusKm: number, rangeKm: number): number | null {
  if (!Number.isFinite(rangeKm) || rangeKm <= bodyRadiusKm) return null;

  // Preserve the body's angular size while placing it on the viewer's fixed-radius sky shell.
  return SKY_SHELL_RADIUS * (bodyRadiusKm / rangeKm);
}

export default function SkyView({
  onExit,
  earth,
  sun,
  latitudeDeg,
  longitudeDeg,
}: SkyViewProps) {
  // React attaches this div to the page; Three.js will place its canvas inside it.
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the controls available to the "start looking" button without re-creating the scene.
  const controlsRef = useRef<PointerLockControls | null>(null);
  const earthMarkerRef = useRef<THREE.Mesh | null>(null);
  const sunMarkerRef = useRef<THREE.Mesh | null>(null);

  // Pointer lock hides the cursor while looking and controls whether the overlay buttons show.
  const [isLocked, setIsLocked] = useState(false);
  const [textureError, setTextureError] = useState(false);

  useEffect(() => {
    // The effect runs after React creates the container in the DOM.
    const container = containerRef.current;
    if (!container) return;

    // A scene holds all 3D objects, lights, and background settings.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050813);
    // Fade distant geometry into the background to soften the edge of the ground plane.
    scene.fog = new THREE.Fog(0x050813, 90, 230);

    // The camera is the viewer's eyes: 70 degrees field of view, near/far render limits.
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
    // Put the camera at a standing eye height above the ground.
    camera.position.set(0, 1.7, 0);

    // The renderer draws the scene into a WebGL canvas.
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // Limit pixel ratio on high-density displays to avoid unnecessarily heavy rendering.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Use the standard sRGB output color space for colors that look correct on screen.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Add the canvas to the React-owned container.
    container.appendChild(renderer.domElement);

    // PointerLockControls turns mouse movement into first-person camera rotation.
    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;
    // Reflect pointer-lock changes in React so the overlay can respond.
    const onLock = () => setIsLocked(true);
    const onUnlock = () => setIsLocked(false);
    controls.addEventListener("lock", onLock);
    controls.addEventListener("unlock", onUnlock);

    // A hemisphere light softly lights upward-facing and ground-facing surfaces.
    scene.add(new THREE.HemisphereLight(0xc4d2ff, 0x51483c, 1.8));

    // Make a large flat plane to represent the lunar ground.
    const groundGeometry = createGroundGeometry(latitudeDeg, longitudeDeg);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    // PlaneGeometry is created in the XY plane; rotate it horizontal and place it below the camera.
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // The equirectangular LROC map covers the Moon; UVs above center it on the observer's coordinates.
    let active = true;
    const texture = new THREE.TextureLoader().load(
      "/textures/lroc_color_2k.jpg",
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.wrapS = THREE.RepeatWrapping;
        groundMaterial.map = loadedTexture;
        groundMaterial.needsUpdate = true;
        setTextureError(false);
      },
      undefined,
      (error) => {
        if (!active) return;
        console.error("Could not load the lunar surface texture.", error);
        setTextureError(true);
      }
    );

    // Unit spheres let each marker be scaled to its apparent size from the observer.
    const markerGeometry = new THREE.SphereGeometry(1, 20, 16);
    const earthMaterial = new THREE.MeshBasicMaterial({ color: 0x55aaff });
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffc247 });
    const earthMarker = new THREE.Mesh(markerGeometry, earthMaterial);
    const sunMarker = new THREE.Mesh(markerGeometry, sunMaterial);
    earthMarker.visible = false;
    sunMarker.visible = false;
    scene.add(earthMarker, sunMarker);
    earthMarkerRef.current = earthMarker;
    sunMarkerRef.current = sunMarker;

    // Keep the rendered canvas matched to the viewer's current dimensions.
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      // Avoid invalid camera aspect values before the container has a measurable size.
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      // Recalculate the camera projection after its aspect ratio changes.
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    // Set the initial canvas size and update it when the browser window changes size.
    resize();
    window.addEventListener("resize", resize);

    // Render continuously so the viewer remains responsive as the camera moves.
    let animationFrame = 0;
    const animate = () => {
      // Schedule the next frame before drawing the current one.
      animationFrame = window.requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // React calls this cleanup when the viewer unmounts; release browser and GPU resources.
    return () => {
      // Stop the render loop and remove browser event listeners.
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      controls.removeEventListener("lock", onLock);
      controls.removeEventListener("unlock", onUnlock);
      // Exit pointer lock if active, then dispose of its control handlers.
      controls.unlock();
      controls.dispose();
      controlsRef.current = null;
      active = false;
      // Dispose Three.js resources to free GPU memory.
      groundGeometry.dispose();
      groundMaterial.dispose();
      texture.dispose();
      markerGeometry.dispose();
      earthMaterial.dispose();
      sunMaterial.dispose();
      earthMarkerRef.current = null;
      sunMarkerRef.current = null;
      renderer.dispose();
      // Remove the WebGL canvas that this effect added to the DOM.
      renderer.domElement.remove();
    };
    // An empty dependency list creates the scene once per mount and cleans it up on unmount.
  }, [latitudeDeg, longitudeDeg]);

  // Move the scene markers when a new backend query result arrives.
  useEffect(() => {
    if (earthMarkerRef.current) {
      if (earth) {
        const apparentRadius = getApparentMarkerRadius(BODY_RADIUS_KM.earth, earth.range_km);
        earthMarkerRef.current.visible = apparentRadius !== null;
        earthMarkerRef.current.position.copy(
          getSkyPosition(earth.azimuth_deg, earth.elevation_deg)
        );
        if (apparentRadius !== null) earthMarkerRef.current.scale.setScalar(apparentRadius);
      } else {
        earthMarkerRef.current.visible = false;
      }
    }

    if (sunMarkerRef.current) {
      if (sun) {
        const apparentRadius = getApparentMarkerRadius(BODY_RADIUS_KM.sun, sun.range_km);
        sunMarkerRef.current.visible = apparentRadius !== null;
        sunMarkerRef.current.position.copy(
          getSkyPosition(sun.azimuth_deg, sun.elevation_deg)
        );
        if (apparentRadius !== null) sunMarkerRef.current.scale.setScalar(apparentRadius);
      } else {
        sunMarkerRef.current.visible = false;
      }
    }
  }, [earth, sun]);

  return (
    <section
      aria-label="First-person lunar ground view"
      style={{
        // Cover the whole browser viewport so this is a separate viewer mode.
        position: "fixed",
        inset: 0,
        height: "100vh",
        width: "100vw",
        // Keep the canvas and overlays within the screen edges.
        overflow: "hidden",
        background: "#050813",
      }}
    >
      {/* Three.js inserts and sizes its WebGL canvas in this container. */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {textureError && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "0.65rem 0.8rem",
            borderRadius: 6,
            color: "#fff",
            background: "rgba(130, 25, 25, 0.9)",
          }}
        >
          Could not load the lunar texture at /textures/lroc_color_2k.jpg.
        </div>
      )}
      {/* Identify the colored markers and explain that they appear after querying positions. */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          padding: "0.65rem 0.8rem",
          borderRadius: 6,
          color: "#eee",
          background: "rgba(8, 12, 24, 0.78)",
          fontSize: 13,
          pointerEvents: "none",
        }}
      >
        <div><span style={{ color: "#55aaff" }}>●</span> Earth</div>
        <div><span style={{ color: "#ffc247" }}>●</span> Sun</div>
        {!earth && !sun && <div style={{ marginTop: 6, color: "#b8c0d4" }}>Query positions to show markers</div>}
      </div>
      {/* Show navigation while the pointer is available; it is hidden during pointer lock. */}
      {!isLocked && (
        <button
          type="button"
          onClick={onExit}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "0.65rem 0.85rem",
            border: 0,
            borderRadius: 6,
            background: "#e6e9f2",
            color: "#101522",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Back to Moon Observer
        </button>
      )}
      {/* Clicking this button grants pointer lock so mouse movement rotates the camera. */}
      {!isLocked && (
        <button
          type="button"
          onClick={() => controlsRef.current?.lock()}
          style={{
            position: "absolute",
            inset: "50% auto auto 50%",
            transform: "translate(-50%, -50%)",
            padding: "0.8rem 1rem",
            border: 0,
            borderRadius: 6,
            background: "#e6e9f2",
            color: "#101522",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Click to rotate camera
        </button>
      )}
      {/* Keep basic controls visible without intercepting clicks on the scene. */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          color: "#b8c0d4",
          background: "rgba(8, 12, 24, 0.78)",
          padding: "0.45rem 0.6rem",
          borderRadius: 6,
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        Move mouse to look · Esc to release
      </div>
    </section>
  );
}
