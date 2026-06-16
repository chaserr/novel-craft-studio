import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { registerKeychainIpc } from './ipc/keychain';
import { registerLlmIpc } from './ipc/llm';
import { registerProjectIpc } from './ipc/project';
import { registerFilesIpc } from './ipc/files';
import { registerWorkflowIpc } from './ipc/workflow';
import { registerCodexSessionsIpc } from './ipc/codex-sessions';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1b1e',
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

app.whenReady().then(() => {
  registerKeychainIpc();
  registerFilesIpc();
  registerProjectIpc();
  registerLlmIpc(() => mainWindow);
  registerWorkflowIpc(() => mainWindow);
  registerCodexSessionsIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
