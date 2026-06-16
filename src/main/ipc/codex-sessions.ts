/**
 * Reads chat history from ~/.codex/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl
 *
 * Codex CLI persists every conversation here automatically (both interactive
 * and `codex exec` runs). This file replaces our own chats.ts — we don't write
 * anything; codex does it for us, and we offer recovery by listing + parsing.
 */

import { ipcMain } from 'electron';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  ChatMessage,
  ChatSession,
  ChatSessionSummary
} from '../../shared/types';

const SESSIONS_ROOT = join(homedir(), '.codex', 'sessions');

/* ----------------------- jsonl event types ----------------------- */

interface SessionMetaEvent {
  timestamp: string;
  type?: 'session_meta';
  payload: {
    id: string;
    timestamp: string;
    cwd?: string;
    originator?: string;
    cli_version?: string;
    source?: string;
    model_provider?: string;
  };
}

interface MessageEvent {
  timestamp: string;
  payload: {
    type: 'message';
    role: 'user' | 'assistant' | 'developer' | 'system';
    content: { type: string; text?: string }[];
  };
}

interface ThreadNameUpdatedEvent {
  payload: {
    type: 'thread_name_updated';
    name?: string;
  };
}

/* ----------------------- scan ----------------------- */

async function walkSessionFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = join(dir, name);
      let s;
      try {
        s = await stat(abs);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        await walk(abs);
      } else if (name.endsWith('.jsonl') && name.startsWith('rollout-')) {
        out.push(abs);
      }
    }
  }
  await walk(root);
  return out;
}

/* ----------------------- parse one session ----------------------- */

async function readSessionLines(path: string): Promise<unknown[]> {
  try {
    const raw = await readFile(path, 'utf-8');
    return raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractMessageText(content: { type: string; text?: string }[]): string {
  return content
    .map((c) => {
      if (c.type === 'input_text' || c.type === 'output_text') return c.text ?? '';
      return '';
    })
    .filter(Boolean)
    .join('');
}

async function parseSessionSummary(
  path: string
): Promise<ChatSessionSummary | null> {
  const lines = await readSessionLines(path);
  let meta: SessionMetaEvent['payload'] | null = null;
  let title: string | undefined;
  let firstUserMsg: string | undefined;
  let messageCount = 0;
  let lastTimestamp = 0;

  for (const line of lines) {
    const ev = line as Record<string, unknown>;
    const ts = ev.timestamp as string | undefined;
    if (ts) {
      const t = Date.parse(ts);
      if (!Number.isNaN(t)) lastTimestamp = Math.max(lastTimestamp, t);
    }
    const payload = ev.payload as { type?: string } | undefined;
    if (payload?.type === 'session_meta') {
      meta = (line as SessionMetaEvent).payload;
    } else if ((payload as any)?.type === undefined && ev.type === 'session_meta') {
      // older event shape
      meta = (line as SessionMetaEvent).payload;
    } else if (payload?.type === 'thread_name_updated') {
      const n = (payload as { name?: string }).name;
      if (n) title = n;
    } else if (payload?.type === 'message') {
      messageCount++;
      const msg = payload as MessageEvent['payload'];
      if (!firstUserMsg && msg.role === 'user') {
        firstUserMsg = extractMessageText(msg.content).slice(0, 80);
      }
    }
  }

  if (!meta) return null;

  return {
    id: meta.id,
    title: title || firstUserMsg || '未命名对话',
    provider: 'openai',
    messageCount,
    updatedAt: lastTimestamp || Date.parse(meta.timestamp) || Date.now()
  };
}

async function parseSessionFull(path: string): Promise<ChatSession | null> {
  const lines = await readSessionLines(path);
  let meta: SessionMetaEvent['payload'] | null = null;
  let title: string | undefined;
  const messages: ChatMessage[] = [];
  let lastTimestamp = 0;
  let model: string | undefined;

  for (const line of lines) {
    const ev = line as Record<string, unknown>;
    const ts = ev.timestamp as string | undefined;
    if (ts) {
      const t = Date.parse(ts);
      if (!Number.isNaN(t)) lastTimestamp = Math.max(lastTimestamp, t);
    }
    const payload = ev.payload as { type?: string } | undefined;
    if (payload?.type === 'session_meta' || ev.type === 'session_meta') {
      meta = (line as SessionMetaEvent).payload;
    } else if (payload?.type === 'turn_context') {
      const m = (payload as { model?: string }).model;
      if (m) model = m;
    } else if (payload?.type === 'thread_name_updated') {
      const n = (payload as { name?: string }).name;
      if (n) title = n;
    } else if (payload?.type === 'message') {
      const m = payload as MessageEvent['payload'];
      // skip 'developer' (system) messages — they're internal
      if (m.role !== 'developer' && m.role !== 'system') {
        const text = extractMessageText(m.content);
        if (text) {
          messages.push({ role: m.role as 'user' | 'assistant', content: text });
        }
      }
    }
  }

  if (!meta) return null;

  return {
    id: meta.id,
    title: title || (messages[0]?.content.slice(0, 40) ?? '未命名对话'),
    provider: 'openai',
    model: model ?? 'gpt-5.5',
    messages,
    projectRoot: meta.cwd,
    createdAt: Date.parse(meta.timestamp) || lastTimestamp || Date.now(),
    updatedAt: lastTimestamp || Date.now()
  };
}

/* ----------------------- locator (for resume) ----------------------- */

const sessionPathCache = new Map<string, string>();

async function locateSessionPath(id: string): Promise<string | null> {
  if (sessionPathCache.has(id)) {
    const p = sessionPathCache.get(id)!;
    if (existsSync(p)) return p;
    sessionPathCache.delete(id);
  }
  const files = await walkSessionFiles(SESSIONS_ROOT);
  for (const f of files) {
    if (f.includes(id)) {
      sessionPathCache.set(id, f);
      return f;
    }
  }
  return null;
}

/* ----------------------- IPC ----------------------- */

export function registerCodexSessionsIpc(): void {
  ipcMain.handle(
    'codex-sessions:list',
    async (_e, projectRootFilter?: string): Promise<ChatSessionSummary[]> => {
      const files = await walkSessionFiles(SESSIONS_ROOT);
      const summaries = await Promise.all(files.map((f) => parseSessionSummary(f)));
      const result = summaries.filter(
        (s): s is ChatSessionSummary => s !== null
      );
      // Optional cwd filter: only sessions that ran inside the current project
      if (projectRootFilter) {
        const filtered: ChatSessionSummary[] = [];
        for (const sum of result) {
          const path = await locateSessionPath(sum.id);
          if (!path) continue;
          // Re-read meta to check cwd
          const lines = await readSessionLines(path);
          const meta = lines.find(
            (l) => (l as any).payload?.type === 'session_meta' || (l as any).type === 'session_meta'
          ) as SessionMetaEvent | undefined;
          if (meta?.payload?.cwd === projectRootFilter) filtered.push(sum);
        }
        return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return result.sort((a, b) => b.updatedAt - a.updatedAt);
    }
  );

  ipcMain.handle(
    'codex-sessions:get',
    async (_e, id: string): Promise<ChatSession | null> => {
      const path = await locateSessionPath(id);
      if (!path) return null;
      return parseSessionFull(path);
    }
  );
}
