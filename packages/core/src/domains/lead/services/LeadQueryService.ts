import { Lead, LeadFilterOptions } from '../entities/Lead';

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
      } else {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }
}
