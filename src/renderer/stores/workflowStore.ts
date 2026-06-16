import { create } from 'zustand';
import type {
  AgentRole,
  WorkflowAction,
  WorkflowConfig,
  WorkflowEvent,
  WorkflowRange,
  WorkflowResult,
  WorkflowSubtask
} from '../../shared/types';
import { api } from '../lib/ipc';
import { useSettings } from './settingsStore';
import { useProject } from './projectStore';

interface WorkflowState {
  /** User-facing configuration in the right panel. */
  action: WorkflowAction;
  roles: AgentRole[];
  range: WorkflowRange;

  /** Currently running workflow. */
  running: boolean;
  activeRequestId: string | null;
  subtasks: WorkflowSubtask[];
  result: WorkflowResult | null;
  error: string | null;

  // ----- setters -----
  setAction: (a: WorkflowAction) => void;
  setRoles: (r: AgentRole[]) => void;
  toggleRole: (r: AgentRole) => void;
  setRange: (r: WorkflowRange) => void;

  // ----- runtime -----
  run: (chapterPaths: string[], projectRoot: string, novelCraftPath: string) => Promise<void>;
  cancel: () => Promise<void>;
  clearResult: () => void;
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
    if (e.requestId !== s.activeRequestId) return;
    switch (e.type) {
      case 'subtask-chunk': {
        const next = s.subtasks.map((t) =>
          t.id === e.subtaskId
            ? { ...t, status: 'running' as const, output: t.output + (e.delta ?? '') }
            : t
        );
        set({ subtasks: next });
        break;
      }
      case 'subtask-done': {
        const next = s.subtasks.map((t) =>
          t.id === e.subtaskId ? { ...t, status: 'done' as const } : t
        );
        set({ subtasks: next });
        break;
      }
      case 'subtask-error': {
        const next = s.subtasks.map((t) =>
          t.id === e.subtaskId
            ? { ...t, status: 'error' as const, error: e.message ?? 'unknown' }
            : t
        );
        set({ subtasks: next });
        break;
      }
      case 'workflow-done': {
        set({ running: false, activeRequestId: null });
        // Workflow may create new files (new chapter, review report, …);
        // refresh the project tree so they show up in the sidebar.
        void useProject.getState().refreshFiles();
        break;
      }
      case 'workflow-error': {
        set({ running: false, activeRequestId: null, error: e.message ?? 'workflow failed' });
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

    running: false,
    activeRequestId: null,
    subtasks: [],
    result: null,
    error: null,

    setAction: (a) => {
      // Switching action resets default roles
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

    run: async (chapterPaths, projectRoot, novelCraftPath) => {
      if (get().running) return;
      const settings = useSettings.getState().settings;
      const config: WorkflowConfig = {
        action: get().action,
        roles: get().roles,
        range: get().range,
        provider: settings.activeProvider,
        model: settings.models[settings.activeProvider]
      };
      const requestId = genId();
      const subtasks: WorkflowSubtask[] = config.roles.map((r) => ({
        id: genId(),
        role: r,
        status: 'pending',
        output: ''
      }));
      set({
        running: true,
        activeRequestId: requestId,
        subtasks,
        result: null,
        error: null
      });
      try {
        await api.workflow.run({
          requestId,
          config,
          chapterPaths,
          projectRoot,
          novelCraftPath
        });
      } catch (err) {
        set({
          running: false,
          activeRequestId: null,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    },

    cancel: async () => {
      const id = get().activeRequestId;
      if (id) await api.workflow.cancel(id);
      set({ running: false, activeRequestId: null });
    },

    clearResult: () => set({ result: null, error: null, subtasks: [] })
  };
});
