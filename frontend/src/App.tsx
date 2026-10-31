import { useCallback } from "react";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { MoonGlobe } from "./MoonGlobe";
import { useSelection, type LatLon } from "./useSelection";
import { useSurfaceQuery } from "./useSurfaceQuery";

// 1e-4° is ~3 m on the Moon: plenty for a click, and keeps the URL readable.
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export default function App() {
  const [selection, setSelection] = useSelection();
  const query = useSurfaceQuery(selection.point, selection.utc);

  const handleSelect = useCallback(
    ({ lat, lon }: LatLon) => setSelection((s) => ({ ...s, point: { lat: round4(lat), lon: round4(lon) } })),
    [setSelection]
  );

  return (
    <div className="layout">
      <main className="map">
        <MoonGlobe point={selection.point} onSelect={handleSelect} />
        <p className="credit">Imagery: NASA Scientific Visualization Studio, LRO</p>
      </main>
      <aside className="panel">
        <AnalyticsPanel selection={selection} onChange={setSelection} query={query} />
      </aside>
    </div>
  );
}
