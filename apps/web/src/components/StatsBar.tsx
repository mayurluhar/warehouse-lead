import React from 'react';
import { PipelineStats } from '@warehouse-lead/core/client';
import { Radio, FileCheck, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';

interface StatsBarProps {
  stats: PipelineStats | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Signals Scanned',
      value: stats?.totalSignalsScanned ?? 0,
      icon: Radio,
      color: '#0891b2',
      bg: '#ecfeff',
      border: '#cffafe'
    },
    {
      label: 'Qualified Leads',
      value: stats?.totalLeads ?? 0,
      icon: FileCheck,
      color: '#4f46e5',
      bg: '#eef2ff',
      border: '#e0e7ff'
    },
    {
      label: 'Active Tenders / RFPs',
      value: stats?.activeTenders ?? 0,
      icon: Sparkles,
      color: '#7c3aed',
      bg: '#f5f3ff',
      border: '#ede9fe'
    },
    {
      label: 'Avg Confidence Score',
      value: `${stats?.avgConfidence ?? 0}%`,
      icon: TrendingUp,
      color: '#059669',
      bg: '#ecfdf5',
      border: '#d1fae5'
    },
    {
      label: 'False Positives Filtered',
      value: stats?.falsePositivesFiltered ?? 0,
      icon: ShieldAlert,
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fef3c7'
    }
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '14px',
      marginBottom: '24px'
    }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                {card.label}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                {card.value}
              </div>
            </div>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: card.bg,
              border: `1px solid ${card.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: card.color
            }}>
              <Icon size={20} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
