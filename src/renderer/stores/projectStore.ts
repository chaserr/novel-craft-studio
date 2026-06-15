import { create } from 'zustand';
import type { NewProjectFields, ProjectFileEntry, ProjectMeta } from '../../shared/types';
import { api } from '../lib/ipc';

interface ProjectState {
  meta: ProjectMeta | null;
  files: ProjectFileEntry[];
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileDirty: boolean;

  openProject: (root: string) => Promise<void>;
  createProject: (fields: NewProjectFields, target: string) => Promise<void>;
  openFile: (path: string) => Promise<void>;
  updateActiveContent: (s: string) => void;
  saveActiveFile: () => Promise<void>;
  closeProject: () => void;
}

export const useProject = create<ProjectState>((set, get) => ({
  meta: null,
  files: [],
  activeFilePath: null,
  activeFileContent: '',
  activeFileDirty: false,

  openProject: async (root) => {
    const { meta, files } = await api.project.open(root);
    set({
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false
    });
  },

  createProject: async (fields, target) => {
    const { meta, files } = await api.project.create(fields, target);
    set({
      meta,
      files,
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false
    });
  },

  openFile: async (path) => {
    // 提示丢弃未保存
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

  updateActiveContent: (s) => {
    set({ activeFileContent: s, activeFileDirty: true });
  },

  saveActiveFile: async () => {
    const p = get().activeFilePath;
    if (!p) return;
    await api.files.write(p, get().activeFileContent);
    set({ activeFileDirty: false });
  },

  closeProject: () => {
    set({
      meta: null,
      files: [],
      activeFilePath: null,
      activeFileContent: '',
      activeFileDirty: false
    });
  }
}));
