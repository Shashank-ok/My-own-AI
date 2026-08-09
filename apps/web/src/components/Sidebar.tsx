import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

export interface SidebarProps {
  collapsed?: boolean;
  isOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, isOpen = true }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: '📊' },
    { label: 'Documents', path: '/documents', icon: '📄' },
    { label: 'Search', path: '/search', icon: '🔍' },
    { label: 'RAG Chat', path: '/chat', icon: '💬' },
    { label: 'Vector Demo', path: '/visualization', icon: '📍' },
    { label: 'Profile', path: '/profile', icon: '👤' },
  ];

  if (!isOpen) return null;

  return (
    <aside
      style={{
        width: collapsed ? '70px' : '240px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-normal)',
        overflowX: 'hidden',
        height: 'calc(100vh - 64px)',
        position: 'sticky',
        top: '64px',
      }}
    >
      <nav style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'hsla(252, 85%, 67%, 0.12)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.925rem',
              transition: 'background-color var(--transition-fast)',
              whiteSpace: 'nowrap',
            })}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {user && !collapsed && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" size="sm" fullWidth onClick={() => logout()} leftIcon="🚪">
            Sign Out
          </Button>
        </div>
      )}
    </aside>
  );
};
