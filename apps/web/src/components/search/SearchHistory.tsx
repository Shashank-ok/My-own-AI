import React from 'react';
import { Button } from '../ui/Button';

interface SearchHistoryProps {
  history: string[];
  onSelectQuery: (query: string) => void;
  onClearHistory: () => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onSelectQuery, onClearHistory }) => {
  if (history.length === 0) return null;

  return (
    <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Recent Queries (Session)
        </span>
        <Button variant="ghost" size="sm" onClick={onClearHistory} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
          Clear History
        </Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {history.map((q, idx) => (
          <button
            key={`${q}-${idx}`}
            type="button"
            onClick={() => onSelectQuery(q)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'hsla(224, 20%, 16%, 0.6)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.825rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            aria-label={`Re-run query: ${q}`}
          >
            <span>🕒</span>
            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
