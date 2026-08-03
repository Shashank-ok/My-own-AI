import React from 'react';
import { DocumentDTO } from '../../api/types';
import { useDocuments } from '../../context/DocumentsContext';
import { Button } from '../ui/Button';
import { StatusBadge } from './StatusBadge';

interface DocumentCardProps {
  document: DocumentDTO;
  onRetry: (doc: DocumentDTO) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ document, onRetry }) => {
  const { selectDocument } = useDocuments();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div
      role="article"
      aria-label={`Document: ${document.title}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '0.75rem 1.5rem',
        alignItems: 'center',
        padding: '1rem 1.25rem',
        backgroundColor: 'hsla(224, 25%, 10%, 0.5)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'hsla(252, 85%, 67%, 0.3)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px hsla(252, 85%, 67%, 0.1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
      onClick={() => selectDocument(document)}
    >
      {/* Left: info */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.975rem',
            color: 'var(--text-primary)',
            marginBottom: '0.35rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {document.title}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge status={document.status} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {document.chunkCount} {document.chunkCount === 1 ? 'chunk' : 'chunks'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {formatDate(document.createdAt)}
          </span>
        </div>
        {document.status === 'failed' && document.ingestionError && (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.78rem',
              color: 'var(--accent-rose)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            ⚠️ {document.ingestionError}
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div
        style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {document.status === 'failed' && (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Retry ingestion for ${document.title}`}
            onClick={() => onRetry(document)}
          >
            🔄 Retry
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label={`View details for ${document.title}`}
          onClick={() => selectDocument(document)}
        >
          View →
        </Button>
      </div>
    </div>
  );
};
