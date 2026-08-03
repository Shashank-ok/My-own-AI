import React from 'react';

export const SearchPage: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Semantic Vector Search</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Query your isolated user vector namespace in the C++ engine and hydrate authorized MongoDB chunks.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Semantic Search Ready</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Search query interface will be connected to the POST /api/search gateway endpoint.
        </p>
      </div>
    </div>
  );
};
