import { create } from 'zustand';
import type { NewProjectFields, ProjectFileEntry, ProjectMeta } from '../../shared/types';
import { api } from '../lib/ipc';
import { detectGenericSparse, detectRtkSparse } from '../lib/rtk';

interface OpenedProject {
  id: string;
  meta: ProjectMeta;
  files: ProjectFileEntry[];
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileDirty: boolean;
  selectedChapterPaths: string[];
  rtkSparse: boolean;
  outlineSparse: boolean;
  chapterOutlineSparse: boolean;
  extraContext: string;
}

interface ProjectState {
  opened: OpenedProject[];
  activeId: string | null;

  meta: ProjectMeta | null;
  files: ProjectFileEntry[];
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileDirty: boolean;
  selectedChapterPaths: string[];
  rtkSparse: boolean;
  outlineSparse: boolean;
  chapterOutlineSparse: boolean;
  extraContext: string;

  setExtraContext: (s: string) => void;

  openProject: (root: string) => Promise<void>;
  createProject: (fields: NewProjectFields, target: string) => Promise<void>;
  setActive: (id: string) => void;
  closeProjectById: (id: string) => void;

  openFile: (path: string) => Promise<void>;
  toggleChapterSelected: (path: string) => void;
  clearChapterSelection: () => void;
  setActiveContent: (s: string) => void;
  saveActiveFile: () => Promise<void>;
  reloadActiveFile: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  clearActiveFile: () => void;
  closeProject: () => void;
}

async function probeRtkSparse(files: ProjectFileEntry[]): Promise<boolean> {
  const rtk = files.find((f) => f.category === 'rtk');
  if (!rtk) return true;
  try {
    const c = await api.files.read(rtk.path);
    return detectRtkSparse(c);
  } catch {
    return true;
  }
}

async function probeFileSparse(
  files: ProjectFileEntry[],
  category: ProjectFileEntry['category'],
  threshold = 300
): Promise<boolean> {
  const f = files.find((x) => x.category === category);
  if (!f) return true;
  try {
    const c = await api.files.read(f.path);
    return detectGenericSparse(c, threshold);
  } catch {
    return true;
  }
}

async function probeAllSparse(
  files: ProjectFileEntry[]
): Promise<{
  rtkSparse: boolean;
  outlineSparse: boolean;
  chapterOutlineSparse: boolean;
}> {
  const [rtkSparse, outlineSparse, chapterOutlineSparse] = await Promise.all([
    probeRtkSparse(files),
    probeFileSparse(files, 'outline', 300),
    probeFileSparse(files, 'chapter-outline', 500)
  ]);
  return { rtkSparse, outlineSparse, chapterOutlineSparse };
}

function flatten(active: OpenedProject | null): {
  meta: ProjectMeta | null;
  files: ProjectFileEntry[];
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileDirty: boolean;
  selectedChapterPaths: string[];
  rtkSparse: boolean;
  outlineSparse: boolean;
  chapterOutlineSparse: boolean;
  extraContext: string;
} {
  if (!active)
    return {
      meta: null,
      files: [],
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: [],
      rtkSparse: false,
      outlineSparse: true,
      chapterOutlineSparse: true,
      extraContext: ''
    };
  return {
    meta: active.meta,
    files: active.files,
    activeFilePath: active.activeFilePath,
    activeFileContent: active.activeFileContent,
    activeFileDirty: active.activeFileDirty,
    selectedChapterPaths: active.selectedChapterPaths,
    rtkSparse: active.rtkSparse,
    outlineSparse: active.outlineSparse,
    chapterOutlineSparse: active.chapterOutlineSparse,
    extraContext: active.extraContext
  };
}

function patchActive(
  opened: OpenedProject[],
  activeId: string | null,
  patch: Partial<OpenedProject>
): { opened: OpenedProject[]; activeId: string | null } & ReturnType<typeof flatten> {
  if (!activeId) {
    return { opened, activeId, ...flatten(null) };
  }
  const next = opened.map((p) => (p.id === activeId ? { ...p, ...patch } : p));
  const active = next.find((p) => p.id === activeId) ?? null;
  return { opened: next, activeId, ...flatten(active) };
}

function mergeOpened(
  prev: OpenedProject[],
  proj: OpenedProject
): OpenedProject[] {
  const filtered = prev.filter((p) => p.id !== proj.id);
  return [...filtered, proj];
}

async function recordRecent(meta: ProjectMeta): Promise<void> {
  try {
    await api.settings.touchRecentProject(meta.rootPath, meta.bookTitle);
  } catch {
    /* recent tracking is best-effort */
  }
}

export const useProject = create<ProjectState>((set, get) => ({
  opened: [],
  activeId: null,
  ...flatten(null),

  setExtraContext: (s) =>
    set((state) => patchActive(state.opened, state.activeId, { extraContext: s })),

  openProject: async (root) => {
    const { meta, files } = await api.project.open(root);
    const sparse = await probeAllSparse(files);
    const proj: OpenedProject = {
      id: meta.rootPath,
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: [],
      ...sparse,
      extraContext: ''
    };
    set((state) => {
      const opened = mergeOpened(state.opened, proj);
      return { opened, activeId: proj.id, ...flatten(proj) };
    });
    void recordRecent(meta);
  },

  createProject: async (fields, target) => {
    const { meta, files } = await api.project.create(fields, target);
    const sparse = await probeAllSparse(files);
    const proj: OpenedProject = {
      id: meta.rootPath,
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: [],
      ...sparse,
      extraContext: ''
    };
    set((state) => {
      const opened = mergeOpened(state.opened, proj);
      return { opened, activeId: proj.id, ...flatten(proj) };
    });
    void recordRecent(meta);
  },

  setActive: (id) => {
    set((state) => {
      const target = state.opened.find((p) => p.id === id) ?? null;
      return { opened: state.opened, activeId: target ? id : null, ...flatten(target) };
    });
  },

  closeProjectById: (id) => {
    set((state) => {
      const opened = state.opened.filter((p) => p.id !== id);
      const nextActiveId =
        state.activeId === id ? (opened[opened.length - 1]?.id ?? null) : state.activeId;
      const nextActive = opened.find((p) => p.id === nextActiveId) ?? null;
      return { opened, activeId: nextActiveId, ...flatten(nextActive) };
    });
  },

  openFile: async (path) => {
    if (get().activeFileDirty && get().activeFilePath) {
      await get().saveActiveFile();
    }
    const content = await api.files.read(path);
    set((state) =>
      patchActive(state.opened, state.activeId, {
        activeFilePath: path,
        activeFileContent: content,
        activeFileDirty: false
      })
    );
  },

  toggleChapterSelected: (path) => {
    const cur = get().selectedChapterPaths;
    const next = cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path];
    set((state) => patchActive(state.opened, state.activeId, { selectedChapterPaths: next }));
  },

  clearChapterSelection: () =>
    set((state) => patchActive(state.opened, state.activeId, { selectedChapterPaths: [] })),

  setActiveContent: (s) => {
    set((state) =>
      patchActive(state.opened, state.activeId, {
        activeFileContent: s,
        activeFileDirty: true
      })
    );
  },

  saveActiveFile: async () => {
    const p = get().activeFilePath;
    if (!p) return;
    const content = get().activeFileContent;
    await api.files.write(p, content);
    set((state) => patchActive(state.opened, state.activeId, { activeFileDirty: false }));
    // 写盘成功后落一份历史快照（节流逻辑在主进程里），失败不影响保存。
    const meta = get().meta;
    if (meta) {
      void api.history.save(meta.rootPath, p, content).catch(() => {
        /* ignore */
      });
    }
  },

  reloadActiveFile: async () => {
    const p = get().activeFilePath;
    if (!p) return;
    const content = await api.files.read(p);
    set((state) =>
      patchActive(state.opened, state.activeId, {
        activeFileContent: content,
        activeFileDirty: false
      })
    );
  },

  refreshFiles: async () => {
    const meta = get().meta;
    if (!meta) return;
    const { meta: newMeta, files } = await api.project.open(meta.rootPath);
    const sparse = await probeAllSparse(files);
    set((state) =>
      patchActive(state.opened, state.activeId, { meta: newMeta, files, ...sparse })
    );
  },

  clearActiveFile: () => {
    set((state) =>
      patchActive(state.opened, state.activeId, {
        activeFilePath: null,
        activeFileContent: '',
        activeFileDirty: false
      })
    );
  },

  closeProject: () => {
    const id = get().activeId;
    if (id) get().closeProjectById(id);
  }
}));
