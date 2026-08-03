import React, { useState } from 'react';
import { DocumentDTO } from '../../api/types';
import { useDocuments } from '../../context/DocumentsContext';
import { Modal, Button, Alert } from '../ui';
import { StatusBadge } from './StatusBadge';

interface DocumentDetailModalProps {
  document: DocumentDTO;
  onClose: () => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, onClose }) => {
  const { retryDocument, deleteDocument } = useDocuments();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const handleRetry = async () => {
    setIsRetrying(true);
    setOpError(null);
    try {
      await retryDocument(document._id);
      setRetrySuccess(true);
    } catch (err: unknown) {
      setOpError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setOpError(null);
    try {
      await deleteDocument(document._id);
      onClose();
    } catch (err: unknown) {
      setOpError(err instanceof Error ? err.message : 'Delete failed');
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Document Details"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
          {document.status === 'failed' && !retrySuccess && (
            <Button variant="outline" isLoading={isRetrying} onClick={handleRetry} leftIcon="🔄">
              Retry Ingestion
            </Button>
          )}
          {!confirmDelete ? (
            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              leftIcon="🗑️"
              style={{ marginLeft: 'auto' }}
            >
              Delete
            </Button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginLeft: 'auto',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '0.875rem', color: 'var(--accent-rose)' }}>
                Permanently delete this document?
              </span>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}>
                Confirm Delete
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {opError && <Alert variant="error">{opError}</Alert>}
        {retrySuccess && (
          <Alert variant="success">Retry initiated. Status will update momentarily.</Alert>
        )}

        {/* Title & Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Title
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {document.title}
            </div>
          </div>
          <StatusBadge status={document.status} />
        </div>

        {/* Metadata grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: 'hsla(224, 25%, 7%, 0.5)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Document ID</div>
            <div
              style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}
            >
              {document._id}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chunks</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {document.chunkCount}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Created</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {formatDate(document.createdAt)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Updated</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {formatDate(document.updatedAt)}
            </div>
          </div>
        </div>

        {/* Ingestion error */}
        {document.status === 'failed' && document.ingestionError && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'hsla(346, 84%, 61%, 0.08)',
              border: '1px solid hsla(346, 84%, 61%, 0.3)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-rose)', marginBottom: '0.5rem' }}>
              Ingestion Error
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'monospace' }}>
              {document.ingestionError}
            </p>
          </div>
        )}

        {/* Custom metadata */}
        {document.metadata && Object.keys(document.metadata).length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Metadata
            </div>
            <pre
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'hsla(224, 25%, 7%, 0.5)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                overflowX: 'auto',
                margin: 0,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {JSON.stringify(document.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
};
