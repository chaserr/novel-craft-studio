import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  LlmStreamEvent,
  NewProjectFields,
  ProjectFileEntry,
  ProjectMeta,
  ProviderId,
  WorkflowEvent,
  WorkflowRunRequest
} from '../shared/types';

const api = {
  /* ---------- platform info ---------- */
  platform: process.platform as NodeJS.Platform,

  /* ---------- keychain / settings ---------- */
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    setNovelCraftPath: (p: string): Promise<void> =>
      ipcRenderer.invoke('settings:setNovelCraftPath', p),
    setActiveProvider: (p: ProviderId): Promise<void> =>
      ipcRenderer.invoke('settings:setActiveProvider', p),
    setModel: (p: ProviderId, model: string): Promise<void> =>
      ipcRenderer.invoke('settings:setModel', p, model),
    setApiKey: (p: ProviderId, key: string): Promise<void> =>
      ipcRenderer.invoke('settings:setApiKey', p, key),
    hasApiKey: (p: ProviderId): Promise<boolean> =>
      ipcRenderer.invoke('settings:hasApiKey', p),
    deleteApiKey: (p: ProviderId): Promise<void> =>
      ipcRenderer.invoke('settings:deleteApiKey', p),
    downloadNovelCraft: (): Promise<string> =>
      ipcRenderer.invoke('settings:downloadNovelCraft')
  },

  /* ---------- project ---------- */
  project: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('project:pickDirectory'),
    open: (rootPath: string): Promise<{ meta: ProjectMeta; files: ProjectFileEntry[] }> =>
      ipcRenderer.invoke('project:open', rootPath),
    create: (
      fields: NewProjectFields,
      targetDir: string
    ): Promise<{ meta: ProjectMeta; files: ProjectFileEntry[] }> =>
      ipcRenderer.invoke('project:create', fields, targetDir)
  },

  /* ---------- files ---------- */
  files: {
    read: (path: string): Promise<string> => ipcRenderer.invoke('files:read', path),
    write: (path: string, content: string): Promise<void> =>
      ipcRenderer.invoke('files:write', path, content)
  },

  /* ---------- llm streaming (used by Tab 2 free chat) ---------- */
  llm: {
    stream: (req: {
      requestId: string;
      provider: ProviderId;
      model: string;
      systemPrompt: string;
      messages: ChatMessage[];
    }): Promise<void> => ipcRenderer.invoke('llm:stream', req),
    cancel: (requestId: string): Promise<void> =>
      ipcRenderer.invoke('llm:cancel', requestId),
    onEvent: (cb: (e: LlmStreamEvent) => void): (() => void) => {
      const handler = (_: unknown, e: LlmStreamEvent): void => cb(e);
      ipcRenderer.on('llm:event', handler);
      return () => ipcRenderer.removeListener('llm:event', handler);
    },
    probeAuth: (
      provider: ProviderId
    ): Promise<{ strategy: 'cli' | 'apikey' | 'none'; label: string }> =>
      ipcRenderer.invoke('llm:probeAuth', provider),
    oauthLogin: (provider: ProviderId): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('llm:oauthLogin', provider)
  },

  /* ---------- workflow engine (Tab 1) ---------- */
  workflow: {
    run: (req: WorkflowRunRequest): Promise<void> =>
      ipcRenderer.invoke('workflow:run', req),
    cancel: (requestId: string): Promise<void> =>
      ipcRenderer.invoke('workflow:cancel', requestId),
    onEvent: (cb: (e: WorkflowEvent) => void): (() => void) => {
      const handler = (_: unknown, e: WorkflowEvent): void => cb(e);
      ipcRenderer.on('workflow:event', handler);
      return () => ipcRenderer.removeListener('workflow:event', handler);
    }
  },

  /* ---------- chat sessions (persisted) ---------- */
  chats: {
    list: (): Promise<ChatSessionSummary[]> => ipcRenderer.invoke('chats:list'),
    get: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke('chats:get', id),
    save: (session: ChatSession): Promise<void> => ipcRenderer.invoke('chats:save', session),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('chats:delete', id)
  }
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
