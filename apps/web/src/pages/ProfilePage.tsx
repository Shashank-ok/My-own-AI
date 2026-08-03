import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageContainer, Card, Button, Alert } from '../components/ui';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  if (!user) return null;

  return (
    <PageContainer
      title="User Profile"
      subtitle="View your account details and authentication status."
      badge={<span className="badge badge-primary">{user.role}</span>}
      actions={
        <Button variant="danger" isLoading={isLoggingOut} onClick={handleLogout} leftIcon="🚪">
          Log Out
        </Button>
      }
    >
      <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Card>
          <Card.Header>
            <Card.Title>Account Details</Card.Title>
            <Card.Subtitle>Information associated with your authenticated session.</Card.Subtitle>
          </Card.Header>
          <Card.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Full Name
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.name}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Email Address
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.email}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  User ID
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>
                  {user.id}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Member Since
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Alert variant="info" title="Token Storage Security Strategy">
          Your access token is held in memory and persisted in <code>localStorage</code> for session continuity.
          Passwords are never stored in memory or client local storage.
        </Alert>
      </div>
    </PageContainer>
  );
};
