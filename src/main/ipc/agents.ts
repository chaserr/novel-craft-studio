import { ipcMain, app } from 'electron';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentRole } from '../../shared/types';

/**
 * Per-role agent prompt override.
 *
 * Resolution order (workflow.ts mirrors this):
 *   1. <userData>/agents-overrides/<role>.md   ← what this IPC writes
 *   2. <customAgentsPath>/<role>.md            ← directory-level override
 *   3. <novelCraftPath>/agents/<role>.md       ← upstream default
 *
 * Renderer's AgentsEditor reads the upstream default (read-only) plus the
 * user override (editable). Saving creates the override file; resetting
 * deletes it (so the default re-applies on next workflow run).
 */

export function agentsOverrideDir(): string {
  return join(app.getPath('userData'), 'agents-overrides');
}

export function agentOverridePath(role: AgentRole): string {
  return join(agentsOverrideDir(), `${role}.md`);
}

async function ensureDir(): Promise<void> {
  const d = agentsOverrideDir();
  if (!existsSync(d)) await mkdir(d, { recursive: true });
}

async function readDefaultPrompt(novelCraftPath: string, role: AgentRole): Promise<string> {
  if (!novelCraftPath) return '';
  const path = join(novelCraftPath, 'agents', `${role}.md`);
  if (!existsSync(path)) return '';
  try {
    const raw = await readFile(path, 'utf-8');
    return raw.replace(/^---[\s\S]*?---\s*/, '').trim();
  } catch {
    return '';
  }
}

async function readOverridePrompt(role: AgentRole): Promise<string | null> {
  const p = agentOverridePath(role);
  if (!existsSync(p)) return null;
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export function registerAgentsIpc(): void {
  ipcMain.handle(
    'agents:readDefault',
    async (_e, role: AgentRole, novelCraftPath: string) =>
      readDefaultPrompt(novelCraftPath, role)
  );

  ipcMain.handle('agents:readOverride', async (_e, role: AgentRole) =>
    readOverridePrompt(role)
  );

  ipcMain.handle('agents:hasOverride', (_e, role: AgentRole) =>
    existsSync(agentOverridePath(role))
  );

  ipcMain.handle(
    'agents:saveOverride',
    async (_e, role: AgentRole, content: string) => {
      await ensureDir();
      await writeFile(agentOverridePath(role), content, 'utf-8');
    }
  );

  ipcMain.handle('agents:deleteOverride', async (_e, role: AgentRole) => {
    const p = agentOverridePath(role);
    if (existsSync(p)) await unlink(p);
  });

  ipcMain.handle('agents:overrideDir', () => agentsOverrideDir());
}
