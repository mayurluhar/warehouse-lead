import React from 'react';
import { CheckCircle2, ExternalLink, Loader2, ThumbsUp, XCircle } from 'lucide-react';
import { ScanRecord } from '../scanRecords';

interface DocumentTableProps {
  records: ScanRecord[];
  /** Absent on the "all news" tab, where promotion is not the point. */
  onPromote?: (record: ScanRecord) => void;
  /** contentHash of the row currently being re-ingested. */
  promotingHash: string | null;
  emptyMessage: string;
}

function formatDate(iso: string): string {
  if (!iso) return 'Date unknown';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 'Date unknown' : parsed.toLocaleDateString();
}

/**
 * The scanned-document list, used for both "all news" and "unqualified".
 *
 * Deliberately not the lead table: these rows have no score, no organisation and
 * no geography, because nothing was extracted from them. Showing them in the
 * lead table's columns would render a wall of dashes and imply the extraction
 * failed, when in fact it ran and returned a considered "no".
 *
 * The rejection reason is given the most horizontal space of any column. It is
 * the only thing on the row a reviewer can act on — deciding whether the
 * classifier was right is exactly the judgement being asked for.
 */
export const DocumentTable: React.FC<DocumentTableProps> = ({
  records,
  onPromote,
  promotingHash,
  emptyMessage
}) => {
  if (records.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', fontWeight: 700 }}>Article</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, width: '40%' }}>
                {onPromote ? 'Why it was rejected' : 'Assessment'}
              </th>
              <th style={{ padding: '10px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>Published</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const isPromoting = promotingHash === record.document.contentHash;
              return (
                <tr
                  key={record.document.contentHash}
                  style={{ borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.07))' }}
                >
                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                    <a
                      href={record.document.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        gap: '5px',
                        alignItems: 'flex-start'
                      }}
                    >
                      {record.document.title}
                      <ExternalLink size={13} style={{ flexShrink: 0, marginTop: '3px', opacity: 0.5 }} />
                    </a>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '3px' }}>
                      {record.document.sourceType} · {record.document.trustTier.replace(/_/g, ' ')}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: '12px 14px',
                      verticalAlign: 'top',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45
                    }}
                  >
                    {record.reason || 'No reason recorded.'}
                  </td>

                  <td
                    style={{
                      padding: '12px 14px',
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {formatDate(record.document.publishedAt)}
                  </td>

                  <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {record.verdict === 'qualified' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#15803d' }}>
                        <CheckCircle2 size={14} />
                        {record.promoted ? 'Approved by you' : 'Qualified'}
                      </span>
                    ) : onPromote ? (
                      <button
                        onClick={() => onPromote(record)}
                        disabled={isPromoting}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '7px',
                          border: '1px solid #15803d',
                          background: isPromoting ? 'rgba(21,128,61,0.08)' : 'transparent',
                          color: '#15803d',
                          fontWeight: 650,
                          fontSize: '0.8rem',
                          cursor: isPromoting ? 'wait' : 'pointer'
                        }}
                      >
                        {isPromoting ? <Loader2 size={13} className="spin" /> : <ThumbsUp size={13} />}
                        {isPromoting ? 'Extracting…' : 'Approve'}
                      </button>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#b45309' }}>
                        <XCircle size={14} />
                        Not a requirement
                      </span>
                    )}
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
