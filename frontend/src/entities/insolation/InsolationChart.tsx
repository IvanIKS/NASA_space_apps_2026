import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EarthPoint, InsolationPoint, SeriesVisibility } from "./types";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

export interface InsolationSeries {
  name: string;
  color: string;
  data: InsolationPoint[];
  earth?: EarthPoint[] | null;
}

interface Props {
  series: InsolationSeries[];
  currentUtc: string;
  visible?: SeriesVisibility;
}

const NOW = "#e6e8ec";
const AXIS = "#3a4250";
const LABEL = "#8a93a3";
const HORIZON = "#55606f";
const BOTH: SeriesVisibility = { insolation: true, earth: true };

const shortUtc = (utc: string) => utc.slice(5, 16).replace("T", " ");

interface TooltipParam {
  seriesName: string;
  seriesIndex: number;
  axisValue: string;
  value: number;
  marker: string;
}

export function InsolationChart({ series, currentUtc, visible = BOTH }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts>();

  useEffect(() => {
    const chart = echarts.init(elRef.current!);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current!);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const axis = series[0]?.data ?? [];
    const nowIdx = axis.findIndex((d) => d.utc >= currentUtc);
    const multi = series.length > 1;
    const showInsolation = visible.insolation;
    const showEarth = visible.earth && series.some((s) => s.earth && s.earth.length > 0);
    const kinds: ("insolation" | "earth")[] = [];
    const lines = series.flatMap((s, i) => {
      const out = [];
      if (showInsolation) {
        kinds.push("insolation");
        out.push({
          type: "line",
          name: s.name,
          yAxisIndex: 0,
          data: s.data.map((d) => d.insolation_watts),
          showSymbol: false,
          sampling: "lttb",
          color: s.color,
          lineStyle: { width: 1.5 },
          areaStyle: multi || showEarth ? undefined : { opacity: 0.15 },
          markLine:
            i === 0 && nowIdx >= 0
              ? {
                  symbol: "none",
                  silent: true,
                  lineStyle: { color: NOW, type: "dashed" },
                  label: { formatter: "now", color: NOW },
                  data: [{ xAxis: axis[nowIdx].utc }],
                }
              : undefined,
        });
      }
      if (showEarth && s.earth) {
        kinds.push("earth");
        const byUtc = new Map(s.earth.map((d) => [d.utc, d.elevation_deg]));
        out.push({
          type: "line",
          name: s.name,
          yAxisIndex: 1,
          data: axis.map((d) => byUtc.get(d.utc) ?? null),
          showSymbol: false,
          sampling: "lttb",
          color: s.color,
          lineStyle: { width: 1.5, type: "dashed" },
          markLine:
            i === 0
              ? {
                  symbol: "none",
                  silent: true,
                  lineStyle: { color: HORIZON, type: "dotted" },
                  label: { formatter: "horizon", color: HORIZON, position: "insideEndTop" },
                  data: [{ yAxis: 0 }],
                }
              : undefined,
        });
      }
      return out;
    });

    chartRef.current?.setOption(
      {
        animation: false,
        grid: { left: 48, right: showEarth ? 44 : 16, top: multi ? 36 : 24, bottom: 28 },
        legend: multi
          ? { top: 0, data: series.map((s) => s.name), textStyle: { color: LABEL }, itemWidth: 14, itemHeight: 2 }
          : undefined,
        tooltip: {
          trigger: "axis",
          formatter: (params: TooltipParam[]) => {
            const rows = params.map((p) => {
              const kind = kinds[p.seriesIndex];
              const value =
                kind === "earth" ? `Earth ${Number(p.value).toFixed(1)}°` : `${Number(p.value).toFixed(1)} W/m²`;
              return `${p.marker} ${multi ? `${p.seriesName} · ` : ""}${value}`;
            });
            return [shortUtc(params[0].axisValue), ...rows].join("<br/>");
          },
        },
        xAxis: {
          type: "category",
          data: axis.map((d) => d.utc),
          boundaryGap: false,
          axisLine: { lineStyle: { color: AXIS } },
          axisLabel: { color: LABEL, formatter: shortUtc },
        },
        yAxis: [
          {
            type: "value",
            name: "W/m²",
            min: 0,
            show: showInsolation,
            nameTextStyle: { color: LABEL },
            axisLabel: { color: LABEL },
            splitLine: { show: showInsolation, lineStyle: { color: "#1c222c" } },
          },
          {
            type: "value",
            name: "Earth °",
            min: -90,
            max: 90,
            interval: 30,
            show: showEarth,
            position: "right",
            nameTextStyle: { color: LABEL },
            axisLabel: { color: LABEL },
            splitLine: { show: !showInsolation, lineStyle: { color: "#1c222c" } },
          },
        ],
        dataZoom: [{ type: "inside" }],
        series: lines,
      },
      { notMerge: true }
    );
  }, [series, currentUtc, visible]);

  return <div ref={elRef} className="mt-2 -mx-2 h-[230px]" />;
}
