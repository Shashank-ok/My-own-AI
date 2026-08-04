import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchPage } from '../src/pages/SearchPage';
import { api } from '../src/api';

// Mock API module
vi.mock('../src/api', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    api: {
      documents: {
        listDocuments: vi.fn(),
      },
      search: {
        search: vi.fn(),
      },
    },
  };
});

describe('Semantic Search Component Tests', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.mocked(api.documents.listDocuments).mockResolvedValue({ documents: [] });
  });

  it('should render search form controls, Top-K selector, and idle state message', async () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Search Query/i)).toBeDefined();
    expect(screen.getByLabelText(/Top-K Results/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Search/i })).toBeDefined();
    expect(screen.getByText(/Enter a search query to explore your knowledge base/i)).toBeDefined();
  });

  it('should execute semantic search and render result cards with distance score', async () => {
    vi.mocked(api.search.search).mockResolvedValue({
      query: 'vector engine architecture',
      namespace: 'user_u1',
      totalHits: 1,
      latencyUs: 15400,
      results: [
        {
          chunkId: 'chunk-101',
          documentId: 'doc-1',
          documentTitle: 'System Design Spec',
          text: 'The C++ vector engine stores index points in an atomic HNSW graph structure.',
          distance: 0.0842,
          chunkIndex: 0,
        },
      ],
    });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Search Query/i), { target: { value: 'vector engine architecture' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => {
      expect(api.search.search).toHaveBeenCalledWith({
        query: 'vector engine architecture',
        k: 5,
      });

      expect(screen.getByText(/System Design Spec/i)).toBeDefined();
      expect(screen.getByText(/The C\+\+ vector engine stores index points/i)).toBeDefined();
      expect(screen.getByText('0.0842')).toBeDefined();
      expect(screen.getByText(/Chunk #0/i)).toBeDefined();
      expect(screen.getByText(/15.4 ms/i)).toBeDefined();
    });
  });

  it('should render empty state when search query yields 0 matching chunks', async () => {
    vi.mocked(api.search.search).mockResolvedValue({
      query: 'nonexistent query term',
      namespace: 'user_u1',
      totalHits: 0,
      latencyUs: 4200,
      results: [],
    });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Search Query/i), { target: { value: 'nonexistent query term' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => {
      expect(screen.getByText('No Matching Chunks Found')).toBeDefined();
    });
  });

  it('should render error alert when vector search API fails', async () => {
    vi.mocked(api.search.search).mockRejectedValue(new Error('Vector Engine Connection Timeout'));

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Search Query/i), { target: { value: 'test failure' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));

    await waitFor(() => {
      expect(screen.getByText('Vector Engine Connection Timeout')).toBeDefined();
    });
  });

  it('should render distance metric explanation when toggled', async () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /Toggle distance metric explanation/i });
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Distance represents the geometric distance between your query embedding/i)).toBeDefined();
      expect(screen.getByText(/Distance is a raw vector metric where lower values indicate closer semantic similarity/i)).toBeDefined();
    });
  });
});
