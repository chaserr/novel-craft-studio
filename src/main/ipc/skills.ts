import { ipcMain, app } from 'electron';
import { readFile, readdir, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Skill loader + per-file override editor.
 *
 * Skills live at <novelCraftPath>/skills/<slug>/SKILL.md (Claude Code shape).
 * The workflow engine auto-loads one skill per action based on a fixed
 * action→slug mapping (see workflow.ts DEFAULT_SKILL_BY_ACTION).
 *
 * If the skill directory has a `reference/` subdirectory, all .md files
 * inside it are appended after SKILL.md in filename-sorted order.
 *
 * Per-file override: any individual file in a skill can be overridden via
 * the in-app editor. Overrides live at
 *   <userData>/skills-overrides/<slug>/<relPath>
 * Resolution per file: override > novel-craft default. Frontmatter is
 * stripped from every loaded body.
 */

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

export function skillsOverrideDir(): string {
  return join(app.getPath('userData'), 'skills-overrides');
}

function skillFileOverridePath(slug: string, relPath: string): string {
  return join(skillsOverrideDir(), slug, relPath);
}

function skillFileDefaultPath(
  novelCraftPath: string,
  slug: string,
  relPath: string
): string {
  return join(novelCraftPath, 'skills', slug, relPath);
}

/** Read file body, override first; returns raw text or '' if missing. */
async function readSkillFile(
  novelCraftPath: string,
  slug: string,
  relPath: string
): Promise<string> {
  const candidates = [
    skillFileOverridePath(slug, relPath),
    skillFileDefaultPath(novelCraftPath, slug, relPath)
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      return await readFile(p, 'utf-8');
    } catch {
      // try next
    }
  }
  return '';
}

async function listReferenceFilenames(skillDir: string): Promise<string[]> {
  const refDir = join(skillDir, 'reference');
  if (!existsSync(refDir)) return [];
  try {
    const entries = await readdir(refDir);
    return entries.filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

export async function readSkillBody(
  novelCraftPath: string,
  slug: string
): Promise<string> {
  if (!novelCraftPath || !slug) return '';
  const defaultDir = join(novelCraftPath, 'skills', slug);
  // SKILL.md must exist somewhere (default or override) for the skill to load.
  const mainRaw = await readSkillFile(novelCraftPath, slug, 'SKILL.md');
  if (!mainRaw) return '';

  const parts: string[] = [stripFrontmatter(mainRaw).trim()];

  // Reference list comes from default dir layout; per-file override is
  // independent — you can override a reference file without forking the dir.
  const refFiles = await listReferenceFilenames(defaultDir);
  for (const f of refFiles) {
    const relPath = join('reference', f);
    const raw = await readSkillFile(novelCraftPath, slug, relPath);
    if (!raw) continue;
    const body = stripFrontmatter(raw).trim();
    if (body) parts.push(`## 参考｜${f.replace(/\.md$/, '')}\n\n${body}`);
  }

  return parts.join('\n\n').trim();
}

/* ============================================================ */
/*               UI editor support (list / read / save)         */
/* ============================================================ */

/** All skills available in the novel-craft repo, with each skill's file list. */
async function listSkills(
  novelCraftPath: string
): Promise<{ slug: string; files: string[] }[]> {
  if (!novelCraftPath) return [];
  const root = join(novelCraftPath, 'skills');
  if (!existsSync(root)) return [];
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  const result: { slug: string; files: string[] }[] = [];
  for (const slug of entries.sort()) {
    const dir = join(root, slug);
    try {
      const s = await stat(dir);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }
    const main = join(dir, 'SKILL.md');
    if (!existsSync(main)) continue;
    const files = ['SKILL.md'];
    const refs = await listReferenceFilenames(dir);
    for (const r of refs) files.push(`reference/${r}`);
    result.push({ slug, files });
  }
  return result;
}

async function readDefaultFile(
  novelCraftPath: string,
  slug: string,
  relPath: string
): Promise<string> {
  if (!novelCraftPath) return '';
  const p = skillFileDefaultPath(novelCraftPath, slug, relPath);
  if (!existsSync(p)) return '';
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return '';
  }
}

async function readOverrideFile(
  slug: string,
  relPath: string
): Promise<string | null> {
  const p = skillFileOverridePath(slug, relPath);
  if (!existsSync(p)) return null;
  try {
    return await readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

async function saveOverrideFile(
  slug: string,
  relPath: string,
  content: string
): Promise<void> {
  const target = skillFileOverridePath(slug, relPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf-8');
}

async function deleteOverrideFile(slug: string, relPath: string): Promise<void> {
  const p = skillFileOverridePath(slug, relPath);
  if (existsSync(p)) await unlink(p);
}

export function registerSkillsIpc(): void {
  ipcMain.handle('skills:list', async (_e, novelCraftPath: string) =>
    listSkills(novelCraftPath)
  );

  ipcMain.handle(
    'skills:readDefault',
    async (_e, slug: string, relPath: string, novelCraftPath: string) =>
      readDefaultFile(novelCraftPath, slug, relPath)
  );

  ipcMain.handle('skills:readOverride', async (_e, slug: string, relPath: string) =>
    readOverrideFile(slug, relPath)
  );

  ipcMain.handle('skills:hasOverride', (_e, slug: string, relPath: string) =>
    existsSync(skillFileOverridePath(slug, relPath))
  );

  ipcMain.handle(
    'skills:saveOverride',
    async (_e, slug: string, relPath: string, content: string) =>
      saveOverrideFile(slug, relPath, content)
  );

  ipcMain.handle(
    'skills:deleteOverride',
    async (_e, slug: string, relPath: string) => deleteOverrideFile(slug, relPath)
  );

  ipcMain.handle('skills:overrideDir', () => skillsOverrideDir());
}
