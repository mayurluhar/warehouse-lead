import React from 'react';
import { Inbox, Newspaper, XCircle } from 'lucide-react';

export type ReviewTab = 'all' | 'qualified' | 'unqualified';

interface ReviewTabsProps {
  active: ReviewTab;
  onChange: (tab: ReviewTab) => void;
  allCount: number;
  qualifiedCount: number;
  unqualifiedCount: number;
}

const TABS: { id: ReviewTab; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'all', label: 'All news', icon: Newspaper, hint: 'Every article this session has scanned' },
  { id: 'qualified', label: 'Qualified', icon: Inbox, hint: 'Articles that produced a warehouse lead' },
  { id: 'unqualified', label: 'Unqualified', icon: XCircle, hint: 'Rejected — review and approve any the classifier got wrong' }
];

/**
 * Switches between the three review lists.
 *
 * Counts are rendered on the tabs themselves because the relationship between
 * them is the actual signal: 38 scanned / 1 qualified says something very
 * different from 38 scanned / 30 qualified, and neither is visible if you have
 * to click through to find out.
 */
export const ReviewTabs: React.FC<ReviewTabsProps> = ({
  active,
  onChange,
  allCount,
  qualifiedCount,
  unqualifiedCount
}) => {
  const counts: Record<ReviewTab, number> = {
    all: allCount,
    qualified: qualifiedCount,
    unqualified: unqualifiedCount
  };

  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            title={tab.hint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 15px',
              borderRadius: '9px',
              border: `1px solid ${isActive ? 'var(--accent, #2563eb)' : 'rgba(0,0,0,0.12)'}`,
              background: isActive ? 'var(--accent, #2563eb)' : '#ffffff',
              color: isActive ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 650,
              fontSize: '0.87rem',
              cursor: 'pointer'
            }}
          >
            <Icon size={15} />
            {tab.label}
            <span
              style={{
                padding: '1px 8px',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)',
                color: isActive ? '#ffffff' : 'var(--text-primary)'
              }}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
};
