import React from 'react';
import { DocumentDTO } from '../../api/types';

interface DocumentFilterSelectProps {
  documents: DocumentDTO[];
  selectedDocumentIds: string[];
  onChangeSelected: (ids: string[]) => void;
  isLoading?: boolean;
}

export const DocumentFilterSelect: React.FC<DocumentFilterSelectProps> = ({
  documents,
  selectedDocumentIds,
  onChangeSelected,
  isLoading = false,
}) => {
  const toggleDoc = (id: string) => {
    if (selectedDocumentIds.includes(id)) {
      onChangeSelected(selectedDocumentIds.filter((d) => d !== id));
    } else {
      onChangeSelected([...selectedDocumentIds, id]);
    }
  };

  const selectAll = () => onChangeSelected([]);

  if (isLoading) {
    return (
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Loading document filter list…
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
        No documents available to filter. Ingest documents to enable filter scoping.
      </div>
    );
  }

  const isAllSelected = selectedDocumentIds.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Scope Search to Specific Documents <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
        </label>
        {selectedDocumentIds.length > 0 && (
          <button
            type="button"
            onClick={selectAll}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Clear Filters (Search All)
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.25rem' }}>
        <button
          type="button"
          onClick={selectAll}
          style={{
            padding: '0.3rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: 'pointer',
            border: isAllSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
            backgroundColor: isAllSelected ? 'hsla(252, 85%, 67%, 0.15)' : 'hsla(224, 20%, 16%, 0.5)',
            color: isAllSelected ? 'var(--primary)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
        >
          🌐 All Documents ({documents.length})
        </button>

        {documents.map((doc) => {
          const isSelected = selectedDocumentIds.includes(doc._id);
          return (
            <button
              key={doc._id}
              type="button"
              onClick={() => toggleDoc(doc._id)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? 'hsla(186, 92%, 52%, 0.15)' : 'hsla(224, 20%, 16%, 0.5)',
                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
                maxWidth: '220px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={doc.title}
            >
              📄 {doc.title}
            </button>
          );
        })}
      </div>
    </div>
  );
};
