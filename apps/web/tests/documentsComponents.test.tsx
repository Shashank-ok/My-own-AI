import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentsPage } from '../src/pages/DocumentsPage';
import { api } from '../src/api';

// Mock API module
vi.mock('../src/api', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    api: {
      documents: {
        listDocuments: vi.fn(),
        ingestDocument: vi.fn(),
        getDocument: vi.fn(),
        retryDocument: vi.fn(),
        deleteDocument: vi.fn(),
      },
    },
  };
});

describe('Document Management & Ingestion Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render empty state when user has no documents', async () => {
    vi.mocked(api.documents.listDocuments).mockResolvedValue({ documents: [] });

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Documents Yet')).toBeDefined();
      expect(screen.getByRole('button', { name: /Ingest First Document/i })).toBeDefined();
    });
  });

  it('should render document list cards and status badges', async () => {
    vi.mocked(api.documents.listDocuments).mockResolvedValue({
      documents: [
        {
          _id: 'doc-1',
          ownerId: 'u1',
          title: 'Architecture Blueprint',
          status: 'completed',
          chunkCount: 12,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          _id: 'doc-2',
          ownerId: 'u1',
          title: 'Corrupted File',
          status: 'failed',
          chunkCount: 0,
          ingestionError: 'Ollama embedding model unreachable',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Architecture Blueprint')).toBeDefined();
      expect(screen.getByText('Corrupted File')).toBeDefined();
      expect(screen.getByText('Ready')).toBeDefined();
      expect(screen.getByText('Failed')).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry ingestion for Corrupted File/i })).toBeDefined();
    });
  });

  it('should open ingest modal, fill title & text, and submit creation request', async () => {
    vi.mocked(api.documents.listDocuments).mockResolvedValue({ documents: [] });
    vi.mocked(api.documents.ingestDocument).mockResolvedValue({
      message: 'Ingestion initiated',
      document: {
        _id: 'doc-new',
        ownerId: 'u1',
        title: 'New Policy Handbook',
        status: 'pending',
        chunkCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ingest First Document/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Ingest First Document/i }));

    expect(screen.getByText('Ingest New Document')).toBeDefined();

    fireEvent.change(screen.getByLabelText(/Document Title/i), { target: { value: 'New Policy Handbook' } });
    fireEvent.change(screen.getByLabelText(/Text Content/i), { target: { value: 'This is the policy text content for testing ingestion.' } });

    fireEvent.click(screen.getByRole('button', { name: /Ingest Document/i }));

    await waitFor(() => {
      expect(api.documents.ingestDocument).toHaveBeenCalledWith({
        title: 'New Policy Handbook',
        text: 'This is the policy text content for testing ingestion.',
      });
    });
  });

  it('should open document detail modal and trigger deletion confirmation', async () => {
    const mockDoc = {
      _id: 'doc-del-1',
      ownerId: 'u1',
      title: 'Obsolete Specification',
      status: 'completed' as const,
      chunkCount: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.mocked(api.documents.listDocuments).mockResolvedValue({ documents: [mockDoc] });
    vi.mocked(api.documents.deleteDocument).mockResolvedValue({ message: 'Deleted', deleted: true });

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Obsolete Specification')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /View details for Obsolete Specification/i }));

    await waitFor(() => {
      expect(screen.getByText('Document Details')).toBeDefined();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(screen.getByText('Permanently delete this document?')).toBeDefined();
      expect(screen.getByRole('button', { name: /Confirm Delete/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }));

    await waitFor(() => {
      expect(api.documents.deleteDocument).toHaveBeenCalledWith('doc-del-1');
    });
  });

  it('should render API error alert when listDocuments fails', async () => {
    vi.mocked(api.documents.listDocuments).mockRejectedValue(new Error('MongoDB Connection Error'));

    render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/MongoDB Connection Error/i)).toBeDefined();
    });
  });
});
