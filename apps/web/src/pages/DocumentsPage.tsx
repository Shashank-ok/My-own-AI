import React, { useState } from 'react';
import { DocumentsProvider, useDocuments } from '../context/DocumentsContext';
import { PageContainer, Button, Alert, EmptyState } from '../components/ui';
import { DocumentCard } from '../components/documents/DocumentCard';
import { IngestDocumentModal } from '../components/documents/IngestDocumentModal';
import { DocumentDetailModal } from '../components/documents/DocumentDetailModal';
import { DocumentDTO } from '../api/types';

/* ── inner dashboard (wrapped inside provider) ── */
const DocumentsDashboard: React.FC = () => {
  const { documents, isLoading, error, hasMore, totalCount, selectedDoc, refresh, loadMore, selectDocument, retryDocument } =
    useDocuments();

  const [showIngest, setShowIngest] = useState(false);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const handleRetry = async (doc: DocumentDTO) => {
    setIsRetrying(doc._id);
    try {
      await retryDocument(doc._id);
    } finally {
      setIsRetrying(null);
    }
  };

  const statusCounts = documents.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <PageContainer
        title="Documents"
        subtitle={
          isLoading
            ? 'Loading…'
            : `${totalCount} document${totalCount !== 1 ? 's' : ''} in your namespace`
        }
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="secondary" size="sm" onClick={() => refresh()} leftIcon="↺" disabled={isLoading}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowIngest(true)} leftIcon="＋">
              New Document
            </Button>
          </div>
        }
      >
        {/* ── Stats row ── */}
        {!isLoading && !error && totalCount > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {(
              [
                { label: 'Total', value: totalCount, color: 'var(--primary)', icon: '📚' },
                {
                  label: 'Ready',
                  value: statusCounts.completed ?? 0,
                  color: 'var(--accent-emerald)',
                  icon: '✅',
                },
                {
                  label: 'Processing',
                  value: (statusCounts.processing ?? 0) + (statusCounts.pending ?? 0),
                  color: 'var(--accent-cyan)',
                  icon: '⚙️',
                },
                {
                  label: 'Failed',
                  value: statusCounts.failed ?? 0,
                  color: 'var(--accent-rose)',
                  icon: '❌',
                },
              ] as const
            ).map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: '1rem 1.25rem',
                  backgroundColor: 'hsla(224, 25%, 10%, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {stat.icon} {stat.label}
                </div>
                <div
                  style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error state ── */}
        {error && !isLoading && (
          <Alert
            variant="error"
            title="Failed to load documents"
            style={{ marginBottom: '1.5rem' }}
          >
            {error} —{' '}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit',
              }}
              onClick={() => refresh()}
            >
              try again
            </button>
          </Alert>
        )}

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '72px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'hsla(224, 25%, 10%, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !error && documents.length === 0 && (
          <EmptyState
            icon="📄"
            title="No Documents Yet"
            description="Ingest your first document to start building your private RAG knowledge base."
            action={
              <Button variant="primary" onClick={() => setShowIngest(true)} leftIcon="＋">
                Ingest First Document
              </Button>
            }
          />
        )}

        {/* ── Document list ── */}
        {!isLoading && documents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {documents.map((doc) => (
              <DocumentCard
                key={doc._id}
                document={{ ...doc, status: isRetrying === doc._id ? 'processing' : doc.status }}
                onRetry={handleRetry}
              />
            ))}

            {/* Load More */}
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem' }}>
                <Button variant="secondary" onClick={loadMore} leftIcon="↓">
                  Load More
                </Button>
              </div>
            )}

            {/* End of list */}
            {!hasMore && totalCount > 5 && (
              <div
                style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem' }}
              >
                All {totalCount} documents loaded
              </div>
            )}
          </div>
        )}
      </PageContainer>

      {/* ── Modals ── */}
      <IngestDocumentModal isOpen={showIngest} onClose={() => setShowIngest(false)} />
      {selectedDoc && (
        <DocumentDetailModal document={selectedDoc} onClose={() => selectDocument(null)} />
      )}

      {/* Pulse keyframe (safe to define inline for isolated scope) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
};

/* ── Exported page wraps provider ── */
export const DocumentsPage: React.FC = () => (
  <DocumentsProvider>
    <DocumentsDashboard />
  </DocumentsProvider>
);
