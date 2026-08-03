import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
        404
      </div>
      <h2 style={{ fontSize: '1.75rem', margin: '0.5rem 0 1rem 0' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px' }}>
        The requested page route does not exist or has been moved.
      </p>
      <Link
        to="/"
        style={{
          backgroundColor: 'var(--primary)',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
        }}
      >
        Return to Dashboard
      </Link>
    </div>
  );
};
