import React from 'react';
import { Search, Gauge } from 'lucide-react';
import { GeoRadius } from '@warehouse-lead/core/client';
import { LocationFilter } from './LocationFilter';

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedIntent: string;
  onIntentChange: (val: string) => void;
  /** Coordinate + radius search; null means no geographic restriction. */
  near: GeoRadius | null;
  onNearChange: (val: GeoRadius | null) => void;
  /** Leads without resolved coordinates, hidden while a radius is active. */
  leadsWithoutCoordinates: number;
  /** Leads with coordinates that fall outside the active radius. */
  leadsOutsideRadius: number;
  includeUnlocated: boolean;
  onIncludeUnlocatedChange: (value: boolean) => void;
  minConfidence: number;
  onConfidenceChange: (val: number) => void;
}

const INTENT_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Intents', value: '' },
  { label: 'Tenders', value: 'tender' },
  { label: 'RFPs', value: 'rfp' },
  { label: 'Scouting', value: 'scouting' },
  { label: 'Expansion', value: 'expansion' },
  { label: 'Land / BTS', value: 'land' },
  { label: 'Watch Signals', value: 'watch' },
];


export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  selectedIntent,
  onIntentChange,
  near,
  onNearChange,
  leadsWithoutCoordinates,
  leadsOutsideRadius,
  includeUnlocated,
  onIncludeUnlocatedChange,
  minConfidence,
  onConfidenceChange
}) => {
  return (
    <div className="glass-panel" style={{
      padding: '14px 20px',
      marginBottom: '20px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '14px',
      justifyContent: 'space-between',
      backgroundColor: '#ffffff'
    }}>
      {/* Search Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#f8fafc',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '6px 12px',
        flex: '1 1 260px'
      }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search by company, tender ref, corridor, industry..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            width: '100%',
            fontWeight: 500
          }}
        />
      </div>

      {/* Intent Badges filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {INTENT_OPTIONS.map((opt) => {
          const isSelected = selectedIntent === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onIntentChange(opt.value)}
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: '6px',
                backgroundColor: isSelected ? 'var(--accent-primary)' : '#f8fafc',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                boxShadow: isSelected ? '0 1px 3px rgba(79, 70, 229, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Coordinate + radius search */}
      <LocationFilter
        value={near}
        onChange={onNearChange}
        hiddenCount={leadsWithoutCoordinates}
        outsideCount={leadsOutsideRadius}
        includeUnlocated={includeUnlocated}
        onIncludeUnlocatedChange={onIncludeUnlocatedChange}
      />

      {/* Min confidence range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
        <Gauge size={15} color="var(--text-muted)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>Min Confidence</span>
            <span style={{ fontWeight: 700, color: '#059669' }}>{minConfidence}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minConfidence}
            onChange={(e) => onConfidenceChange(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
};
