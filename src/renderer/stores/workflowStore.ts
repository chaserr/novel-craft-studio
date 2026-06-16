import { create } from 'zustand';
import { notifications } from '@mantine/notifications';
import type {
  AgentRole,
  WorkflowAction,
  WorkflowConfig,
  WorkflowEvent,
  WorkflowRange,
  WorkflowSubtask
} from '../../shared/types';
import { api } from '../lib/ipc';
import { useSettings } from './settingsStore';
import { useProject } from './projectStore';

/**
 * 一次 workflow 执行的快照 —— action + roles + range + 实时 subtasks。
 * 多个 RunState 可以同时存在（同类型互斥，但 RTK / 大纲 / 章节大纲 / 审稿 等不同 action 可并发）。
 */
export interface RunState {
  id: string;
  action: WorkflowAction;
  roles: AgentRole[];
  range: WorkflowRange;
  subtasks: WorkflowSubtask[];
  status: 'running' | 'done' | 'error';
  error?: string;
  startedAt: number;
}

interface WorkflowState {
  /** 右栏 form 当前选择（不是某次具体执行的快照）。 */
  action: WorkflowAction;
  roles: AgentRole[];
  range: WorkflowRange;

  /** 所有 run 实例（含进行中 + 已完成 / 出错），按 id 索引。 */
  runs: Record<string, RunState>;
  /** WorkflowResultView 展示的是哪个 run。新 run 启动时自动选中它。 */
  selectedRunId: string | null;

  // ----- setters -----
  setAction: (a: WorkflowAction) => void;
  setRoles: (r: AgentRole[]) => void;
  toggleRole: (r: AgentRole) => void;
  setRange: (r: WorkflowRange) => void;
  selectRun: (id: string | null) => void;

  // ----- runtime -----
  /**
   * 用当前 store 里的 action / roles / range 启动一次 workflow。
   * 同类型已经在跑 → 拒绝；RTK 稀疏且无 extraContext → 拒绝。
   */
  run: (
    chapterPaths: string[],
    projectRoot: string,
    novelCraftPath: string,
    extraContextOverride?: string
  ) => Promise<void>;
  cancel: (runId: string) => Promise<void>;
  clearRun: (runId: string) => void;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DEFAULT_ROLES_BY_ACTION: Record<WorkflowAction, AgentRole[]> = {
  'write-next': ['novel-writer'],
  continue: ['novel-writer'],
  sync: ['novel-memory'],
  review: [
    'novel-architect',
    'novel-pacer',
    'novel-plotter',
    'novel-auditor',
    'novel-reader'
  ],
  polish: ['novel-polisher'],
  'draft-rtk': ['novel-architect'],
  'draft-outline': ['novel-architect'],
  'draft-chapter-outline': ['novel-architect'],
  'free-chat': []
};

let unsubscribe: (() => void) | null = null;

function ensureListener(
  state: () => WorkflowState,
  set: (p: Partial<WorkflowState>) => void
): void {
  if (unsubscribe) return;
  unsubscribe = api.workflow.onEvent((e: WorkflowEvent) => {
    const s = state();
    const run = s.runs[e.requestId];
    if (!run) return;
    switch (e.type) {
      case 'subtask-chunk': {
        const subtasks = run.subtasks.map((t) =>
          t.id === e.subtaskId
            ? { ...t, status: 'running' as const, output: t.output + (e.delta ?? '') }
            : t
        );
        set({ runs: { ...s.runs, [run.id]: { ...run, subtasks } } });
        break;
      }
      case 'subtask-done': {
        const subtasks = run.subtasks.map((t) =>
          t.id === e.subtaskId ? { ...t, status: 'done' as const } : t
        );
        set({ runs: { ...s.runs, [run.id]: { ...run, subtasks } } });
        break;
      }
      case 'subtask-error': {
        const subtasks = run.subtasks.map((t) =>
          t.id === e.subtaskId
            ? { ...t, status: 'error' as const, error: e.message ?? 'unknown' }
            : t
        );
        set({ runs: { ...s.runs, [run.id]: { ...run, subtasks } } });
        break;
      }
      case 'workflow-done': {
        set({
          runs: {
            ...s.runs,
            [run.id]: { ...run, status: 'done' }
          }
        });
        // workflow 完成可能产生新文件 / 改了 RTK / 大纲 → 刷新项目树和 sparse 状态
        void useProject.getState().refreshFiles();
        break;
      }
      case 'workflow-error': {
        set({
          runs: {
            ...s.runs,
            [run.id]: {
              ...run,
              status: 'error',
              error: e.message ?? 'workflow failed'
            }
          }
        });
        break;
      }
    }
  });
}

export const useWorkflow = create<WorkflowState>((set, get) => {
  ensureListener(get, (p) => set(p));
  return {
    action: 'write-next',
    roles: ['novel-writer'],
    range: { type: 'chapter' },

    runs: {},
    selectedRunId: null,

    setAction: (a) => {
      set({ action: a, roles: DEFAULT_ROLES_BY_ACTION[a] });
    },
    setRoles: (r) => set({ roles: r }),
    toggleRole: (r) => {
      const cur = get().roles;
      set({
        roles: cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
      });
    },
    setRange: (r) => set({ range: r }),
    selectRun: (id) => set({ selectedRunId: id }),

    run: async (chapterPaths, projectRoot, novelCraftPath, extraContextOverride) => {
      const project = useProject.getState();
      const extraContext = extraContextOverride ?? project.extraContext;

      // 守门 1：RTK 稀疏 + 无简述 → 拒绝。
      if (project.rtkSparse && !extraContext.trim()) {
        notifications.show({
          title: '请先填写故事简述',
          message: '中栏「引导」页里 2-5 句描述题材 / 主线 / 主角，再启动 workflow。',
          color: 'yellow',
          autoClose: 4000
        });
        return;
      }

      const action = get().action;

      // 守门 2：同类型互斥 — 如果有 run 还在跑同样的 action，拒绝再开一个。
      const sameTypeRunning = Object.values(get().runs).find(
        (r) => r.action === action && r.status === 'running'
      );
      if (sameTypeRunning) {
        notifications.show({
          title: `「${action}」已经在执行`,
          message: '等当前的跑完再开下一个，或在 Workflow 结果页取消它。',
          color: 'yellow',
          autoClose: 3000
        });
        return;
      }

      const settings = useSettings.getState().settings;
      const roles = get().roles;
      const range = get().range;
      const config: WorkflowConfig = {
        action,
        roles,
        range,
        provider: settings.activeProvider,
        model: settings.models[settings.activeProvider]
      };
      const requestId = genId();
      // IMPORTANT: subtask id must match main process pattern `${requestId}-${idx}`
      const subtasks: WorkflowSubtask[] = roles.map((r, idx) => ({
        id: `${requestId}-${idx}`,
        role: r,
        status: 'pending',
        output: ''
      }));
      const newRun: RunState = {
        id: requestId,
        action,
        roles,
        range,
        subtasks,
        status: 'running',
        startedAt: Date.now()
      };
      set({
        runs: { ...get().runs, [requestId]: newRun },
        selectedRunId: requestId
      });

      try {
        await api.workflow.run({
          requestId,
          config,
          chapterPaths,
          projectRoot,
          novelCraftPath,
          extraContext: extraContext.trim() || undefined
        });
      } catch (err) {
        const r = get().runs[requestId];
        if (r) {
          set({
            runs: {
              ...get().runs,
              [requestId]: {
                ...r,
                status: 'error',
                error: err instanceof Error ? err.message : String(err)
              }
            }
          });
        }
      }
    },

    cancel: async (runId) => {
      await api.workflow.cancel(runId);
      const r = get().runs[runId];
      if (r && r.status === 'running') {
        set({
          runs: {
            ...get().runs,
            [runId]: { ...r, status: 'error', error: '已取消' }
          }
        });
      }
    },

    clearRun: (runId) => {
      const { [runId]: _gone, ...rest } = get().runs;
      const next: Partial<WorkflowState> = { runs: rest };
      if (get().selectedRunId === runId) {
        // 选下一个：优先选还在跑的；都没有就清空
        const stillRunning = Object.values(rest).find((r) => r.status === 'running');
        next.selectedRunId = stillRunning?.id ?? null;
      }
      set(next);
    }
  };
});

/* -------------------- 派生 selectors -------------------- */

/** 任何 run 正在跑？（粗粒度，给"是否要禁用全局 stop"用） */
export function useAnyRunning(): boolean {
  return useWorkflow((s) =>
    Object.values(s.runs).some((r) => r.status === 'running')
  );
}

/** 指定 action 当前是否有 run 在执行 —— 同类型互斥的依据。 */
export function useIsActionRunning(action: WorkflowAction): boolean {
  return useWorkflow((s) =>
    Object.values(s.runs).some(
      (r) => r.action === action && r.status === 'running'
    )
  );
}

/** 按启动时间倒序拿到所有 run（active + 历史）。 */
export function useRunsByRecent(): RunState[] {
  return useWorkflow((s) =>
    Object.values(s.runs).sort((a, b) => b.startedAt - a.startedAt)
  );
}
