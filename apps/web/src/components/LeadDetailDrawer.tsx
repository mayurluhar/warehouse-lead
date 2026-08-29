import React from 'react';
import { LeadRecord } from '../types/lead';
import { ScoreBreakdown } from './ScoreBreakdown';
import {
  X,
  ExternalLink,
  Layers,
  Quote,
  Cpu
} from 'lucide-react';

interface LeadDetailDrawerProps {
  lead: LeadRecord | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: LeadRecord['status']) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onUpdateStatus
}) => {
  if (!lead) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100%',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-drawer)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className={`badge badge-${lead.intent}`}>
                {lead.intent}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                ID: {lead.id}
              </span>
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {lead.organizationName || lead.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Workflow Status Switcher */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Lead Pipeline Stage:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['inbox', 'approved', 'contacted', 'rejected'] as LeadRecord['status'][]).map((st) => (
              <button
                key={st}
                onClick={() => onUpdateStatus(lead.id, st)}
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: lead.status === st ? 'var(--accent-primary)' : '#ffffff',
                  color: lead.status === st ? '#ffffff' : 'var(--text-secondary)',
                  border: lead.status === st ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: lead.status === st ? '0 1px 3px rgba(79, 70, 229, 0.25)' : 'var(--shadow-xs)',
                  transition: 'all 0.15s ease'
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer Body Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: AI Reasoning & Intent Summary */}
          <div className="glass-panel" style={{ padding: '16px 20px', backgroundColor: '#f5f7ff', border: '1px solid #e0e7ff', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#4f46e5', fontSize: '0.8rem', fontWeight: 700 }}>
              <Cpu size={15} />
              <span>AI Extraction & Relevance Reasoning</span>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.55 }}>
              {lead.reasoningSummary}
            </p>
          </div>

          {/* Section 2: Structured Requirement Attributes */}
          <div>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 800 }}>
              Structured Requirement Parameters
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Target Occupier</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{lead.organizationName || 'Unspecified'}</div>
              </div>

              <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Industry / Vertical</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{lead.industry || 'General Logistics'}</div>
              </div>

              <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Requirement Size</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#047857' }}>
                  {lead.size.value ? `${lead.size.value.toLocaleString()} ${lead.size.unit?.replace('_', ' ')}` : 'Not specified'}
                  {lead.size.normalizedSqft && lead.size.unit !== 'sqft' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      (~{lead.size.normalizedSqft.toLocaleString()} sqft)
                    </span>
                  )}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Requirement Type</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {lead.requirementType.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Target Micro-Corridor</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {lead.location.corridor || lead.location.city || 'Unspecified'}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>State / Region</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{lead.location.state || 'India'}</div>
              </div>

              {lead.tenderReference && (
                <div className="glass-panel" style={{ padding: '12px 14px', gridColumn: 'span 2', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: '0.74rem', color: '#6d28d9', marginBottom: '3px', fontWeight: 700 }}>Tender / RFP Reference ID</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#5b21b6', fontFamily: 'var(--font-mono)' }}>
                    {lead.tenderReference}
                  </div>
                </div>
              )}

              {lead.deadline && (
                <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.74rem', color: '#b45309', marginBottom: '3px', fontWeight: 700 }}>Submission Deadline</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>{lead.deadline}</div>
                </div>
              )}

              {(lead.contact.email || lead.contact.phone) && (
                <div className="glass-panel" style={{ padding: '12px 14px', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 600 }}>Direct Contact</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {lead.contact.email && <span>{lead.contact.email}</span>}
                    {lead.contact.phone && <span>{lead.contact.phone}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Special Facility Requirements */}
            {lead.specialRequirements.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Special Facility Capabilities</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {lead.specialRequirements.map((spec, i) => (
                    <span key={i} style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#eef2ff',
                      color: '#4f46e5',
                      border: '1px solid #c7d2fe'
                    }}>
                      {spec.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Traceable Evidence Quotes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Quote size={15} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 800 }}>
                Traceable Source Evidence Quotes
              </h3>
            </div>
            
            {lead.evidence.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lead.evidence.map((ev, idx) => (
                  <div key={idx} className="glass-panel" style={{ padding: '10px 14px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '4px' }}>
                      Field: {ev.field}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#1e293b', fontStyle: 'italic', borderLeft: '3px solid var(--accent-primary)', paddingLeft: '8px', backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      "{ev.quote}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Direct quote offsets derived from primary article headline and body.
              </div>
            )}
          </div>

          {/* Section 4: Explainable Confidence Score */}
          <div>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 800 }}>
              Explainable Lead Confidence Calculation
            </h3>
            <ScoreBreakdown score={lead.scoreBreakdown} confidence={lead.confidence} />
          </div>

          {/* Section 5: Primary Source & Corroborating Evidence */}
          <div>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 800 }}>
              Source Provenance & Raw Documents
            </h3>
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '10px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#047857' }}>
                  Primary Source ({lead.primarySource.sourceType.replace('_', ' ')})
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {new Date(lead.primarySource.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {lead.primarySource.title}
              </div>
              <a
                href={lead.primarySource.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#4f46e5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                  marginBottom: '10px'
                }}
              >
                <span>{lead.primarySource.canonicalUrl}</span>
                <ExternalLink size={12} />
              </a>
              <div style={{
                fontSize: '0.78rem',
                color: '#334155',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-subtle)',
                padding: '10px',
                borderRadius: '6px',
                maxHeight: '120px',
                overflowY: 'auto',
                lineHeight: 1.45
              }}>
                {lead.primarySource.cleanText}
              </div>
            </div>

            {/* Corroborating sources */}
            {lead.corroboratingSources.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0891b2', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={13} />
                  <span>Corroborating Evidence Sources ({lead.corroboratingSources.length})</span>
                </div>
                {lead.corroboratingSources.map((cs, idx) => (
                  <div key={idx} className="glass-panel" style={{ padding: '10px 14px', marginBottom: '8px', backgroundColor: '#f8fafc' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{cs.title}</div>
                    <a
                      href={cs.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.74rem', fontWeight: 600, color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <span>{cs.canonicalUrl}</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
