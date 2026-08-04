import React, { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { ChatProvider, useChat } from '../context/ChatContext';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { Button, Textarea, Alert, Spinner } from '../components/ui';
import { api, DocumentDTO } from '../api';
import { DocumentFilterSelect } from '../components/search/DocumentFilterSelect';

const ChatWorkspace: React.FC = () => {
  const {
    messages,
    isGenerating,
    error,
    lastFailedQuestion,
    askQuestion,
    retryFailedQuestion,
    clearActiveMessages,
    activeConversation,
  } = useChat();

  const [question, setQuestion] = useState('');
  const [k, setK] = useState<number>(5);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of message list on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Load user documents for optional filter scoping
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.documents.listDocuments();
        setDocuments(res.documents || []);
      } catch (err) {
        console.warn('[ChatPage] Failed to fetch documents list:', err);
      }
    };
    fetchDocs();
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isGenerating) return;

    askQuestion(trimmed, {
      k: Number(k),
      documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
    });
    setQuestion('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)', gap: 0, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Sidebar for conversation management */}
      <ConversationSidebar />

      {/* Main RAG Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'hsla(224, 25%, 8%, 0.5)' }}>
        {/* Workspace Header */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💬</span>
              <span>{activeConversation ? activeConversation.title : 'New RAG Chat Session'}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              Bounded context generation powered by Ollama & C++ Vector Engine
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              aria-expanded={showSettings}
              leftIcon="⚙️"
            >
              RAG Options {selectedDocumentIds.length > 0 && `(${selectedDocumentIds.length} doc filter)`}
            </Button>

            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearActiveMessages} style={{ fontSize: '0.8rem' }}>
                Clear Screen
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible RAG Search Settings Drawer */}
        {showSettings && (
          <div style={{ padding: '1rem 1.25rem', backgroundColor: 'hsla(224, 25%, 6%, 0.9)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label htmlFor="rag-k-select" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Retrieval Depth (k chunks)
                </label>
                <select
                  id="rag-k-select"
                  className="form-control"
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                >
                  <option value={1}>k = 1 chunk</option>
                  <option value={3}>k = 3 chunks</option>
                  <option value={5}>k = 5 chunks (default)</option>
                  <option value={10}>k = 10 chunks</option>
                </select>
              </div>

              <DocumentFilterSelect
                documents={documents}
                selectedDocumentIds={selectedDocumentIds}
                onChangeSelected={setSelectedDocumentIds}
              />
            </div>
          </div>
        )}

        {/* Chat Message Scroll Window */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 && !isGenerating && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '440px', opacity: 0.85 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Ask a question about your documents
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Your question will retrieve relevant vector chunks from your private namespace and synthesize a grounded answer.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} onRetry={lastFailedQuestion ? retryFailedQuestion : undefined} />
          ))}

          {/* Loading Indicator Spinner during LLM completion */}
          {isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'hsla(224, 25%, 10%, 0.6)', borderRadius: 'var(--radius-md)', width: 'fit-content', marginBottom: '1rem' }}>
              <Spinner size="sm" color="primary" />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Searching vector index & generating answer with Ollama…
              </span>
            </div>
          )}

          {/* Backend Error Banner */}
          {error && !isGenerating && (
            <Alert variant="error" title="Backend Error" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span>{error}</span>
                {lastFailedQuestion && (
                  <Button variant="danger" size="sm" onClick={retryFailedQuestion}>
                    Retry Question
                  </Button>
                )}
              </div>
            </Alert>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Question Input Bar */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Textarea
                id="rag-question-input"
                placeholder="Ask your document knowledge base a question… (Press Enter to send, Shift+Enter for new line)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={isGenerating}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isGenerating}
              disabled={!question.trim() || isGenerating}
              leftIcon="✈️"
              style={{ height: '54px' }}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const ChatPage: React.FC = () => (
  <ChatProvider>
    <ChatWorkspace />
  </ChatProvider>
);

export default ChatPage;
