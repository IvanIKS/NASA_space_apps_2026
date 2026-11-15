export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19);
}

export function shiftUtc(utc: string, hours: number): string {
  return new Date(Date.parse(`${utc}Z`) + hours * 3_600_000).toISOString().slice(0, 19);
}
