/**
 * TypeScript Data Transfer Objects (DTOs) matching Node.js Express API Schemas
 */

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDTO;
  token: string;
}

export interface UserProfileResponse {
  user: UserDTO;
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DocumentDTO {
  _id: string;
  ownerId: string;
  title: string;
  status: DocumentStatus;
  chunkCount: number;
  originalFileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  ingestionError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestDocumentRequest {
  title: string;
  text: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface DocumentResponse {
  message: string;
  document: DocumentDTO;
}

export interface DocumentListResponse {
  documents: DocumentDTO[];
}

export interface RetryDocumentResponse {
  message: string;
  document: DocumentDTO;
}

export interface DeleteDocumentResponse {
  message: string;
  deleted: boolean;
}

/**
 * Note: Distance values are raw metric distances (e.g. Cosine distance where 0.0 indicates identity), NOT probabilities.
 */
export interface SearchHitDTO {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  text: string;
  distance: number;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface SearchRequest {
  query: string;
  k?: number;
  documentIds?: string[];
}

export interface SearchResponse {
  query: string;
  namespace: string;
  totalHits: number;
  latencyUs: number;
  results: SearchHitDTO[];
}

export interface MessageDTO {
  role: 'user' | 'assistant';
  content: string;
  sourceChunkIds?: string[];
  model?: string;
  createdAt: string;
}

export interface ConversationDTO {
  _id: string;
  ownerId: string;
  title: string;
  messages: MessageDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface AskQuestionRequest {
  question: string;
  conversationId?: string;
  k?: number;
  documentIds?: string[];
}

export interface AskQuestionResponse {
  conversationId: string;
  question: string;
  answer: string;
  sources: SearchHitDTO[];
  model: string;
}

export interface ConversationListResponse {
  conversations: ConversationDTO[];
}

export interface ConversationDetailsResponse {
  conversation: ConversationDTO;
}

export interface DeleteConversationResponse {
  deleted: boolean;
}

export interface HealthStatusResponse {
  status: string;
  timestamp: string;
  services: {
    api: string;
    mongodb: string;
    ollama: string;
    vectorEngine: string;
  };
}
