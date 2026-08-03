import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, DocumentDTO } from '../api';

const PAGE_SIZE = 10;

export interface DocumentsContextType {
  documents: DocumentDTO[];
  isLoading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  totalCount: number;
  selectedDoc: DocumentDTO | null;
  refresh: () => Promise<void>;
  loadMore: () => void;
  selectDocument: (doc: DocumentDTO | null) => void;
  ingestDocument: (title: string, text: string) => Promise<DocumentDTO>;
  deleteDocument: (id: string) => Promise<void>;
  retryDocument: (id: string) => Promise<DocumentDTO>;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export const DocumentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allDocuments, setAllDocuments] = useState<DocumentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDTO | null>(null);

  const documents = allDocuments.slice(0, page * PAGE_SIZE);
  const hasMore = allDocuments.length > page * PAGE_SIZE;
  const totalCount = allDocuments.length;

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.documents.listDocuments();
      const sorted = [...res.documents].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllDocuments(sorted);
      setPage(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const ingestDocument = async (title: string, text: string): Promise<DocumentDTO> => {
    const res = await api.documents.ingestDocument({ title, text });
    await fetchDocuments();
    return res.document;
  };

  const deleteDocument = async (id: string): Promise<void> => {
    await api.documents.deleteDocument(id);
    setAllDocuments((prev) => prev.filter((d) => d._id !== id));
    if (selectedDoc?._id === id) setSelectedDoc(null);
  };

  const retryDocument = async (id: string): Promise<DocumentDTO> => {
    const res = await api.documents.retryDocument(id);
    setAllDocuments((prev) => prev.map((d) => (d._id === id ? res.document : d)));
    return res.document;
  };

  const loadMore = () => setPage((p) => p + 1);

  return (
    <DocumentsContext.Provider
      value={{
        documents,
        isLoading,
        error,
        page,
        hasMore,
        totalCount,
        selectedDoc,
        refresh: fetchDocuments,
        loadMore,
        selectDocument: setSelectedDoc,
        ingestDocument,
        deleteDocument,
        retryDocument,
      }}
    >
      {children}
    </DocumentsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDocuments = (): DocumentsContextType => {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within a DocumentsProvider');
  return ctx;
};
