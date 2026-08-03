import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary Caught Unhandled Error]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'hsl(224, 25%, 8%)',
            color: 'hsl(210, 40%, 98%)',
            padding: '2rem',
          }}
        >
          <div
            style={{
              maxWidth: '540px',
              width: '100%',
              backgroundColor: 'hsla(224, 20%, 12%, 0.8)',
              backdropFilter: 'blur(16px)',
              border: '1px solid hsla(346, 84%, 61%, 0.4)',
              borderRadius: '16px',
              padding: '2.5rem',
              textAlign: 'center',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                fontSize: '3rem',
                marginBottom: '1rem',
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontFamily: 'Outfit, sans-serif' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'hsl(215, 20%, 70%)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred in the application.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: 'hsl(252, 85%, 67%)',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
