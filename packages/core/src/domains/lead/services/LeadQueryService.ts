import { GeoRadius } from '../entities/Geo';
import { Lead, LeadFilterOptions } from '../entities/Lead';
import { GeoService } from './GeoService';

/**
 * Applies the lead filter/sort vocabulary to an in-memory collection.
 *
 * Pure and free of Node built-ins, so the React desk imports it directly and
 * filters client-held leads with exactly the rules the server would apply.
 * Before this existed the logic lived inside the in-memory repository, which
 * meant the browser would have had to reimplement — and eventually diverge
 * from — the same predicates.
 */
export class LeadQueryService {
  private readonly geoService: GeoService;

  constructor(deps?: { geoService?: GeoService }) {
    this.geoService = deps?.geoService ?? new GeoService();
  }

  /**
   * Leads that carry no coordinates, and so can never satisfy a radius filter.
   * Surfaced so the UI can say how many leads a radius search is hiding rather
   * than appearing to have lost them.
   */
  public countWithoutCoordinates(leads: Lead[]): number {
    return leads.filter((l) => this.geoService.toPoint(l.location) === null).length;
  }

  /**
   * Leads that have coordinates but sit outside the search area.
   *
   * Reported separately from leads with no coordinates because the two need
   * different actions from the user: one is a gap in the source data, the other
   * just means the radius is too tight. Without this, a scan that produced a
   * real lead 600 km away showed an empty table and no reason why.
   */
  public countOutsideRadius(leads: Lead[], area: GeoRadius): number {
    return leads.filter((lead) => {
      const point = this.geoService.toPoint(lead.location);
      return point !== null && !this.geoService.isWithin(point, area);
    }).length;
  }

  public apply(leads: Lead[], filters: LeadFilterOptions = {}): Lead[] {
    let result = [...leads];

    if (filters.status) {
      result = result.filter((l) => l.status === filters.status);
    }

    if (filters.intent) {
      result = result.filter((l) => l.intent === filters.intent);
    }

    if (filters.city) {
      result = result.filter((l) => l.location.city?.toLowerCase() === filters.city?.toLowerCase());
    }

    if (filters.corridor) {
      result = result.filter((l) => l.location.corridor?.toLowerCase() === filters.corridor?.toLowerCase());
    }

    if (filters.near) {
      const area = filters.near;
      result = result.filter((l) => {
        const point = this.geoService.toPoint(l.location);
        // An unlocatable lead is not "outside" the radius — it is unplaced.
        // Which of the two it counts as is the caller's call, not an
        // assumption made here.
        if (point === null) return Boolean(filters.includeUnlocated);
        return this.geoService.isWithin(point, area);
      });
    }

    if (filters.minConfidence !== undefined) {
      result = result.filter((l) => l.confidence >= filters.minConfidence!);
    }

    if (filters.minSqft !== undefined) {
      result = result.filter((l) => (l.size.normalizedSqft || 0) >= filters.minSqft!);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((l) =>
        l.title.toLowerCase().includes(q) ||
        l.organizationName?.toLowerCase().includes(q) ||
        l.industry?.toLowerCase().includes(q) ||
        l.location.corridor?.toLowerCase().includes(q) ||
        l.location.city?.toLowerCase().includes(q) ||
        l.tenderReference?.toLowerCase().includes(q)
      );
    }

    const sortBy = filters.sortBy || 'date';
    const sortOrder = filters.sortOrder || 'desc';

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'confidence') {
        comparison = a.confidence - b.confidence;
      } else if (sortBy === 'size') {
        comparison = (a.size.normalizedSqft || 0) - (b.size.normalizedSqft || 0);
      } else if (sortBy === 'distance' && filters.near) {
        const pa = this.geoService.toPoint(a.location);
        const pb = this.geoService.toPoint(b.location);
        comparison =
          (pa ? this.geoService.distanceKm(filters.near, pa) : Number.MAX_SAFE_INTEGER) -
          (pb ? this.geoService.distanceKm(filters.near, pb) : Number.MAX_SAFE_INTEGER);
        // Nearest first reads more naturally than the default descending order.
        return sortOrder === 'desc' ? comparison : -comparison;
      } else {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }
}
