import React, { useState } from 'react';
import { Alert } from '../ui/Alert';

export const DistanceExplanation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: isOpen ? '0.75rem' : 0 }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-cyan)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontWeight: 500,
          }}
          aria-expanded={isOpen}
          aria-label="Toggle distance metric explanation"
        >
          <span>ℹ️</span>
          <span>{isOpen ? 'Hide distance metric explanation' : 'How are vector distance scores calculated?'}</span>
          <span style={{ fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {isOpen && (
        <Alert variant="info" title="Understanding Distance Metrics">
          <div style={{ fontSize: '0.85rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p style={{ margin: 0 }}>
              Distance represents the geometric distance between your query embedding and chunk vectors in high-dimensional embedding space.
            </p>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
              ⚠️ Important: Distance is a raw vector metric where lower values indicate closer semantic similarity. It is NOT a confidence score or probability percentage.
            </p>
          </div>
        </Alert>
      )}
    </div>
  );
};
