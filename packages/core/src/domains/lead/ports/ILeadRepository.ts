import { Lead, LeadFilterOptions, LeadStatus } from '../entities/Lead';

/**
 * Persistence contract for the Lead aggregate.
 *
 * Store-neutral by design: no method leaks a query builder, a SQL fragment or a
 * driver type, so the in-memory adapter used today and the Neon Postgres
 * adapter planned in the master plan satisfy the identical interface. Swapping
 * stores becomes a change at the Composition Root, not a change to any use case.
 *
 * Every method takes `tenantId` explicitly rather than reading ambient state,
 * so a caller cannot accidentally query across tenants. Adapters must reject a
 * missing tenantId rather than silently returning everything.
 *
 * Methods are async even though the current adapter is synchronous — a real
 * database will be, and having the Port already return promises means adding
 * one changes no caller.
 */
export interface ILeadRepository {
  findById(id: string, tenantId: string): Promise<Lead | null>;

  /** Applies the whitelisted filter/sort vocabulary in LeadFilterOptions. */
  findMany(filters: LeadFilterOptions, tenantId: string): Promise<Lead[]>;

  save(lead: Lead, tenantId: string): Promise<Lead>;

  /** Returns the updated lead, or null when no lead has that id. */
  updateStatus(id: string, status: LeadStatus, tenantId: string): Promise<Lead | null>;

  /** Removes every lead for the tenant. Used by the dev reset endpoint. */
  deleteAll(tenantId: string): Promise<void>;
}
