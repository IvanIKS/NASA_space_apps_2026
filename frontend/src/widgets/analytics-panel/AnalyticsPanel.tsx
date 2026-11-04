import { useEffect, useState, type FormEvent } from "react";
import { InsolationChart } from "@/entities/insolation";
import type { SurfaceQueryState } from "@/entities/surface-observation";
import type { Selection } from "@/features/select-point";
import { cn, formatDeg as deg, nowUtc } from "@/shared/lib";
import { Button, Input, Label } from "@/shared/ui";

interface Props {
  selection: Selection;
  onChange: (selection: Selection) => void;
  query: SurfaceQueryState;
}

export function AnalyticsPanel({ selection, onChange, query }: Props) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [utc, setUtc] = useState(selection.utc);

  // A click on the globe overwrites whatever is being typed.
  useEffect(() => {
    setLat(selection.point ? String(selection.point.lat) : "");
    setLon(selection.point ? String(selection.point.lon) : "");
    setUtc(selection.utc);
  }, [selection]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onChange({
      ...selection,
      point: lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : selection.point,
      // datetime-local drops ":00" seconds; the backend wants the full HH:MM:SS.
      utc: utc.length === 16 ? `${utc}:00` : utc,
    });
  }

  const { data, loading, error } = query;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Analytics</h2>

      <form className="grid grid-cols-2 gap-2.5" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <Label htmlFor="lat" className="text-xs text-muted-foreground">Latitude</Label>
          <Input id="lat" type="number" step="any" min={-90} max={90} required value={lat}
            onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lon" className="text-xs text-muted-foreground">Longitude</Label>
          <Input id="lon" type="number" step="any" min={-180} max={180} required value={lon}
            onChange={(e) => setLon(e.target.value)} />
        </div>
        <div className="col-span-full grid gap-1">
          <Label htmlFor="utc" className="text-xs text-muted-foreground">Time (UTC)</Label>
          <Input id="utc" type="datetime-local" step={1} required value={utc}
            onChange={(e) => setUtc(e.target.value)} />
        </div>
        <div className="col-span-full flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setUtc(nowUtc())}>Now</Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>

      {!selection.point && <p className="mt-4 text-muted-foreground">Click anywhere on the Moon to pick a point.</p>}
      {error && <p className="mt-4 whitespace-pre-wrap text-destructive">{error}</p>}

      {data && (
        <div className={cn("mt-5 transition-opacity", loading && "opacity-50")}>
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="text-xs font-medium text-muted-foreground">
                <th /><th className="py-1 text-right">Azimuth</th><th className="py-1 text-right">Elevation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1">Sun</td>
                <td className="py-1 text-right">{deg(data.sun.azimuth_deg)}</td>
                <td className="py-1 text-right">{deg(data.sun.elevation_deg)}</td>
              </tr>
              <tr>
                <td className="py-1">Earth</td>
                <td className="py-1 text-right">{deg(data.earth.azimuth_deg)}</td>
                <td className="py-1 text-right">{deg(data.earth.elevation_deg)}</td>
              </tr>
            </tbody>
          </table>

          <h3 className="mt-5 mb-1 font-medium text-muted-foreground">Illumination</h3>
          <p className="m-0 text-2xl tabular-nums">
            {data.insolation.insolation_watts.toFixed(1)}{" "}
            <span className="text-[13px] text-muted-foreground">W/m² now</span>
          </p>
          <InsolationChart data={data.insolation.insolation_graph} currentUtc={selection.utc} />
          <p className="mt-1 text-xs text-muted-foreground">±1 lunar day around the selected time, hourly samples.</p>
        </div>
      )}
      {loading && !data && <p className="mt-4 text-muted-foreground">Loading…</p>}
    </div>
  );
}
