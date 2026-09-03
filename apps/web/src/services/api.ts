import { GeoRadius, Lead, SourceDocument } from '@warehouse-lead/core/client';

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
  /** Places a targeted scan actually searched, echoed back for the UI. */
  focusPlaces?: string[];
  /** Per-source outcome, so a rate-limited feed is visible not silent. */
  sourceReports?: SourceReport[];
  /**
   * Whether extraction ran at reduced quality (e.g. Bedrock throttled and the
   * rule-based fallback was used), with a user-facing reason.
   */
  extraction?: {
    degraded: boolean;
    fallbackCount: number;
    processedCount: number;
    reason?: string;
  };
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

/**
 * @param near Optional centre + radius. When given, the scan builds
 *             location-targeted search queries instead of searching nationally.
 */
/** What a discovery call returns: the document list, with nothing extracted yet. */
export interface DiscoveryResponse {
  success: boolean;
  documents: SourceDocument[];
  documentCount: number;
  focusPlaces?: string[];
  sourceReports?: SourceReport[];
}

export interface SourceReport {
  source: string;
  status: 'ok' | 'blocked' | 'failed';
  itemCount: number;
  message?: string;
}

async function post<T>(path: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
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

/**
 * Step 1 of a scan: fetch the document list. Fast and AI-free.
 *
 * @param near Optional centre + radius. When given, the scan builds
 *             location-targeted search queries instead of searching nationally.
 */
export function discoverLiveDocuments(near?: GeoRadius | null): Promise<DiscoveryResponse> {
  return post('/api/ingest/scan', {
    ...(near ? { latitude: near.latitude, longitude: near.longitude, radiusKm: near.radiusKm } : {})
  });
}

/**
 * Step 2: process a single document.
 *
 * `rawText` is stripped from the leads sent back — deduplication only reads
 * `contentHash` and `canonicalUrl` from an existing lead's sources, and the UI
 * never displays it, so shipping it on every request would waste bandwidth.
 */
export function ingestOneDocument(
  document: SourceDocument,
  knownLeads: Lead[],
  modelId: string,
  near?: GeoRadius | null,
  signal?: AbortSignal
): Promise<IngestionResponse> {
  return post(
    '/api/ingest/document',
    { document, knownLeads: stripRawText(knownLeads), modelId, ...nearPayload(near) },
    signal
  );
}

/**
 * The search area, flattened onto the request body.
 *
 * Sent with every ingestion call, not just discovery: scoring ranks location
 * relevance by distance from this point, so a document processed without it
 * would be scored on a different basis from its neighbours in the same scan.
 */
function nearPayload(near?: GeoRadius | null): Record<string, number> {
  return near
    ? { latitude: near.latitude, longitude: near.longitude, radiusKm: near.radiusKm }
    : {};
}

function stripRawText(leads: Lead[]): Lead[] {
  const lighten = (d: SourceDocument): SourceDocument => ({ ...d, rawText: '' });
  return leads.map((lead) => ({
    ...lead,
    primarySource: lighten(lead.primarySource),
    corroboratingSources: lead.corroboratingSources.map(lighten)
  }));
}

export function ingestUrl(
  url: string,
  knownLeads: Lead[],
  modelId: string,
  near?: GeoRadius | null
): Promise<IngestionResponse> {
  return postIngestion('/api/ingest/url', {
    url,
    knownLeads: stripRawText(knownLeads),
    modelId,
    ...nearPayload(near)
  });
}

export function ingestRawText(
  text: string,
  title: string | undefined,
  knownLeads: Lead[],
  modelId: string,
  near?: GeoRadius | null
): Promise<IngestionResponse> {
  return postIngestion('/api/ingest/text', {
    text,
    title,
    knownLeads: stripRawText(knownLeads),
    modelId,
    ...nearPayload(near)
  });
}

/** A place returned by the live geocoder, for the location picker. */
export interface PlaceResult {
  name: string;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
}

/**
 * Live place lookup. Goes through our API rather than straight to the geocoder
 * so the rate limit is enforced in one place and the provider can be swapped
 * server-side without a frontend change.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const res = await fetch(`${API_BASE}/api/geo/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`Place search failed: ${res.statusText}`);
  const body = (await res.json()) as { places?: PlaceResult[] };
  return body.places ?? [];
}
