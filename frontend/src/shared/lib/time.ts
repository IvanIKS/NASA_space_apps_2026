export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19);
}
