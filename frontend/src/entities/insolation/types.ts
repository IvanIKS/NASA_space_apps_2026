export interface InsolationPoint {
  utc: string;
  insolation_watts: number;
}

export interface EarthPoint {
  utc: string;
  elevation_deg: number;
}

export interface SeriesVisibility {
  insolation: boolean;
  earth: boolean;
}
