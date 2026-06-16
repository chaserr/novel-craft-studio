import { create } from 'zustand';
import type {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  LlmStreamEvent,
  ProviderId
} from '../../shared/types';
import { api } from '../lib/ipc';
import { useSettings } from './settingsStore';

interface ChatState {
  /** All persisted sessions (summary) sorted by updatedAt desc. */
  sessions: ChatSessionSummary[];
  /** Currently active session (full). null = no session loaded yet. */
  current: ChatSession | null;

  streaming: boolean;
  activeRequestId: string | null;
  error: string | null;

  // ----- session ops -----
  loadList: () => Promise<void>;
  newSession: (projectRoot?: string) => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;

  // ----- chat ops -----
  send: (userText: string, systemPrompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function autoTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ').slice(0, 40);
  return t || '新对话';
}

function makeSession(
  provider: ProviderId,
  model: string,
  projectRoot?: string
): ChatSession {
  const now = Date.now();
  return {
    id: genId(),
    title: '新对话',
    provider,
    model,
    messages: [],
    projectRoot,
    createdAt: now,
    updatedAt: now
  };
}

let unsubscribe: (() => void) | null = null;

function ensureListener(
  state: () => ChatState,
  set: (p: Partial<ChatState>) => void
): void {
  if (unsubscribe) return;
  unsubscribe = api.llm.onEvent((e: LlmStreamEvent) => {
    const s = state();
    if (!s.current || e.requestId !== s.activeRequestId) return;
    if (e.type === 'chunk' && e.delta) {
      const msgs = [...s.current.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + e.delta };
      } else {
        msgs.push({ role: 'assistant', content: e.delta });
      }
      const updated = { ...s.current, messages: msgs, updatedAt: Date.now() };
      set({ current: updated });
    } else if (e.type === 'done') {
      const updated = s.current
        ? { ...s.current, updatedAt: Date.now() }
        : s.current;
      set({ streaming: false, activeRequestId: null, current: updated });
      if (updated) {
        void api.chats.save(updated).then(() => void state().loadList());
      }
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
    sessions: [],
    current: null,
    streaming: false,
    activeRequestId: null,
    error: null,

    loadList: async () => {
      const list = await api.chats.list();
      set({ sessions: list });
    },

    newSession: async (projectRoot) => {
      const s = useSettings.getState().settings;
      const sess = makeSession(s.activeProvider, s.models[s.activeProvider], projectRoot);
      set({ current: sess, error: null });
      await api.chats.save(sess);
      await get().loadList();
    },

    selectSession: async (id) => {
      const sess = await api.chats.get(id);
      if (sess) set({ current: sess, error: null });
    },

    deleteSession: async (id) => {
      await api.chats.delete(id);
      const cur = get().current;
      if (cur?.id === id) set({ current: null });
      await get().loadList();
    },

    renameSession: async (id, title) => {
      const sess = await api.chats.get(id);
      if (!sess) return;
      sess.title = title;
      sess.updatedAt = Date.now();
      await api.chats.save(sess);
      if (get().current?.id === id) set({ current: sess });
      await get().loadList();
    },

    send: async (userText, systemPrompt) => {
      if (get().streaming) return;
      let cur = get().current;
      if (!cur) {
        await get().newSession();
        cur = get().current!;
      }

      const userMsg: ChatMessage = { role: 'user', content: userText };
      const messages = [...cur.messages, userMsg];
      const title = cur.messages.length === 0 ? autoTitle(userText) : cur.title;
      const updated: ChatSession = {
        ...cur,
        title,
        messages,
        updatedAt: Date.now()
      };
      const requestId = genId();
      set({
        current: updated,
        streaming: true,
        activeRequestId: requestId,
        error: null
      });
      void api.chats.save(updated);

      try {
        await api.llm.stream({
          requestId,
          provider: cur.provider,
          model: cur.model,
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

    clearError: () => {
      set({ error: null });
    }
  };
});
