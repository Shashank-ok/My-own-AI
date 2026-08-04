import React, { useState } from 'react';
import { VectorPoint } from '../../utils/vectorEngine';

interface AccessibleVectorTableProps {
  points: VectorPoint[];
}

export const AccessibleVectorTable: React.FC<AccessibleVectorTableProps> = ({ points }) => {
  const [showTable, setShowTable] = useState(false);

  return (
    <div style={{ marginTop: '1.75rem' }}>
      <button
        type="button"
        onClick={() => setShowTable(!showTable)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontWeight: 500,
        }}
        aria-expanded={showTable}
        aria-label="Toggle accessible tabular view of vector data"
      >
        <span>📊</span>
        <span>{showTable ? 'Hide Accessible Vector Data Table' : 'Show Accessible Vector Data Table'}</span>
        <span style={{ fontSize: '0.75rem' }}>{showTable ? '▲' : '▼'}</span>
      </button>

      {showTable && (
        <div style={{ marginTop: '0.875rem', overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.825rem',
              backgroundColor: 'hsla(224, 25%, 6%, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="High-dimensional vector dataset projection table"
          >
            <thead>
              <tr style={{ backgroundColor: 'hsla(224, 25%, 10%, 0.8)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '0.625rem 0.875rem' }}>Rank</th>
                <th style={{ padding: '0.625rem 0.875rem' }}>ID</th>
                <th style={{ padding: '0.625rem 0.875rem' }}>Document Title</th>
                <th style={{ padding: '0.625rem 0.875rem' }}>Category</th>
                <th style={{ padding: '0.625rem 0.875rem' }}>2D Pos (X, Y)</th>
                <th style={{ padding: '0.625rem 0.875rem' }}>Vector Distance</th>
                <th style={{ padding: '0.625rem 0.875rem' }}>Nearest Neighbor</th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt) => {
                const formattedDist = typeof pt.distance === 'number' ? pt.distance.toFixed(4) : 'N/A';
                return (
                  <tr
                    key={pt.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: pt.isNearestNeighbor ? 'hsla(186, 92%, 52%, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.5rem 0.875rem', fontWeight: pt.rank ? 700 : 400 }}>
                      {pt.rank ? `#${pt.rank}` : '-'}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {pt.id}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {pt.title}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-secondary)' }}>
                      {pt.category}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      ({pt.x2d.toFixed(1)}, {pt.y2d.toFixed(1)})
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      {formattedDist}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem' }}>
                      {pt.isNearestNeighbor ? (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          Top-{pt.rank} Match
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
