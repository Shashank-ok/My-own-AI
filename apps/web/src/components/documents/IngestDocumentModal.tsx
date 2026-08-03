import React, { useState, FormEvent } from 'react';
import { useDocuments } from '../../context/DocumentsContext';
import { Modal, Input, Button, Alert } from '../ui';
import { Textarea } from '../ui/Textarea';

interface IngestDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IngestDocumentModal: React.FC<IngestDocumentModalProps> = ({ isOpen, onClose }) => {
  const { ingestDocument } = useDocuments();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [textError, setTextError] = useState<string | undefined>();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setTitle('');
    setText('');
    setTitleError(undefined);
    setTextError(undefined);
    setApiError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    let valid = true;
    setTitleError(undefined);
    setTextError(undefined);

    if (!title.trim()) {
      setTitleError('Document title is required');
      valid = false;
    } else if (title.trim().length > 200) {
      setTitleError('Title must be 200 characters or fewer');
      valid = false;
    }

    if (!text.trim()) {
      setTextError('Document text content is required');
      valid = false;
    } else if (text.trim().length < 10) {
      setTextError('Content must be at least 10 characters');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await ingestDocument(title.trim(), text.trim());
      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to ingest document');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ingest New Document"
      footer={
        success ? null : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              isLoading={isSubmitting}
            >
              Ingest Document
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>
            Document ingested successfully!
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Processing in the background. Status will update shortly.
          </p>
        </div>
      ) : (
        <form
          id="ingest-form"
          onSubmit={handleSubmit}
          noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
          {apiError && (
            <Alert variant="error" onClose={() => setApiError(null)}>
              {apiError}
            </Alert>
          )}

          <Input
            label="Document Title"
            id="doc-title"
            placeholder="e.g. Company Handbook 2024"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={titleError}
            required
            autoFocus
          />

          <Textarea
            label="Text Content"
            id="doc-text"
            placeholder="Paste your document text here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={textError}
            rows={10}
            showCharCount
            required
          />

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Text will be chunked, embedded, and indexed in your private namespace.
            Ownership is enforced on the server — other users cannot access this document.
          </p>
        </form>
      )}
    </Modal>
  );
};
