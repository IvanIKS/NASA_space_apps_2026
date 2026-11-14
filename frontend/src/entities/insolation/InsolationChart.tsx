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
import type { InsolationPoint } from "./types";

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
}

interface Props {
  /** One or more series sampled at the same times (same request time), so they share the x axis. */
  series: InsolationSeries[];
  currentUtc: string;
}

const NOW = "#55aaff";
const AXIS = "#3a4250";
const LABEL = "#8a93a3";

// "2026-09-18T16:30:57" → "09-18 16:30"
const shortUtc = (utc: string) => utc.slice(5, 16).replace("T", " ");

export function InsolationChart({ series, currentUtc }: Props) {
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
    // The series is evenly sampled, so a category axis of the backend's own UTC strings is exact.
    // Both sides use the same ISO format, so a string comparison finds the "now" sample.
    const nowIdx = axis.findIndex((d) => d.utc >= currentUtc);
    const multi = series.length > 1;
    chartRef.current?.setOption(
      {
        animation: false,
        grid: { left: 48, right: 16, top: multi ? 36 : 24, bottom: 28 },
        legend: multi ? { top: 0, textStyle: { color: LABEL }, itemWidth: 14, itemHeight: 2 } : undefined,
        tooltip: {
          trigger: "axis",
          valueFormatter: (v: unknown) => `${Number(v).toFixed(1)} W/m²`,
        },
        xAxis: {
          type: "category",
          data: axis.map((d) => d.utc),
          boundaryGap: false,
          axisLine: { lineStyle: { color: AXIS } },
          axisLabel: { color: LABEL, formatter: shortUtc },
        },
        yAxis: {
          type: "value",
          name: "W/m²",
          min: 0,
          nameTextStyle: { color: LABEL },
          axisLabel: { color: LABEL },
          splitLine: { lineStyle: { color: "#1c222c" } },
        },
        // Wheel/pinch zoom only; the slider's thumbnail of the series confused people.
        dataZoom: [{ type: "inside" }],
        series: series.map((s, i) => ({
          type: "line",
          name: s.name,
          data: s.data.map((d) => d.insolation_watts),
          showSymbol: false,
          sampling: "lttb",
          color: s.color,
          lineStyle: { width: 1.5 },
          // A fill reads well for one curve; several fills just hide each other.
          areaStyle: multi ? undefined : { opacity: 0.15 },
          markLine:
            i === 0 && nowIdx >= 0
              ? {
                  symbol: "none",
                  silent: true,
                  lineStyle: { color: NOW, type: "dashed" },
                  label: { formatter: "now", color: NOW },
                  // The category string, not the index: with lttb sampling an index is ambiguous.
                  data: [{ xAxis: axis[nowIdx].utc }],
                }
              : undefined,
        })),
      },
      { notMerge: true }
    );
  }, [series, currentUtc]);

  return <div ref={elRef} className="mt-2 -mx-2 h-[230px]" />;
}
