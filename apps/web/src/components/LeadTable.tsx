import React from 'react';
import { Lead, Intent } from '@warehouse-lead/core/client';
import {
  MapPin,
  Check,
  X,
  Layers,
  Sparkles
} from 'lucide-react';

interface LeadTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onUpdateStatus: (id: string, status: Lead['status'], e: React.MouseEvent) => void;
  selectedLeadId: string | null;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  onSelectLead,
  onUpdateStatus,
  selectedLeadId
}) => {
  if (leads.length === 0) {
    return (
      <div className="glass-panel" style={{
        padding: '60px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        backgroundColor: '#ffffff'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '12px',
          backgroundColor: '#eef2ff',
          border: '1px solid #e0e7ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#4f46e5'
        }}>
          <Sparkles size={24} />
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          No warehouse leads in queue
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
          Trigger a "Live RSS Scan" from the control hub above, or ingest a URL or newsletter text, to start gathering qualified warehouse occupier signals.
        </p>
      </div>
    );
  }

  const getIntentBadgeClass = (intent: Intent) => {
    switch (intent) {
      case 'tender': return 'badge-tender';
      case 'rfp': return 'badge-rfp';
      case 'scouting': return 'badge-scouting';
      case 'expansion': return 'badge-expansion';
      case 'land': return 'badge-land';
      case 'watch':
      default: return 'badge-watch';
    }
  };

  const getConfidenceClass = (conf: number) => {
    if (conf >= 75) return 'confidence-high';
    if (conf >= 50) return 'confidence-mid';
    return 'confidence-low';
  };

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', backgroundColor: '#ffffff' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: '#f8fafc',
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              fontWeight: 700
            }}>
              <th style={{ padding: '14px 18px', width: '110px' }}>Intent</th>
              <th style={{ padding: '14px 18px' }}>Company / Requirement</th>
              <th style={{ padding: '14px 18px', width: '130px' }}>Size</th>
              <th style={{ padding: '14px 18px', width: '150px' }}>Location</th>
              <th style={{ padding: '14px 18px', width: '110px' }}>Confidence</th>
              <th style={{ padding: '14px 18px', width: '110px' }}>Status</th>
              <th style={{ padding: '14px 18px', width: '90px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isSelected = selectedLeadId === lead.id;
              const sizeStr = lead.size.value
                ? `${lead.size.value.toLocaleString()} ${lead.size.unit?.replace('_', ' ')}`
                : 'Unspecified size';

              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  {/* Intent Badge */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                    <span className={`badge ${getIntentBadgeClass(lead.intent)}`}>
                      {lead.intent}
                    </span>
                    {lead.corroboratingSources.length > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.68rem',
                        color: '#0891b2',
                        marginTop: '4px',
                        fontWeight: 700
                      }}>
                        <Layers size={11} />
                        <span>+{lead.corroboratingSources.length} sources</span>
                      </div>
                    )}
                  </td>

                  {/* Company & Title */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {lead.organizationName || 'Identified Requirement'}
                      </span>
                      {lead.industry && (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          background: '#f1f5f9',
                          border: '1px solid var(--border-subtle)',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {lead.industry}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.35',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {lead.title}
                    </div>
                  </td>

                  {/* Size */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      {sizeStr}
                    </div>
                    {lead.size.normalizedSqft && lead.size.unit !== 'sqft' && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        ~{lead.size.normalizedSqft.toLocaleString()} sqft
                      </div>
                    )}
                  </td>

                  {/* Location */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      <MapPin size={13} color="var(--text-muted)" />
                      <span>{lead.location.corridor || lead.location.city || lead.location.state || 'Unspecified'}</span>
                    </div>
                    {lead.location.corridor && lead.location.city && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '17px' }}>
                        {lead.location.city}, {lead.location.state || 'GJ'}
                      </div>
                    )}
                  </td>

                  {/* Confidence */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                    <span className={`badge ${getConfidenceClass(lead.confidence)}`} style={{ fontWeight: 700 }}>
                      {lead.confidence}%
                    </span>
                  </td>

                  {/* Status Pill */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: lead.status === 'approved'
                        ? '#ecfdf5'
                        : lead.status === 'rejected'
                        ? '#fff1f2'
                        : '#f1f5f9',
                      color: lead.status === 'approved'
                        ? '#047857'
                        : lead.status === 'rejected'
                        ? '#be123c'
                        : 'var(--text-secondary)',
                      border: lead.status === 'approved'
                        ? '1px solid #a7f3d0'
                        : lead.status === 'rejected'
                        ? '1px solid #fecdd3'
                        : '1px solid var(--border-subtle)'
                    }}>
                      {lead.status}
                    </span>
                  </td>

                  {/* Quick Action buttons */}
                  <td style={{ padding: '14px 18px', verticalAlign: 'top', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <button
                        title="Approve Lead"
                        onClick={(e) => onUpdateStatus(lead.id, 'approved', e)}
                        style={{
                          padding: '5px',
                          borderRadius: '6px',
                          color: lead.status === 'approved' ? '#047857' : 'var(--text-muted)',
                          background: lead.status === 'approved' ? '#ecfdf5' : '#f8fafc',
                          border: '1px solid var(--border-subtle)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        title="Reject Lead"
                        onClick={(e) => onUpdateStatus(lead.id, 'rejected', e)}
                        style={{
                          padding: '5px',
                          borderRadius: '6px',
                          color: lead.status === 'rejected' ? '#be123c' : 'var(--text-muted)',
                          background: lead.status === 'rejected' ? '#fff1f2' : '#f8fafc',
                          border: '1px solid var(--border-subtle)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
