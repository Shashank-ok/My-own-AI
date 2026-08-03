import React from 'react';

export const DashboardPage: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Welcome to Your OWN AI — high-performance private vector search & RAG platform.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Documents Ingested</span>
            <span className="badge badge-primary">Durable</span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>0</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Persisted in MongoDB memory/store
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>C++ Vector Index</span>
            <span className="badge badge-success">HNSW</span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>0 Vectors</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Sub-millisecond cosine vector retrieval
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ollama LLM Status</span>
            <span className="badge badge-primary">Local</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginTop: '0.5rem' }}>
            Ready
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Local embeddings & completion generator
          </p>
        </div>
      </div>
    </div>
  );
};
