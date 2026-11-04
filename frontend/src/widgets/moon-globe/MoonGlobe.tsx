import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { ACCENT_COLOR as ACCENT, TEXTURES } from "@/shared/config";
import type { LatLon } from "@/shared/lib";

interface Props {
  point: LatLon | null;
  onSelect: (point: LatLon) => void;
}

// Reference features: they make it easy to see that texture and coordinates line up.
const LANDMARKS = [
  { name: "Tycho", lat: -43.31, lon: -11.36 },
  { name: "Copernicus", lat: 9.62, lon: -20.08 },
  { name: "Apollo 11", lat: 0.674, lon: 23.473 },
  { name: "Shackleton", lat: -89.67, lon: 129.78 },
];

// A map-style pin in screen space, so it stays the same size at any zoom and reads
// against the bright regolith. The outer div is a zero-size anchor at the coordinate;
// the SVG hangs above it so the pin's tip sits exactly on the point.
function createPin(): HTMLElement {
  const el = document.createElement("div");
  el.className = "size-0 pointer-events-none transition-opacity";
  el.innerHTML = `
    <svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true"
         class="absolute bottom-0 left-0 -translate-x-1/2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">
      <path d="M14 39C14 39 2 23.5 2 14a12 12 0 0 1 24 0c0 9.5-12 25-12 25z"
            fill="${ACCENT}" stroke="#1a1200" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="14" cy="14" r="4.5" fill="#1a1200"/>
    </svg>`;
  return el;
}

export function MoonGlobe({ point, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods>();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);
  const marker = useMemo(() => (point ? [point] : []), [point]);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Turn the selected point towards the camera, keeping the current zoom.
  // The first positioning (a point restored from the URL) is instant.
  const positionedRef = useRef(false);
  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe || !point) return;
    const ms = positionedRef.current ? 800 : 0;
    positionedRef.current = true;
    globe.pointOfView({ lat: point.lat, lng: point.lon, altitude: globe.pointOfView().altitude }, ms);
  }, [point, ready]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {size && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          // The default zoom-in animation fights with pointOfView() on load.
          animateIn={false}
          backgroundColor="#000000"
          globeImageUrl={TEXTURES.color}
          bumpImageUrl={TEXTURES.elevation}
          showAtmosphere={false}
          showGraticules
          onGlobeReady={() => setReady(true)}
          onGlobeClick={({ lat, lng }) => onSelect({ lat, lon: lng })}
          htmlElementsData={marker}
          htmlLat="lat"
          htmlLng="lon"
          htmlAltitude={0.005}
          htmlElement={createPin}
          htmlElementVisibilityModifier={(el, visible) => { el.style.opacity = visible ? "1" : "0"; }}
          htmlTransitionDuration={0}
          ringsData={marker}
          ringLat="lat"
          ringLng="lon"
          ringColor={() => (t: number) => `rgba(245, 160, 0, ${0.9 * (1 - t)})`}
          ringMaxRadius={5}
          ringPropagationSpeed={2.5}
          ringRepeatPeriod={1000}
          labelsData={LANDMARKS}
          labelLat="lat"
          labelLng="lon"
          labelText="name"
          labelSize={1.2}
          labelDotRadius={0.3}
          labelColor={() => "rgba(255, 255, 255, 0.75)"}
          labelResolution={2}
        />
      )}
    </div>
  );
}
