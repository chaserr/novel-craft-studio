import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Skill body loader.
 *
 * Skills live at <novelCraftPath>/skills/<slug>/SKILL.md (Claude Code shape).
 * The workflow engine auto-loads one skill per action based on a fixed
 * action→slug mapping (see workflow.ts DEFAULT_SKILL_BY_ACTION) and appends
 * the body to the system prompt. Frontmatter is stripped.
 */

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

export async function readSkillBody(
  novelCraftPath: string,
  slug: string
): Promise<string> {
  if (!novelCraftPath || !slug) return '';
  const path = join(novelCraftPath, 'skills', slug, 'SKILL.md');
  if (!existsSync(path)) return '';
  try {
    const raw = await readFile(path, 'utf-8');
    return stripFrontmatter(raw).trim();
  } catch {
    return '';
  }
}
