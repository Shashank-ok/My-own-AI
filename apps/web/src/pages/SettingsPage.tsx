import React from 'react';
import { config } from '../config/env';

export const SettingsPage: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Application Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Configure API endpoints, engine parameters, and workspace preferences.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '600px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Connection Configuration</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Express API Gateway URL
            </label>
            <input
              type="text"
              readOnly
              value={config.apiBaseUrl}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'hsla(224, 20%, 8%, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
