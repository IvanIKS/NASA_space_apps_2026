import type { InsolationPoint } from "./types";

export interface Transition {
  kind: "sunrise" | "sunset";
  utc: string;
}

const lit = (p: InsolationPoint) => p.insolation_watts > 0;

export function nextTransition(data: InsolationPoint[], nowUtc: string): Transition | null {
  const start = data.findIndex((d) => d.utc >= nowUtc);
  if (start < 0) return null;
  const litNow = lit(data[start]);
  for (let i = start + 1; i < data.length; i += 1) {
    if (lit(data[i]) !== litNow) return { kind: lit(data[i]) ? "sunrise" : "sunset", utc: data[i].utc };
  }
  return null;
}

export function litFraction(data: InsolationPoint[]): number {
  return data.length === 0 ? 0 : data.filter(lit).length / data.length;
}

export function hoursBetween(from: string, to: string): number {
  return (Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 3_600_000;
}

export function formatHours(hours: number): string {
  const h = Math.round(hours);
  if (h < 1) return "<1h";
  const days = Math.floor(h / 24);
  const rest = h % 24;
  return days > 0 ? (rest > 0 ? `${days}d ${rest}h` : `${days}d`) : `${rest}h`;
}
