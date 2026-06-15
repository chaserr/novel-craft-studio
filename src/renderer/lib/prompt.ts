import { api } from './ipc';
import type { ProjectFileEntry } from '../../shared/types';

/**
 * 组装传给 LLM 的 system prompt。
 *
 * 优先级：
 * 1. RTK.md（题材气质、文风底线）—— 最高
 * 2. 当前打开章节的上下文（前/后片段）
 * 3. 大纲与章节大纲（摘要）
 */
export async function buildSystemPrompt(opts: {
  rootPath: string | null;
  files: ProjectFileEntry[];
  activeFilePath: string | null;
  activeFileContent: string;
}): Promise<string> {
  const parts: string[] = [];
  parts.push(
    '你是一位长篇小说写作助手。严格遵守下方"项目规则（RTK.md）"。'
  );

  if (opts.rootPath) {
    const rtk = opts.files.find((f) => f.category === 'rtk');
    if (rtk) {
      try {
        const content = await api.files.read(rtk.path);
        parts.push('\n## 项目规则（RTK.md）\n\n' + content);
      } catch {}
    }

    const outline = opts.files.find((f) => f.category === 'outline');
    if (outline) {
      try {
        const content = await api.files.read(outline.path);
        parts.push('\n## 小说大纲\n\n' + content.slice(0, 4000));
      } catch {}
    }
  }

  if (opts.activeFilePath) {
    const name = opts.activeFilePath.split('/').pop() ?? '';
    parts.push(
      `\n## 当前正在编辑的文件：${name}\n\n` +
        '以下是文件当前内容片段（最多 2000 字）：\n\n```\n' +
        opts.activeFileContent.slice(0, 2000) +
        '\n```'
    );
  }

  parts.push(
    '\n## 行为准则\n' +
      '- 不要写空洞的金句作为人物对白\n' +
      '- 不要用"她忽然意识到……"类内心独白复述前面的场景\n' +
      '- 章节结尾避免"感悟收束"模板，多用未完动作 / 物件落定 / 跨场景叠加等结构\n' +
      '- 每段至少有一个信息量推进\n' +
      '- 对话符合人物身份与年龄\n'
  );

  return parts.join('\n');
}
