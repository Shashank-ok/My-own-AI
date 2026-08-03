import React, { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📂',
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`glass-card ${className}`}
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}>{icon}</div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', maxWidth: '420px', marginBottom: action ? '1.5rem' : 0 }}>
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
