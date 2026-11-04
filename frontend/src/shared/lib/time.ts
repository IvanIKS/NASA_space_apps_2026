/** Current time in the backend's format: YYYY-MM-DDTHH:MM:SS, no timezone suffix. */
export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19);
}
