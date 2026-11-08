export interface OmmRecord {
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  OBJECT_NAME: string;
  OWNER: string;
  OBJECT_TYPE: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
  BSTAR?: number;
  EPHEMERIS_TYPE?: 0 | '0';
  CLASSIFICATION_TYPE?: 'U' | 'C';
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  [key: string]: string | number | undefined;
}

export interface CatalogManifest {
  source: string;
  fetch_time_utc: string;
  satcat_time_utc: string;
  total_objects: number;
  stale_after_hours: number;
  min_element_epoch_utc: string;
  max_element_epoch_utc: string;
}

export interface SatellitePosition {
  record: OmmRecord;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  speedKmS: number;
  ageHours: number;
  staleElements: boolean;
}
