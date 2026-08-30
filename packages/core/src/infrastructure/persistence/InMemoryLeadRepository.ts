import { Lead, LeadFilterOptions, LeadStatus } from '../../domains/lead/entities/Lead';
import { ILeadRepository } from '../../domains/lead/ports/ILeadRepository';
import { LeadQueryService } from '../../domains/lead/services/LeadQueryService';

/**
 * Process-memory implementation of ILeadRepository.
 *
 * For the POC the platform is deliberately stateless between requests: the API
 * stores nothing, the React desk owns the leads, and a browser refresh clears
 * them. So this is constructed per request and seeded with the leads the client
 * already holds, which is what lets deduplication and corroboration still work
 * across separate ingestion calls without any server-side storage.
 *
 * It remains a full ILeadRepository implementation, so introducing a real
 * datastore later means writing one more adapter and changing the Composition
 * Root — no use case or service is aware of the difference.
 */
export class InMemoryLeadRepository implements ILeadRepository {
  private readonly byTenant: Map<string, Map<string, Lead>> = new Map();
  private readonly queryService: LeadQueryService;

  constructor(deps?: { queryService?: LeadQueryService }) {
    this.queryService = deps?.queryService ?? new LeadQueryService();
  }

  private tenantLeads(tenantId: string): Map<string, Lead> {
    if (!tenantId) {
      throw new Error('Forbidden: tenantId is required for every lead query');
    }
    let leads = this.byTenant.get(tenantId);
    if (!leads) {
      leads = new Map<string, Lead>();
      this.byTenant.set(tenantId, leads);
    }
    return leads;
  }

  /** Loads a starting set, e.g. the leads a client sent with its request. */
  public seed(leads: Lead[], tenantId: string): void {
    const target = this.tenantLeads(tenantId);
    for (const lead of leads) {
      target.set(lead.id, lead);
    }
  }

  public count(tenantId: string): number {
    return this.tenantLeads(tenantId).size;
  }

  async findById(id: string, tenantId: string): Promise<Lead | null> {
    return this.tenantLeads(tenantId).get(id) ?? null;
  }

  async findMany(filters: LeadFilterOptions, tenantId: string): Promise<Lead[]> {
    const all = Array.from(this.tenantLeads(tenantId).values());
    return this.queryService.apply(all, filters);
  }

  async save(lead: Lead, tenantId: string): Promise<Lead> {
    this.tenantLeads(tenantId).set(lead.id, lead);
    return lead;
  }

  async updateStatus(id: string, status: LeadStatus, tenantId: string): Promise<Lead | null> {
    const lead = this.tenantLeads(tenantId).get(id);
    if (!lead) return null;
    lead.status = status;
    lead.updatedAt = new Date().toISOString();
    return lead;
  }

  async deleteAll(tenantId: string): Promise<void> {
    this.tenantLeads(tenantId).clear();
  }
}
