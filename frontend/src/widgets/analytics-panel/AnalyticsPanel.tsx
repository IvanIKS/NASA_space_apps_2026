import { useEffect, useMemo, useState, type FormEvent } from "react";
import { InsolationChart, type InsolationSeries } from "@/entities/insolation";
import type { SurfaceQueryState } from "@/entities/surface-observation";
import { activePoint, pointLabel, type Selection, type SelectionActions } from "@/features/select-point";
import { POINT_COLORS } from "@/shared/config";
import { cn, formatDeg as deg, nowUtc } from "@/shared/lib";
import { Button, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui";
import { CompareView } from "./CompareView";
import { EarthElevationChart, type EarthElevationSeries } from "./EarthElevationChart";
import { PointChips } from "./PointChips";

interface Props {
  selection: Selection;
  queries: SurfaceQueryState[];
  actions: SelectionActions;
}

type Tab = "point" | "compare";

export function AnalyticsPanel({ selection, queries, actions }: Props) {
  const point = activePoint(selection);
  const query = queries[selection.active];
  const canCompare = selection.points.length > 1;
  const [tab, setTab] = useState<Tab>("point");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [utc, setUtc] = useState(selection.utc);

  useEffect(() => {
    const prefill = point && !selection.adding;
    setLat(prefill ? String(point.lat) : "");
    setLon(prefill ? String(point.lon) : "");
    setUtc(selection.utc);
  }, [point, selection.utc, selection.adding]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    actions.apply(
      lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : null,
      utc.length === 16 ? `${utc}:00` : utc
    );
  }

  const label = point ? pointLabel(selection.active) : null;
  const color = POINT_COLORS[selection.active];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Analytics</h2>
      <PointChips selection={selection} actions={actions} />

      <form className="grid grid-cols-2 gap-2.5" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <Label htmlFor="lat" className="text-xs text-muted-foreground">Latitude</Label>
          <Input id="lat" type="number" step="any" min={-90} max={90} required={!selection.adding} value={lat}
            onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lon" className="text-xs text-muted-foreground">Longitude</Label>
          <Input id="lon" type="number" step="any" min={-180} max={180} required={!selection.adding} value={lon}
            onChange={(e) => setLon(e.target.value)} />
        </div>
        <div className="col-span-full grid gap-1">
          <Label htmlFor="utc" className="text-xs text-muted-foreground">Time (UTC)</Label>
          <Input id="utc" type="datetime-local" step={1} required value={utc}
            onChange={(e) => setUtc(e.target.value)} />
        </div>
        <div className="col-span-full flex items-center justify-end gap-2">
          {selection.adding ? (
            <span className="mr-auto text-xs text-muted-foreground">Coordinates add point {pointLabel(selection.points.length)}</span>
          ) : canCompare ? (
            <span className="mr-auto text-xs text-muted-foreground">Time applies to all points</span>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => setUtc(nowUtc())}>Now</Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>

      {!point && <p className="mt-4 text-muted-foreground">Click anywhere on the Moon to pick a point.</p>}

      {point && (
        <Tabs value={canCompare ? tab : "point"} onValueChange={(v) => setTab(v as Tab)} className="mt-5">
          <TabsList className="w-full">
            <TabsTrigger value="point">
              <span className="size-2 rounded-full" style={{ background: color }} /> Point {label}
            </TabsTrigger>
            <TabsTrigger value="compare" disabled={!canCompare}>
              Compare
            </TabsTrigger>
          </TabsList>
          {!canCompare && <p className="m-0 text-xs text-muted-foreground">Add a second point to compare.</p>}
          <TabsContent value="point">
            <PointView query={query} utc={selection.utc} color={color} />
          </TabsContent>
          <TabsContent value="compare">
            <CompareView queries={queries} utc={selection.utc} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PointView({ query, utc, color }: { query: SurfaceQueryState; utc: string; color: string }) {
  const { data, loading, error } = query;
  const series = useMemo<InsolationSeries[]>(
    () => (data ? [{ name: "Illumination", color, data: data.insolation.insolation_graph }] : []),
    [data, color]
  );
  if (error) return <p className="mt-2 whitespace-pre-wrap text-destructive">{error}</p>;
  if (!data) return <p className="mt-2 text-muted-foreground">Loading…</p>;
  return (
    <div className={cn("mt-2 transition-opacity", loading && "opacity-50")}>
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

      <h3 className="mt-5 mb-1 font-medium text-muted-foreground">Earth Line-of-Sight</h3>
      <EarthVisibilitySection visibility={data.earth_visibility} utc={utc} color={color} />

      <h3 className="mt-5 mb-1 font-medium text-muted-foreground">Illumination</h3>
      <p className="m-0 text-2xl tabular-nums">
        {data.insolation.insolation_watts.toFixed(1)}{" "}
        <span className="text-[13px] text-muted-foreground">W/m² now</span>
      </p>
      <InsolationChart series={series} currentUtc={utc} />
      <p className="mt-1 text-xs text-muted-foreground">±1 lunar day around the selected time, hourly samples.</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function shortUtc(iso: string): string {
  return iso.slice(5, 16).replace("T", " ");
}

function EarthVisibilitySection({
  visibility,
  utc,
  color,
}: {
  visibility: NonNullable<SurfaceQueryState["data"]>["earth_visibility"];
  utc: string;
  color: string;
}) {
  const earthSeries = useMemo<EarthElevationSeries[]>(
    () =>
      visibility.elevation_graph?.length
        ? [{ name: "Earth elevation", color, data: visibility.elevation_graph }]
        : [],
    [visibility.elevation_graph, color]
  );

  if (visibility.always_visible) {
    return (
      <div>
        <p className="m-0 text-xs text-muted-foreground">
          Always in direct view (100% of ±1 lunar day, max {deg(visibility.windows[0]?.max_elevation_deg ?? 0)}).
        </p>
        {earthSeries.length > 0 && <EarthElevationChart series={earthSeries} currentUtc={utc} />}
      </div>
    );
  }
  if (visibility.never_visible) {
    return (
      <div>
        <p className="m-0 text-xs text-muted-foreground">
          Never in direct view (0% of ±1 lunar day — far side).
        </p>
        {earthSeries.length > 0 && <EarthElevationChart series={earthSeries} currentUtc={utc} />}
      </div>
    );
  }
  const pct = (visibility.visible_fraction * 100).toFixed(1);
  return (
    <div>
      <p className="m-0 text-xs text-muted-foreground">
        Visible {pct}% of ±1 lunar day ({visibility.windows.length}{" "}
        {visibility.windows.length === 1 ? "window" : "windows"}).
      </p>
      {earthSeries.length > 0 && <EarthElevationChart series={earthSeries} currentUtc={utc} />}
      <table className="mt-2 w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 text-left font-medium">Rise (UTC)</th>
            <th className="py-1 text-left font-medium">Set (UTC)</th>
            <th className="py-1 text-right font-medium">Duration</th>
            <th className="py-1 text-right font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {visibility.windows.map((w, i) => (
            <tr key={i} className="border-t border-border">
              <td className="py-1">{w.clipped_start ? `≤ ${shortUtc(w.rise_utc)}` : shortUtc(w.rise_utc)}</td>
              <td className="py-1">{w.clipped_end ? `≥ ${shortUtc(w.set_utc)}` : shortUtc(w.set_utc)}</td>
              <td className="py-1 text-right">{formatDuration(w.duration_s)}</td>
              <td className="py-1 text-right">{deg(w.max_elevation_deg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
