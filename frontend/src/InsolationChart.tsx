import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { InsolationPoint } from "./api";

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

interface Props {
  data: InsolationPoint[];
  currentUtc: string;
}

const ACCENT = "#f5a000";
const NOW = "#55aaff";
const AXIS = "#3a4250";
const LABEL = "#8a93a3";

// "2026-09-18T16:30:57" → "09-18 16:30"
const shortUtc = (utc: string) => utc.slice(5, 16).replace("T", " ");

export function InsolationChart({ data, currentUtc }: Props) {
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
    // The series is evenly sampled, so a category axis of the backend's own UTC strings is exact.
    // Both sides use the same ISO format, so a string comparison finds the "now" sample.
    const nowIdx = data.findIndex((d) => d.utc >= currentUtc);
    chartRef.current?.setOption(
      {
        animation: false,
        grid: { left: 48, right: 16, top: 24, bottom: 64 },
        tooltip: {
          trigger: "axis",
          valueFormatter: (v: unknown) => `${Number(v).toFixed(1)} W/m²`,
        },
        xAxis: {
          type: "category",
          data: data.map((d) => d.utc),
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
        dataZoom: [
          { type: "inside" },
          { type: "slider", height: 18, bottom: 8, borderColor: AXIS, textStyle: { color: LABEL } },
        ],
        series: [
          {
            type: "line",
            data: data.map((d) => d.insolation_watts),
            showSymbol: false,
            sampling: "lttb",
            color: ACCENT,
            lineStyle: { width: 1.5 },
            areaStyle: { opacity: 0.15 },
            markLine:
              nowIdx >= 0
                ? {
                    symbol: "none",
                    silent: true,
                    lineStyle: { color: NOW, type: "dashed" },
                    label: { formatter: "now", color: NOW },
                    // The category string, not the index: with lttb sampling an index is ambiguous.
                    data: [{ xAxis: data[nowIdx].utc }],
                  }
                : undefined,
          },
        ],
      },
      { notMerge: true }
    );
  }, [data, currentUtc]);

  return <div ref={elRef} className="chart" />;
}
