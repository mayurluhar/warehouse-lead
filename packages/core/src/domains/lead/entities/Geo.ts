/** A point on the earth, in decimal degrees (WGS84). */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** A circular search area: everything within `radiusKm` of a centre point. */
export interface GeoRadius extends GeoPoint {
  radiusKm: number;
}

/** What kind of place a gazetteer entry describes, coarsest last. */
export type PlaceKind = 'corridor' | 'city' | 'state';

/**
 * A known logistics place: a warehousing micro-corridor, its parent city, or a
 * state centroid used as a last-resort fallback.
 */
export interface GazetteerPlace {
  /** Canonical display name, e.g. "Sanand" or "Bhiwandi". */
  name: string;
  kind: PlaceKind;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
}

/** Where a scan should concentrate its searching. */
export interface ScanFocus {
  centre: GeoRadius;
  /**
   * Place names inside the radius, used to build location-targeted search
   * queries. Empty when the radius covers nothing the gazetteer knows.
   */
  placeNames: string[];
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}
