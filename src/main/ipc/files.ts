import { ipcMain, shell } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

export function registerFilesIpc(): void {
  ipcMain.handle('files:read', async (_e, path: string) => {
    return readFile(path, 'utf-8');
  });

  ipcMain.handle('files:write', async (_e, path: string, content: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');
  });

  // 在系统文件管理器里高亮显示文件（macOS=Finder, Windows=Explorer, Linux=Files）。
  // 如果传的路径是目录，则在它的父目录里高亮它；目录不存在时打开父目录。
  ipcMain.handle('files:showInFolder', (_e, path: string) => {
    if (existsSync(path)) {
      shell.showItemInFolder(path);
    } else {
      // 兜底：目标文件被删了或刚移走 — 打开它的父目录
      void shell.openPath(dirname(path));
    }
  });

  // 移到系统废纸篓（可恢复）。比直接 unlink 安全。
  ipcMain.handle('files:trash', async (_e, path: string) => {
    if (!existsSync(path)) return;
    await shell.trashItem(path);
  });
}
