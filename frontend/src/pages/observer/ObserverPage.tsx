import { useEffect } from "react";
import type { SurfaceQueryState } from "@/entities/surface-observation";
import type { Selection } from "@/features/select-point";
import type { LatLon } from "@/shared/lib";
import { ViewToggleButton } from "@/shared/ui";
import { AnalyticsPanel } from "@/widgets/analytics-panel";
import { MoonGlobe } from "@/widgets/moon-globe";
import { SkyView } from "@/widgets/sky-view";

interface Props {
  selection: Selection;
  query: SurfaceQueryState;
  onChange: (selection: Selection) => void;
  onSelectPoint: (point: LatLon) => void;
  onToggleView: () => void;
}

/**
 * Main page: the map column on the left shows either the globe or the first-person view at the
 * selected point; the analytics panel on the right stays put in both.
 */
export function ObserverPage({ selection, query, onChange, onSelectPoint, onToggleView }: Props) {
  const point = selection.point;
  const surface = selection.view === "surface" && point !== null;

  // Esc leaves the surface view, like closing a Street View panorama.
  useEffect(() => {
    if (!surface) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggleView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [surface, onToggleView]);

  return (
    <div className="grid h-full grid-cols-1 grid-rows-[60vh_auto] max-md:h-auto md:grid-cols-[minmax(0,1fr)_440px] md:grid-rows-1">
      <main className="relative min-h-0 overflow-hidden">
        {surface && point ? (
          <SkyView
            earth={query.data?.earth ?? null}
            sun={query.data?.sun ?? null}
            latitudeDeg={point.lat}
            longitudeDeg={point.lon}
          />
        ) : (
          <>
            <MoonGlobe point={point} onSelect={onSelectPoint} />
            <p className="pointer-events-none absolute bottom-2 left-3 m-0 text-[11px] text-muted-foreground">
              Imagery: NASA Scientific Visualization Studio, LRO
            </p>
          </>
        )}
        <ViewToggleButton
          icon={surface ? "globe" : "person"}
          onClick={onToggleView}
          disabled={!point}
          title={
            surface
              ? "Back to the globe (Esc)"
              : point
                ? "Stand on the surface at the selected point"
                : "Pick a point on the Moon first"
          }
        >
          {surface ? "Globe view" : "Surface view"}
        </ViewToggleButton>
      </main>
      <aside className="overflow-y-auto border-t border-border bg-card px-5 py-4 md:border-t-0 md:border-l">
        <AnalyticsPanel selection={selection} onChange={onChange} query={query} />
      </aside>
    </div>
  );
}
