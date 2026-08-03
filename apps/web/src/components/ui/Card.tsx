import React, { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> & {
  Header: React.FC<HTMLAttributes<HTMLDivElement>>;
  Title: React.FC<HTMLAttributes<HTMLHeadingElement>>;
  Subtitle: React.FC<HTMLAttributes<HTMLParagraphElement>>;
  Body: React.FC<HTMLAttributes<HTMLDivElement>>;
  Footer: React.FC<HTMLAttributes<HTMLDivElement>>;
} = ({ children, hoverable = false, className = '', style, ...props }) => {
  return (
    <div
      className={`glass-card ${className}`}
      style={{
        padding: '1.5rem',
        transition: hoverable ? 'all var(--transition-smooth)' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div style={{ marginBottom: '1rem', ...style }} {...props}>
    {children}
  </div>
);

const CardTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({ children, style, ...props }) => (
  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-display)', ...style }} {...props}>
    {children}
  </h3>
);

const CardSubtitle: React.FC<HTMLAttributes<HTMLParagraphElement>> = ({ children, style, ...props }) => (
  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', ...style }} {...props}>
    {children}
  </p>
);

const CardBody: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div style={{ flex: 1, ...style }} {...props}>
    {children}
  </div>
);

const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div
    style={{
      marginTop: '1.25rem',
      paddingTop: '1rem',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '0.75rem',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Subtitle = CardSubtitle;
Card.Body = CardBody;
Card.Footer = CardFooter;
