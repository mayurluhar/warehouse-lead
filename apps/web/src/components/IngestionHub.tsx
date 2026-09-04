import React, { useEffect, useRef, useState } from 'react';
import {
  discoverLiveDocuments,
  discoverLinkedInDocuments,
  fetchCapabilities,
  ingestOneDocument,
  ingestUrl,
  ingestRawText,
  DiscoveryResponse,
  IngestionResponse
} from '../services/api';
import { GeoRadius, Lead, SourceDocument } from '@warehouse-lead/core/client';
import { ModelSelector } from './ModelSelector';
import {
  Linkedin,
  Radio,
  Globe,
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  StopCircle
} from 'lucide-react';

interface IngestionHubProps {
  /** Leads this browser holds; sent so the server can deduplicate against them. */
  knownLeads: Lead[];
  /** Area the live scan should target; null searches nationally. */
  scanNear: GeoRadius | null;
  /** Extraction model for the next run. */
  modelId: string;
  onModelChange: (modelId: string) => void;
  onIngested: (result: IngestionResponse) => void;
  onLoadingChange: (loading: boolean) => void;
}

type TabType = 'scan' | 'linkedin' | 'url' | 'text';

export const IngestionHub: React.FC<IngestionHubProps> = ({
  knownLeads,
  scanNear,
  modelId,
  onModelChange,
  onIngested,
  onLoadingChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  // Asked once at mount: the tab is shown either way, but a deployment with no
  // search provider says so up front instead of offering a scan that must fail.
  const [linkedInEnabled, setLinkedInEnabled] = useState(true);
  const [loading, setLoadingState] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; leads: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setLoading = (value: boolean) => {
    setLoadingState(value);
    onLoadingChange(value);
  };

  // Form states
  const [urlInput, setUrlInput] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textBody, setTextBody] = useState('');

  /**
   * Runs a discovered queue one document per request.
   *
   * Sequential by necessity, not caution: deduplication compares each document
   * against the leads accumulated so far, so a parallel loop would race and
   * create duplicate cards for the same requirement. One document per request
   * also keeps every call well inside the Lambda timeout and confines an AI
   * throttle to a single document rather than failing the whole scan.
   */
  const runQueue = async (
    discovery: DiscoveryResponse,
    label: string,
    scopeNote: string
  ) => {
    const documents = discovery.documents ?? [];
    const degraded = (discovery.sourceReports ?? []).filter((r) => r.status !== 'ok');
    const blocked = degraded.filter((r) => r.status === 'blocked');
    const sourceNote =
      (blocked.length ? ` ${blocked.map((b) => b.source).join(', ')} is rate-limiting and was skipped.` : '') +
      (degraded.length && !blocked.length ? ` ${degraded.map((d) => d.source).join(', ')} could not be reached.` : '');

    if (documents.length === 0) {
      setStatusMessage({
        type: degraded.length ? 'error' : 'success',
        text: `${label}: no documents found.${scopeNote}${sourceNote}`
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // The running lead set is tracked locally: React state updates are async,
    // and each request must carry the leads produced by the previous one or
    // deduplication has nothing to compare against.
    let workingLeads = knownLeads;
    let relevant = 0;
    let discarded = 0;
    let added = 0;
    let failures = 0;
    let processed = 0;

    setProgress({ done: 0, total: documents.length, leads: 0 });

    for (const document of documents) {
      if (controller.signal.aborted) break;

      try {
        const res = await ingestOneDocument(
          document as SourceDocument,
          workingLeads,
          modelId,
          scanNear,
          controller.signal
        );
        workingLeads = res.leads ?? workingLeads;
        onIngested(res);

        if (res.isRelevant) {
          relevant++;
          if (res.isNew) added++;
        } else {
          discarded++;
        }
        failures = 0;
      } catch (err) {
        if (controller.signal.aborted) break;
        failures++;
        // Three consecutive failures means the backend is unwell; pressing on
        // through the remaining documents would just repeat the same error.
        if (failures >= 3) {
          setStatusMessage({
            type: 'error',
            text: `${label} stopped after ${processed} of ${documents.length} documents: ${(err as Error).message}`
          });
          break;
        }
      }

      processed++;
      setProgress({ done: processed, total: documents.length, leads: workingLeads.length });
    }

    abortRef.current = null;
    setProgress(null);

    const stopped = controller.signal.aborted;
    setStatusMessage({
      type: failures >= 3 && processed === 0 ? 'error' : 'success',
      text:
        `${label} ${stopped ? 'stopped' : 'finished'}: processed ${processed} of ${documents.length} documents. ` +
        `Extracted ${relevant} warehouse signals (${added} new). Discarded ${discarded} non-demand items.` +
        scopeNote + sourceNote
    });
  };

  useEffect(() => {
    fetchCapabilities()
      .then((c) => setLinkedInEnabled(c.linkedInEnabled))
      .catch(() => setLinkedInEnabled(false));
  }, []);

  const handleLinkedInScan = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const discovery = await discoverLinkedInDocuments(scanNear);
      const scope = discovery.focusPlaces?.length
        ? ` Searched around: ${discovery.focusPlaces.join(', ')}.`
        : ' No area set — searched without a location filter. Set a point and radius to target a city.';
      await runQueue(discovery, 'LinkedIn scan', scope);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `LinkedIn scan failed: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const discovery = await discoverLiveDocuments(scanNear);
      const scope = discovery.focusPlaces?.length
        ? ` Targeted: ${discovery.focusPlaces.join(', ')}.`
        : ' Searched nationally — set a latitude and longitude to target an area.';
      await runQueue(discovery, 'Live scan', scope);
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Scan failed: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };


  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await ingestUrl(urlInput, knownLeads, modelId, scanNear);
      onIngested(res);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Extracted lead: "${res.lead?.organizationName || res.lead?.title}" (Confidence: ${res.lead?.confidence}%)`
        });
        setUrlInput('');
      } else {
        setStatusMessage({
          type: 'error',
          text: `Document ingested but classified as not a warehouse demand signal: ${res.reason || 'Irrelevant content'}`
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `URL ingestion error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleTextIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textBody) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await ingestRawText(textBody, textTitle || 'Direct Ingestion', knownLeads, modelId, scanNear);
      onIngested(res);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Parsed successfully: "${res.lead?.organizationName || 'Warehouse Lead'}" (Confidence: ${res.lead?.confidence}%)`
        });
        setTextTitle('');
        setTextBody('');
      } else {
        setStatusMessage({
          type: 'error',
          text: `Text analyzed but filtered: ${res.reason || 'No requirement identified'}`
        });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Text parsing error: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', backgroundColor: '#ffffff' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '14px',
        marginBottom: '18px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Lead Ingestion Control Hub
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Discover and extract structured warehouse leads across live feeds, direct URLs, trade newsletters, and public tenders.
          </p>
          {/* Locked mid-run so every document in one queue uses one model. */}
          <ModelSelector value={modelId} onChange={onModelChange} disabled={loading} />
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            onClick={() => { setActiveTab('scan'); setStatusMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'scan' ? '#4f46e5' : 'var(--text-secondary)',
              background: activeTab === 'scan' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'scan' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              border: activeTab === 'scan' ? '1px solid #e2e8f0' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <Radio size={14} />
            <span>Live RSS Scan</span>
          </button>

          <button
            onClick={() => { setActiveTab('linkedin'); setStatusMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'linkedin' ? '#0a66c2' : 'var(--text-secondary)',
              background: activeTab === 'linkedin' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'linkedin' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              border: activeTab === 'linkedin' ? '1px solid #e2e8f0' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <Linkedin size={14} />
            <span>LinkedIn</span>
          </button>

          <button
            onClick={() => { setActiveTab('url'); setStatusMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'url' ? '#4f46e5' : 'var(--text-secondary)',
              background: activeTab === 'url' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'url' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              border: activeTab === 'url' ? '1px solid #e2e8f0' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={14} />
            <span>Direct URL</span>
          </button>

          <button
            onClick={() => { setActiveTab('text'); setStatusMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'text' ? '#4f46e5' : 'var(--text-secondary)',
              background: activeTab === 'text' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'text' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              border: activeTab === 'text' ? '1px solid #e2e8f0' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={14} />
            <span>Newsletter / Text</span>
          </button>

        </div>
      </div>

      {/* Tab 1: Live RSS Scan */}
      {activeTab === 'scan' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '4px' }}>
              Automated Keyword Discovery Stream
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '750px' }}>
              Monitors live Google News and regional industry feeds for keywords such as:
              <code style={{ color: '#4f46e5', marginLeft: '6px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                "warehouse required", "godown on lease", "distribution centre expansion", "cold storage Gujarat"
              </code>.
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.88rem',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Radio size={16} />}
            <span>{loading ? 'Scanning & Extracting...' : 'Trigger Live Scan'}</span>
          </button>
        </div>
      )}

      {/* Tab 2: LinkedIn public posts */}
      {activeTab === 'linkedin' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '4px' }}>
              Public LinkedIn Requirement Posts
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '750px' }}>
              Searches publicly indexed LinkedIn posts for occupier phrasing such as
              <code style={{ color: '#0a66c2', marginLeft: '6px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                "warehouse requirement", "godown required", "warehouse on lease"
              </code>
              , narrowed to the places around your latitude, longitude and radius.
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '750px' }}>
              {scanNear
                ? `Targeting the area within ${scanNear.radiusKm} km of ${scanNear.latitude.toFixed(3)}, ${scanNear.longitude.toFixed(3)}.`
                : 'No area set. Pick a city in the location filter below to target this search.'}
              {' '}Results are public posts only, scored as unverified — LinkedIn publishes no post API,
              so this cannot see private or unindexed posts.
            </p>
            {!linkedInEnabled && (
              <p style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '6px', fontWeight: 600 }}>
                No search provider configured — set SEARCH_PROVIDER and SEARCH_API_KEY to enable this tab.
              </p>
            )}
          </div>
          <button
            onClick={handleLinkedInScan}
            disabled={loading || !linkedInEnabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: linkedInEnabled ? '#0a66c2' : '#94a3b8',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.88rem',
              boxShadow: linkedInEnabled ? '0 2px 6px rgba(10, 102, 194, 0.25)' : 'none',
              whiteSpace: 'nowrap',
              cursor: linkedInEnabled && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Linkedin size={16} />}
            <span>{loading ? 'Searching...' : 'Search LinkedIn'}</span>
          </button>
        </div>
      )}

      {/* Tab 2: Direct URL Ingestion */}
      {activeTab === 'url' && (
        <form onSubmit={handleUrlIngest} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="url"
              required
              placeholder="Paste article, tender, or public notice URL (e.g. https://economictimes.indiatimes.com/...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !urlInput}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.88rem',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={16} />}
            <span>{loading ? 'Scraping & Extracting...' : 'Extract Lead from URL'}</span>
          </button>
        </form>
      )}

      {/* Tab 3: Raw Text / Newsletter Parser */}
      {activeTab === 'text' && (
        <form onSubmit={handleTextIngest} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="Optional Title / Reference (e.g. Inbound Trade Newsletter #42)"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <textarea
            required
            rows={3}
            placeholder="Paste raw tender notice, trade email, or RFP text snippet here..."
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={loading || !textBody}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.88rem',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
              <span>{loading ? 'Analyzing with Bedrock...' : 'Extract Structured Lead'}</span>
            </button>
          </div>
        </form>
      )}


      {/* Live per-document progress */}
      {progress && (
        <div style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e40af' }}>
              Extracting document {progress.done} of {progress.total}
              <span style={{ fontWeight: 500, color: '#3b82f6', marginLeft: '8px' }}>
                {progress.leads} lead{progress.leads === 1 ? '' : 's'} so far
              </span>
            </span>

            <button
              onClick={() => abortRef.current?.abort()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 11px',
                borderRadius: '6px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#be123c',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              <StopCircle size={13} />
              <span>Stop</span>
            </button>
          </div>

          {/* Leads appear in the table as each document completes, so the bar
              reflects work already banked rather than work merely started. */}
          <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#dbeafe', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: '999px',
              backgroundColor: '#3b82f6',
              width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>
      )}

      {/* Status Alert */}
      {statusMessage && (
        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '0.84rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: statusMessage.type === 'success' ? '#ecfdf5' : '#fff1f2',
          border: statusMessage.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecdd3',
          color: statusMessage.type === 'success' ? '#065f46' : '#be123c'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
