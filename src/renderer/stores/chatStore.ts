/**
 * Chat store — backed by codex's own ~/.codex/sessions/ history.
 * We don't persist anything ourselves; codex CLI writes its own jsonl files
 * when we spawn it. We just list/parse them.
 *
 * Flow:
 *  - new chat: send() with no current session → codex spawns, emits thread_id → bind it
 *  - continue chat: send() with current session id → calls `codex exec resume <id>`
 *  - load from history: selectSession() → read jsonl, hydrate UI
 *
 * Note: this currently only manages ChatGPT/Codex sessions. Claude / DeepSeek
 * runs in chat are ephemeral (lost on app restart) — separate feature later.
 */

import { create } from 'zustand';
import type {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  LlmStreamEvent
} from '../../shared/types';
import { api } from '../lib/ipc';
import { useSettings } from './settingsStore';

interface ChatState {
  /** Codex sessions (from ~/.codex/sessions), summary only. */
  sessions: ChatSessionSummary[];
  /** Currently active session. null = no session yet (next send starts a new one). */
  current: ChatSession | null;

  streaming: boolean;
  activeRequestId: string | null;
  error: string | null;

  // ----- session ops -----
  loadList: (projectRoot?: string) => Promise<void>;
  newSession: () => void;
  selectSession: (id: string) => Promise<void>;

  // ----- chat ops -----
  send: (userText: string, systemPrompt: string) => Promise<void>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
    if (e.type === 'session' && e.sessionId) {
      // Codex told us the session id; bind it so next send uses resume
      const updated = { ...s.current, id: e.sessionId };
      set({ current: updated });
    } else if (e.type === 'chunk' && e.delta) {
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
      set({ streaming: false, activeRequestId: null });
      // Refresh list — codex just appended/created a jsonl
      const projectRoot = state().current?.projectRoot;
      void state().loadList(projectRoot);
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

    loadList: async (projectRoot) => {
      const list = await api.codexSessions.list(projectRoot);
      set({ sessions: list });
    },

    newSession: () => {
      const s = useSettings.getState().settings;
      // Pending session — id is empty until codex emits thread_id on first send
      const now = Date.now();
      set({
        current: {
          id: '',
          title: '新对话',
          provider: s.activeProvider,
          model: s.models[s.activeProvider],
          messages: [],
          createdAt: now,
          updatedAt: now
        },
        error: null
      });
    },

    selectSession: async (id) => {
      const sess = await api.codexSessions.get(id);
      if (sess) set({ current: sess, error: null });
    },

    send: async (userText, systemPrompt) => {
      if (get().streaming) return;
      let cur = get().current;
      if (!cur) {
        get().newSession();
        cur = get().current!;
      }

      const userMsg: ChatMessage = { role: 'user', content: userText };
      const messages = [...cur.messages, userMsg];
      const title =
        cur.messages.length === 0
          ? userText.trim().slice(0, 40) || '新对话'
          : cur.title;
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

      try {
        await api.llm.stream({
          requestId,
          provider: cur.provider,
          model: cur.model,
          systemPrompt,
          messages,
          // If we have a session id from codex (assigned during a previous send),
          // resume the existing codex thread instead of starting new.
          resumeSessionId: cur.id || undefined
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
