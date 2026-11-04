import type { SurfaceQueryState } from "@/entities/surface-observation";
import type { Selection } from "@/features/select-point";
import type { LatLon } from "@/shared/lib";
import { ViewToggleButton } from "@/shared/ui";
import { AnalyticsPanel } from "@/widgets/analytics-panel";
import { MoonGlobe } from "@/widgets/moon-globe";

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
    <div className="grid h-full grid-cols-1 grid-rows-[60vh_auto] max-md:h-auto md:grid-cols-[minmax(0,1fr)_440px] md:grid-rows-1">
      <main className="relative min-h-0 overflow-hidden">
        <MoonGlobe point={selection.point} onSelect={onSelectPoint} />
        <p className="pointer-events-none absolute bottom-2 left-3 m-0 text-[11px] text-muted-foreground">
          Imagery: NASA Scientific Visualization Studio, LRO
        </p>
        <ViewToggleButton
          icon="person"
          onClick={onEnterSurface}
          disabled={!selection.point}
          title={selection.point ? "Stand on the surface at the selected point" : "Pick a point on the Moon first"}
        >
          Surface view
        </ViewToggleButton>
      </main>
      <aside className="overflow-y-auto border-t border-border bg-card px-5 py-4 md:border-t-0 md:border-l">
        <AnalyticsPanel selection={selection} onChange={onChange} query={query} />
      </aside>
    </div>
  );
}
