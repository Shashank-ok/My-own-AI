import React from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
  style,
}) => {
  const iconMap: Record<AlertVariant, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <div className={`alert alert-${variant} ${className}`} style={style} role="alert">
      <div className="alert-icon">{iconMap[variant]}</div>
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        <div className="alert-message">{children}</div>
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Close alert">
          ×
        </button>
      )}
    </div>
  );
};
