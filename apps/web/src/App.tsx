import React, { useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { IngestionHub } from './components/IngestionHub';
import { FilterBar } from './components/FilterBar';
import { LeadTable } from './components/LeadTable';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { ExtractionAlert } from './components/ExtractionAlert';
import { IngestionResponse } from './services/api';
import {
  DEFAULT_EXTRACTION_MODEL_ID,
  GeoRadius,
  IngestionMetrics,
  Lead,
  LeadQueryService,
  PipelineStatsService
} from '@warehouse-lead/core/client';

/**
 * The React desk owns all POC state.
 *
 * There is no database and the API is stateless, so these hooks are the single
 * source of truth: leads live here, filtering and stats are computed here, and
 * a browser refresh resets everything by design.
 *
 * Filtering and the stats rollup reuse the same domain services the server
 * runs, imported through the browser-safe `@warehouse-lead/core/client` entry
 * point, so the desk cannot drift from the backend's rules.
 */

// Stateless across renders; both hold no state of their own.
const queryService = new LeadQueryService();
const statsService = new PipelineStatsService();

export const App: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<IngestionMetrics>({ scannedTotal: 0, falsePositivesTotal: 0 });
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState<string>(DEFAULT_EXTRACTION_MODEL_ID);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  // Survives the ingestion hub's transient status line, because the leads it
  // affected stay in the table long after that message is replaced.
  const [extractionAlert, setExtractionAlert] = useState<IngestionResponse['extraction'] | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedIntent, setSelectedIntent] = useState('');
  const [near, setNear] = useState<GeoRadius | null>(null);
  // On by default: a lead the sources never located should still be reviewable.
  // Turning it off makes the radius strict, for when only mapped leads matter.
  const [includeUnlocated, setIncludeUnlocated] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0);

  /** Folds an ingestion response into local state. */
  const applyIngestion = useCallback((result: IngestionResponse) => {
    setLeads(result.leads ?? []);
    // Clear on a healthy run so a stale warning cannot outlive the problem.
    setExtractionAlert(result.extraction?.degraded ? result.extraction : null);
    setMetrics((prev) => ({
      scannedTotal: prev.scannedTotal + (result.scannedCount ?? 0),
      falsePositivesTotal: prev.falsePositivesTotal + (result.discardedCount ?? 0)
    }));
  }, []);

  const visibleLeads = useMemo(
    () =>
      queryService.apply(leads, {
        search: search || undefined,
        intent: (selectedIntent || undefined) as Lead['intent'] | undefined,
        near: near ?? undefined,
        includeUnlocated,
        minConfidence: minConfidence > 0 ? minConfidence : undefined,
        // With a centre point, nearest-first is the useful ordering.
        sortBy: near ? 'distance' : undefined
      }),
    [leads, search, selectedIntent, near, includeUnlocated, minConfidence]
  );

  // Leads the radius filter can never match, reported rather than silently lost.
  const leadsWithoutCoordinates = useMemo(
    () => queryService.countWithoutCoordinates(leads),
    [leads]
  );

  // Leads that do have coordinates but fall outside the radius. Distinct from
  // the above: this one is fixed by widening the search, not by better sources.
  const leadsOutsideRadius = useMemo(
    () => (near ? queryService.countOutsideRadius(leads, near) : 0),
    [leads, near]
  );

  const stats = useMemo(() => statsService.calculate(leads, metrics), [leads, metrics]);

  // Derived rather than stored, so the drawer always shows the current lead
  // after a status change instead of a stale copy.
  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  const handleUpdateStatus = (id: string, status: Lead['status'], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l))
    );
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to reset all leads and pipeline stats?')) {
      setLeads([]);
      setMetrics({ scannedTotal: 0, falsePositivesTotal: 0 });
      setSelectedLeadId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header onClear={handleClearAll} loading={loading} />

      <main style={{
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '24px',
        flex: 1
      }}>
        {/* Degraded-extraction warning */}
        {extractionAlert?.degraded && (
          <ExtractionAlert
            reason={extractionAlert.reason ?? 'AI extraction was unavailable for this run.'}
            fallbackCount={extractionAlert.fallbackCount}
            processedCount={extractionAlert.processedCount}
            onDismiss={() => setExtractionAlert(null)}
          />
        )}

        {/* Pipeline Summary Counters */}
        <StatsBar stats={stats} />

        {/* Ingestion Hub */}
        <IngestionHub
          knownLeads={leads}
          scanNear={near}
          modelId={modelId}
          onModelChange={setModelId}
          onIngested={applyIngestion}
          onLoadingChange={setLoading}
        />

        {/* Search & Multi-criteria Filter Bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          selectedIntent={selectedIntent}
          onIntentChange={setSelectedIntent}
          near={near}
          onNearChange={setNear}
          leadsWithoutCoordinates={leadsWithoutCoordinates}
          leadsOutsideRadius={leadsOutsideRadius}
          includeUnlocated={includeUnlocated}
          onIncludeUnlocatedChange={setIncludeUnlocated}
          minConfidence={minConfidence}
          onConfidenceChange={setMinConfidence}
        />

        {/* Lead Table / Inbox */}
        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Showing <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{visibleLeads.length}</span> qualified warehouse requirement leads
          </div>
        </div>

        <LeadTable
          leads={visibleLeads}
          onSelectLead={(lead) => setSelectedLeadId(lead.id)}
          onUpdateStatus={(id, status, e) => handleUpdateStatus(id, status, e)}
          selectedLeadId={selectedLeadId}
        />
      </main>

      {/* Deep Inspection Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLeadId(null)}
        onUpdateStatus={(id, status) => handleUpdateStatus(id, status)}
      />
    </div>
  );
};
