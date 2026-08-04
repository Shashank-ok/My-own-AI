/**
 * Vector Engine Simulation & PCA 2D Projection Utility
 * Demonstrates high-dimensional vector search algorithms (FLAT, HNSW, IVF-PQ)
 * and distance metrics (Cosine, Euclidean, Dot Product).
 */

export type AlgorithmType = 'FLAT' | 'HNSW' | 'IVF_PQ';
export type MetricType = 'COSINE' | 'EUCLIDEAN' | 'DOT_PRODUCT';

export interface VectorPoint {
  id: string;
  title: string;
  category: string;
  color: string;
  vector: number[]; // High-dimensional vector (e.g. 64-dim)
  x2d: number;      // PCA projected X coordinate (-100 to 100)
  y2d: number;      // PCA projected Y coordinate (-100 to 100)
  distance?: number;
  rank?: number;
  isNearestNeighbor?: boolean;
}

export interface BenchmarkResult {
  algorithm: AlgorithmType;
  name: string;
  latencyUs: number;
  recallPercent: number;
  indexType: string;
  memoryFootprint: string;
  topKIds: string[];
}

// Distance Metric Calculation Functions
export function calculateDistance(vecA: number[], vecB: number[], metric: MetricType): number {
  if (vecA.length !== vecB.length) return Infinity;

  if (metric === 'EUCLIDEAN') {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  if (metric === 'DOT_PRODUCT') {
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    // Negate so lower is closer / higher similarity
    return -dot;
  }

  // Default: COSINE DISTANCE = 1 - Cosine Similarity
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1.0;
  const cosSim = dot / denom;
  return Math.max(0, 1.0 - cosSim);
}

// Generate Deterministic Sample Vector Dataset with Clusters
export function generateSampleDataset(count = 50, dimensions = 64): VectorPoint[] {
  const categories = [
    { name: 'Artificial Intelligence', color: 'hsla(252, 85%, 67%, 0.9)', center: [0.8, 0.2, 0.6] },
    { name: 'Quantum Physics', color: 'hsla(186, 92%, 52%, 0.9)', center: [-0.6, 0.7, -0.3] },
    { name: 'Financial Markets', color: 'hsla(152, 76%, 48%, 0.9)', center: [0.1, -0.8, 0.5] },
    { name: 'Biomedical Genetics', color: 'hsla(38, 92%, 50%, 0.9)', center: [-0.7, -0.4, -0.8] },
  ];

  const points: VectorPoint[] = [];

  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length];
    const vector: number[] = [];

    // Synthesize dimensional values around cluster centers
    for (let d = 0; d < dimensions; d++) {
      const base = cat.center[d % cat.center.length];
      const noise = Math.sin(i * 999 + d * 13) * 0.3;
      vector.push(base + noise);
    }

    // Pseudo-PCA projection onto 2D bounds (-90 to 90)
    let x2d = 0;
    let y2d = 0;
    for (let d = 0; d < dimensions; d++) {
      x2d += vector[d] * Math.cos((d * Math.PI * 2) / dimensions);
      y2d += vector[d] * Math.sin((d * Math.PI * 2) / dimensions);
    }

    // Scale to normalized screen box
    x2d = (x2d / (dimensions / 4)) * 75;
    y2d = (y2d / (dimensions / 4)) * 75;

    points.push({
      id: `vec-${i + 1}`,
      title: `${cat.name} Document #${Math.floor(i / categories.length) + 1}`,
      category: cat.name,
      color: cat.color,
      vector,
      x2d,
      y2d,
    });
  }

  return points;
}

// Run Search and Benchmark Comparison across FLAT, HNSW, IVF_PQ
export function runVectorSearch(
  queryVector: number[],
  dataset: VectorPoint[],
  algorithm: AlgorithmType,
  metric: MetricType,
  k = 5
): { results: VectorPoint[]; benchmarks: BenchmarkResult[]; latencyUs: number } {
  const startTime = performance.now();

  // 1. Calculate distances for all dataset points
  const scoredPoints = dataset.map((pt) => {
    const dist = calculateDistance(queryVector, pt.vector, metric);
    return { ...pt, distance: dist };
  });

  // Exact Ground Truth (FLAT brute-force sort)
  const exactSorted = [...scoredPoints].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  // Simulate selected algorithm speed & recall characteristics
  const simulatedResults = [...exactSorted];
  let latencyMultiplier = 1.0;

  if (algorithm === 'HNSW') {
    latencyMultiplier = 0.15; // 85% faster graph lookup
  } else if (algorithm === 'IVF_PQ') {
    latencyMultiplier = 0.08; // 92% faster inverted index lookup
    // Swap 1 item to simulate 90% recall
    if (simulatedResults.length > k + 1) {
      const temp = simulatedResults[k - 1];
      simulatedResults[k - 1] = simulatedResults[k + 1];
      simulatedResults[k + 1] = temp;
    }
  }

  const durationMs = performance.now() - startTime;
  const baseLatencyUs = Math.max(12, Math.round(durationMs * 1000 + dataset.length * 1.8));
  const actualLatencyUs = Math.round(baseLatencyUs * latencyMultiplier);

  // Mark top-k nearest neighbors
  const finalResults = simulatedResults.map((pt, idx) => {
    const isTopK = idx < k;
    return {
      ...pt,
      rank: idx + 1,
      isNearestNeighbor: isTopK,
    };
  });

  // Calculate Algorithm Comparison Benchmarks
  const benchmarks: BenchmarkResult[] = [
    {
      algorithm: 'FLAT',
      name: 'Flat (Brute-Force)',
      latencyUs: baseLatencyUs,
      recallPercent: 100,
      indexType: 'Exact Linear Scan',
      memoryFootprint: `${(dataset.length * 0.25).toFixed(1)} KB`,
      topKIds: exactSorted.slice(0, k).map((p) => p.id),
    },
    {
      algorithm: 'HNSW',
      name: 'HNSW (Graph Index)',
      latencyUs: Math.round(baseLatencyUs * 0.18),
      recallPercent: 98,
      indexType: 'Hierarchical Navigable Graph',
      memoryFootprint: `${(dataset.length * 0.45).toFixed(1)} KB`,
      topKIds: exactSorted.slice(0, k).map((p) => p.id),
    },
    {
      algorithm: 'IVF_PQ',
      name: 'IVF-PQ (Quantized)',
      latencyUs: Math.round(baseLatencyUs * 0.09),
      recallPercent: 92,
      indexType: 'Inverted File + Product Quantization',
      memoryFootprint: `${(dataset.length * 0.08).toFixed(1)} KB`,
      topKIds: exactSorted.slice(0, k).map((p) => p.id),
    },
  ];

  return {
    results: finalResults,
    benchmarks,
    latencyUs: actualLatencyUs,
  };
}
