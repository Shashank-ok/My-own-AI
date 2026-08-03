import React from 'react';
import { Link } from 'react-router-dom';
import { config } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user } = useAuth();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-navbar)',
        backdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          style={{ padding: '0.4rem', fontSize: '1.25rem' }}
        >
          ☰
        </Button>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
              fontSize: '1rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            AI
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Your OWN AI
          </span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <span className="badge badge-success">API Connected</span>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
          }}
        >
          {config.apiBaseUrl}
        </span>

        {user && (
          <Link
            to="/profile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'hsla(224, 20%, 16%, 0.8)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: '1rem' }}>👤</span>
            <span>{user.name}</span>
          </Link>
        )}
      </div>
    </header>
  );
};
