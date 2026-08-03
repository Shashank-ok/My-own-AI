import React from 'react';

export const ChatPage: React.FC = () => {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>RAG Chat Workspace</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Ask questions against your document knowledge base using bounded system context and Ollama LLM generation.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💬</div>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Interactive RAG Chat Workspace</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Conversational interface will be connected to POST /api/chat/ask and conversation history endpoints.
        </p>
      </div>
    </div>
  );
};
