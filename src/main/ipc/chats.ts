/**
 * Persistent chat sessions.
 * Each session is one JSON file under `<userData>/chats/<id>.json`.
 * Schema: src/shared/types.ts ChatSession.
 */

import { ipcMain, app } from 'electron';
import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChatSession, ChatSessionSummary } from '../../shared/types';

function chatsDir(): string {
  return join(app.getPath('userData'), 'chats');
}

async function ensureDir(): Promise<void> {
  await mkdir(chatsDir(), { recursive: true });
}

export function registerChatsIpc(): void {
  ipcMain.handle('chats:list', async (): Promise<ChatSessionSummary[]> => {
    await ensureDir();
    const dir = chatsDir();
    const files = await readdir(dir).catch(() => [] as string[]);
    const sessions = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          try {
            const s: ChatSession = JSON.parse(await readFile(join(dir, f), 'utf-8'));
            return {
              id: s.id,
              title: s.title,
              provider: s.provider,
              messageCount: s.messages.length,
              updatedAt: s.updatedAt
            } as ChatSessionSummary;
          } catch {
            return null;
          }
        })
    );
    return sessions
      .filter((s): s is ChatSessionSummary => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  ipcMain.handle('chats:get', async (_e, id: string): Promise<ChatSession | null> => {
    try {
      const raw = await readFile(join(chatsDir(), `${id}.json`), 'utf-8');
      return JSON.parse(raw) as ChatSession;
    } catch {
      return null;
    }
  });

  ipcMain.handle('chats:save', async (_e, session: ChatSession): Promise<void> => {
    await ensureDir();
    await writeFile(
      join(chatsDir(), `${session.id}.json`),
      JSON.stringify(session, null, 2),
      'utf-8'
    );
  });

  ipcMain.handle('chats:delete', async (_e, id: string): Promise<void> => {
    await unlink(join(chatsDir(), `${id}.json`)).catch(() => {
      /* missing is fine */
    });
  });
}
