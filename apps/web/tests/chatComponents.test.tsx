import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatPage } from '../src/pages/ChatPage';
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
      chat: {
        askQuestion: vi.fn(),
        listConversations: vi.fn(),
        getConversation: vi.fn(),
        deleteConversation: vi.fn(),
      },
    },
  };
});

describe('RAG Chat Component Tests', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.restoreAllMocks();
    vi.mocked(api.documents.listDocuments).mockResolvedValue({ documents: [] });
    vi.mocked(api.chat.listConversations).mockResolvedValue({ conversations: [] });
  });

  it('should render RAG chat workspace, sidebar, and initial idle prompt', async () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New RAG Chat Session')).toBeDefined();
      expect(screen.getByText('Ask a question about your documents')).toBeDefined();
      expect(screen.getByRole('button', { name: /New Conversation/i })).toBeDefined();
    });
  });

  it('should send a question and render assistant response with source citations', async () => {
    vi.mocked(api.chat.askQuestion).mockResolvedValue({
      conversationId: 'conv-123',
      question: 'What is vector retrieval?',
      answer: 'Vector retrieval maps query embeddings to nearest document chunks in vector space.',
      model: 'llama3:latest',
      sources: [
        {
          chunkId: 'c-1',
          documentId: 'd-1',
          documentTitle: 'RAG Architecture Whitepaper',
          text: 'Vector retrieval matches embeddings using Cosine distance metric.',
          distance: 0.0412,
          chunkIndex: 0,
        },
      ],
    });

    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    const textarea = screen.getByPlaceholderText(/Ask your document knowledge base a question/i);
    fireEvent.change(textarea, { target: { value: 'What is vector retrieval?' } });

    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(api.chat.askQuestion).toHaveBeenCalledWith({
        question: 'What is vector retrieval?',
        conversationId: undefined,
        k: 5,
        documentIds: undefined,
      });

      expect(screen.getByText('What is vector retrieval?')).toBeDefined();
      expect(screen.getByText('Vector retrieval maps query embeddings to nearest document chunks in vector space.')).toBeDefined();
      expect(screen.getByText('llama3:latest')).toBeDefined();
      expect(screen.getByText(/Retrieved Vector Sources \(1\)/i)).toBeDefined();
      expect(screen.getByText(/\[1\] RAG Architecture Whitepaper/i)).toBeDefined();
    });
  });

  it('should render error alert and retry button when LLM generation fails', async () => {
    vi.mocked(api.chat.askQuestion).mockRejectedValue(new Error('Ollama service timeout (HTTP 504)'));

    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    const textarea = screen.getByPlaceholderText(/Ask your document knowledge base a question/i);
    fireEvent.change(textarea, { target: { value: 'Trigger LLM timeout test' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      const errorElements = screen.getAllByText(/Ollama service timeout \(HTTP 504\)/i);
      expect(errorElements.length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Retry Question/i })).toBeDefined();
    });
  });
});
