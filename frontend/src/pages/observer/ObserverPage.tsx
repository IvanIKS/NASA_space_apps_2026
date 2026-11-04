import type { SurfaceQueryState } from "@/entities/surface-observation";
import type { Selection } from "@/features/select-point";
import type { LatLon } from "@/shared/lib";
import { ViewToggleButton } from "@/shared/ui";
import { AnalyticsPanel } from "@/widgets/analytics-panel";
import { MoonGlobe } from "@/widgets/moon-globe";
import "./observer-page.css";

interface Props {
  selection: Selection;
  query: SurfaceQueryState;
  onChange: (selection: Selection) => void;
  onSelectPoint: (point: LatLon) => void;
  onEnterSurface: () => void;
}

/** Main page: globe on the left, analytics for the selected point on the right. */
export function ObserverPage({ selection, query, onChange, onSelectPoint, onEnterSurface }: Props) {
  return (
    <div className="layout">
      <main className="map">
        <MoonGlobe point={selection.point} onSelect={onSelectPoint} />
        <p className="credit">Imagery: NASA Scientific Visualization Studio, LRO</p>
        <ViewToggleButton
          icon="person"
          onClick={onEnterSurface}
          disabled={!selection.point}
          title={selection.point ? "Stand on the surface at the selected point" : "Pick a point on the Moon first"}
        >
          Surface view
        </ViewToggleButton>
      </main>
      <aside className="panel">
        <AnalyticsPanel selection={selection} onChange={onChange} query={query} />
      </aside>
    </div>
  );
}
