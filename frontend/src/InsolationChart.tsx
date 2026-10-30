import type { InsolationPoint } from "./api";

interface Props {
  data: InsolationPoint[];
  currentUtc: string;
}

const W = 600, H = 180;
const ML = 48, MR = 12, MT = 10, MB = 34;
const PW = W - ML - MR;
const PH = H - MT - MB;
const MAX_W = 1400;

export function InsolationChart({ data, currentUtc }: Props) {
  if (data.length < 2) return null;

  const t0 = new Date(data[0].utc).getTime();
  const t1 = new Date(data[data.length - 1].utc).getTime();
  const tRange = t1 - t0;

  const px = (utc: string) => ML + ((new Date(utc).getTime() - t0) / tRange) * PW;
  const py = (w: number) => MT + PH - Math.max(0, w / MAX_W) * PH;

  const pts = data.map((d) => `${px(d.utc).toFixed(1)},${py(d.insolation_watts).toFixed(1)}`).join(" ");
  const areaPts = [
    `${ML},${MT + PH}`,
    ...data.map((d) => `${px(d.utc).toFixed(1)},${py(d.insolation_watts).toFixed(1)}`),
    `${(ML + PW).toFixed(1)},${MT + PH}`,
  ].join(" ");

  const curX = px(currentUtc);

  const yTicks = [0, 350, 700, 1050, 1400];
  const labelIdxs = [0, 0.25, 0.5, 0.75, 1].map((f) =>
    Math.round(f * (data.length - 1))
  );

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ margin: "0 0 0.25rem", fontSize: "0.85rem", color: "#aaa" }}>
        Insolation — ±1 lunar day
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", background: "#0a0a0a", borderRadius: 4 }}
      >
        {/* area */}
        <polygon points={areaPts} fill="#f5a00033" />
        {/* line */}
        <polyline points={pts} fill="none" stroke="#f5a000" strokeWidth={1.5} />
        {/* current-time marker */}
        <line
          x1={curX} x2={curX} y1={MT} y2={MT + PH}
          stroke="#55aaff" strokeWidth={1.5} strokeDasharray="4 2"
        />
        {/* axes */}
        <line x1={ML} x2={ML + PW} y1={MT + PH} y2={MT + PH} stroke="#444" />
        <line x1={ML} x2={ML} y1={MT} y2={MT + PH} stroke="#444" />
        {/* y ticks */}
        {yTicks.map((w) => (
          <g key={w}>
            <line x1={ML - 3} x2={ML} y1={py(w)} y2={py(w)} stroke="#444" />
            <text x={ML - 5} y={py(w) + 4} textAnchor="end" fill="#888" fontSize={9}>
              {w}
            </text>
          </g>
        ))}
        {/* x labels */}
        {labelIdxs.map((i) => {
          const d = data[i];
          const x = px(d.utc);
          const label = d.utc.slice(5, 13).replace("-", "/");
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={MT + PH} y2={MT + PH + 3} stroke="#444" />
              <text x={x} y={MT + PH + 14} textAnchor="middle" fill="#888" fontSize={9}>
                {label}
              </text>
            </g>
          );
        })}
        {/* y axis label */}
        <text
          x={12} y={MT + PH / 2}
          fill="#777" fontSize={9} textAnchor="middle"
          transform={`rotate(-90, 12, ${MT + PH / 2})`}
        >
          W/m²
        </text>
        {/* "now" label */}
        <text x={curX + 3} y={MT + 10} fill="#55aaff" fontSize={9}>now</text>
      </svg>
    </div>
  );
}
