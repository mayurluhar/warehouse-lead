import { IngestionMetrics } from '../../domains/lead/entities/IngestionMetrics';
import { IIngestionMetricsRepository } from '../../domains/lead/ports/IIngestionMetricsRepository';

/**
 * Process-memory implementation of IIngestionMetricsRepository.
 *
 * Shares the lifetime and the limitations of InMemoryLeadRepository: counters
 * reset on cold start.
 */
export class InMemoryIngestionMetricsRepository implements IIngestionMetricsRepository {
  private readonly byTenant: Map<string, IngestionMetrics> = new Map();

  private metricsFor(tenantId: string): IngestionMetrics {
    if (!tenantId) {
      throw new Error('Forbidden: tenantId is required for every metrics query');
    }
    let metrics = this.byTenant.get(tenantId);
    if (!metrics) {
      metrics = { scannedTotal: 0, falsePositivesTotal: 0 };
      this.byTenant.set(tenantId, metrics);
    }
    return metrics;
  }

  async get(tenantId: string): Promise<IngestionMetrics> {
    return { ...this.metricsFor(tenantId) };
  }

  async incrementScanned(count: number, tenantId: string): Promise<void> {
    this.metricsFor(tenantId).scannedTotal += count;
  }

  async incrementFalsePositives(count: number, tenantId: string): Promise<void> {
    this.metricsFor(tenantId).falsePositivesTotal += count;
  }

  async reset(tenantId: string): Promise<void> {
    this.byTenant.set(tenantId, { scannedTotal: 0, falsePositivesTotal: 0 });
  }
}
