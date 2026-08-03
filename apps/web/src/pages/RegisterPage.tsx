import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Input, Button, Alert } from '../components/ui';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Validation Errors
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);

  const validate = (): boolean => {
    let valid = true;
    setNameError(undefined);
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);

    if (!name.trim()) {
      setNameError('Full name is required');
      valid = false;
    } else if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters long');
      valid = false;
    }

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
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      valid = false;
    }

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match');
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
      await register(email.trim(), password, name.trim());
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account. Email may already be registered.';
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
      <Card style={{ maxWidth: '460px', width: '100%', padding: '2.5rem 2rem' }}>
        <Card.Header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Card.Title style={{ fontSize: '1.75rem' }}>Create Account</Card.Title>
          <Card.Subtitle>Get started with private RAG document search and LLM chat.</Card.Subtitle>
        </Card.Header>

        <Card.Body>
          {error && (
            <Alert variant="error" title="Registration Failed" onClose={() => setError(null)} style={{ marginBottom: '1.5rem' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Input
              label="Full Name"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              autoComplete="name"
              required
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              autoComplete="new-password"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmError}
              autoComplete="new-password"
              required
            />

            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting} style={{ marginTop: '0.5rem' }}>
              Register Account
            </Button>
          </form>
        </Card.Body>

        <Card.Footer style={{ justifyContent: 'center', marginTop: '1.5rem', paddingTop: '1.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Sign In
            </Link>
          </span>
        </Card.Footer>
      </Card>
    </div>
  );
};
