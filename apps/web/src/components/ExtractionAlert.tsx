import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ExtractionAlertProps {
  reason: string;
  fallbackCount: number;
  processedCount: number;
  onDismiss: () => void;
}

/**
 * Persistent banner shown when extraction ran on the degraded fallback path.
 *
 * Deliberately separate from the ingestion hub's transient status line: the
 * consequence outlives the run that caused it. Leads already in the table were
 * extracted at lower accuracy, and a user who missed the status message would
 * otherwise have no way to know why this scan's results look worse than the
 * last one's.
 */
export const ExtractionAlert: React.FC<ExtractionAlertProps> = ({
  reason,
  fallbackCount,
  processedCount,
  onDismiss
}) => (
  <div
    role="status"
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '12px 16px',
      marginBottom: '20px',
      borderRadius: '10px',
      backgroundColor: '#fffbeb',
      border: '1px solid #fde68a',
      color: '#92400e'
    }}
  >
    <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 800, fontSize: '0.86rem', marginBottom: '2px' }}>
        AI extraction unavailable — results are lower quality
      </div>
      <div style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>{reason}</div>
      <div style={{ fontSize: '0.76rem', marginTop: '4px', color: '#b45309' }}>
        {fallbackCount} of {processedCount} document{processedCount === 1 ? '' : 's'} used the
        rule-based fallback.
      </div>
    </div>

    <button
      onClick={onDismiss}
      title="Dismiss"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '4px',
        borderRadius: '6px',
        background: 'transparent',
        border: 'none',
        color: '#92400e'
      }}
    >
      <X size={15} />
    </button>
  </div>
);
