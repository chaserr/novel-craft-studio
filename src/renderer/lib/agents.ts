import type { AgentMeta, AgentRole } from '../../shared/types';

/** 12 通用 novel-* agents — matches `<NovelCraftPath>/agents/novel-*.md`. */
export const AGENTS: AgentMeta[] = [
  {
    id: 'novel-writer',
    label: '写作者',
    shortDescription: '正文写作 / 章节生成 / 续写 / 扩写'
  },
  {
    id: 'novel-polisher',
    label: '润色师',
    shortDescription: '风格统一 / 陈词滥调清除 / 句式打磨'
  },
  {
    id: 'novel-auditor',
    label: '审计员',
    shortDescription: '逻辑 / 设定 / 时间线一致性核查'
  },
  {
    id: 'novel-pacer',
    label: '节奏师',
    shortDescription: '爽点密度 / 情绪曲线 / 章末拉力'
  },
  {
    id: 'novel-plotter',
    label: '剧情/伏笔',
    shortDescription: '伏笔追踪 / 支线管理 / 情感账单'
  },
  {
    id: 'novel-dialogist',
    label: '对话编辑',
    shortDescription: '角色对话差异化 / 对白自然度'
  },
  {
    id: 'novel-scene-refiner',
    label: '场景编辑',
    shortDescription: '场景描写 / 感官层次 / 氛围'
  },
  {
    id: 'novel-reader',
    label: '读者评审',
    shortDescription: '目标读者主观反馈 / 试读评分'
  },
  {
    id: 'novel-researcher',
    label: '资料考证',
    shortDescription: '背景真实性 / 时代细节 / 专业领域'
  },
  {
    id: 'novel-architect',
    label: '架构师',
    shortDescription: '世界观 / 大纲 / 全书结构'
  },
  {
    id: 'novel-memory',
    label: '记忆体',
    shortDescription: '跨章状态 / 上下文摘要 / 连续性'
  },
  {
    id: 'novel-curator',
    label: '质量管理',
    shortDescription: '多轮审稿提炼 / 作者写作档案'
  }
];

export function agentLabel(id: AgentRole): string {
  return AGENTS.find((a) => a.id === id)?.label ?? id;
}
