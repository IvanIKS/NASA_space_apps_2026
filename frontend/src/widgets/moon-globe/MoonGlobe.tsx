import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { pointLabel } from "@/features/select-point";
import { POINT_COLORS, TEXTURES } from "@/shared/config";
import type { LatLon } from "@/shared/lib";

interface Props {
  points: LatLon[];
  active: number;
  onSelect: (point: LatLon) => void;
  onActivate: (index: number) => void;
}

interface Pin extends LatLon {
  index: number;
  active: boolean;
}

// Reference features: they make it easy to see that texture and coordinates line up.
const LANDMARKS = [
  { name: "Tycho", lat: -43.31, lon: -11.36 },
  { name: "Copernicus", lat: 9.62, lon: -20.08 },
  { name: "Apollo 11", lat: 0.674, lon: 23.473 },
  { name: "Shackleton", lat: -89.67, lon: 129.78 },
];

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

// A map-style pin in screen space, so it stays the same size at any zoom and reads
// against the bright regolith. The outer div is a zero-size anchor at the coordinate;
// the SVG hangs above it so the pin's tip sits exactly on the point. The active pin is
// larger; the others are clickable to make them active.
function createPin(pin: Pin, onActivate: (index: number) => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "size-0 transition-opacity";
  const scale = pin.active ? 1 : 0.78;
  el.innerHTML = `
    <svg viewBox="0 0 28 40" width="${28 * scale}" height="${40 * scale}" aria-label="Point ${pointLabel(pin.index)}"
         class="absolute bottom-0 left-0 -translate-x-1/2 cursor-pointer drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">
      <path d="M14 39C14 39 2 23.5 2 14a12 12 0 0 1 24 0c0 9.5-12 25-12 25z"
            fill="${POINT_COLORS[pin.index]}" stroke="#1a1200" stroke-width="2" stroke-linejoin="round"/>
      <text x="14" y="18.5" text-anchor="middle" font-size="13" font-weight="700" font-family="system-ui, sans-serif" fill="#1a1200">${pointLabel(pin.index)}</text>
    </svg>`;
  el.firstElementChild!.addEventListener("click", (e) => {
    e.stopPropagation();
    onActivate(pin.index);
  });
  return el;
}

export function MoonGlobe({ points, active, onSelect, onActivate }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods>();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);
  const pins = useMemo<Pin[]>(
    () => points.map((p, index) => ({ ...p, index, active: index === active })),
    [points, active]
  );
  const activePin = useMemo(() => pins.filter((p) => p.active), [pins]);
  const ringColor = POINT_COLORS[active] ?? POINT_COLORS[0];

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Turn the active point towards the camera, keeping the current zoom.
  // The first positioning (a point restored from the URL) is instant.
  const positionedRef = useRef(false);
  const point = points[active];
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
          htmlElementsData={pins}
          htmlLat="lat"
          htmlLng="lon"
          htmlAltitude={0.005}
          htmlElement={(d) => createPin(d as Pin, onActivate)}
          htmlElementVisibilityModifier={(el, visible) => { el.style.opacity = visible ? "1" : "0"; }}
          htmlTransitionDuration={0}
          ringsData={activePin}
          ringLat="lat"
          ringLng="lon"
          ringColor={() => (t: number) => `rgba(${hexToRgb(ringColor)}, ${0.9 * (1 - t)})`}
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
