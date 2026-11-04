import type { SurfaceQueryResponse } from "@/entities/surface-observation";
import type { LatLon } from "@/shared/lib";
import { SkyView } from "@/widgets/sky-view";

interface Props {
  point: LatLon;
  data: SurfaceQueryResponse | null;
  onExit: () => void;
}

/** Full-screen first-person view standing at the selected point. */
export function SurfacePage({ point, data, onExit }: Props) {
  return (
    <SkyView
      onExit={onExit}
      earth={data?.earth ?? null}
      sun={data?.sun ?? null}
      latitudeDeg={point.lat}
      longitudeDeg={point.lon}
    />
  );
}
