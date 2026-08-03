import React, { InputHTMLAttributes, useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  startIcon,
  endIcon,
  id,
  className = '',
  disabled,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const hasError = Boolean(error);
  const describedBy = [
    hasError ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-field">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {startIcon && (
          <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', display: 'flex' }}>
            {startIcon}
          </div>
        )}

        <input
          id={inputId}
          className={`form-control ${hasError ? 'form-control-error' : ''} ${className}`}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={describedBy || undefined}
          style={{
            paddingLeft: startIcon ? '2.5rem' : undefined,
            paddingRight: endIcon ? '2.5rem' : undefined,
          }}
          {...props}
        />

        {endIcon && (
          <div style={{ position: 'absolute', right: '0.75rem', color: 'var(--text-muted)', display: 'flex' }}>
            {endIcon}
          </div>
        )}
      </div>

      {hasError ? (
        <span id={errorId} className="form-error">
          {error}
        </span>
      ) : helperText ? (
        <span id={helperId} className="form-hint">
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
