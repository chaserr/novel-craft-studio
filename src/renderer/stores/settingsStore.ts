import { create } from 'zustand';
import type { AppSettings, ProviderId } from '../../shared/types';
import { api } from '../lib/ipc';

interface SettingsState {
  loaded: boolean;
  settings: AppSettings;
  hasApiKey: Record<ProviderId, boolean>;
  load: () => Promise<void>;
  setNovelCraftPath: (p: string) => Promise<void>;
  setActiveProvider: (p: ProviderId) => Promise<void>;
  setModel: (p: ProviderId, m: string) => Promise<void>;
  setApiKey: (p: ProviderId, key: string) => Promise<void>;
}

const initial: AppSettings = {
  novelCraftPath: '',
  activeProvider: 'deepseek',
  models: {
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-5',
    deepseek: 'deepseek-chat'
  },
  preferredAuth: {}
};

export const useSettings = create<SettingsState>((set, get) => ({
  loaded: false,
  settings: initial,
  hasApiKey: { openai: false, anthropic: false, deepseek: false },

  load: async () => {
    const s = await api.settings.get();
    const [oa, an, ds] = await Promise.all([
      api.settings.hasApiKey('openai'),
      api.settings.hasApiKey('anthropic'),
      api.settings.hasApiKey('deepseek')
    ]);
    set({
      loaded: true,
      settings: s,
      hasApiKey: { openai: oa, anthropic: an, deepseek: ds }
    });
  },

  setNovelCraftPath: async (p) => {
    await api.settings.setNovelCraftPath(p);
    set({ settings: { ...get().settings, novelCraftPath: p } });
  },

  setActiveProvider: async (p) => {
    await api.settings.setActiveProvider(p);
    set({ settings: { ...get().settings, activeProvider: p } });
  },

  setModel: async (p, m) => {
    await api.settings.setModel(p, m);
    set({
      settings: {
        ...get().settings,
        models: { ...get().settings.models, [p]: m }
      }
    });
  },

  setApiKey: async (p, key) => {
    await api.settings.setApiKey(p, key);
    set({ hasApiKey: { ...get().hasApiKey, [p]: !!key } });
  }
}));
