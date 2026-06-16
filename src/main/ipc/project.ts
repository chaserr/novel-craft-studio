import { ipcMain, dialog } from 'electron';
import { readFile, writeFile, mkdir, readdir, stat, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import type {
  NewProjectFields,
  ProjectFileEntry,
  ProjectMeta,
  Volume
} from '../../shared/types';
import { getSettings } from './keychain';

/* ---------- categorize a file by its name ---------- */

function categorize(name: string, isDir: boolean): ProjectFileEntry['category'] {
  if (isDir) {
    if (name === '人物档案') return 'character';
    if (name === '写作技巧') return 'craft';
    if (name === '审稿报告') return 'review';
    return 'other';
  }
  if (name === 'RTK.md') return 'rtk';
  if (name === '小说大纲.md') return 'outline';
  if (name === '章节大纲.md') return 'chapter-outline';
  if (name === '前情梳理.md') return 'recap';
  if (name === '伏笔清单.md') return 'foreshadow';
  if (name === '经典语录.md') return 'quotes';
  if (/-第\d+章-.+\.md$/.test(name)) return 'chapter';
  return 'other';
}

/* ---------- scan a project dir recursively (1 level only — chapters are flat) ---------- */

const CHAPTER_NUM_RE = /-第(\d+)章-/;

async function scanProject(rootPath: string): Promise<ProjectFileEntry[]> {
  const entries: ProjectFileEntry[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    const names = await readdir(dir);
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const abs = join(dir, name);
      const s = await stat(abs);
      const isDir = s.isDirectory();
      const cat = categorize(name, isDir);
      const entry: ProjectFileEntry = {
        path: abs,
        relPath: relative(rootPath, abs),
        name,
        category: cat,
        isDir
      };
      if (cat === 'chapter') {
        const m = CHAPTER_NUM_RE.exec(name);
        if (m) entry.chapterNumber = parseInt(m[1], 10);
        try {
          const body = await readFile(abs, 'utf-8');
          // 章节文件如果只有少量内容（< 200 字符）视为骨架未写
          entry.hasContent = body.replace(/^\s+|\s+$/g, '').length > 200;
        } catch {
          entry.hasContent = false;
        }
      }
      entries.push(entry);
      if (isDir && depth < 2) await walk(abs, depth + 1);
    }
  }

  await walk(rootPath, 0);
  return entries;
}

/* ---------- parse volume structure from 章节大纲.md ---------- */

const VOLUME_HEADING_RE = /^##\s+(第[一二三四五六七八九十百千\d]+卷[^\n]*)$/m;
const VOLUME_HEADING_GLOBAL = /^##\s+(第[一二三四五六七八九十百千\d]+卷[^\n]*)$/gm;

async function parseVolumes(files: ProjectFileEntry[]): Promise<Volume[]> {
  const outlineFile = files.find((f) => f.category === 'chapter-outline');
  if (!outlineFile) return defaultSingleVolume(files);

  let content: string;
  try {
    content = await readFile(outlineFile.path, 'utf-8');
  } catch {
    return defaultSingleVolume(files);
  }

  const headings: { title: string; offset: number }[] = [];
  let match;
  const re = new RegExp(VOLUME_HEADING_GLOBAL);
  while ((match = re.exec(content)) !== null) {
    headings.push({ title: match[1].trim(), offset: match.index });
  }
  if (headings.length === 0) return defaultSingleVolume(files);

  // For each volume heading, find chapter numbers mentioned in its section.
  const chapterRe = /第(\d+)章/g;
  const volumes: Volume[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].offset;
    const end = i + 1 < headings.length ? headings[i + 1].offset : content.length;
    const section = content.slice(start, end);
    const nums = new Set<number>();
    let cm;
    const subRe = new RegExp(chapterRe);
    while ((cm = subRe.exec(section)) !== null) nums.add(parseInt(cm[1], 10));
    if (nums.size === 0) continue;
    const sorted = [...nums].sort((a, b) => a - b);
    volumes.push({
      index: i + 1,
      title: headings[i].title,
      startChapter: sorted[0],
      endChapter: sorted[sorted.length - 1]
    });
  }

  return volumes.length > 0 ? volumes : defaultSingleVolume(files);
}

function defaultSingleVolume(files: ProjectFileEntry[]): Volume[] {
  const chaps = files
    .filter((f) => f.category === 'chapter' && f.chapterNumber)
    .map((f) => f.chapterNumber!);
  if (chaps.length === 0) return [];
  return [
    {
      index: 1,
      title: '全书',
      startChapter: Math.min(...chaps),
      endChapter: Math.max(...chaps)
    }
  ];
}

/* ---------- detect book title from chapter naming pattern or RTK.md ---------- */

function detectBookTitle(files: ProjectFileEntry[], rootPath: string): string {
  const chapter = files.find((f) => f.category === 'chapter');
  if (chapter) {
    const m = /^(.+?)-第\d+章-/.exec(chapter.name);
    if (m) return m[1];
  }
  return basename(rootPath);
}

/* ---------- template rendering for novel-init ---------- */

function renderTemplate(content: string, fields: NewProjectFields): string {
  const toneList = fields.coreTone.map((t) => `- ${t}`).join('\n');
  const mainCharLines = fields.mainCharacters
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join('\n');
  return content
    .replace(/\{\{书名\}\}/g, fields.bookTitle)
    .replace(/\{\{题材标签\}\}/g, fields.genre)
    .replace(/\{\{目标读者-年龄段\}\}/g, fields.targetReader)
    .replace(/\{\{目标读者-性别倾向\}\}/g, '')
    .replace(/\{\{目标读者-阅读偏好\}\}/g, '')
    .replace(/\{\{目标读者画像\}\}/g, fields.targetReader)
    .replace(/\{\{核心气质 → 用 "- " 列出，每行一个\}\}/g, toneList)
    .replace(/\{\{主线人物 → 用 "- " 列出，"姓名：一句话设定"\}\}/g, mainCharLines)
    .replace(/\{\{对每个主线人物简要列出\}\}/g, mainCharLines)
    .replace(/\{\{写作平台\}\}/g, fields.platform)
    .replace(/\{\{篇幅预期\}\}/g, fields.scale)
    .replace(/\{\{是否多书同宇宙\}\}/g, fields.multiverse ? '是' : '否')
    .replace(/\{\{[^}]*\}\}/g, ''); // strip any remaining placeholders
}

/* ---------- copy + render novel-craft templates into a new project dir ---------- */

async function copyTemplates(
  novelCraftPath: string,
  targetDir: string,
  fields: NewProjectFields
): Promise<void> {
  const templatesRoot = join(novelCraftPath, 'templates');
  if (!existsSync(templatesRoot)) {
    throw new Error(
      `找不到 novel-craft templates 目录: ${templatesRoot}\n请在 Settings 中检查 novel-craft 仓库路径。`
    );
  }

  async function walkAndRender(srcDir: string, dstDir: string): Promise<void> {
    await mkdir(dstDir, { recursive: true });
    const names = await readdir(srcDir);
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const src = join(srcDir, name);
      const dst = join(dstDir, name);
      const s = await stat(src);
      if (s.isDirectory()) {
        await walkAndRender(src, dst);
      } else if (name.endsWith('.md')) {
        const raw = await readFile(src, 'utf-8');
        await writeFile(dst, renderTemplate(raw, fields), 'utf-8');
      } else {
        await cp(src, dst);
      }
    }
  }

  await walkAndRender(templatesRoot, targetDir);

  // 主角档案文件名：取主线人物第一个的姓名（在冒号前）
  const firstChar = fields.mainCharacters
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (firstChar) {
    const charName = firstChar.split(/[:：]/)[0].trim();
    if (charName) {
      const src = join(targetDir, '人物档案', '人物模板.md');
      const dst = join(targetDir, '人物档案', `${charName}.md`);
      if (existsSync(src)) {
        const raw = await readFile(src, 'utf-8');
        await writeFile(
          dst,
          raw.replace(/\{\{人物姓名\}\}/g, charName),
          'utf-8'
        );
      }
    }
  }
}

/* ---------- IPC registration ---------- */

export function registerProjectIpc(): void {
  ipcMain.handle('project:pickDirectory', async () => {
    const r = await dialog.showOpenDialog({
      title: '选择小说项目目录',
      properties: ['openDirectory', 'createDirectory']
    });
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  });

  ipcMain.handle('project:open', async (_e, rootPath: string) => {
    const files = await scanProject(rootPath);
    const volumes = await parseVolumes(files);
    const meta: ProjectMeta = {
      rootPath,
      bookTitle: detectBookTitle(files, rootPath),
      hasRtk: files.some((f) => f.category === 'rtk'),
      volumes
    };
    return { meta, files };
  });

  ipcMain.handle(
    'project:create',
    async (_e, fields: NewProjectFields, targetDir: string) => {
      const settings = getSettings();
      if (!settings.novelCraftPath) {
        throw new Error(
          '请先在 Settings 里指定 novel-craft 仓库的本地路径。'
        );
      }
      await copyTemplates(settings.novelCraftPath, targetDir, fields);
      const files = await scanProject(targetDir);
      const volumes = await parseVolumes(files);
      const meta: ProjectMeta = {
        rootPath: targetDir,
        bookTitle: fields.bookTitle,
        hasRtk: files.some((f) => f.category === 'rtk'),
        volumes
      };
      return { meta, files };
    }
  );
}
