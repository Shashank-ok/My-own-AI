import React, { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Input, Button, Alert } from '../components/ui';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Validation
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const validate = (): boolean => {
    let valid = true;
    setEmailError(undefined);
    setPasswordError(undefined);

    if (!email.trim()) {
      setEmailError('Email address is required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(ellipse at top right, hsla(252, 85%, 67%, 0.12) 0%, transparent 70%)',
      }}
    >
      <Card style={{ maxWidth: '440px', width: '100%', padding: '2.5rem 2rem' }}>
        <Card.Header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
              fontSize: '1.5rem',
              margin: '0 auto 1rem auto',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            AI
          </div>
          <Card.Title style={{ fontSize: '1.75rem' }}>Welcome Back</Card.Title>
          <Card.Subtitle>Sign in to access your private vector RAG workspace.</Card.Subtitle>
        </Card.Header>

        <Card.Body>
          {error && (
            <Alert variant="error" title="Authentication Failed" onClose={() => setError(null)} style={{ marginBottom: '1.5rem' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Email Address"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              autoComplete="current-password"
              required
            />

            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting} style={{ marginTop: '0.5rem' }}>
              Sign In
            </Button>
          </form>
        </Card.Body>

        <Card.Footer style={{ justifyContent: 'center', marginTop: '1.5rem', paddingTop: '1.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Create Account
            </Link>
          </span>
        </Card.Footer>
      </Card>
    </div>
  );
};
