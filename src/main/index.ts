import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { registerKeychainIpc } from './ipc/keychain';
import { registerLlmIpc } from './ipc/llm';
import { registerProjectIpc } from './ipc/project';
import { registerFilesIpc } from './ipc/files';
import { registerWorkflowIpc } from './ipc/workflow';
import { registerCodexSessionsIpc } from './ipc/codex-sessions';
import { registerAgentsIpc } from './ipc/agents';
import { registerSkillsIpc } from './ipc/skills';
import { registerHistoryIpc } from './ipc/history';
import {
  BUILD_FINGERPRINT,
  BUILD_CHANNEL,
  BUILD_TAG,
  BUILD_TIMESTAMP,
  ORIGIN_REPO,
  buildBanner
} from '../shared/fingerprint';

// dev 模式 .app bundle 名是 "Electron"，macOS 菜单栏 / 关于面板 / Quit 菜单
// 默认全部读 bundle 名。手动覆盖 app name 让两套模式表现一致。
app.setName('Orchid');
if (process.platform === 'darwin') {
  app.setAboutPanelOptions({
    applicationName: 'Orchid',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026 chaser'
  });
}

let mainWindow: BrowserWindow | null = null;

// Resolve icon for both dev (repo/resources/icon.png) and prod
// (electron-builder copies resources/ into Contents/Resources/).
function resolveIconPath(): string {
  const dev = join(__dirname, '..', '..', 'resources', 'icon.png');
  if (existsSync(dev)) return dev;
  return join(process.resourcesPath, 'icon.png');
}

function createWindow(): void {
  const iconPath = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1b1e',
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    // production 也开 devtools 方便用户诊断（稳定后可移除）
    if (process.env.NOVEL_CRAFT_DEVTOOLS === '1' || !process.env['ELECTRON_RENDERER_URL']) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[renderer] did-fail-load', { code, desc, url });
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer] render-process-gone', details);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/**
 * Build a macOS application menu without any Electron-default Help links
 * (those default to electronjs.org). Standard editing roles preserved.
 */
function buildAppMenu(): void {
  if (process.platform !== 'darwin') {
    // Windows/Linux: kill the menu bar entirely (we use autoHideMenuBar anyway).
    Menu.setApplicationMenu(null);
    return;
  }
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Orchid',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Orchid GitHub',
          click: (): void => {
            void shell.openExternal('https://github.com/chaserr/novel-craft-studio');
          }
        },
        {
          label: 'Report an Issue',
          click: (): void => {
            void shell.openExternal(
              'https://github.com/chaserr/novel-craft-studio/issues'
            );
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  console.info(buildBanner());
  buildAppMenu();

  // macOS dock icon — BrowserWindow.icon 在 mac 上被忽略，需用 app.dock.setIcon。
  // dev 下 .app bundle 是 Electron.app（默认图标），prod 下是 Orchid.app（已嵌入），
  // 但即便 prod 我们也覆盖一遍，确保 dock 一致。
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(resolveIconPath());
    } catch {
      /* 找不到图标也不致命 */
    }
  }

  ipcMain.handle('app:build-info', () => ({
    fingerprint: BUILD_FINGERPRINT,
    channel: BUILD_CHANNEL,
    tag: BUILD_TAG,
    timestamp: BUILD_TIMESTAMP,
    origin: ORIGIN_REPO
  }));
  registerKeychainIpc();
  registerFilesIpc();
  registerProjectIpc();
  registerLlmIpc(() => mainWindow);
  registerWorkflowIpc(() => mainWindow);
  registerCodexSessionsIpc();
  registerAgentsIpc();
  registerSkillsIpc();
  registerHistoryIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
