import { GazetteerPlace, GeoPoint } from '../entities/Geo';
import { LocationInfo } from '../entities/Lead';

/**
 * Turns place names into coordinates, and answers which known places sit
 * inside a radius.
 *
 * The POC implementation is a built-in lookup table, which is why this is a
 * Port: swapping in a real geocoding service (Nominatim, Google, Mapbox) means
 * writing one adapter and changing the Composition Root, with no change to the
 * ingestion pipeline. Async for exactly that reason — a network geocoder must
 * fit this shape without a signature change.
 */
export interface IGazetteer {
  /**
   * Resolves the most specific named place available, trying corridor, then
   * city, then state. Returns null rather than guessing when nothing matches,
   * so a lead is never plotted at a made-up location.
   */
  resolve(location: LocationInfo): Promise<GeoPoint | null>;

  /** Known places whose centre falls within `radiusKm` of `centre`. */
  findWithin(centre: GeoPoint, radiusKm: number): Promise<GazetteerPlace[]>;
}
