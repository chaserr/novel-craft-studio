import { create } from 'zustand';
import type { NewProjectFields, ProjectFileEntry, ProjectMeta } from '../../shared/types';
import { api } from '../lib/ipc';

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

  openProject: (root: string) => Promise<void>;
  createProject: (fields: NewProjectFields, target: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  toggleChapterSelected: (path: string) => void;
  clearChapterSelection: () => void;
  setActiveContent: (s: string) => void;
  saveActiveFile: () => Promise<void>;
  reloadActiveFile: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  closeProject: () => void;
}

export const useProject = create<ProjectState>((set, get) => ({
  meta: null,
  files: [],
  activeFilePath: null,
  activeFileContent: '',
  activeFileDirty: false,
  selectedChapterPaths: [],

  openProject: async (root) => {
    const { meta, files } = await api.project.open(root);
    set({
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: []
    });
  },

  createProject: async (fields, target) => {
    const { meta, files } = await api.project.create(fields, target);
    set({
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: []
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
    set({ meta: newMeta, files });
  },

  closeProject: () => {
    set({
      meta: null,
      files: [],
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false,
      selectedChapterPaths: []
    });
  }
}));
