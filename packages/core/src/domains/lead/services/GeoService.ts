import { GeoPoint, GeoRadius } from '../entities/Geo';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance calculations.
 *
 * Pure and free of Node built-ins so the React desk runs the identical maths
 * when filtering client-held leads by radius.
 *
 * Haversine treats the earth as a sphere, which is off by up to ~0.5% versus a
 * proper ellipsoidal calculation. That is far below the precision of the
 * underlying data — leads are located to a town centroid at best — so the extra
 * complexity of Vincenty would buy nothing real.
 */
export class GeoService {
  /** Distance in kilometres between two points. */
  public distanceKm(from: GeoPoint, to: GeoPoint): number {
    const dLat = toRadians(to.latitude - from.latitude);
    const dLon = toRadians(to.longitude - from.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(from.latitude)) *
        Math.cos(toRadians(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** True when `point` lies inside the circle described by `area`. */
  public isWithin(point: GeoPoint, area: GeoRadius): boolean {
    return this.distanceKm(point, area) <= area.radiusKm;
  }

  /**
   * Reads coordinates off a value that may not have them.
   * Returns null unless both are present and numeric.
   */
  public toPoint(value: { latitude: number | null; longitude: number | null }): GeoPoint | null {
    if (typeof value.latitude !== 'number' || typeof value.longitude !== 'number') return null;
    return { latitude: value.latitude, longitude: value.longitude };
  }
}
