import { useEffect, useMemo, useState } from "react";
import {
  formatHours,
  hoursBetween,
  InsolationChart,
  litFraction,
  nextTransition,
  type InsolationSeries,
} from "@/entities/insolation";
import type { SurfaceQueryState } from "@/entities/surface-observation";
import { pointLabel } from "@/features/select-point";
import { POINT_COLORS } from "@/shared/config";
import { cn, formatDeg as deg } from "@/shared/lib";
import { EarthElevationChart, type EarthElevationSeries } from "./EarthElevationChart";

interface Props {
  queries: SurfaceQueryState[];
  utc: string;
}

interface Row {
  index: number;
  sunEl: number;
  earthEl: number;
  earthLos: number;
  watts: number;
  lit: number;
  next: string;
}

interface Snapshot {
  queries: SurfaceQueryState[];
  utc: string;
}

export function CompareView({ queries, utc }: Props) {
  const settled = queries.every((q) => !q.loading);
  const [snapshot, setSnapshot] = useState<Snapshot>({ queries, utc });
  useEffect(() => {
    if (settled) setSnapshot({ queries, utc });
  }, [settled, queries, utc]);
  const shown = settled ? { queries, utc } : snapshot;

  const rows = useMemo<(Row | null)[]>(
    () =>
      shown.queries.map(({ data }, index) => {
        if (!data) return null;
        const utc = shown.utc;
        const graph = data.insolation.insolation_graph;
        const t = nextTransition(graph, utc);
        return {
          index,
          sunEl: data.sun.elevation_deg,
          earthEl: data.earth.elevation_deg,
          earthLos: data.earth_visibility.visible_fraction,
          watts: data.insolation.insolation_watts,
          lit: litFraction(graph),
          next: t ? `${t.kind === "sunrise" ? "↑" : "↓"} ${formatHours(hoursBetween(utc, t.utc))}` : "—",
        };
      }),
    [shown]
  );
  const loaded = rows.filter((r): r is Row => r !== null);
  const best = (key: "sunEl" | "watts" | "lit" | "earthLos") => {
    const values = loaded.map((r) => r[key]);
    const max = Math.max(...values);
    return values.some((v) => v !== max) ? max : NaN;
  };
  const bestSunEl = best("sunEl");
  const bestEarthLos = best("earthLos");
  const bestWatts = best("watts");
  const bestLit = best("lit");
  const series = useMemo<InsolationSeries[]>(
    () =>
      shown.queries.flatMap((q, index) =>
        q.data ? [{ name: pointLabel(index), color: POINT_COLORS[index], data: q.data.insolation.insolation_graph }] : []
      ),
    [shown]
  );
  const earthSeries = useMemo<EarthElevationSeries[]>(
    () =>
      shown.queries.flatMap((q, index) =>
        q.data?.earth_visibility.elevation_graph?.length
          ? [{ name: pointLabel(index), color: POINT_COLORS[index], data: q.data.earth_visibility.elevation_graph }]
          : []
      ),
    [shown]
  );

  const hi = (on: boolean) => cn("py-1.5 text-right", on && "font-semibold text-foreground");

  return (
    <div className={cn("transition-opacity", !settled && "opacity-50")}>
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 text-left font-medium">Point</th>
            <th className="py-1 text-right font-medium" title="Sun elevation">Sun</th>
            <th className="py-1 text-right font-medium" title="Earth elevation">Earth</th>
            <th className="py-1 text-right font-medium" title="Share of ±1 lunar day with direct Earth line-of-sight">LOS</th>
            <th className="py-1 text-right font-medium" title="Illumination now">W/m²</th>
            <th className="py-1 text-right font-medium" title="Share of the lunar day in sunlight">Lit</th>
            <th className="py-1 text-right font-medium" title="Next sunrise ↑ or sunset ↓">Next</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {rows.map((r, index) => (
            <tr key={index} className="border-t border-border">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="size-2 rounded-full" style={{ background: POINT_COLORS[index] }} />
                  {pointLabel(index)}
                </span>
              </td>
              {r ? (
                <>
                  <td className={hi(r.sunEl === bestSunEl)}>{deg(r.sunEl)}</td>
                  <td className="py-1.5 text-right">{deg(r.earthEl)}</td>
                  <td className={hi(r.earthLos === bestEarthLos)}>{Math.round(r.earthLos * 100)}%</td>
                  <td className={hi(r.watts === bestWatts)}>{r.watts.toFixed(0)}</td>
                  <td className={hi(r.lit === bestLit)}>{Math.round(r.lit * 100)}%</td>
                  <td className="py-1.5 text-right whitespace-nowrap">{r.next}</td>
                </>
              ) : (
                <td className="py-1.5 text-right" colSpan={6}>
                  {shown.queries[index].error ? <span className="text-destructive">error</span> : "…"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Sun and Earth elevation at the selected time; Lit is the share of ±1 lunar day with sunlight; Next is the time
        to the next sunrise ↑ or sunset ↓. Best values in bold.
      </p>

      {series.length > 0 && (
        <>
          <h3 className="mt-5 mb-1 font-medium text-muted-foreground">Illumination</h3>
          <InsolationChart series={series} currentUtc={shown.utc} />
          <p className="mt-1 text-xs text-muted-foreground">±1 lunar day around the selected time, hourly samples.</p>
        </>
      )}

      {earthSeries.length > 0 && (
        <>
          <h3 className="mt-5 mb-1 font-medium text-muted-foreground">Earth Elevation</h3>
          <EarthElevationChart series={earthSeries} currentUtc={shown.utc} />
          <p className="mt-1 text-xs text-muted-foreground">Earth angle above the horizon (0° = horizon), hourly samples.</p>
        </>
      )}
    </div>
  );
}
