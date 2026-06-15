import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  ChatMessage,
  LlmStreamEvent,
  NewProjectFields,
  ProjectFileEntry,
  ProjectMeta,
  ProviderId
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

  /* ---------- llm streaming ---------- */
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
    }
  }
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
