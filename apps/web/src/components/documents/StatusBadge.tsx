import React from 'react';
import { DocumentStatus } from '../../api/types';

interface StatusBadgeProps {
  status: DocumentStatus;
}

const CONFIG: Record<
  DocumentStatus,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: 'Pending',
    icon: '⏳',
    color: 'var(--accent-amber)',
    bg: 'hsla(38, 92%, 50%, 0.12)',
    border: 'hsla(38, 92%, 50%, 0.3)',
  },
  processing: {
    label: 'Processing',
    icon: '⚙️',
    color: 'var(--accent-cyan)',
    bg: 'hsla(186, 92%, 52%, 0.12)',
    border: 'hsla(186, 92%, 52%, 0.3)',
  },
  completed: {
    label: 'Ready',
    icon: '✅',
    color: 'var(--accent-emerald)',
    bg: 'hsla(152, 76%, 48%, 0.12)',
    border: 'hsla(152, 76%, 48%, 0.3)',
  },
  failed: {
    label: 'Failed',
    icon: '❌',
    color: 'var(--accent-rose)',
    bg: 'hsla(346, 84%, 61%, 0.12)',
    border: 'hsla(346, 84%, 61%, 0.3)',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const cfg = CONFIG[status] ?? CONFIG.failed;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.6rem',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '0.75rem' }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};
