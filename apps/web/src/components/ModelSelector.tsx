import React from 'react';
import { Cpu } from 'lucide-react';
import { EXTRACTION_MODELS, findExtractionModel } from '@warehouse-lead/core/client';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  /** Locked while a queue is running so the run uses one model throughout. */
  disabled?: boolean;
}

/**
 * Picks the extraction model for the next run.
 *
 * A development affordance: Bedrock's on-demand quota is per model, so when
 * the default model throttles mid-session, switching to the other one keeps work
 * moving instead of waiting out the cooldown. Options come from the shared allowlist in core —
 * the same list the server validates against.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, disabled }) => {
  const selected = findExtractionModel(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Cpu size={14} color="var(--text-muted)" />
        <select
          aria-label="Extraction model"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          {EXTRACTION_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', maxWidth: '260px', lineHeight: 1.35 }}>
          {selected.note}
        </span>
      )}
    </div>
  );
};
