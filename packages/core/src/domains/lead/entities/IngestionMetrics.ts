/**
 * Pipeline counters that are not derivable from the stored leads.
 *
 * Scanned and discarded documents leave no lead behind, so their totals have to
 * be recorded as ingestion happens. Kept as a separate aggregate from Lead
 * because it has its own lifecycle and its own repository Port.
 */
export interface IngestionMetrics {
  /** Every document pulled from a source, relevant or not. */
  scannedTotal: number;
  /** Documents the extractor rejected as not containing a real requirement. */
  falsePositivesTotal: number;
}

/** Dashboard rollup combining stored leads with the ingestion counters. */
export interface PipelineStats {
  totalLeads: number;
  activeTenders: number;
  highConfidenceCount: number;
  totalSignalsScanned: number;
  falsePositivesFiltered: number;
  avgConfidence: number;
  corridorBreakdown: Record<string, number>;
  intentBreakdown: Record<string, number>;
}
