import { create } from 'zustand';
import type { NewProjectFields, ProjectFileEntry, ProjectMeta } from '../../shared/types';
import { api } from '../lib/ipc';
import { detectGenericSparse, detectRtkSparse } from '../lib/rtk';

interface ProjectState {
  meta: ProjectMeta | null;
  files: ProjectFileEntry[];
  /** The chapter user is currently editing / "在看" (single). */
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileDirty: boolean;
  /**
   * Chapter file paths the user has multi-selected (cmd+click).
   * Drives WorkflowRange 'multi'. The activeFilePath is always implicitly
   * the primary chapter for range='chapter'.
   */
  selectedChapterPaths: string[];

  /**
   * RTK.md 是否"用户什么都没填" — 是的话，让 AI 起任何稿都没意义，
   * 必须先让用户在引导页填一段"故事简述"。
   * openProject / createProject / refreshFiles 时自动重算。
   */
  rtkSparse: boolean;
  /** 小说大纲.md 是否为空骨架。决定引导页 5 步清单里这一步是否打勾。 */
  outlineSparse: boolean;
  /** 章节大纲.md 是否为空骨架。 */
  chapterOutlineSparse: boolean;
  /**
   * 用户在引导页填的「故事简述」。RTK 稀疏时是强制必填项，会被注入到
   * 每个 workflow 的高优先级 user message 里。跟随项目，切项目时清空。
   */
  extraContext: string;
  setExtraContext: (s: string) => void;

  openProject: (root: string) => Promise<void>;
  createProject: (fields: NewProjectFields, target: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  toggleChapterSelected: (path: string) => void;
  clearChapterSelection: () => void;
  setActiveContent: (s: string) => void;
  saveActiveFile: () => Promise<void>;
  reloadActiveFile: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  /** 清空当前在编辑的文件（不退项目）。删除/重命名时用。 */
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

export const useProject = create<ProjectState>((set, get) => ({
  meta: null,
  files: [],
  activeFilePath: null,
  activeFileContent: '',
  activeFileDirty: false,
  selectedChapterPaths: [],
  rtkSparse: false,
  outlineSparse: true,
  chapterOutlineSparse: true,
  extraContext: '',

  setExtraContext: (s) => set({ extraContext: s }),

  openProject: async (root) => {
    const { meta, files } = await api.project.open(root);
    const sparse = await probeAllSparse(files);
    set({
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: [],
      ...sparse,
      extraContext: ''
    });
  },

  createProject: async (fields, target) => {
    const { meta, files } = await api.project.create(fields, target);
    const sparse = await probeAllSparse(files);
    set({
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: [],
      ...sparse,
      extraContext: ''
    });
  },

  openFile: async (path) => {
    if (get().activeFileDirty && get().activeFilePath) {
      await get().saveActiveFile();
    }
    const content = await api.files.read(path);
    set({
      activeFilePath: path,
      activeFileContent: content,
      activeFileDirty: false
    });
  },

  toggleChapterSelected: (path) => {
    const cur = get().selectedChapterPaths;
    set({
      selectedChapterPaths: cur.includes(path)
        ? cur.filter((p) => p !== path)
        : [...cur, path]
    });
  },

  clearChapterSelection: () => set({ selectedChapterPaths: [] }),

  setActiveContent: (s) => {
    set({ activeFileContent: s, activeFileDirty: true });
  },

  saveActiveFile: async () => {
    const p = get().activeFilePath;
    if (!p) return;
    await api.files.write(p, get().activeFileContent);
    set({ activeFileDirty: false });
  },

  reloadActiveFile: async () => {
    const p = get().activeFilePath;
    if (!p) return;
    const content = await api.files.read(p);
    set({ activeFileContent: content, activeFileDirty: false });
  },

  refreshFiles: async () => {
    const meta = get().meta;
    if (!meta) return;
    const { meta: newMeta, files } = await api.project.open(meta.rootPath);
    const sparse = await probeAllSparse(files);
    set({ meta: newMeta, files, ...sparse });
  },

  clearActiveFile: () => {
    set({ activeFilePath: null, activeFileContent: '', activeFileDirty: false });
  },

  closeProject: () => {
    set({
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
    });
  }
}));
