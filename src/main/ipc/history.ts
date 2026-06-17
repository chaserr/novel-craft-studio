import { ipcMain } from 'electron';
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  unlink
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Per-file save history.
 *
 * Snapshots live at <projectRoot>/.orchid-history/<原相对路径>/<ts>-<hash>.md
 * (dotfile dir → 不进侧栏扫描；用户可加进 .gitignore)。
 *
 * 节流 + 去重：
 *   - 内容跟最新版完全一样 → 跳过
 *   - 距上一份 < 60s → 用新版替换上一份（不堆 N 份"几秒前的小改"）
 *   - 单个文件保留最近 50 份
 */

const HISTORY_DIRNAME = '.orchid-history';
const MIN_INTERVAL_MS = 60_000;
const MAX_SNAPSHOTS_PER_FILE = 50;
const SNAP_RE = /^(\d+)-([a-f0-9]+)\.md$/;

function historyDirFor(projectRoot: string, filePath: string): string | null {
  if (!projectRoot) return null;
  const rel = relative(projectRoot, filePath);
  if (rel.startsWith('..') || rel.startsWith('/') || rel === '') return null;
  return join(projectRoot, HISTORY_DIRNAME, rel);
}

function contentHash(s: string): string {
  return createHash('sha1').update(s, 'utf-8').digest('hex').slice(0, 16);
}

export interface SnapshotMeta {
  timestamp: number;
  path: string;
  size: number;
  hash: string;
}

async function listSnapshots(
  projectRoot: string,
  filePath: string
): Promise<SnapshotMeta[]> {
  const dir = historyDirFor(projectRoot, filePath);
  if (!dir || !existsSync(dir)) return [];
  try {
    const names = await readdir(dir);
    const metas: SnapshotMeta[] = [];
    for (const name of names) {
      const m = SNAP_RE.exec(name);
      if (!m) continue;
      const ts = parseInt(m[1], 10);
      const abs = join(dir, name);
      try {
        const st = await stat(abs);
        metas.push({ timestamp: ts, path: abs, size: st.size, hash: m[2] });
      } catch {
        // skip missing
      }
    }
    metas.sort((a, b) => b.timestamp - a.timestamp); // 最新在前
    return metas;
  } catch {
    return [];
  }
}

async function saveSnapshot(
  projectRoot: string,
  filePath: string,
  content: string
): Promise<{ ok: boolean; reason?: string }> {
  const dir = historyDirFor(projectRoot, filePath);
  if (!dir) return { ok: false, reason: 'outside-project' };
  await mkdir(dir, { recursive: true });

  const existing = await listSnapshots(projectRoot, filePath);
  const now = Date.now();
  const newHash = contentHash(content);

  if (existing.length > 0) {
    const latest = existing[0];
    if (latest.hash === newHash) return { ok: false, reason: 'unchanged' };
    if (now - latest.timestamp < MIN_INTERVAL_MS) {
      // 在节流窗口内 → 替换上一份，不新增。
      try {
        await unlink(latest.path);
      } catch {
        // ignore
      }
    }
  }

  const fname = `${now}-${newHash}.md`;
  await writeFile(join(dir, fname), content, 'utf-8');

  const after = await listSnapshots(projectRoot, filePath);
  if (after.length > MAX_SNAPSHOTS_PER_FILE) {
    for (const m of after.slice(MAX_SNAPSHOTS_PER_FILE)) {
      try {
        await unlink(m.path);
      } catch {
        // ignore
      }
    }
  }

  return { ok: true };
}

async function readSnapshot(snapshotPath: string): Promise<string> {
  try {
    return await readFile(snapshotPath, 'utf-8');
  } catch {
    return '';
  }
}

async function deleteSnapshot(snapshotPath: string): Promise<void> {
  // 安全网：拒绝路径里没有 .orchid-history 的删除请求，避免误删项目文件。
  if (!basename(snapshotPath).match(SNAP_RE)) return;
  if (!snapshotPath.includes(`/${HISTORY_DIRNAME}/`)) return;
  if (!existsSync(snapshotPath)) return;
  try {
    await unlink(snapshotPath);
  } catch {
    // ignore
  }
}

export function registerHistoryIpc(): void {
  ipcMain.handle(
    'history:list',
    (_e, projectRoot: string, filePath: string) =>
      listSnapshots(projectRoot, filePath)
  );
  ipcMain.handle(
    'history:save',
    (_e, projectRoot: string, filePath: string, content: string) =>
      saveSnapshot(projectRoot, filePath, content)
  );
  ipcMain.handle('history:read', (_e, snapshotPath: string) =>
    readSnapshot(snapshotPath)
  );
  ipcMain.handle('history:delete', (_e, snapshotPath: string) =>
    deleteSnapshot(snapshotPath)
  );
}
