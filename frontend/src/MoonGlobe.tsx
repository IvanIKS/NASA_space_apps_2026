import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { LatLon } from "./useSelection";

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

const ACCENT = "#f5a000";

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
    <div ref={wrapRef} className="globe">
      {size && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          // The default zoom-in animation fights with pointOfView() on load.
          animateIn={false}
          backgroundColor="#000000"
          globeImageUrl="/textures/lroc_color_2k.jpg"
          bumpImageUrl="/textures/ldem_3_8bit.jpg"
          showAtmosphere={false}
          showGraticules
          onGlobeReady={() => setReady(true)}
          onGlobeClick={({ lat, lng }) => onSelect({ lat, lon: lng })}
          pointsData={marker}
          pointLat="lat"
          pointLng="lon"
          pointColor={() => ACCENT}
          pointAltitude={0.02}
          pointRadius={0.5}
          ringsData={marker}
          ringLat="lat"
          ringLng="lon"
          ringColor={() => (t: number) => `rgba(245, 160, 0, ${1 - t})`}
          ringMaxRadius={4}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1200}
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
