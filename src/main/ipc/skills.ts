import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Skill body loader.
 *
 * Skills live at <novelCraftPath>/skills/<slug>/SKILL.md (Claude Code shape).
 * The workflow engine auto-loads one skill per action based on a fixed
 * action→slug mapping (see workflow.ts DEFAULT_SKILL_BY_ACTION).
 *
 * If the skill directory has a `reference/` subdirectory, all .md files
 * inside it are appended after SKILL.md in filename-sorted order — each
 * preceded by an H2 heading. Mirrors the SKILL.md convention "按需查阅
 * reference/*.md"; in Orchid's single-turn mode the LLM can't pull files
 * mid-conversation, so we pre-bake them. Frontmatter is stripped from
 * every .md.
 */

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
}

async function readReferenceFiles(skillDir: string): Promise<string> {
  const refDir = join(skillDir, 'reference');
  if (!existsSync(refDir)) return '';
  let entries: string[];
  try {
    entries = await readdir(refDir);
  } catch {
    return '';
  }
  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();
  const parts: string[] = [];
  for (const f of mdFiles) {
    try {
      const body = stripFrontmatter(await readFile(join(refDir, f), 'utf-8')).trim();
      if (body) parts.push(`## 参考｜${f.replace(/\.md$/, '')}\n\n${body}`);
    } catch {
      // skip unreadable reference
    }
  }
  return parts.join('\n\n');
}

export async function readSkillBody(
  novelCraftPath: string,
  slug: string
): Promise<string> {
  if (!novelCraftPath || !slug) return '';
  const skillDir = join(novelCraftPath, 'skills', slug);
  const main = join(skillDir, 'SKILL.md');
  if (!existsSync(main)) return '';

  let mainBody: string;
  try {
    mainBody = stripFrontmatter(await readFile(main, 'utf-8')).trim();
  } catch {
    return '';
  }

  const refBody = await readReferenceFiles(skillDir);
  return refBody ? `${mainBody}\n\n${refBody}` : mainBody;
}
