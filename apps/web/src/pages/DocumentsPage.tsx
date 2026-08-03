import React from 'react';

export const DocumentsPage: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Document Management</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Ingest text files, split content into deterministic chunks, and sync vector embeddings.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📄</div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Documents Ingested Yet</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Document ingestion interface will be enabled in subsequent UI stages.
        </p>
      </div>
    </div>
  );
};
