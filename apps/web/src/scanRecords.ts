import { Lead, SourceDocument } from '@warehouse-lead/core/client';

/**
 * Everything a scan looked at, kept whether or not it produced a lead.
 *
 * Before this existed the pipeline discarded rejected documents the moment the
 * classifier ruled on them, so "we scanned 38 articles and kept 1" was a claim
 * the user could not check. A classifier that silently drops the wrong article
 * is the most expensive failure this product can have, and it was invisible.
 *
 * Records live only in browser state, like leads — a refresh clears them.
 */
export interface ScanRecord {
  /** The document as fetched. Kept intact so a promotion can re-ingest it. */
  document: SourceDocument;
  verdict: 'qualified' | 'unqualified';
  /** The classifier's stated reason — the whole point of showing rejections. */
  reason: string;
  /** Set when the verdict was 'qualified'; links the row to its lead. */
  leadId: string | null;
  /** True once a reviewer promoted this from the unqualified list. */
  promoted: boolean;
  processedAt: string;
}

/**
 * Adds or replaces a record, keyed by content hash.
 *
 * Replacement matters for promotion: re-ingesting a document must update its
 * existing row rather than leave the rejected copy sitting alongside the
 * qualified one.
 */
export function upsertRecord(records: ScanRecord[], next: ScanRecord): ScanRecord[] {
  const index = records.findIndex((r) => r.document.contentHash === next.document.contentHash);
  if (index === -1) return [...records, next];

  const copy = [...records];
  copy[index] = next;
  return copy;
}

/**
 * Rejected documents, newest first.
 *
 * Newest-first because the reviewer's attention is worth most on what the
 * current scan just produced, not on what a scan three runs ago rejected.
 */
export function unqualifiedRecords(records: ScanRecord[]): ScanRecord[] {
  return records
    .filter((r) => r.verdict === 'unqualified')
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt));
}

export function qualifiedRecords(records: ScanRecord[]): ScanRecord[] {
  return records.filter((r) => r.verdict === 'qualified');
}

/** Leads whose row is currently hidden by the active filters, with the count. */
export function hiddenLeadCount(allLeads: Lead[], visibleLeads: Lead[]): number {
  return Math.max(0, allLeads.length - visibleLeads.length);
}
