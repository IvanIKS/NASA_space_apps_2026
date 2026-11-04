import { useCallback } from "react";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { MoonGlobe } from "./MoonGlobe";
import SkyView from "./SkyView";
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
  const enterSurface = useCallback(() => setSelection((s) => ({ ...s, view: "surface" })), [setSelection]);
  const exitSurface = useCallback(() => setSelection((s) => ({ ...s, view: "globe" })), [setSelection]);

  // The surface view replaces the page rather than overlaying it, so only one WebGL scene runs at a time.
  if (selection.view === "surface" && selection.point) {
    return (
      <SkyView
        onExit={exitSurface}
        earth={query.data?.earth ?? null}
        sun={query.data?.sun ?? null}
        latitudeDeg={selection.point.lat}
        longitudeDeg={selection.point.lon}
      />
    );
  }

  return (
    <div className="layout">
      <main className="map">
        <MoonGlobe point={selection.point} onSelect={handleSelect} />
        <p className="credit">Imagery: NASA Scientific Visualization Studio, LRO</p>
        <button
          type="button"
          className="surface-toggle"
          onClick={enterSurface}
          disabled={!selection.point}
          title={selection.point ? "Stand on the surface at the selected point" : "Pick a point on the Moon first"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="4.5" r="2.5" fill="currentColor" />
            <path
              d="M9 8h6l2 7h-2.2L14 11v10h-2v-6h-1v6H9V11l-.8 4H6z"
              fill="currentColor"
            />
          </svg>
          Surface view
        </button>
      </main>
      <aside className="panel">
        <AnalyticsPanel selection={selection} onChange={setSelection} query={query} />
      </aside>
    </div>
  );
}
