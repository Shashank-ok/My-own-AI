import { request } from './client';
import {
  AskQuestionRequest,
  AskQuestionResponse,
  ConversationListResponse,
  ConversationDetailsResponse,
  DeleteConversationResponse,
} from './types';

export const chatApi = {
  async askQuestion(data: AskQuestionRequest): Promise<AskQuestionResponse> {
    return request<AskQuestionResponse>('/api/chat/ask', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listConversations(): Promise<ConversationListResponse> {
    return request<ConversationListResponse>('/api/chat/conversations', {
      method: 'GET',
    });
  },

  async getConversation(id: string): Promise<ConversationDetailsResponse> {
    return request<ConversationDetailsResponse>(`/api/chat/conversations/${id}`, {
      method: 'GET',
    });
  },

  async deleteConversation(id: string): Promise<DeleteConversationResponse> {
    return request<DeleteConversationResponse>(`/api/chat/conversations/${id}`, {
      method: 'DELETE',
    });
  },
};
