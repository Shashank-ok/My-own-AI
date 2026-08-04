import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, ConversationDTO, SearchHitDTO } from '../api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchHitDTO[];
  model?: string;
  createdAt: string;
  isError?: boolean;
}

export interface ChatContextType {
  conversations: ConversationDTO[];
  activeConversationId: string | null;
  activeConversation: ConversationDTO | null;
  messages: ChatMessage[];
  isLoadingConversations: boolean;
  isGenerating: boolean;
  error: string | null;
  lastFailedQuestion: string | null;
  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  askQuestion: (question: string, options?: { k?: number; documentIds?: string[] }) => Promise<void>;
  retryFailedQuestion: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  clearActiveMessages: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const res = await api.chat.listConversations();
      const sorted = [...(res.conversations || [])].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setConversations(sorted);
    } catch (err) {
      console.warn('[ChatContext] Failed to load conversations list:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const selectConversation = async (id: string) => {
    setError(null);
    setActiveConversationId(id);
    try {
      const res = await api.chat.getConversation(id);
      setActiveConversation(res.conversation);

      const uiMsgs: ChatMessage[] = res.conversation.messages.map((m, idx) => ({
        id: `${id}-msg-${idx}`,
        role: m.role,
        content: m.content,
        model: m.model,
        createdAt: m.createdAt,
      }));
      setMessages(uiMsgs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load conversation details';
      setError(msg);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setError(null);
    setLastFailedQuestion(null);
  };

  const askQuestion = async (question: string, options?: { k?: number; documentIds?: string[] }) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setError(null);
    setLastFailedQuestion(null);

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const response = await api.chat.askQuestion({
        question: trimmed,
        conversationId: activeConversationId || undefined,
        k: options?.k,
        documentIds: options?.documentIds,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        sources: response.sources || [],
        model: response.model,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setActiveConversationId(response.conversationId);
      await fetchConversations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate answer from Ollama LLM';
      setError(msg);
      setLastFailedQuestion(trimmed);

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Failed to get answer: ${msg}`,
          createdAt: new Date().toISOString(),
          isError: true,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const retryFailedQuestion = async () => {
    if (lastFailedQuestion) {
      // Remove trailing error message if present
      setMessages((prev) => prev.filter((m) => !m.isError));
      await askQuestion(lastFailedQuestion);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.chat.deleteConversation(id);
      if (activeConversationId === id) {
        startNewConversation();
      }
      await fetchConversations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete conversation';
      setError(msg);
    }
  };

  const clearActiveMessages = () => {
    setMessages([]);
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        messages,
        isLoadingConversations,
        isGenerating,
        error,
        lastFailedQuestion,
        fetchConversations,
        selectConversation,
        startNewConversation,
        askQuestion,
        retryFailedQuestion,
        deleteConversation,
        clearActiveMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
