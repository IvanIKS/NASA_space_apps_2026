import { useCallback } from "react";
import { useSurfaceQuery } from "@/entities/surface-observation";
import { useSelection } from "@/features/select-point";
import { ObserverPage } from "@/pages/observer";
import { roundCoord, type LatLon } from "@/shared/lib";

export default function App() {
  const [selection, setSelection] = useSelection();
  const query = useSurfaceQuery(selection.point, selection.utc);

  const selectPoint = useCallback(
    ({ lat, lon }: LatLon) => setSelection((s) => ({ ...s, point: { lat: roundCoord(lat), lon: roundCoord(lon) } })),
    [setSelection]
  );
  const toggleView = useCallback(
    () => setSelection((s) => ({ ...s, view: s.view === "surface" ? "globe" : "surface" })),
    [setSelection]
  );

  return (
    <ObserverPage
      selection={selection}
      query={query}
      onChange={setSelection}
      onSelectPoint={selectPoint}
      onToggleView={toggleView}
    />
  );
}
