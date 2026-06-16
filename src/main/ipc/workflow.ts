/**
 * Workflow engine — backend.
 *
 * Receives `workflow:run` requests from renderer with:
 *   - action     : which novel-craft skill to run
 *   - roles      : 1+ novel-* agents
 *   - range      : which chapters
 *   - provider/model : LLM target
 *   - chapterPaths   : already resolved by renderer
 *   - projectRoot    : project dir (to read RTK / outline / etc.)
 *   - novelCraftPath : agent prompts source
 *
 * For each role, builds a system prompt that combines:
 *   1. Claude Code prefix (added in anthropic adapter)
 *   2. Project RTK.md
 *   3. Agent's own system prompt (from novel-craft/agents/<role>.md)
 *   4. Workflow action context ("you are doing write-next for chapter X")
 *   5. Range chapter contents
 *
 * Then calls the per-role LLM stream IN PARALLEL, multiplexing chunks back
 * to renderer keyed by subtaskId.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { readFile, writeFile, mkdir, readdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import type {
  AgentRole,
  ChatMessage,
  WorkflowConfig,
  WorkflowEvent,
  WorkflowRunRequest
} from '../../shared/types';
import { getAdapter } from '../llm/registry';
import { resolveToken } from './cli-token';
import { getApiKey } from './keychain';

const activeRequests = new Map<string, AbortController>();

/* ---------- read RTK / outline / etc from project ---------- */

async function readIfExists(path: string, maxBytes = 50_000): Promise<string> {
  if (!existsSync(path)) return '';
  try {
    const s = await readFile(path, 'utf-8');
    return s.length > maxBytes ? s.slice(0, maxBytes) + '\n\n[…truncated]' : s;
  } catch {
    return '';
  }
}

async function readProjectContext(projectRoot: string): Promise<{
  rtk: string;
  outline: string;
  chapterOutline: string;
  recap: string;
  foreshadow: string;
}> {
  const [rtk, outline, chapterOutline, recap, foreshadow] = await Promise.all([
    readIfExists(join(projectRoot, 'RTK.md'), 30_000),
    readIfExists(join(projectRoot, '小说大纲.md'), 30_000),
    readIfExists(join(projectRoot, '章节大纲.md'), 30_000),
    readIfExists(join(projectRoot, '前情梳理.md'), 30_000),
    readIfExists(join(projectRoot, '伏笔清单.md'), 30_000)
  ]);
  return { rtk, outline, chapterOutline, recap, foreshadow };
}

/* ---------- read an agent's system prompt from novel-craft/agents/<id>.md ---------- */

/**
 * Read an agent's system prompt. Resolution order:
 *   1. customAgentsPath/<role>.md  (user override, optional)
 *   2. novelCraftPath/agents/<role>.md  (default novel-craft repo)
 * Lets users fork prompts without forking the whole novel-craft repo.
 */
async function readAgentPrompt(
  novelCraftPath: string,
  role: AgentRole,
  customAgentsPath?: string
): Promise<string> {
  const candidates: string[] = [];
  if (customAgentsPath && customAgentsPath.trim()) {
    candidates.push(join(customAgentsPath, `${role}.md`));
  }
  candidates.push(join(novelCraftPath, 'agents', `${role}.md`));

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = await readFile(path, 'utf-8');
      return raw.replace(/^---[\s\S]*?---\s*/, '').trim();
    } catch {
      // try next candidate
    }
  }
  return '';
}

/* ---------- format chapter content for prompt ---------- */

async function readChapters(chapterPaths: string[]): Promise<string> {
  if (chapterPaths.length === 0) return '';
  const parts: string[] = [];
  // Cap total to ~80k chars to avoid massive prompts
  let total = 0;
  const cap = 80_000;
  for (const p of chapterPaths) {
    if (total >= cap) {
      parts.push(`\n\n[…后续章节因长度限制省略]`);
      break;
    }
    try {
      const body = await readFile(p, 'utf-8');
      const name = basename(p);
      const trimmed =
        total + body.length > cap ? body.slice(0, cap - total) + '\n[…截断]' : body;
      total += trimmed.length;
      parts.push(`\n\n=== ${name} ===\n\n${trimmed}`);
    } catch {
      // ignore single chapter read failure
    }
  }
  return parts.join('');
}

/* ---------- build per-role system prompt ---------- */

interface BuildPromptArgs {
  role: AgentRole;
  config: WorkflowConfig;
  novelCraftPath: string;
  customAgentsPath?: string;
  projectRoot: string;
  chapterPaths: string[];
  /** 用户在 UI 里补充的故事简述（项目字段稀疏时用）。 */
  extraContext?: string;
}

async function buildSystemPrompt(args: BuildPromptArgs): Promise<{
  system: string;
  user: string;
}> {
  const ctx = await readProjectContext(args.projectRoot);
  const agentPrompt = await readAgentPrompt(args.novelCraftPath, args.role, args.customAgentsPath);
  const chapters = await readChapters(args.chapterPaths);

  const actionDirective = describeAction(args.config);

  const systemParts: string[] = [];
  if (ctx.rtk) systemParts.push(`# 项目规则（RTK.md，最高优先级）\n\n${ctx.rtk}`);
  if (agentPrompt) systemParts.push(`# 你的角色\n\n${agentPrompt}`);
  systemParts.push(`# 当前任务\n\n${actionDirective}`);

  const userParts: string[] = [];
  // 用户在 UI 里补的故事简述放最前，优先级最高 — 这是 RTK 之外作者的"原始意图"。
  if (args.extraContext && args.extraContext.trim())
    userParts.push(`## 作者补充的故事简述（高优先级）\n\n${args.extraContext.trim()}`);
  if (ctx.outline)
    userParts.push(`## 小说大纲\n\n${ctx.outline}`);
  if (ctx.chapterOutline)
    userParts.push(`## 章节大纲（窗口）\n\n${ctx.chapterOutline}`);
  if (ctx.recap)
    userParts.push(`## 前情梳理（最近章节摘要）\n\n${ctx.recap}`);
  if (ctx.foreshadow)
    userParts.push(`## 伏笔清单（活跃 / 待回收）\n\n${ctx.foreshadow}`);
  if (chapters)
    userParts.push(`## 范围内章节正文\n${chapters}`);

  return {
    system: systemParts.join('\n\n'),
    user: userParts.join('\n\n')
  };
}

function describeAction(config: WorkflowConfig): string {
  switch (config.action) {
    case 'write-next':
      return (
        '请按章节大纲生成下一未完成章节的完整正文。要求：\n' +
        '- 严格遵守 RTK.md 的题材气质与文风约束\n' +
        '- 字数依平台与篇幅预期判断（出版向 4000-6000，网文向 2000-4000）\n' +
        '- 章末必须有 A/B 级钩子（不可平铺收束）\n' +
        '- 自然埋入 1-2 个伏笔（如有合适机会）\n' +
        '- **直接输出章节正文 markdown 内容**，不要任何解释 / 总结 / 元评论\n' +
        '- 文件头加一行 yaml frontmatter：```---\\nchapter: N\\ntitle: 章名\\n---```'
      );
    case 'continue':
      return (
        '请在"范围内章节正文"的末尾**追加**约 800-1500 字的延续内容。不要重写已有部分。' +
        '保持原章节的语气、节奏、视角、情绪基调。直接输出追加内容。'
      );
    case 'sync':
      return (
        '阅读范围章节后，按以下结构输出同步内容（markdown 表格 + 列表）：\n\n' +
        '## 1. 前情梳理新增条目\n[200-400 字摘要]\n\n' +
        '## 2. 涉及人物状态变化\n[逐人物列出]\n\n' +
        '## 3. 伏笔清单变更\n- 新埋：…\n- 兑现：…\n- 推进：…\n\n' +
        '## 4. 经典语录候选（0-3 句，宁缺毋滥）\n- 「…」（说话人）\n\n' +
        '只输出本结构。不写其他文字。'
      );
    case 'review':
      return (
        '按你的角色专长审查范围章节，输出结构化报告。' +
        '不要重写章节，只标记问题 + 给具体修改建议（含位置引用）。'
      );
    case 'polish':
      return (
        '按 zh-novel-polish 的"八大叙事病灶"清单扫描范围章节。逐段输出：\n' +
        '【原文】「…」\n【病灶】病灶 N（描述）\n【润色版】「…」\n【说明】[一句话]\n\n' +
        '不要修改情节事实、人物关系、伏笔走向。' +
        '改动量 > 30% 的段落不要给修改版，标"建议作者重写"。'
      );
    case 'draft-rtk':
      return (
        '基于项目已有的 RTK.md 框架（在用户消息里）和新建项目时填写的字段，**补全所有占位符 + 完善细节**：\n' +
        '- §1 项目目标：让核心气质的描述更具体\n' +
        '- §4.3 套话黑名单：按题材添加 5-10 个针对性短语\n' +
        '- §5 文风要求：把"细腻但不滥情"等抽象要求落到 3-5 条具体可检查的规则\n' +
        '- §5.3 感情线要求（如适用）：按题材定制（校园青春 vs 都市悬疑 vs 武侠等差异巨大）\n' +
        '- §5.4 时代/世界线要求：按题材给出具体的"通过哪类细节体现"\n\n' +
        '**直接输出完整 RTK.md 内容**（覆盖式）。保持现有 markdown 结构和 § 编号不变。不要任何解释。'
      );
    case 'draft-outline':
      return (
        '基于项目 RTK.md（题材、读者、核心气质、主线人物、篇幅预期），起草《小说大纲.md》：\n' +
        '- 一句话故事（核心冲突）\n' +
        '- 四幕结构：每幕的功能、关键节点、结尾点\n' +
        '- 情绪曲线草图（用 ↑↓→⚡💧🔥 标注每幕的情绪基调）\n' +
        '- 3-5 个对全书有结构意义的大伏笔\n' +
        '- 2-3 条主要支线\n' +
        '- 不可触碰的禁区（基于 RTK 红线）\n\n' +
        '**直接输出完整 markdown 内容**（覆盖式）。要具体，不要"待补"占位符。'
      );
    case 'draft-chapter-outline':
      return (
        '基于已有的小说大纲，起草前 10 章的详细《章节大纲.md》：\n' +
        '- 每章用统一格式：位置（哪幕）/ 情绪基调 / 字数预期 / 核心功能 / 主要节点（2-3 个）/ 场景 / 关系变化点 / 人物内心变化点 / 本章埋伏笔 / 本章回收伏笔 / 章尾结构 / 章尾钩子\n' +
        '- 章尾结构必须多样化（未完动作 / 物件落定 / 跨场景叠加 / 群消息切断 / 对话未完 / 未发生的事 等，不可连续同款）\n' +
        '- 第 1-3 章是黄金三章：每章都要有强钩子\n' +
        '- 字数预期按 RTK 的写作平台调整\n\n' +
        '**直接输出完整 markdown 内容**（覆盖式）。'
      );
    case 'free-chat':
      return '与作者自由对话，回答关于这本小说的边角问题。';
  }
}

/* ---------- IPC registration ---------- */

export function registerWorkflowIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('workflow:run', async (_e, req: WorkflowRunRequest) => {
    const send = (e: WorkflowEvent): void => {
      getWindow()?.webContents.send('workflow:event', e);
    };

    const controller = new AbortController();
    activeRequests.set(req.requestId, controller);

    const token = await resolveToken(req.config.provider, () =>
      getApiKey(req.config.provider)
    );
    if (!token) {
      send({
        requestId: req.requestId,
        type: 'workflow-error',
        message: `${req.config.provider} 未配置可用凭证`
      });
      activeRequests.delete(req.requestId);
      return;
    }

    const adapter = getAdapter(req.config.provider);

    // Collect each subtask's final text by snapshotting chunks
    const subtaskOutputs: { role: AgentRole; text: string }[] = [];
    const collectChunk = (role: AgentRole, delta: string): void => {
      let entry = subtaskOutputs.find((s) => s.role === role);
      if (!entry) {
        entry = { role, text: '' };
        subtaskOutputs.push(entry);
      }
      entry.text += delta;
    };

    // Wrap tasks: tap chunks so we can persist results when the workflow completes
    const tappedTasks = req.config.roles.map(async (role, idx) => {
      const subtaskId = `${req.requestId}-${idx}`;
      const { system, user } = await buildSystemPrompt({
        role,
        config: req.config,
        novelCraftPath: req.novelCraftPath,
        customAgentsPath: req.customAgentsPath,
        projectRoot: req.projectRoot,
        chapterPaths: req.chapterPaths,
        extraContext: req.extraContext
      });
      const messages: ChatMessage[] = [{ role: 'user', content: user }];
      return new Promise<void>((resolve) => {
        adapter
          .streamChat({
            token,
            model: req.config.model || adapter.defaultModel,
            systemPrompt: system,
            messages,
            abortSignal: controller.signal,
            onChunk: (delta) => {
              collectChunk(role, delta);
              send({
                requestId: req.requestId,
                type: 'subtask-chunk',
                subtaskId,
                role,
                delta
              });
            },
            onDone: () => {
              send({
                requestId: req.requestId,
                type: 'subtask-done',
                subtaskId,
                role
              });
              resolve();
            },
            onError: (err) => {
              send({
                requestId: req.requestId,
                type: 'subtask-error',
                subtaskId,
                role,
                message: err.message
              });
              resolve();
            }
          })
          .catch((err: unknown) => {
            send({
              requestId: req.requestId,
              type: 'subtask-error',
              subtaskId,
              role,
              message: err instanceof Error ? err.message : String(err)
            });
            resolve();
          });
      });
    });
    try {
      await Promise.all(tappedTasks);
      // Persist results based on action
      try {
        await persistWorkflowOutput({
          action: req.config.action,
          subtasks: subtaskOutputs,
          projectRoot: req.projectRoot,
          chapterPaths: req.chapterPaths
        });
      } catch (err) {
        console.error('[workflow] persist failed', err);
      }
      send({ requestId: req.requestId, type: 'workflow-done' });
    } finally {
      activeRequests.delete(req.requestId);
    }
  });

  ipcMain.handle('workflow:cancel', (_e, requestId: string) => {
    const c = activeRequests.get(requestId);
    c?.abort();
    activeRequests.delete(requestId);
  });
}

/* ========================================================================== */
/*                            Output persistence                              */
/* ========================================================================== */

interface PersistArgs {
  action: WorkflowConfig['action'];
  subtasks: { role: AgentRole; text: string }[];
  projectRoot: string;
  chapterPaths: string[];
}

async function persistWorkflowOutput(args: PersistArgs): Promise<void> {
  switch (args.action) {
    case 'write-next':
      await persistWriteNext(args);
      break;
    case 'continue':
      await persistContinue(args);
      break;
    case 'review':
      await persistReviewReport(args);
      break;
    case 'draft-rtk':
      await persistDraftToFile(args, 'RTK.md');
      break;
    case 'draft-outline':
      await persistDraftToFile(args, '小说大纲.md');
      break;
    case 'draft-chapter-outline':
      await persistDraftToFile(args, '章节大纲.md');
      break;
    case 'sync':
    case 'polish':
    case 'free-chat':
      // These actions present results in UI for user accept/reject; no auto-write.
      break;
  }
}

/** Overwrite a project-root file with the LLM output (with a one-line preamble). */
async function persistDraftToFile(
  args: PersistArgs,
  relativePath: string
): Promise<void> {
  const text = args.subtasks[0]?.text;
  if (!text) return;
  const target = join(args.projectRoot, relativePath);
  // Strip leading "```markdown" / "```" code fence if model wrapped output
  const cleaned = text
    .replace(/^```(?:markdown|md)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();
  await writeFile(target, cleaned + '\n', 'utf-8');
}

/** Read book title and detect next unwritten chapter number from existing files. */
async function detectBookContext(
  projectRoot: string
): Promise<{ bookTitle: string; nextChapterNumber: number; chapterOutlineRaw: string }> {
  const outline = await readIfExists(join(projectRoot, '章节大纲.md'), 30_000);
  let bookTitle = basename(projectRoot);
  let maxN = 0;
  const dirents = await readdir(projectRoot);
  for (const name of dirents) {
    const m = /^(.+?)-第(\d+)章-/.exec(name);
    if (m) {
      bookTitle = m[1];
      const n = parseInt(m[2], 10);
      if (n > maxN) maxN = n;
    }
  }
  return { bookTitle, nextChapterNumber: maxN + 1, chapterOutlineRaw: outline };
}

/** Try to extract `章名` from LLM output's yaml frontmatter or first markdown heading. */
function extractChapterTitle(text: string, fallbackChapter: number): string {
  const fmMatch = /^---\s*\n([\s\S]*?)\n---/.exec(text);
  if (fmMatch) {
    const titleMatch = /title:\s*(.+)/.exec(fmMatch[1]);
    if (titleMatch) return titleMatch[1].trim();
  }
  const hdr = /^#\s+(.+)$/m.exec(text);
  if (hdr) return hdr[1].trim().replace(/[\\/:?"<>|]/g, '');
  return `第${fallbackChapter}章`;
}

async function persistWriteNext(args: PersistArgs): Promise<void> {
  const text = args.subtasks[0]?.text;
  if (!text) return;
  const ctx = await detectBookContext(args.projectRoot);
  const chapterTitle = extractChapterTitle(text, ctx.nextChapterNumber);
  const safeTitle = chapterTitle.replace(/[\\/:?"<>|]/g, '').slice(0, 30);
  const fileName = `${ctx.bookTitle}-第${ctx.nextChapterNumber}章-${safeTitle}.md`;
  const target = join(args.projectRoot, fileName);
  await writeFile(target, text, 'utf-8');
}

async function persistContinue(args: PersistArgs): Promise<void> {
  const text = args.subtasks[0]?.text;
  if (!text || args.chapterPaths.length === 0) return;
  // Append to the (first) current chapter
  const target = args.chapterPaths[0];
  await appendFile(target, `\n\n${text}`, 'utf-8');
}

async function persistReviewReport(args: PersistArgs): Promise<void> {
  if (args.subtasks.length === 0) return;
  const reportDir = join(args.projectRoot, '审稿报告');
  await mkdir(reportDir, { recursive: true });
  // Determine batch number
  const existing = (await readdir(reportDir).catch(() => [] as string[])).filter((n) =>
    /^审稿-第\d+批/.test(n)
  );
  const batch = existing.length + 1;
  const batchStr = String(batch).padStart(2, '0');

  // Try to determine chapter range from paths
  const chapterNums = args.chapterPaths
    .map((p) => /-第(\d+)章-/.exec(basename(p))?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n!, 10))
    .sort((a, b) => a - b);
  const rangeStr =
    chapterNums.length > 0
      ? `第${chapterNums[0]}-${chapterNums[chapterNums.length - 1]}章`
      : '范围未知';

  const fileName = `审稿-第${batchStr}批-${rangeStr}.md`;
  const target = join(reportDir, fileName);

  const sections = args.subtasks
    .map((st) => `## ${st.role}\n\n${st.text}`)
    .join('\n\n---\n\n');
  const header = `# 审稿报告 第 ${batch} 批 — ${rangeStr}\n\n生成时间：${new Date().toISOString()}\n\n召唤角色：${args.subtasks.map((s) => s.role).join(', ')}\n\n`;
  await writeFile(target, header + sections, 'utf-8');
}
