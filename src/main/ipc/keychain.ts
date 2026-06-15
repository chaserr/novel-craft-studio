import { ipcMain, app } from 'electron';
import keytar from 'keytar';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AppSettings, ProviderId } from '../../shared/types';

const execAsync = promisify(exec);
const NOVEL_CRAFT_REPO = 'https://github.com/chaserr/novel-craft.git';

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

  ipcMain.handle('settings:downloadNovelCraft', async () => {
    const targetDir = join(app.getPath('userData'), 'novel-craft');

    // 先确认 git 可用
    try {
      await execAsync('git --version');
    } catch {
      throw new Error(
        '系统未安装 git。请先安装 git（macOS: xcode-select --install；Windows: 从 git-scm.com 下载）'
      );
    }

    if (existsSync(join(targetDir, '.git'))) {
      // 已存在 → git pull 更新
      await execAsync(`git -C "${targetDir}" pull --ff-only`, {
        timeout: 60_000
      });
    } else {
      // 不存在 → clone
      if (existsSync(targetDir)) {
        throw new Error(
          `目标路径已存在但不是 git 仓库：${targetDir}。请手动删除后重试，或在 Settings 中手填别的路径。`
        );
      }
      await execAsync(
        `git clone --depth 1 "${NOVEL_CRAFT_REPO}" "${targetDir}"`,
        { timeout: 180_000 }
      );
    }

    // 保存路径到 settings.json
    const s = loadSettings();
    s.novelCraftPath = targetDir;
    saveSettings(s);
    return targetDir;
  });
}

export async function getApiKey(provider: ProviderId): Promise<string | null> {
  return keytar.getPassword(SERVICE, provider);
}

export function getSettings(): AppSettings {
  return loadSettings();
}
