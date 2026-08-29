import React, { useState } from 'react';
import {
  triggerMultiSourceScan,
  ingestUrl,
  ingestRawText,
  loadBenchmarkSamples
} from '../services/api';
import {
  Radio,
  Globe,
  FileText,
  Database,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface IngestionHubProps {
  onIngestionComplete: () => void;
}

type TabType = 'scan' | 'url' | 'text' | 'benchmark';

export const IngestionHub: React.FC<IngestionHubProps> = ({ onIngestionComplete }) => {
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [urlInput, setUrlInput] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textBody, setTextBody] = useState('');

  const handleScan = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await triggerMultiSourceScan();
      setStatusMessage({
        type: 'success',
        text: `Live scan finished! Scanned ${res.scannedCount} items. Extracted ${res.relevantCount} warehouse signals (${res.newLeadsAdded} new). Discarded ${res.discardedCount} non-demand items.`
      });
      onIngestionComplete();
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
      const res = await ingestUrl(urlInput);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Extracted lead: "${res.lead?.organizationName || res.lead?.title}" (Confidence: ${res.lead?.confidence}%)`
        });
        setUrlInput('');
        onIngestionComplete();
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
      const res = await ingestRawText(textBody, textTitle || 'Direct Ingestion');
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Parsed successfully: "${res.lead?.organizationName || 'Warehouse Lead'}" (Confidence: ${res.lead?.confidence}%)`
        });
        setTextTitle('');
        setTextBody('');
        onIngestionComplete();
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

  const handleBenchmark = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await loadBenchmarkSamples();
      setStatusMessage({
        type: 'success',
        text: `Loaded ${res.relevantCount} verified benchmark signals (FCI Aslali Tender, Blinkit Sanand Hub, Sun Pharma Changodar Cold Storage, GIDC Dahej BTS, etc.)`
      });
      onIngestionComplete();
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Benchmark loading failed: ${(err as Error).message}` });
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Discover and extract structured warehouse leads across live feeds, direct URLs, trade newsletters, and public tenders.
          </p>
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

          <button
            onClick={() => { setActiveTab('benchmark'); setStatusMessage(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: activeTab === 'benchmark' ? '#059669' : 'var(--text-secondary)',
              background: activeTab === 'benchmark' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'benchmark' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              border: activeTab === 'benchmark' ? '1px solid #e2e8f0' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <Database size={14} />
            <span>Benchmark Data</span>
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

      {/* Tab 4: Benchmark Dataset */}
      {activeTab === 'benchmark' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '4px' }}>
              Load Real-World Benchmark Test Bank
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Populates high-confidence government tenders (FCI Godown Hiring Aslali, GIDC Dahej BTS), quick-commerce expansions (Blinkit Sanand), pharma cold storage RFPs (Sun Pharma Changodar), and negative stock-market test signals.
            </p>
          </div>
          <button
            onClick={handleBenchmark}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: '#059669',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.88rem',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Database size={16} />}
            <span>{loading ? 'Loading...' : 'Load Benchmark Signals'}</span>
          </button>
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
