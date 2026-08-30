import React from 'react';
import { Warehouse, Loader2, Trash2, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onClear: () => void;
  loading: boolean;
}

/**
 * There is no Refresh action any more: leads live in React state, so there is
 * nothing on a server to re-read. Reset clears that state, and a browser
 * refresh does the same thing.
 */
export const Header: React.FC<HeaderProps> = ({ onClear, loading }) => {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 30,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)'
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)'
          }}>
            <Warehouse size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
                LeadDesk
              </h1>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#eef2ff',
                color: '#4f46e5',
                border: '1px solid #c7d2fe'
              }}>
                Phase 1 Prototype
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Warehouse Lead Intelligence & Public Signal Discovery Engine
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#047857',
            background: '#ecfdf5',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #a7f3d0'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981'
            }} />
            <span>AWS Bedrock & Connectors Live</span>
          </div>

          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: 'var(--shadow-xs)'
            }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Ingesting…</span>
            </div>
          )}

          <button
            onClick={onClear}
            title="Clear all leads held in this browser session"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#be123c',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 0.15s ease'
            }}
          >
            <Trash2 size={14} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
