import { Lead } from '@warehouse-lead/core/client';

// In dev, stay same-origin and let the Vite proxy (see vite.config.ts) forward
// /api to whatever backend is active — the local node server or the SST Lambda
// Function URL. A relative base means the browser never issues a cross-origin
// request, so CORS cannot fail the local workflow.
//
// In a production build there is no proxy, so the deployed site must call the
// Function URL directly using the VITE_API_URL baked in at build time.
const API_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * The API is stateless: it stores nothing between requests. Every ingestion
 * call sends the leads this browser already holds so the server can deduplicate
 * and corroborate against them, and returns the full updated set.
 */
export interface IngestionResponse {
  success: boolean;
  scannedCount: number;
  relevantCount: number;
  discardedCount: number;
  newLeadsAdded: number;
  leads: Lead[];
  /** Present on the single-document paths (URL and text). */
  isRelevant?: boolean;
  reason?: string;
  isNew?: boolean;
  isCorroborated?: boolean;
  lead?: Lead | null;
}

async function postIngestion(path: string, payload: Record<string, unknown>): Promise<IngestionResponse> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    // The API returns { error } on failure; surface it rather than a bare status.
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {
      // Non-JSON body; keep the status text.
    }
    throw new Error(detail);
  }

  return res.json();
}

export function triggerMultiSourceScan(knownLeads: Lead[]): Promise<IngestionResponse> {
  return postIngestion('/api/ingest/scan', { knownLeads });
}

export function loadBenchmarkSamples(knownLeads: Lead[]): Promise<IngestionResponse> {
  return postIngestion('/api/ingest/samples', { knownLeads });
}

export function ingestUrl(url: string, knownLeads: Lead[]): Promise<IngestionResponse> {
  return postIngestion('/api/ingest/url', { url, knownLeads });
}

export function ingestRawText(text: string, title: string | undefined, knownLeads: Lead[]): Promise<IngestionResponse> {
  return postIngestion('/api/ingest/text', { text, title, knownLeads });
}
