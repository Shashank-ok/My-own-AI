import React from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: '📊' },
  { label: 'Documents', path: '/documents', icon: '📄' },
  { label: 'Semantic Search', path: '/search', icon: '🔍' },
  { label: 'RAG Chat', path: '/chat', icon: '💬' },
  { label: 'UI Gallery', path: '/components', icon: '🎨' },
  { label: 'Settings', path: '/settings', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  return (
    <aside
      style={{
        width: isOpen ? '240px' : '0px',
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        transition: 'all var(--transition-smooth)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
      }}
    >
      <nav style={{ padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'hsla(252, 85%, 67%, 0.15)' : 'transparent',
              border: isActive ? '1px solid hsla(252, 85%, 67%, 0.3)' : '1px solid transparent',
              transition: 'all var(--transition-fast)',
            })}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Your OWN AI v1.0
        </div>
      </div>
    </aside>
  );
};
