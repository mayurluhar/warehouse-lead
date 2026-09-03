import axios from 'axios';
import { getLogger } from '../../common/Logger';
import { GazetteerPlace, GeoPoint, PlaceKind } from '../../domains/lead/entities/Geo';
import { LocationInfo } from '../../domains/lead/entities/Lead';
import { IGazetteer } from '../../domains/lead/ports/IGazetteer';
import { GeoService } from '../../domains/lead/services/GeoService';

const logger = getLogger('NominatimGazetteer');

const EARTH_RADIUS_KM = 6371;

/**
 * Live gazetteer backed by OpenStreetMap's Nominatim service.
 *
 * Replaces the hardcoded place table the POC started with. Nothing about which
 * places exist, what they are called, or where they sit is baked into this
 * repository any more — every name and coordinate is fetched at request time,
 * so the system works for a point anywhere on earth rather than only the
 * corridors somebody thought to type in.
 *
 * Nominatim is used because it needs no API key and no billing account, which
 * keeps the POC runnable by anyone who clones it. Its usage policy is strict
 * and this adapter honours it: at most one request per second, a User-Agent
 * that identifies the application, and results cached so a repeated scan of the
 * same area costs nothing. Point NOMINATIM_BASE_URL at a self-hosted instance
 * or a commercial geocoder to lift those limits.
 *
 * A lookup that finds nothing yields null rather than a guess: an unplottable
 * lead is excluded from radius searches, which is the honest outcome and one
 * the UI already reports.
 */

/** Nominatim's address hierarchy, coarsest last. Every field is optional. */
interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  industrial?: string;
  town?: string;
  city?: string;
  municipality?: string;
  city_district?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface NominatimOptions {
  geoService: GeoService;
  baseUrl?: string;
  /**
   * Nominatim requires a User-Agent identifying the application. Deliberately
   * carries no personal data — it is sent to a third-party service.
   */
  userAgent?: string;
  /** Minimum gap between requests. Nominatim's published policy is 1/second. */
  minIntervalMs?: number;
  cacheTtlMs?: number;
  timeoutMs?: number;
  /**
   * Compass probes taken at the radius edge, in addition to the centre, when
   * answering findWithin. More probes mean wider coverage and a proportionally
   * slower scan, since each one is a separate paced request.
   */
  probeCount?: number;
  /** Restricts results to one country, e.g. 'in'. Unset searches worldwide. */
  countryCode?: string;
}

/**
 * Industrial-estate wording appended to a place name by the extractors.
 * Stripped as a retry when the full name has no entry in the geocoder.
 */
const ESTATE_SUFFIX =
  /\s+(?:GIDC|MIDC|SEZ|PCPIR|Industrial\s+(?:Estate|Area|Park|Corridor|Cluster|Belt)|Logistics\s+(?:Park|Hub))\s*$/i;

/** Offsets a point by `distanceKm` along a compass bearing, in degrees. */
function destinationPoint(origin: GeoPoint, bearingDegrees: number, distanceKm: number): GeoPoint {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latRad = (origin.latitude * Math.PI) / 180;

  const dLat = ((distanceKm * Math.cos(bearing)) / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLon =
    ((distanceKm * Math.sin(bearing)) / (EARTH_RADIUS_KM * Math.cos(latRad))) * (180 / Math.PI);

  return {
    latitude: Math.max(-90, Math.min(90, origin.latitude + dLat)),
    longitude: origin.longitude + dLon
  };
}

export class NominatimGazetteer implements IGazetteer {
  private readonly geoService: GeoService;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly cacheTtlMs: number;
  private readonly timeoutMs: number;
  private readonly probeCount: number;
  private readonly countryCode?: string;

  private readonly cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Serialises every outbound call. Nominatim's policy is a hard limit rather
   * than a suggestion — exceeding it gets the caller blocked outright — so
   * requests queue behind one another instead of relying on callers to behave.
   */
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(deps: NominatimOptions) {
    this.geoService = deps.geoService;
    this.baseUrl = (deps.baseUrl || process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org')
      .replace(/\/$/, '');
    this.userAgent =
      deps.userAgent ||
      process.env.NOMINATIM_USER_AGENT ||
      'warehouse-lead-intelligence-poc/0.1 (contact: set NOMINATIM_USER_AGENT)';
    this.minIntervalMs = deps.minIntervalMs ?? Number(process.env.NOMINATIM_MIN_INTERVAL_MS ?? 1100);
    this.cacheTtlMs = deps.cacheTtlMs ?? 6 * 60 * 60 * 1000;
    this.timeoutMs = deps.timeoutMs ?? 8000;
    this.probeCount = deps.probeCount ?? Number(process.env.NOMINATIM_PROBE_COUNT ?? 4);
    this.countryCode = deps.countryCode ?? process.env.NOMINATIM_COUNTRY_CODE ?? undefined;
  }

  private cached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private store<T>(key: string, value: T): T {
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
    return value;
  }

  /** Runs `task` on the shared queue, never closer than minIntervalMs apart. */
  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const waitFor = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (waitFor > 0) await new Promise((resolve) => setTimeout(resolve, waitFor));
      this.lastRequestAt = Date.now();
      return task();
    });

    // Keep the chain alive even when a task rejects, or one failure would
    // permanently wedge every later lookup.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async request<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
    const key = `${path}?${new URLSearchParams(params as Record<string, string>).toString()}`;
    const hit = this.cached<T>(key);
    if (hit !== undefined) return hit;

    try {
      const result = await this.schedule(async () => {
        const { data } = await axios.get<T>(`${this.baseUrl}${path}`, {
          params: { format: 'jsonv2', ...params },
          timeout: this.timeoutMs,
          headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'en' }
        });
        return data;
      });

      return this.store(key, result);
    } catch (error) {
      // Geocoding is an enrichment, never the point of the request. A lookup
      // that fails costs the lead its coordinates, not the whole scan.
      logger.warn('Nominatim lookup failed', { path, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Rejects strings that cannot be a place name before they reach the geocoder.
   *
   * Nominatim is relevance-ranked, not exact-match: it returns its best guess
   * for almost any input rather than nothing. Asking it about "400 cities"
   * returned coordinates in Hyderabad, which put a lead with no known location
   * onto the map 624 km from the user's search centre — then the radius filter
   * hid it, so a real lead vanished with no explanation. A wrong coordinate is
   * strictly worse than no coordinate, and this is the guard that keeps the
   * "never plot at a made-up location" rule true.
   */
  private isPlausibleQuery(query: string): boolean {
    // Digits belong to quantities ("400 cities", "50,000 sq ft"), not to the
    // place names this system deals with.
    if (/\d/.test(query)) return false;

    // A place reference is a name or two, not a clause.
    const words = query.split(/[\s,]+/).filter(Boolean);
    return words.length > 0 && words.length <= 6 && query.length >= 3;
  }

  /** Most specific naming available, coarsest last, as free-text queries. */
  private queryCandidates(location: LocationInfo): string[] {
    const parts = [location.corridor, location.city, location.state].map((p) => p?.trim() || null);
    const [corridor, city, state] = parts;

    const candidates = [
      [corridor, city, state],
      [corridor, state],
      [city, state],
      [corridor],
      [city],
      [state]
    ]
      .map((group) => group.filter(Boolean).join(', '))
      .filter((q) => q.length > 0);

    // An estate name often has no OSM entry under its full form: "Sanand GIDC"
    // returns nothing while "Sanand" resolves cleanly. Retrying without the
    // suffix trades a little precision — the town centre rather than the
    // estate — for a coordinate at all, which is what the radius filter needs.
    for (const named of [corridor, city]) {
      const bare = named?.replace(ESTATE_SUFFIX, '').trim();
      if (bare && bare !== named) candidates.push(bare);
    }

    // A raw phrase from the document is the last resort: it is unstructured,
    // so it is tried only once everything named has come up empty — and only
    // when it actually reads like a place.
    if (location.rawText?.trim()) candidates.push(location.rawText.trim());

    return Array.from(new Set(candidates)).filter((q) => this.isPlausibleQuery(q));
  }

  public async resolve(location: LocationInfo): Promise<GeoPoint | null> {
    for (const query of this.queryCandidates(location)) {
      const results = await this.request<NominatimPlace[]>('/search', {
        q: query,
        limit: 1,
        addressdetails: 1,
        ...(this.countryCode ? { countrycodes: this.countryCode } : {})
      });

      const hit = results?.[0];
      if (!hit) continue;

      const latitude = Number(hit.lat);
      const longitude = Number(hit.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      logger.info('Geocoded location', { query, latitude, longitude });
      return { latitude, longitude };
    }

    return null;
  }

  /**
   * Names the places around a point by reverse-geocoding a compass of probes:
   * the centre, plus `probeCount` points spaced evenly around the radius edge.
   *
   * Nominatim answers "what is at this coordinate", not "what lies within this
   * circle", so the circle is sampled instead. Each probe returns one OSM
   * object carrying a full address hierarchy, which yields up to three places —
   * a suburb-level name (the closest analogue to a warehousing corridor), its
   * town or city, and its state.
   *
   * Every place therefore carries the coordinates of the object that named it,
   * which sits inside the searched circle by construction. That is an
   * approximation of a true centroid — a state named from a probe is pinned at
   * the probe, not at the state's middle — and it is the right one here,
   * because these coordinates exist to order results by proximity to the search
   * centre, not to plot the state itself.
   */
  public async findWithin(centre: GeoPoint, radiusKm: number): Promise<GazetteerPlace[]> {
    const probes: GeoPoint[] = [centre];
    for (let i = 0; i < this.probeCount; i++) {
      // 0.8 keeps the probe inside the circle rather than exactly on its edge.
      probes.push(destinationPoint(centre, (360 / this.probeCount) * i, radiusKm * 0.8));
    }

    const byName = new Map<string, GazetteerPlace>();

    for (const probe of probes) {
      // Zoom 14 is the coarsest level that still returns a suburb. Below it
      // (12 and under) Indian metros come back with nothing between the
      // district and the state, so the probe contributes no usable search term.
      const place = await this.request<NominatimPlace>('/reverse', {
        lat: probe.latitude.toFixed(5),
        lon: probe.longitude.toFixed(5),
        zoom: 14,
        addressdetails: 1
      });

      const address = place?.address;
      if (!address) continue;

      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      // OSM does not tag Indian cities consistently: Ahmedabad comes back as
      // `state_district` with no `city` field at all, so a chain that stopped
      // at `village` silently dropped every major metro. `county` is last
      // because it is often an administrative taluka nobody searches by.
      const city =
        address.city ||
        address.town ||
        address.municipality ||
        address.city_district ||
        address.village ||
        address.state_district ||
        address.county ||
        null;
      const state = address.state || null;

      const named: { name: string | undefined; kind: PlaceKind }[] = [
        // Suburb-level naming is the closest live equivalent to a warehousing
        // micro-corridor, and makes by far the best search term.
        { name: address.industrial || address.suburb || address.neighbourhood || address.hamlet, kind: 'corridor' },
        { name: city ?? undefined, kind: 'city' },
        { name: state ?? undefined, kind: 'state' }
      ];

      for (const { name, kind } of named) {
        const trimmed = name?.trim();
        if (!trimmed) continue;

        const key = trimmed.toLowerCase();
        // First probe to name a place wins, and probes run centre-first, so a
        // place keeps the coordinates of the nearest probe that saw it.
        if (byName.has(key)) continue;

        byName.set(key, { name: trimmed, kind, city, state, latitude, longitude });
      }
    }

    const places = Array.from(byName.values());
    logger.info('Resolved places around search centre', {
      probes: probes.length,
      placeCount: places.length,
      places: places.map((p) => p.name)
    });

    return places.sort(
      (a, b) => this.geoService.distanceKm(centre, a) - this.geoService.distanceKm(centre, b)
    );
  }

  /**
   * Free-text place search, for the UI's location picker.
   *
   * Not part of IGazetteer: the ingestion pipeline never needs it, and widening
   * the Port for one presentation concern would force every future gazetteer to
   * implement a typeahead it has no use for.
   */
  public async search(query: string, limit = 5): Promise<GazetteerPlace[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = await this.request<NominatimPlace[]>('/search', {
      q: trimmed,
      limit: Math.max(1, Math.min(10, limit)),
      addressdetails: 1,
      ...(this.countryCode ? { countrycodes: this.countryCode } : {})
    });

    return (results ?? [])
      .map((hit) => {
        const latitude = Number(hit.lat);
        const longitude = Number(hit.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const address = hit.address ?? {};
        return {
          name: hit.display_name || trimmed,
          kind: 'city' as PlaceKind,
          city:
            address.city ||
            address.town ||
            address.municipality ||
            address.city_district ||
            address.village ||
            address.state_district ||
            null,
          state: address.state || null,
          latitude,
          longitude
        };
      })
      .filter((place): place is GazetteerPlace => place !== null);
  }
}
