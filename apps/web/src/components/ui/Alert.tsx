import React, { ReactNode } from 'react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

const icons: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '🚨',
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  return (
    <div className={`alert alert-${variant} ${className}`} role="alert">
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{icons[variant]}</span>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '1rem',
            opacity: 0.8,
            padding: '0.1rem 0.3rem',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
