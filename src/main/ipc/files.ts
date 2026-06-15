import { ipcMain } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export function registerFilesIpc(): void {
  ipcMain.handle('files:read', async (_e, path: string) => {
    return readFile(path, 'utf-8');
  });

  ipcMain.handle('files:write', async (_e, path: string, content: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf-8');
  });
}
