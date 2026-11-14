import { useSurfaceQueries } from "@/entities/surface-observation";
import { useSelection } from "@/features/select-point";
import { ObserverPage } from "@/pages/observer";

export default function App() {
  const [selection, actions] = useSelection();
  const queries = useSurfaceQueries(selection.points, selection.utc, selection.days, selection.revision);

  return <ObserverPage selection={selection} queries={queries} actions={actions} />;
}
