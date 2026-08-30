import React from 'react';
import { ScoreBreakdown as IScoreBreakdown } from '@warehouse-lead/core/client';
import { CheckCircle2 } from 'lucide-react';

interface ScoreBreakdownProps {
  score: IScoreBreakdown;
  confidence: number;
}

export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ score, confidence }) => {
  const components = [
    { label: 'Intent Strength', value: score.intentStrength, max: 25, color: '#7c3aed' },
    { label: 'Requirement Specificity', value: score.requirementSpecificity, max: 20, color: '#2563eb' },
    { label: 'Source Trust Tier', value: score.sourceTrust, max: 15, color: '#059669' },
    { label: 'Location Match (Gujarat / Hub)', value: score.locationRelevance, max: 15, color: '#0891b2' },
    { label: 'Signal Recency', value: score.recency, max: 10, color: '#d97706' },
    { label: 'Corroboration Bonus', value: score.corroboration, max: 10, color: '#db2777' },
    { label: 'Actionable Route / Tender Ref', value: score.contactActionability, max: 5, color: '#0d9488' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Overall Score Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: '10px',
        backgroundColor: '#f8fafc',
        border: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
            Composite Confidence Score
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: confidence >= 75 ? '#047857' : confidence >= 50 ? '#b45309' : '#64748b' }}>
            {confidence}% <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>/ 100</span>
          </div>
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: confidence >= 75 ? '#ecfdf5' : confidence >= 50 ? '#fffbeb' : '#f1f5f9',
          color: confidence >= 75 ? '#047857' : confidence >= 50 ? '#b45309' : '#475569',
          border: confidence >= 75 ? '1px solid #a7f3d0' : confidence >= 50 ? '1px solid #fde68a' : '1px solid var(--border-subtle)'
        }}>
          {confidence >= 75 ? 'High Confidence' : confidence >= 50 ? 'Medium Confidence' : 'Watch Signal'}
        </div>
      </div>

      {/* Component progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {components.map((c, i) => {
          const pct = Math.round((c.value / c.max) * 100);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {c.value} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {c.max}</span>
                </span>
              </div>
              <div style={{
                height: '6px',
                width: '100%',
                backgroundColor: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  backgroundColor: c.color,
                  borderRadius: '3px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Score explanation notes */}
      {score.explanations && score.explanations.length > 0 && (
        <div style={{
          marginTop: '6px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Score Reason Breakdown:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {score.explanations.map((exp, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={13} color="#059669" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>{exp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
