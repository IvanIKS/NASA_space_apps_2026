import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { pointLabel } from "@/features/select-point";
import type { HeatPoint } from "@/entities/landscape";
import { POINT_COLORS, TEXTURES } from "@/shared/config";
import type { LatLon } from "@/shared/lib";

interface Props {
  points: LatLon[];
  active: number;
  onSelect: (point: LatLon) => void;
  onActivate: (index: number) => void;
  imageUrl?: string | null;
  heatPoints?: HeatPoint[] | null;
}

interface Pin extends LatLon {
  index: number;
  active: boolean;
}

const LANDMARKS = [
  { name: "Tycho", lat: -43.31, lon: -11.36 },
  { name: "Copernicus", lat: 9.62, lon: -20.08 },
  { name: "Apollo 11", lat: 0.674, lon: 23.473 },
  { name: "Shackleton", lat: -89.67, lon: 129.78 },
];

const HEAT_TOP_ALTITUDE = 0.3;
const HEAT_BANDWIDTH_DEG = 2.5;
const HEAT_MARKER_ALTITUDE = 0.12;

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

function createPin(pin: Pin, onActivate: (index: number) => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "size-0 transition-opacity";
  const scale = pin.active ? 1 : 0.78;
  el.innerHTML = `
    <svg viewBox="0 0 28 40" width="${28 * scale}" height="${40 * scale}" aria-label="Point ${pointLabel(pin.index)}"
         class="pointer-events-auto absolute bottom-0 left-0 -translate-x-1/2 cursor-pointer drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">
      <path d="M14 39C14 39 2 23.5 2 14a12 12 0 0 1 24 0c0 9.5-12 25-12 25z"
            fill="${POINT_COLORS[pin.index]}" stroke="#1a1200" stroke-width="2" stroke-linejoin="round"/>
      <text x="14" y="18.5" text-anchor="middle" font-size="13" font-weight="700" font-family="system-ui, sans-serif" fill="#1a1200">${pointLabel(pin.index)}</text>
    </svg>`;
  const svg = el.firstElementChild!;
  for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup"]) {
    svg.addEventListener(type, (e) => e.stopPropagation());
  }
  svg.addEventListener("click", (e) => {
    e.stopPropagation();
    onActivate(pin.index);
  });
  return el;
}

export function MoonGlobe({ points, active, onSelect, onActivate, imageUrl, heatPoints }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods>();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [ready, setReady] = useState(false);
  const pins = useMemo<Pin[]>(
    () => points.map((p, index) => ({ ...p, index, active: index === active })),
    [points, active]
  );
  const activePin = useMemo(() => pins.filter((p) => p.active), [pins]);
  const pinElement = useCallback((d: object) => createPin(d as Pin, onActivate), [onActivate]);
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

  const positionedRef = useRef(false);
  const point = points[active];
  useEffect(() => {
    const globe = globeRef.current;
    if (!ready || !globe || !point) return;
    const ms = positionedRef.current ? 800 : 0;
    positionedRef.current = true;
    globe.pointOfView({ lat: point.lat, lng: point.lon, altitude: globe.pointOfView().altitude }, ms);
  }, [point, ready]);

  const heatmaps = useMemo(() => (heatPoints ? [heatPoints] : []), [heatPoints]);
  const raised = Boolean(heatPoints);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {size && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          animateIn={false}
          backgroundColor="#000000"
          globeImageUrl={imageUrl ?? TEXTURES.color}
          bumpImageUrl={TEXTURES.elevation}
          showAtmosphere={false}
          showGraticules
          onGlobeReady={() => setReady(true)}
          onGlobeClick={({ lat, lng }) => onSelect({ lat, lon: lng })}
          htmlElementsData={pins}
          htmlLat="lat"
          htmlLng="lon"
          htmlAltitude={raised ? HEAT_MARKER_ALTITUDE : 0.005}
          htmlElement={pinElement}
          htmlElementVisibilityModifier={(el, visible) => { el.style.opacity = visible ? "1" : "0"; }}
          htmlTransitionDuration={0}
          ringsData={activePin}
          ringLat="lat"
          ringLng="lon"
          ringColor={() => (t: number) => `rgba(${hexToRgb(ringColor)}, ${0.9 * (1 - t)})`}
          ringAltitude={raised ? HEAT_MARKER_ALTITUDE : 0.0015}
          ringMaxRadius={5}
          ringPropagationSpeed={2.5}
          ringRepeatPeriod={1000}
          labelsData={LANDMARKS}
          labelLat="lat"
          labelLng="lon"
          labelText="name"
          labelAltitude={raised ? HEAT_MARKER_ALTITUDE : 0.01}
          labelSize={1.2}
          labelDotRadius={0.3}
          labelColor={() => "rgba(255, 255, 255, 0.75)"}
          labelResolution={2}
          heatmapsData={heatmaps}
          heatmapPoints={(d) => d as HeatPoint[]}
          heatmapPointLat={(p) => (p as HeatPoint)[0]}
          heatmapPointLng={(p) => (p as HeatPoint)[1]}
          heatmapPointWeight={(p) => (p as HeatPoint)[2]}
          heatmapBandwidth={HEAT_BANDWIDTH_DEG}
          heatmapColorSaturation={1.0}
          heatmapBaseAltitude={0.005}
          heatmapTopAltitude={HEAT_TOP_ALTITUDE}
          heatmapsTransitionDuration={1200}
        />
      )}
    </div>
  );
}
