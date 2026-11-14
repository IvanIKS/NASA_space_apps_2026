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
  series: InsolationSeries[];
  currentUtc: string;
}

const NOW = "#e6e8ec";
const AXIS = "#3a4250";
const LABEL = "#8a93a3";

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
        dataZoom: [{ type: "inside" }],
        series: series.map((s, i) => ({
          type: "line",
          name: s.name,
          data: s.data.map((d) => d.insolation_watts),
          showSymbol: false,
          sampling: "lttb",
          color: s.color,
          lineStyle: { width: 1.5 },
          areaStyle: multi ? undefined : { opacity: 0.15 },
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
        })),
      },
      { notMerge: true }
    );
  }, [series, currentUtc]);

  return <div ref={elRef} className="mt-2 -mx-2 h-[230px]" />;
}
