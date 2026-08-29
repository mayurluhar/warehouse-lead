import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { IngestionHub } from './components/IngestionHub';
import { FilterBar } from './components/FilterBar';
import { LeadTable } from './components/LeadTable';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { fetchLeads, fetchPipelineStats, updateLeadStatus, clearAllLeads } from './services/api';
import { LeadRecord, PipelineStats } from './types/lead';

export const App: React.FC = () => {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedIntent, setSelectedIntent] = useState('');
  const [selectedCorridor, setSelectedCorridor] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, statsRes] = await Promise.all([
        fetchLeads({
          search: search || undefined,
          intent: selectedIntent || undefined,
          corridor: selectedCorridor || undefined,
          minConfidence: minConfidence > 0 ? minConfidence : undefined
        }),
        fetchPipelineStats()
      ]);
      setLeads(leadsRes.leads || []);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load platform data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedIntent, selectedCorridor, minConfidence]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (id: string, status: LeadRecord['status'], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await updateLeadStatus(id, status);
      if (res.success) {
        setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
        if (selectedLead?.id === id) {
          setSelectedLead(res.lead);
        }
      }
    } catch (err) {
      console.error('Failed updating lead status:', err);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to reset all stored leads and pipeline stats?')) {
      try {
        await clearAllLeads();
        setSelectedLead(null);
        await loadData();
      } catch (err) {
        console.error('Failed resetting leads:', err);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        onRefresh={loadData}
        onClear={handleClearAll}
        loading={loading}
      />

      <main style={{
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '24px',
        flex: 1
      }}>
        {/* Pipeline Summary Counters */}
        <StatsBar stats={stats} />

        {/* Ingestion Hub */}
        <IngestionHub onIngestionComplete={loadData} />

        {/* Search & Multi-criteria Filter Bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          selectedIntent={selectedIntent}
          onIntentChange={setSelectedIntent}
          selectedCorridor={selectedCorridor}
          onCorridorChange={setSelectedCorridor}
          minConfidence={minConfidence}
          onConfidenceChange={setMinConfidence}
        />

        {/* Lead Table / Inbox */}
        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Showing <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{leads.length}</span> qualified warehouse requirement leads
          </div>
        </div>

        <LeadTable
          leads={leads}
          onSelectLead={setSelectedLead}
          onUpdateStatus={(id, status, e) => handleUpdateStatus(id, status, e)}
          selectedLeadId={selectedLead?.id || null}
        />
      </main>

      {/* Deep Inspection Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdateStatus={(id, status) => handleUpdateStatus(id, status)}
      />
    </div>
  );
};
