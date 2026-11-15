export interface InsolationPoint {
  utc: string;
  insolation_watts: number;
}

export interface EarthPoint {
  utc: string;
  azimuth_deg: number;
  elevation_deg: number;
}

export interface SeriesVisibility {
  insolation: boolean;
  earth: boolean;
}
