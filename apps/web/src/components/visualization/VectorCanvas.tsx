import React, { useRef, useEffect, useState, useCallback } from 'react';
import { VectorPoint } from '../../utils/vectorEngine';

interface VectorCanvasProps {
  points: VectorPoint[];
  queryPos: { x: number; y: number };
  onQueryPosChange: (pos: { x: number; y: number }) => void;
  k: number;
}

export const VectorCanvas: React.FC<VectorCanvasProps> = ({ points, queryPos, onQueryPosChange, k }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<VectorPoint | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);

  // Convert 2D data coordinates (-100 to 100) to Canvas pixels
  const dataToPixel = useCallback((x: number, y: number, width: number, height: number) => {
    const px = ((x + 100) / 200) * (width - 80) + 40;
    const py = (1 - (y + 100) / 200) * (height - 80) + 40;
    return { px, py };
  }, []);

  // Convert Canvas pixels to 2D data coordinates (-100 to 100)
  const pixelToData = useCallback((px: number, py: number, width: number, height: number) => {
    const x = ((px - 40) / (width - 80)) * 200 - 100;
    const y = (1 - (py - 40) / (height - 80)) * 200 - 100;
    return { x: Math.max(-100, Math.min(100, x)), y: Math.max(-100, Math.min(100, y)) };
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid lines & axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Origin Axes
    const origin = dataToPixel(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(origin.px, 0); ctx.lineTo(origin.px, height);
    ctx.moveTo(0, origin.py); ctx.lineTo(width, origin.py);
    ctx.stroke();

    const queryPixel = dataToPixel(queryPos.x, queryPos.y, width, height);

    // Draw laser lines connecting Query Vector to Top-K Nearest Neighbors
    const nearestNeighbors = points.filter((p) => p.isNearestNeighbor);
    nearestNeighbors.forEach((pt) => {
      const ptPixel = dataToPixel(pt.x2d, pt.y2d, width, height);
      ctx.strokeStyle = 'hsla(186, 92%, 52%, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(queryPixel.px, queryPixel.py);
      ctx.lineTo(ptPixel.px, ptPixel.py);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw Data Points
    points.forEach((pt) => {
      const { px, py } = dataToPixel(pt.x2d, pt.y2d, width, height);
      const isNN = pt.isNearestNeighbor;
      const isHovered = hoveredPoint?.id === pt.id;

      if (isNN) {
        // Nearest neighbor glowing ring
        ctx.strokeStyle = 'hsla(186, 92%, 52%, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Point circle
      ctx.fillStyle = isNN ? 'var(--accent-cyan)' : pt.color || 'var(--primary)';
      ctx.beginPath();
      ctx.arc(px, py, isHovered ? 8 : isNN ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Rank Label for Top-K
      if (isNN && pt.rank) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`#${pt.rank}`, px + 8, py - 8);
      }
    });

    // Draw Query Vector Marker (Star / Pulsing Ring)
    ctx.strokeStyle = 'var(--accent-rose)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(queryPixel.px, queryPixel.py, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'var(--accent-rose)';
    ctx.beginPath();
    ctx.arc(queryPixel.px, queryPixel.py, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('🔍 Query Vector', queryPixel.px + 12, queryPixel.py + 4);
  }, [points, queryPos, hoveredPoint, dataToPixel]);

  // Handle Mouse Move for Hover Tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setMouseCanvasPos({ x: px, y: py });

    const width = canvas.width;
    const height = canvas.height;

    // Check hit radius (15px)
    let found: VectorPoint | null = null;
    for (const pt of points) {
      const ptPixel = dataToPixel(pt.x2d, pt.y2d, width, height);
      const dist = Math.hypot(px - ptPixel.px, py - ptPixel.py);
      if (dist <= 12) {
        found = pt;
        break;
      }
    }
    setHoveredPoint(found);
  };

  // Handle Click Canvas to reposition Query Vector
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dataCoords = pixelToData(px, py, canvas.width, canvas.height);
    onQueryPosChange(dataCoords);
  };

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        width={720}
        height={460}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredPoint(null); setMouseCanvasPos(null); }}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          maxWidth: '720px',
          height: 'auto',
          aspectRatio: '720 / 460',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          cursor: 'crosshair',
          boxShadow: 'var(--shadow-sm)',
        }}
        aria-label="2D PCA Vector Scatter Plot Canvas. Click anywhere to reposition the query vector."
      />

      {/* Hover Tooltip Overlay */}
      {hoveredPoint && mouseCanvasPos && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(mouseCanvasPos.x + 15, 520)}px`,
            top: `${Math.max(mouseCanvasPos.y - 45, 10)}px`,
            backgroundColor: 'rgba(11, 15, 25, 0.95)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.625rem 0.875rem',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: 'var(--shadow-md)',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            {hoveredPoint.title}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Category: {hoveredPoint.category}
          </div>
          {typeof hoveredPoint.distance === 'number' && (
            <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginTop: '0.25rem' }}>
              Vector Distance: {hoveredPoint.distance.toFixed(4)} {hoveredPoint.rank ? `(#${hoveredPoint.rank})` : ''}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        💡 Tip: Click anywhere on the 2D canvas to reposition the <strong>Query Vector</strong>. Top-{k} nearest neighbors will update automatically.
      </div>
    </div>
  );
};
