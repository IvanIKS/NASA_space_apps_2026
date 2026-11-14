import type { InsolationPoint } from "./types";

export interface Transition {
  kind: "sunrise" | "sunset";
  /** Backend format, same as the series. */
  utc: string;
}

const lit = (p: InsolationPoint) => p.insolation_watts > 0;

/** The first sunrise or sunset after `nowUtc` in the series, or null if none before the series ends. */
export function nextTransition(data: InsolationPoint[], nowUtc: string): Transition | null {
  const start = data.findIndex((d) => d.utc >= nowUtc);
  if (start < 0) return null;
  const litNow = lit(data[start]);
  for (let i = start + 1; i < data.length; i += 1) {
    if (lit(data[i]) !== litNow) return { kind: lit(data[i]) ? "sunrise" : "sunset", utc: data[i].utc };
  }
  return null;
}

/** Share of samples with any sunlight: 0.5 at the equator, higher on peaks of eternal light. */
export function litFraction(data: InsolationPoint[]): number {
  return data.length === 0 ? 0 : data.filter(lit).length / data.length;
}

/** Hours from `from` to `to`; both in the backend's UTC format. */
export function hoursBetween(from: string, to: string): number {
  return (Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 3_600_000;
}

/** "3d 4h", "5h", "<1h". */
export function formatHours(hours: number): string {
  const h = Math.round(hours);
  if (h < 1) return "<1h";
  const days = Math.floor(h / 24);
  const rest = h % 24;
  return days > 0 ? (rest > 0 ? `${days}d ${rest}h` : `${days}d`) : `${rest}h`;
}
