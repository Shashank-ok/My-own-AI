import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Button } from '../ui/Button';

export const ConversationSidebar: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    startNewConversation,
    deleteConversation,
    isLoadingConversations,
  } = useChat();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteConversation(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside
      style={{
        width: '280px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
      }}
    >
      {/* Header: New Chat Button */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <Button variant="primary" fullWidth onClick={startNewConversation} leftIcon="＋">
          New Conversation
        </Button>
      </div>

      {/* Conversations List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
          History ({conversations.length})
        </div>

        {isLoadingConversations && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
            Loading conversations…
          </div>
        )}

        {!isLoadingConversations && conversations.length === 0 && (
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', padding: '0.5rem', fontStyle: 'italic' }}>
            No past conversations yet.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {conversations.map((conv) => {
            const isActive = activeConversationId === conv._id;
            const isDeletingThis = deletingId === conv._id;

            return (
              <div
                key={conv._id}
                onClick={() => selectConversation(conv._id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'hsla(252, 85%, 67%, 0.12)' : 'transparent',
                  border: isActive ? '1px solid hsla(252, 85%, 67%, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    💬 {conv.title || 'Untitled Conversation'}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {formatDate(conv.updatedAt)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={isDeletingThis}
                  onClick={(e) => handleDelete(e, conv._id)}
                  aria-label={`Delete conversation ${conv.title}`}
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem', color: 'var(--accent-rose)' }}
                >
                  🗑️
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
