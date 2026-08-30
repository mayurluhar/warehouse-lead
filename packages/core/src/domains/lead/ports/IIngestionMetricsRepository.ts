import { IngestionMetrics } from '../entities/IngestionMetrics';

/**
 * Persistence contract for the pipeline counters.
 *
 * Separate from ILeadRepository because these counters survive documents that
 * never became leads, so they cannot be recomputed from stored leads alone.
 */
export interface IIngestionMetricsRepository {
  get(tenantId: string): Promise<IngestionMetrics>;

  incrementScanned(count: number, tenantId: string): Promise<void>;

  incrementFalsePositives(count: number, tenantId: string): Promise<void>;

  reset(tenantId: string): Promise<void>;
}
