import React from 'react';
import { BenchmarkResult, AlgorithmType } from '../../utils/vectorEngine';

interface AlgorithmComparisonProps {
  benchmarks: BenchmarkResult[];
  activeAlgorithm: AlgorithmType;
  onSelectAlgorithm: (alg: AlgorithmType) => void;
}

export const AlgorithmComparison: React.FC<AlgorithmComparisonProps> = ({
  benchmarks,
  activeAlgorithm,
  onSelectAlgorithm,
}) => {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>⚡</span>
        <span>Algorithm Benchmark & Recall Comparison</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {benchmarks.map((bm) => {
          const isActive = activeAlgorithm === bm.algorithm;
          return (
            <div
              key={bm.algorithm}
              onClick={() => onSelectAlgorithm(bm.algorithm)}
              style={{
                padding: '1.125rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'hsla(252, 85%, 67%, 0.12)' : 'hsla(224, 25%, 8%, 0.6)',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isActive ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {bm.name}
                </span>
                {isActive && <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Selected</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Latency:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                    {bm.latencyUs} μs ({(bm.latencyUs / 1000).toFixed(3)} ms)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Recall Accuracy:</span>
                  <span style={{ fontWeight: 600, color: bm.recallPercent === 100 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                    {bm.recallPercent}%
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Memory Footprint:</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {bm.memoryFootprint}
                  </span>
                </div>

                <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {bm.indexType}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
