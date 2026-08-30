import { LeadRecord, PipelineStats } from '../types/lead';

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

export async function fetchLeads(params: {
  search?: string;
  intent?: string;
  corridor?: string;
  minConfidence?: number;
  status?: string;
  sortBy?: string;
} = {}): Promise<{ count: number; leads: LeadRecord[] }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.intent) query.set('intent', params.intent);
  if (params.corridor) query.set('corridor', params.corridor);
  if (params.minConfidence) query.set('minConfidence', params.minConfidence.toString());
  if (params.status) query.set('status', params.status);
  if (params.sortBy) query.set('sortBy', params.sortBy);

  const res = await fetch(`${API_BASE}/api/leads?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed fetching leads: ${res.statusText}`);
  return res.json();
}

export async function fetchLeadDetail(id: string): Promise<LeadRecord> {
  const res = await fetch(`${API_BASE}/api/leads/${id}`);
  if (!res.ok) throw new Error(`Failed fetching lead ${id}: ${res.statusText}`);
  const data = await res.json();
  return data.lead;
}

export async function fetchPipelineStats(): Promise<PipelineStats> {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error(`Failed fetching stats: ${res.statusText}`);
  return res.json();
}

export async function triggerMultiSourceScan(): Promise<{
  scannedCount: number;
  relevantCount: number;
  discardedCount: number;
  newLeadsAdded: number;
  totalLeads: number;
}> {
  const res = await fetch(`${API_BASE}/api/ingest/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`);
  return res.json();
}

export async function ingestUrl(url: string): Promise<{ success: boolean; isNew?: boolean; isCorroborated?: boolean; lead?: LeadRecord; reason?: string }> {
  const res = await fetch(`${API_BASE}/api/ingest/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error(`URL Ingestion failed: ${res.statusText}`);
  return res.json();
}

export async function ingestRawText(text: string, title?: string): Promise<{ success: boolean; isNew?: boolean; lead?: LeadRecord; reason?: string }> {
  const res = await fetch(`${API_BASE}/api/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title })
  });
  if (!res.ok) throw new Error(`Text Ingestion failed: ${res.statusText}`);
  return res.json();
}

export async function loadBenchmarkSamples(): Promise<{ scannedCount: number; relevantCount: number; leads: LeadRecord[] }> {
  const res = await fetch(`${API_BASE}/api/ingest/samples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Loading samples failed: ${res.statusText}`);
  return res.json();
}

export async function updateLeadStatus(id: string, status: LeadRecord['status']): Promise<{ success: boolean; lead: LeadRecord }> {
  const res = await fetch(`${API_BASE}/api/leads/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`Status update failed: ${res.statusText}`);
  return res.json();
}

export async function clearAllLeads(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/leads`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Clear leads failed: ${res.statusText}`);
  return res.json();
}
