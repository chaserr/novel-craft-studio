import { ipcMain, app } from 'electron';
import keytar from 'keytar';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AppSettings, ProviderId } from '../../shared/types';

const SERVICE = 'novel-craft-studio';

function configPath(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'settings.json');
}

function defaultSettings(): AppSettings {
  return {
    novelCraftPath: '',
    activeProvider: 'deepseek',
    models: {
      openai: 'gpt-4o',
      anthropic: 'claude-opus-4-5-20251101',
      deepseek: 'deepseek-chat'
    }
  };
}

function loadSettings(): AppSettings {
  const p = configPath();
  if (!existsSync(p)) return defaultSettings();
  try {
    const raw = readFileSync(p, 'utf-8');
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(s: AppSettings): void {
  writeFileSync(configPath(), JSON.stringify(s, null, 2), 'utf-8');
}

export function registerKeychainIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings());

  ipcMain.handle('settings:setNovelCraftPath', (_e, p: string) => {
    const s = loadSettings();
    s.novelCraftPath = p;
    saveSettings(s);
  });

  ipcMain.handle('settings:setActiveProvider', (_e, p: ProviderId) => {
    const s = loadSettings();
    s.activeProvider = p;
    saveSettings(s);
  });

  ipcMain.handle('settings:setModel', (_e, p: ProviderId, model: string) => {
    const s = loadSettings();
    s.models[p] = model;
    saveSettings(s);
  });

  ipcMain.handle('settings:setApiKey', async (_e, p: ProviderId, key: string) => {
    if (key) await keytar.setPassword(SERVICE, p, key);
    else await keytar.deletePassword(SERVICE, p);
  });

  ipcMain.handle('settings:hasApiKey', async (_e, p: ProviderId) => {
    const k = await keytar.getPassword(SERVICE, p);
    return !!k;
  });

  ipcMain.handle('settings:deleteApiKey', async (_e, p: ProviderId) => {
    await keytar.deletePassword(SERVICE, p);
  });
}

export async function getApiKey(provider: ProviderId): Promise<string | null> {
  return keytar.getPassword(SERVICE, provider);
}

export function getSettings(): AppSettings {
  return loadSettings();
}
