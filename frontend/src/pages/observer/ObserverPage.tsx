import { useEffect } from "react";
import type { SurfaceQueryState } from "@/entities/surface-observation";
import { activePoint, type Selection, type SelectionActions } from "@/features/select-point";
import { ViewToggleButton } from "@/shared/ui";
import { AnalyticsPanel } from "@/widgets/analytics-panel";
import { MoonGlobe } from "@/widgets/moon-globe";
import { SkyView } from "@/widgets/sky-view";

interface Props {
  selection: Selection;
  queries: SurfaceQueryState[];
  actions: SelectionActions;
}

export function ObserverPage({ selection, queries, actions }: Props) {
  const point = activePoint(selection);
  const query = queries[selection.active];
  const surface = selection.view === "surface" && point !== null;

  useEffect(() => {
    if (!surface && !selection.adding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (surface) actions.toggleView();
      else actions.cancelAdd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [surface, selection.adding, actions]);

  return (
    <div className="grid h-full grid-cols-1 grid-rows-[60vh_auto] max-md:h-auto md:grid-cols-[minmax(0,1fr)_440px] md:grid-rows-1">
      <main className="relative min-h-0 overflow-hidden">
        {surface && point ? (
          <SkyView
            earth={query?.data?.earth ?? null}
            sun={query?.data?.sun ?? null}
            latitudeDeg={point.lat}
            longitudeDeg={point.lon}
          />
        ) : (
          <>
            <MoonGlobe
              points={selection.points}
              active={selection.active}
              onSelect={actions.place}
              onActivate={actions.activate}
            />
            <p className="pointer-events-none absolute bottom-2 left-3 m-0 text-[11px] text-muted-foreground">
              Imagery: NASA Scientific Visualization Studio, LRO
            </p>
          </>
        )}
        <ViewToggleButton
          icon={surface ? "globe" : "person"}
          onClick={actions.toggleView}
          disabled={!point}
          title={
            surface
              ? "Back to the globe (Esc)"
              : point
                ? "Stand on the surface at the active point"
                : "Pick a point on the Moon first"
          }
        >
          {surface ? "Globe view" : "Surface view"}
        </ViewToggleButton>
      </main>
      <aside className="overflow-y-auto border-t border-border bg-card px-5 py-4 md:border-t-0 md:border-l">
        <AnalyticsPanel selection={selection} queries={queries} actions={actions} />
      </aside>
    </div>
  );
}
