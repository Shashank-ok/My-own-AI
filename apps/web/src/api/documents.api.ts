import { request } from './client';
import {
  IngestDocumentRequest,
  DocumentResponse,
  DocumentListResponse,
  RetryDocumentResponse,
  DeleteDocumentResponse,
  DocumentDTO,
} from './types';

export const documentsApi = {
  async ingestDocument(data: IngestDocumentRequest): Promise<DocumentResponse> {
    return request<DocumentResponse>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listDocuments(): Promise<DocumentListResponse> {
    return request<DocumentListResponse>('/api/documents', {
      method: 'GET',
    });
  },

  async getDocument(id: string): Promise<{ document: DocumentDTO }> {
    return request<{ document: DocumentDTO }>(`/api/documents/${id}`, {
      method: 'GET',
    });
  },

  async retryDocument(id: string, text?: string): Promise<RetryDocumentResponse> {
    return request<RetryDocumentResponse>(`/api/documents/${id}/retry`, {
      method: 'POST',
      body: text ? JSON.stringify({ text }) : undefined,
    });
  },

  async deleteDocument(id: string): Promise<DeleteDocumentResponse> {
    return request<DeleteDocumentResponse>(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  },
};
