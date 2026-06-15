import { create } from 'zustand';
import type { ChatMessage, LlmStreamEvent } from '../../shared/types';
import { api } from '../lib/ipc';

interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
  activeRequestId: string | null;
  error: string | null;

  send: (
    userText: string,
    systemPrompt: string,
    provider: 'openai' | 'anthropic' | 'deepseek',
    model: string
  ) => Promise<void>;
  cancel: () => Promise<void>;
  clear: () => void;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let unsubscribe: (() => void) | null = null;

function ensureListener(state: () => ChatState, set: (p: Partial<ChatState>) => void): void {
  if (unsubscribe) return;
  unsubscribe = api.llm.onEvent((e: LlmStreamEvent) => {
    const s = state();
    if (e.requestId !== s.activeRequestId) return;
    if (e.type === 'chunk' && e.delta) {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + e.delta };
      } else {
        msgs.push({ role: 'assistant', content: e.delta });
      }
      set({ messages: msgs });
    } else if (e.type === 'done') {
      set({ streaming: false, activeRequestId: null });
    } else if (e.type === 'error') {
      set({
        streaming: false,
        activeRequestId: null,
        error: e.message ?? '未知错误'
      });
    }
  });
}

export const useChat = create<ChatState>((set, get) => {
  ensureListener(get, (p) => set(p));
  return {
    messages: [],
    streaming: false,
    activeRequestId: null,
    error: null,

    send: async (userText, systemPrompt, provider, model) => {
      if (get().streaming) return;
      const userMsg: ChatMessage = { role: 'user', content: userText };
      const messages = [...get().messages, userMsg];
      const requestId = genId();
      set({
        messages,
        streaming: true,
        activeRequestId: requestId,
        error: null
      });
      try {
        await api.llm.stream({
          requestId,
          provider,
          model,
          systemPrompt,
          messages
        });
      } catch (err) {
        set({
          streaming: false,
          activeRequestId: null,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    },

    cancel: async () => {
      const id = get().activeRequestId;
      if (id) await api.llm.cancel(id);
      set({ streaming: false, activeRequestId: null });
    },

    clear: () => {
      set({ messages: [], error: null });
    }
  };
});
