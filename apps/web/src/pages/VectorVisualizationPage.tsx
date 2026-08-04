import React, { useState, useMemo } from 'react';
import { PageContainer, Card, Alert } from '../components/ui';
import {
  AlgorithmType,
  MetricType,
  generateSampleDataset,
  runVectorSearch,
} from '../utils/vectorEngine';
import { VectorCanvas } from '../components/visualization/VectorCanvas';
import { AlgorithmComparison } from '../components/visualization/AlgorithmComparison';
import { AccessibleVectorTable } from '../components/visualization/AccessibleVectorTable';

export const VectorVisualizationPage: React.FC = () => {
  // Options
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('HNSW');
  const [metric, setMetric] = useState<MetricType>('COSINE');
  const [k, setK] = useState<number>(5);

  // Query vector position on 2D canvas
  const [queryPos, setQueryPos] = useState<{ x: number; y: number }>({ x: 30, y: 25 });

  // Generate deterministic dataset once
  const initialDataset = useMemo(() => generateSampleDataset(48, 64), []);

  // Compute 64-dim query vector from 2D coordinates
  const queryVector = useMemo(() => {
    const vec: number[] = [];
    for (let d = 0; d < 64; d++) {
      const val =
        (queryPos.x / 75) * Math.cos((d * Math.PI * 2) / 64) +
        (queryPos.y / 75) * Math.sin((d * Math.PI * 2) / 64);
      vec.push(val);
    }
    return vec;
  }, [queryPos]);

  // Execute Vector Search
  const searchOutput = useMemo(() => {
    return runVectorSearch(queryVector, initialDataset, algorithm, metric, k);
  }, [queryVector, initialDataset, algorithm, metric, k]);

  return (
    <PageContainer
      title="Vector Search 2D Visualization & Benchmarks"
      subtitle="Interactive 2D PCA projection scatter plot visualizing vector distance metrics and index algorithms."
    >
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>
        {/* Mandatory 2D Projection Disclaimer Alert */}
        <Alert variant="warning" title="2D Projection Approximation Disclaimer" style={{ marginBottom: '1.25rem' }}>
          The 2D scatter plot is a Principal Component Analysis (PCA) linear projection approximation of high-dimensional vector space.
          <strong style={{ display: 'block', marginTop: '0.25rem' }}>
            ⚠️ Do NOT infer that visual distance on the 2D canvas equals exact high-dimensional vector distance. High-dimensional vector distances are computed using the selected metric ({metric}).
          </strong>
        </Alert>

        {/* Controls Card */}
        <Card style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            {/* Algorithm Selector */}
            <div>
              <label htmlFor="algorithm-select" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Search Algorithm
              </label>
              <select
                id="algorithm-select"
                className="form-control"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
              >
                <option value="FLAT">Flat (Exact Brute-Force)</option>
                <option value="HNSW">HNSW (Navigable Graph)</option>
                <option value="IVF_PQ">IVF-PQ (Quantized Inverted Index)</option>
              </select>
            </div>

            {/* Distance Metric Selector */}
            <div>
              <label htmlFor="metric-select" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Distance Metric
              </label>
              <select
                id="metric-select"
                className="form-control"
                value={metric}
                onChange={(e) => setMetric(e.target.value as MetricType)}
              >
                <option value="COSINE">Cosine Distance (Default)</option>
                <option value="EUCLIDEAN">Euclidean L2 Distance</option>
                <option value="DOT_PRODUCT">Dot Product (Inner Product)</option>
              </select>
            </div>

            {/* Top-K Selector */}
            <div>
              <label htmlFor="vis-topk-select" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Nearest Neighbors (k)
              </label>
              <select
                id="vis-topk-select"
                className="form-control"
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
              >
                <option value={3}>k = 3 nearest</option>
                <option value={5}>k = 5 nearest (default)</option>
                <option value={8}>k = 8 nearest</option>
                <option value={12}>k = 12 nearest</option>
              </select>
            </div>

            {/* Real-time Latency Badge */}
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Engine Latency
              </div>
              <div
                style={{
                  height: '40px',
                  padding: '0 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'hsla(186, 92%, 52%, 0.12)',
                  border: '1px solid hsla(186, 92%, 52%, 0.3)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                ⚡ {searchOutput.latencyUs} μs ({(searchOutput.latencyUs / 1000).toFixed(3)} ms)
              </div>
            </div>
          </div>
        </Card>

        {/* 2D Vector Canvas Scatter Plot */}
        <Card style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📍</span>
              <span>2D PCA Scatter Plot (768-Dim Vector Space Approximation)</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setQueryPos({ x: 45, y: 35 })}
              >
                Preset 1 (AI Cluster)
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setQueryPos({ x: -40, y: -30 })}
              >
                Preset 2 (Genetics)
              </button>
            </div>
          </div>

          <VectorCanvas
            points={searchOutput.results}
            queryPos={queryPos}
            onQueryPosChange={setQueryPos}
            k={k}
          />
        </Card>

        {/* Algorithm Comparison Benchmarks */}
        <AlgorithmComparison
          benchmarks={searchOutput.benchmarks}
          activeAlgorithm={algorithm}
          onSelectAlgorithm={setAlgorithm}
        />

        {/* Accessible Fallback Table */}
        <AccessibleVectorTable points={searchOutput.results} />
      </div>
    </PageContainer>
  );
};

export default VectorVisualizationPage;
