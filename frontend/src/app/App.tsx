import { useCallback } from "react";
import { useSurfaceQuery } from "@/entities/surface-observation";
import { useSelection } from "@/features/select-point";
import { ObserverPage } from "@/pages/observer";
import { SurfacePage } from "@/pages/surface";
import { roundCoord, type LatLon } from "@/shared/lib";

export default function App() {
  const [selection, setSelection] = useSelection();
  const query = useSurfaceQuery(selection.point, selection.utc);

  const selectPoint = useCallback(
    ({ lat, lon }: LatLon) => setSelection((s) => ({ ...s, point: { lat: roundCoord(lat), lon: roundCoord(lon) } })),
    [setSelection]
  );
  const enterSurface = useCallback(() => setSelection((s) => ({ ...s, view: "surface" })), [setSelection]);
  const exitSurface = useCallback(() => setSelection((s) => ({ ...s, view: "globe" })), [setSelection]);

  // The surface view replaces the page rather than overlaying it, so only one WebGL scene runs at a time.
  if (selection.view === "surface" && selection.point) {
    return <SurfacePage point={selection.point} data={query.data} onExit={exitSurface} />;
  }

  return (
    <ObserverPage
      selection={selection}
      query={query}
      onChange={setSelection}
      onSelectPoint={selectPoint}
      onEnterSurface={enterSurface}
    />
  );
}
