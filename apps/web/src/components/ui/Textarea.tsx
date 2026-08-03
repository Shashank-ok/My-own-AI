import React, { TextareaHTMLAttributes, useId } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showCharCount?: boolean;
  maxLength?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  showCharCount = false,
  maxLength,
  value,
  id,
  className = '',
  rows = 4,
  ...props
}) => {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const helperId = `${textareaId}-helper`;
  const errorId = `${textareaId}-error`;

  const hasError = Boolean(error);
  const currentLength = typeof value === 'string' ? value.length : 0;

  const describedBy = [
    hasError ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-field">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label && (
          <label htmlFor={textareaId} className="form-label">
            {label}
          </label>
        )}
        {showCharCount && maxLength && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {currentLength} / {maxLength}
          </span>
        )}
      </div>

      <textarea
        id={textareaId}
        rows={rows}
        maxLength={maxLength}
        value={value}
        className={`form-control ${hasError ? 'form-control-error' : ''} ${className}`}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        style={{ resize: 'vertical', minHeight: '80px' }}
        {...props}
      />

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
