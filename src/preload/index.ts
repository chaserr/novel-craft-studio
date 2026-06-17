import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentRole,
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
  },

  /* ---------- per-file save history (.orchid-history/) ---------- */
  history: {
    list: (
      projectRoot: string,
      filePath: string
    ): Promise<
      { timestamp: number; path: string; size: number; hash: string }[]
    > => ipcRenderer.invoke('history:list', projectRoot, filePath),
    save: (
      projectRoot: string,
      filePath: string,
      content: string
    ): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke('history:save', projectRoot, filePath, content),
    read: (snapshotPath: string): Promise<string> =>
      ipcRenderer.invoke('history:read', snapshotPath),
    delete: (snapshotPath: string): Promise<void> =>
      ipcRenderer.invoke('history:delete', snapshotPath)
  },

  /* ---------- per-file skill override (in-app editor) ---------- */
  skills: {
    list: (
      novelCraftPath: string
    ): Promise<{ slug: string; files: string[] }[]> =>
      ipcRenderer.invoke('skills:list', novelCraftPath),
    readDefault: (
      slug: string,
      relPath: string,
      novelCraftPath: string
    ): Promise<string> =>
      ipcRenderer.invoke('skills:readDefault', slug, relPath, novelCraftPath),
    readOverride: (slug: string, relPath: string): Promise<string | null> =>
      ipcRenderer.invoke('skills:readOverride', slug, relPath),
    hasOverride: (slug: string, relPath: string): Promise<boolean> =>
      ipcRenderer.invoke('skills:hasOverride', slug, relPath),
    saveOverride: (slug: string, relPath: string, content: string): Promise<void> =>
      ipcRenderer.invoke('skills:saveOverride', slug, relPath, content),
    deleteOverride: (slug: string, relPath: string): Promise<void> =>
      ipcRenderer.invoke('skills:deleteOverride', slug, relPath),
    overrideDir: (): Promise<string> => ipcRenderer.invoke('skills:overrideDir')
  },

  /* ---------- per-agent prompt override (in-app editor) ---------- */
  agents: {
    readDefault: (role: AgentRole, novelCraftPath: string): Promise<string> =>
      ipcRenderer.invoke('agents:readDefault', role, novelCraftPath),
    readOverride: (role: AgentRole): Promise<string | null> =>
      ipcRenderer.invoke('agents:readOverride', role),
    hasOverride: (role: AgentRole): Promise<boolean> =>
      ipcRenderer.invoke('agents:hasOverride', role),
    saveOverride: (role: AgentRole, content: string): Promise<void> =>
      ipcRenderer.invoke('agents:saveOverride', role, content),
    deleteOverride: (role: AgentRole): Promise<void> =>
      ipcRenderer.invoke('agents:deleteOverride', role),
    overrideDir: (): Promise<string> => ipcRenderer.invoke('agents:overrideDir')
  }
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
