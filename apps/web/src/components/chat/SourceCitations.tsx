import React, { useState } from 'react';
import { SearchHitDTO } from '../../api/types';

interface SourceCitationsProps {
  sources: SearchHitDTO[];
}

export const SourceCitations: React.FC<SourceCitationsProps> = ({ sources }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div
      style={{
        marginTop: '0.875rem',
        paddingTop: '0.875rem',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        <span>📚</span>
        <span>Retrieved Vector Sources ({sources.length})</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sources.map((src, idx) => {
          const isExpanded = expandedIndex === idx;
          const formattedDistance = typeof src.distance === 'number' ? src.distance.toFixed(4) : String(src.distance);

          return (
            <div
              key={src.chunkId || idx}
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'hsla(224, 25%, 6%, 0.6)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              {/* Citation Pill Bar */}
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>
                    [{idx + 1}] {src.documentTitle || 'Untitled Document'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Chunk #{src.chunkIndex}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span
                    title="Vector Distance metric (lower value = higher semantic similarity)"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'var(--accent-emerald)',
                      backgroundColor: 'hsla(152, 76%, 48%, 0.1)',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    dist: {formattedDistance}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Expandable Text Chunk Preview */}
              {isExpanded && (
                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'hsla(224, 25%, 4%, 0.8)',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.825rem',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: '1.5',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {src.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
