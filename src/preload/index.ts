import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  ChatMessage,
  ChatMode,
  ChatSession,
  ChatSessionSummary,
  ColorScheme,
  LlmStreamEvent,
  NewProjectFields,
  ProjectFileEntry,
  ProjectMeta,
  ProviderId,
  ReasoningEffort,
  RecentProject,
  WorkflowEvent,
  WorkflowRunRequest
} from '../shared/types';

export interface BuildInfo {
  fingerprint: string;
  channel: 'dev' | 'release';
  tag: string;
  timestamp: string;
  origin: string;
}

const api = {
  /* ---------- platform info ---------- */
  platform: process.platform as NodeJS.Platform,

  /* ---------- app meta (for About modal) ---------- */
  app: {
    buildInfo: (): Promise<BuildInfo> => ipcRenderer.invoke('app:build-info')
  },

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
      ipcRenderer.invoke('settings:downloadNovelCraft'),
    setColorScheme: (c: ColorScheme): Promise<void> =>
      ipcRenderer.invoke('settings:setColorScheme', c),
    setCustomAgentsPath: (p: string): Promise<void> =>
      ipcRenderer.invoke('settings:setCustomAgentsPath', p),
    touchRecentProject: (rootPath: string, bookTitle: string): Promise<RecentProject[]> =>
      ipcRenderer.invoke('settings:touchRecentProject', rootPath, bookTitle),
    removeRecentProject: (rootPath: string): Promise<RecentProject[]> =>
      ipcRenderer.invoke('settings:removeRecentProject', rootPath)
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
      ipcRenderer.invoke('files:write', path, content),
    showInFolder: (path: string): Promise<void> =>
      ipcRenderer.invoke('files:showInFolder', path),
    trash: (path: string): Promise<void> =>
      ipcRenderer.invoke('files:trash', path)
  },

  /* ---------- llm streaming (used by Tab 2 free chat) ---------- */
  llm: {
    stream: (req: {
      requestId: string;
      provider: ProviderId;
      model: string;
      systemPrompt: string;
      messages: ChatMessage[];
      resumeSessionId?: string;
      mode?: ChatMode;
      reasoningEffort?: ReasoningEffort;
      projectRoot?: string;
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

  /* ---------- chat history (read-only from codex sessions) ---------- */
  codexSessions: {
    list: (projectRoot?: string): Promise<ChatSessionSummary[]> =>
      ipcRenderer.invoke('codex-sessions:list', projectRoot),
    get: (id: string): Promise<ChatSession | null> =>
      ipcRenderer.invoke('codex-sessions:get', id)
  }
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
