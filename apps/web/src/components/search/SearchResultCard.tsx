import React, { useState } from 'react';
import { SearchHitDTO } from '../../api/types';
import { Card } from '../ui/Card';

interface SearchResultCardProps {
  hit: SearchHitDTO;
  rank: number;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ hit, rank }) => {
  const [showMetadata, setShowMetadata] = useState(false);

  // Distance formatting: raw metric rounded to 4 decimal places
  const formattedDistance = typeof hit.distance === 'number' ? hit.distance.toFixed(4) : String(hit.distance);

  return (
    <Card style={{ padding: '1.25rem', marginBottom: '1rem', transition: 'border-color var(--transition-fast)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        {/* Left header: Rank + Title + Chunk Index */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <span
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'hsla(252, 85%, 67%, 0.15)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            #{rank}
          </span>

          <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            📄 {hit.documentTitle || 'Untitled Document'}
          </span>

          <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
            Chunk #{hit.chunkIndex}
          </span>
        </div>

        {/* Right header: Raw Vector Distance score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            title="Vector Metric Distance (Lower values indicate higher semantic similarity. Not a probability percentage.)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.625rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'hsla(186, 92%, 52%, 0.12)',
              border: '1px solid hsla(186, 92%, 52%, 0.3)',
              color: 'var(--accent-cyan)',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'help',
            }}
          >
            <span>📐 Distance:</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{formattedDistance}</span>
          </div>
        </div>
      </div>

      {/* Text Preview Snippet */}
      <div
        style={{
          padding: '1rem',
          backgroundColor: 'hsla(224, 25%, 7%, 0.6)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.925rem',
          lineHeight: '1.6',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {hit.text}
      </div>

      {/* Metadata Accordion */}
      {hit.metadata && Object.keys(hit.metadata).length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setShowMetadata(!showMetadata)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>{showMetadata ? '▼ Hide Metadata' : '▶ Show Chunk Metadata'}</span>
          </button>

          {showMetadata && (
            <pre
              style={{
                marginTop: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'hsla(224, 25%, 5%, 0.7)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                overflowX: 'auto',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {JSON.stringify(hit.metadata, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
};
