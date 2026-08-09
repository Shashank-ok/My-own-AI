import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDocuments } from '../../context/DocumentsContext';
import { api, DocumentDTO, DocumentStatus } from '../../api';
import { Modal, Input, Button, Alert } from '../ui';
import { Textarea } from '../ui/Textarea';
import * as pdfjsLib from 'pdfjs-dist';

// Point pdf.js worker at the CDN build so we don't need a custom webpack/vite config
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/* ── Constants ────────────────────────────────────────────────────────────── */
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB (matches Express limit)
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 40; // ~100 s ceiling

/* ── Status display map ───────────────────────────────────────────────────── */
/**
 * Maps the actual backend DocumentStatus values to user-facing labels.
 * The backend uses a single 'processing' state for the full pipeline
 * (chunking → embedding → indexing). We do NOT show fake sub-steps or
 * invent values the API doesn't return.
 */
const STATUS_DISPLAY: Record<
  DocumentStatus,
  { label: string; icon: string; color: string; description: string }
> = {
  pending: {
    label: 'Pending',
    icon: '⏳',
    color: 'var(--accent-amber)',
    description: 'Queued — waiting to enter the processing pipeline.',
  },
  processing: {
    label: 'Processing',
    icon: '⚙️',
    color: 'var(--accent-cyan)',
    description: 'Chunking, embedding, and indexing in progress…',
  },
  completed: {
    label: 'Ready',
    icon: '✅',
    color: 'var(--accent-emerald)',
    description: 'Fully indexed and searchable in your namespace.',
  },
  failed: {
    label: 'Failed',
    icon: '❌',
    color: 'var(--accent-rose)',
    description: 'Ingestion pipeline encountered an error.',
  },
};

/* ── Byte-size formatter ──────────────────────────────────────────────────── */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* ── PDF text extractor ───────────────────────────────────────────────────── */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }
  return pageTexts.join('\n\n');
}

/* ── MetadataEditor ───────────────────────────────────────────────────────── */
interface MetaRow {
  id: number;
  key: string;
  value: string;
}

const MetadataEditor: React.FC<{
  rows: MetaRow[];
  onChange: (rows: MetaRow[]) => void;
}> = ({ rows, onChange }) => {
  const nextId = useRef(rows.length + 1);

  const addRow = () => {
    onChange([...rows, { id: nextId.current++, key: '', value: '' }]);
  };

  const removeRow = (id: number) => onChange(rows.filter((r) => r.id !== id));

  const updateRow = (id: number, field: 'key' | 'value', val: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Metadata <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
        </label>
        <Button variant="ghost" size="sm" onClick={addRow} type="button">
          + Add field
        </Button>
      </div>

      {rows.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          No metadata fields — click "+ Add field" to attach key-value pairs.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rows.map((row, idx) => (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem' }}>
            <input
              className="form-control"
              aria-label={`Metadata key ${idx + 1}`}
              placeholder="key"
              value={row.key}
              onChange={(e) => updateRow(row.id, 'key', e.target.value)}
            />
            <input
              className="form-control"
              aria-label={`Metadata value ${idx + 1}`}
              placeholder="value"
              value={row.value}
              onChange={(e) => updateRow(row.id, 'value', e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label={`Remove metadata row ${idx + 1}`}
              onClick={() => removeRow(row.id)}
              style={{ color: 'var(--accent-rose)' }}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── IngestionTracker ─────────────────────────────────────────────────────── */
const IngestionTracker: React.FC<{
  documentId: string;
  initialDoc: DocumentDTO;
  onDone: (finalDoc: DocumentDTO) => void;
}> = ({ documentId, initialDoc, onDone }) => {
  const [doc, setDoc] = useState<DocumentDTO>(initialDoc);
  const [pollError, setPollError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (attemptRef.current >= POLL_MAX_ATTEMPTS) {
      setPollError('Polling timed out. Check document status in the dashboard.');
      return;
    }
    attemptRef.current++;
    try {
      const res = await api.documents.getDocument(documentId);
      setDoc(res.document);
      if (res.document.status === 'completed' || res.document.status === 'failed') {
        onDone(res.document);
        return; // stop polling
      }
    } catch (_err) {
      // swallow transient poll errors; keep trying
    }
    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [documentId, onDone]);

  useEffect(() => {
    if (doc.status !== 'completed' && doc.status !== 'failed') {
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg = STATUS_DISPLAY[doc.status] ?? STATUS_DISPLAY.pending;
  const isTerminal = doc.status === 'completed' || doc.status === 'failed';
  const isSpinning = !isTerminal;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '1.5rem 1rem',
      }}
    >
      {/* Animated status icon */}
      <div
        style={{
          fontSize: '3rem',
          animation: isSpinning ? 'spin 1.8s linear infinite' : undefined,
        }}
      >
        {cfg.icon}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: cfg.color, marginBottom: '0.4rem' }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{cfg.description}</div>
      </div>

      {/* Document info */}
      <div
        style={{
          width: '100%',
          padding: '0.875rem 1rem',
          backgroundColor: 'hsla(224, 25%, 7%, 0.6)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {doc.title}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          ID: {doc._id}
        </div>
        {doc.status === 'completed' && (
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>
            {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''} indexed
          </div>
        )}
      </div>

      {/* Error detail */}
      {doc.status === 'failed' && doc.ingestionError && (
        <Alert variant="error" title="Ingestion Error">
          {doc.ingestionError}
        </Alert>
      )}

      {/* Poll timeout note */}
      {pollError && <Alert variant="warning">{pollError}</Alert>}

      {/* Explicit disclaimer — no fabricated sub-steps */}
      {isSpinning && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
          Polling backend every {POLL_INTERVAL_MS / 1000} s. Status reflects the actual server state.
        </p>
      )}
    </div>
  );
};

/* ── Main Modal ───────────────────────────────────────────────────────────── */
interface IngestDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalPhase = 'form' | 'tracking' | 'done';
type InputMode = 'paste' | 'file';

export const IngestDocumentModal: React.FC<IngestDocumentModalProps> = ({ isOpen, onClose }) => {
  const { ingestDocument } = useDocuments();

  // Form fields
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [metaRows, setMetaRows] = useState<MetaRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation
  const [titleError, setTitleError] = useState<string | undefined>();
  const [textError, setTextError] = useState<string | undefined>();

  // Submission
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phase, setPhase] = useState<ModalPhase>('form');
  const [trackedDoc, setTrackedDoc] = useState<DocumentDTO | null>(null);
  const [finalDoc, setFinalDoc] = useState<DocumentDTO | null>(null);

  // Computed payload size for display
  const payloadBytes = new TextEncoder().encode(
    JSON.stringify({ title: title.trim(), text: text.trim() })
  ).length;
  const sizeLabel = fmtBytes(payloadBytes);
  const sizeWarning = payloadBytes > MAX_PAYLOAD_BYTES;
  const sizeHint = payloadBytes > 0;

  const resetForm = () => {
    setTitle('');
    setText('');
    setFileName(null);
    setMetaRows([]);
    setTitleError(undefined);
    setTextError(undefined);
    setApiError(null);
    setIsSubmitting(false);
    setPhase('form');
    setTrackedDoc(null);
    setFinalDoc(null);
    setInputMode('paste');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    // Block close during active submission to prevent duplicate
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  /* File picker */
  const [isReadingFile, setIsReadingFile] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setTextError(undefined);
    setIsReadingFile(true);
    try {
      let content: string;
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        content = await extractPdfText(file);
        if (!content.trim()) {
          setTextError('Could not extract text from this PDF. It may be scanned/image-only.');
          setIsReadingFile(false);
          return;
        }
      } else {
        content = await file.text();
      }
      setText(content);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch {
      setTextError('Failed to read file. Please try again.');
    } finally {
      setIsReadingFile(false);
    }
  };

  /* Validation */
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
      setTextError(inputMode === 'file' ? 'Please select a text file' : 'Text content is required');
      valid = false;
    } else if (text.trim().length < 10) {
      setTextError('Content must be at least 10 characters');
      valid = false;
    }

    if (sizeWarning) {
      setTextError(`Payload too large (${sizeLabel}). Maximum is 10 MB.`);
      valid = false;
    }

    return valid;
  };

  /* Submit */
  const handleSubmit = async () => {
    setApiError(null);
    if (!validate()) return;
    if (isSubmitting) return; // hard guard against duplicate clicks

    // Build optional metadata
    const meta: Record<string, string> = {};
    for (const row of metaRows) {
      if (row.key.trim()) meta[row.key.trim()] = row.value.trim();
    }

    setIsSubmitting(true);
    try {
      const doc = await ingestDocument(
        title.trim(),
        text.trim(),
        Object.keys(meta).length > 0 ? meta : undefined
      );
      setTrackedDoc(doc);
      setPhase('tracking');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to submit document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackingDone = (doc: DocumentDTO) => {
    setFinalDoc(doc);
    setPhase('done');
  };

  /* Modal title */
  const modalTitle =
    phase === 'tracking'
      ? 'Ingestion Progress'
      : phase === 'done'
        ? finalDoc?.status === 'completed'
          ? 'Document Ready'
          : 'Ingestion Failed'
        : 'Ingest New Document';

  /* Footer */
  const renderFooter = () => {
    if (phase === 'form') {
      return (
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting} disabled={sizeWarning}>
            {isSubmitting ? 'Submitting…' : 'Ingest Document'}
          </Button>
        </>
      );
    }
    if (phase === 'tracking') {
      // No footer during polling — prevent accidental dismiss
      return null;
    }
    // done
    return (
      <Button variant="primary" onClick={handleClose}>
        Close
      </Button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} footer={renderFooter()}>
      {/* ── FORM PHASE ── */}
      {phase === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {apiError && (
            <Alert variant="error" onClose={() => setApiError(null)}>
              {apiError}
            </Alert>
          )}

          {/* Title */}
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

          {/* Input mode tabs */}
          <div>
            <div
              role="tablist"
              aria-label="Text input mode"
              style={{ display: 'flex', gap: '0', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}
            >
              {(['paste', 'file'] as InputMode[]).map((mode) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={inputMode === mode}
                  onClick={() => { setInputMode(mode); setText(''); setFileName(null); setTextError(undefined); }}
                  type="button"
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: inputMode === mode ? '2px solid var(--primary)' : '2px solid transparent',
                    color: inputMode === mode ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: inputMode === mode ? 600 : 400,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    marginBottom: '-1px',
                    transition: 'color var(--transition-fast)',
                  }}
                >
                  {mode === 'paste' ? '📝 Paste Text' : '📂 Upload File'}
                </button>
              ))}
            </div>

            {/* Paste mode */}
            {inputMode === 'paste' && (
              <Textarea
                label="Text Content"
                id="doc-text"
                placeholder="Paste your document text here…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                error={textError}
                rows={9}
                showCharCount
                required
              />
            )}

            {/* File upload mode */}
            {inputMode === 'file' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  htmlFor="doc-file"
                  style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}
                >
                  Text File <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <label
                  htmlFor="doc-file"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '1.5rem',
                    border: `2px dashed ${textError ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: 'hsla(224, 25%, 7%, 0.4)',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>📂</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {fileName ? (
                      <strong style={{ color: 'var(--text-primary)' }}>{fileName}</strong>
                    ) : (
                      'Click to browse or drop a .txt / .md file'
                    )}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Accepted: plain text, Markdown, PDF
                  </span>
                </label>
                <input
                  id="doc-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                  onChange={handleFileChange}
                  disabled={isReadingFile}
                  aria-describedby={textError ? 'doc-file-error' : undefined}
                  style={{ display: 'none' }}
                />
                {textError && (
                  <span id="doc-file-error" className="form-error" role="alert">
                    {textError}
                  </span>
                )}
                {isReadingFile && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                    ⏳ Reading file…
                  </span>
                )}
                {text && !textError && !isReadingFile && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>
                    ✅ {text.length.toLocaleString()} characters loaded from file
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Metadata editor */}
          <MetadataEditor rows={metaRows} onChange={setMetaRows} />

          {/* Payload size indicator */}
          {sizeHint && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: sizeWarning
                  ? 'hsla(346, 84%, 61%, 0.1)'
                  : 'hsla(224, 25%, 10%, 0.5)',
                border: `1px solid ${sizeWarning ? 'hsla(346, 84%, 61%, 0.35)' : 'var(--border-subtle)'}`,
                fontSize: '0.8rem',
              }}
            >
              <span>📦</span>
              <span style={{ color: sizeWarning ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                Estimated payload: <strong>{sizeLabel}</strong>
                {sizeWarning ? ' — exceeds 10 MB limit' : ' / 10 MB max'}
              </span>
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            Content is chunked, embedded, and indexed server-side in your private namespace.
            Ownership is enforced on the server — other users cannot access your documents.
          </p>
        </div>
      )}

      {/* ── TRACKING PHASE ── */}
      {phase === 'tracking' && trackedDoc && (
        <IngestionTracker
          documentId={trackedDoc._id}
          initialDoc={trackedDoc}
          onDone={handleTrackingDone}
        />
      )}

      {/* ── DONE PHASE ── */}
      {phase === 'done' && finalDoc && (
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          {finalDoc.status === 'completed' ? (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✅</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.4rem' }}>
                Document Ready
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                <strong>{finalDoc.title}</strong> is now fully indexed — {finalDoc.chunkCount} chunk
                {finalDoc.chunkCount !== 1 ? 's' : ''} available for semantic search.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>❌</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '0.4rem' }}>
                Ingestion Failed
              </div>
              {finalDoc.ingestionError && (
                <Alert variant="error" style={{ textAlign: 'left', marginTop: '1rem' }}>
                  {finalDoc.ingestionError}
                </Alert>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
                You can retry from the Documents dashboard.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
