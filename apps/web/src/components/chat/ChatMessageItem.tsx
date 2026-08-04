import React, { useState } from 'react';
import { ChatMessage } from '../../context/ChatContext';
import { SourceCitations } from './SourceCitations';
import { Button } from '../ui/Button';

interface ChatMessageItemProps {
  message: ChatMessage;
  onRetry?: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1.25rem',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          minWidth: '280px',
          borderRadius: 'var(--radius-md)',
          padding: '1.125rem 1.25rem',
          backgroundColor: isUser
            ? 'hsla(252, 85%, 67%, 0.15)'
            : message.isError
              ? 'hsla(346, 84%, 61%, 0.12)'
              : 'hsla(224, 25%, 10%, 0.7)',
          border: isUser
            ? '1px solid hsla(252, 85%, 67%, 0.3)'
            : message.isError
              ? '1px solid hsla(346, 84%, 61%, 0.3)'
              : '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Message Header: Role Icon + Title + Model + Copy Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.625rem',
            paddingBottom: '0.4rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>{isUser ? '👤' : '🤖'}</span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isUser ? 'var(--primary)' : 'var(--text-primary)' }}>
              {isUser ? 'You' : 'AI Assistant'}
            </span>

            {message.model && !isUser && (
              <span
                style={{
                  fontSize: '0.725rem',
                  fontFamily: 'monospace',
                  color: 'var(--accent-cyan)',
                  backgroundColor: 'hsla(186, 92%, 52%, 0.1)',
                  padding: '0.15rem 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {message.model}
              </span>
            )}
          </div>

          {!isUser && !message.isError && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              aria-label="Copy response to clipboard"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              {copied ? '✅ Copied' : '📋 Copy'}
            </Button>
          )}
        </div>

        {/* Message Text Content with Line Breaks Preserved & Safe Plain Text */}
        <div
          style={{
            fontSize: '0.925rem',
            lineHeight: '1.6',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>

        {/* Retry Button for Failed Messages */}
        {message.isError && onRetry && (
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="danger" size="sm" onClick={onRetry} leftIcon="🔄">
              Retry Message
            </Button>
          </div>
        )}

        {/* Source Citations Block for Assistant Messages */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}
      </div>
    </div>
  );
};
