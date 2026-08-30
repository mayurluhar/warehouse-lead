import { Lead } from '../entities/Lead';
import { IngestionMetrics, PipelineStats } from '../entities/IngestionMetrics';

/**
 * Derives the dashboard rollup from stored leads plus the ingestion counters.
 *
 * This is a pure calculation, so it lives in the domain rather than in the
 * repository. The previous in-memory store computed it internally, which meant
 * moving to Postgres would have meant reimplementing the arithmetic in SQL.
 */
export class PipelineStatsService {
  public calculate(leads: Lead[], metrics: IngestionMetrics): PipelineStats {
    const totalLeads = leads.length;
    const activeTenders = leads.filter((l) => l.intent === 'tender' || l.intent === 'rfp').length;
    const highConfidenceCount = leads.filter((l) => l.confidence >= 75).length;

    const sumConfidence = leads.reduce((acc, curr) => acc + curr.confidence, 0);
    const avgConfidence = totalLeads > 0 ? Math.round(sumConfidence / totalLeads) : 0;

    const corridorBreakdown: Record<string, number> = {};
    const intentBreakdown: Record<string, number> = {};

    for (const lead of leads) {
      const loc = lead.location.corridor || lead.location.city || 'Other';
      corridorBreakdown[loc] = (corridorBreakdown[loc] || 0) + 1;

      intentBreakdown[lead.intent] = (intentBreakdown[lead.intent] || 0) + 1;
    }

    return {
      totalLeads,
      activeTenders,
      highConfidenceCount,
      // Falls back to the lead count when nothing has been scanned this
      // process lifetime, preserving the previous store's behaviour.
      totalSignalsScanned: metrics.scannedTotal || totalLeads,
      falsePositivesFiltered: metrics.falsePositivesTotal,
      avgConfidence,
      corridorBreakdown,
      intentBreakdown
    };
  }
}
