export interface InsolationPoint {
  /** Backend format: YYYY-MM-DDTHH:MM:SS, no timezone suffix. */
  utc: string;
  insolation_watts: number;
}
