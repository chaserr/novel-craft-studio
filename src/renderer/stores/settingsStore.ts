import { create } from 'zustand';
import type { AppSettings, ProviderId } from '../../shared/types';
import { api } from '../lib/ipc';

/** 与 probeAuth 返回的 strategy 同构。'none' 才意味着真的没配置。 */
type AuthStrategy = 'cli' | 'apikey' | 'none';

interface SettingsState {
  loaded: boolean;
  settings: AppSettings;
  hasApiKey: Record<ProviderId, boolean>;
  /**
   * 真实的 auth 状态。CLI 登录（codex login / claude /login）也算 OK，
   * 不仅仅是 API key。UI badge / ⚠ 都应该读这个，不该读 hasApiKey。
   */
  authStrategy: Record<ProviderId, AuthStrategy>;
  load: () => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
  setNovelCraftPath: (p: string) => Promise<void>;
  setActiveProvider: (p: ProviderId) => Promise<void>;
  setModel: (p: ProviderId, m: string) => Promise<void>;
  setApiKey: (p: ProviderId, key: string) => Promise<void>;
}

const initial: AppSettings = {
  novelCraftPath: '',
  activeProvider: 'deepseek',
  models: {
    openai: 'gpt-5.5',
    anthropic: 'claude-sonnet-4-5',
    deepseek: 'deepseek-chat'
  },
  preferredAuth: {}
};

export const useSettings = create<SettingsState>((set, get) => ({
  loaded: false,
  settings: initial,
  hasApiKey: { openai: false, anthropic: false, deepseek: false },
  authStrategy: { openai: 'none', anthropic: 'none', deepseek: 'none' },

  load: async () => {
    const s = await api.settings.get();
    const [oa, an, ds, oaProbe, anProbe, dsProbe] = await Promise.all([
      api.settings.hasApiKey('openai'),
      api.settings.hasApiKey('anthropic'),
      api.settings.hasApiKey('deepseek'),
      api.llm.probeAuth('openai'),
      api.llm.probeAuth('anthropic'),
      api.llm.probeAuth('deepseek')
    ]);
    set({
      loaded: true,
      settings: s,
      hasApiKey: { openai: oa, anthropic: an, deepseek: ds },
      authStrategy: {
        openai: oaProbe.strategy,
        anthropic: anProbe.strategy,
        deepseek: dsProbe.strategy
      }
    });
  },

  refreshAuthStatus: async () => {
    const [oa, an, ds] = await Promise.all([
      api.llm.probeAuth('openai'),
      api.llm.probeAuth('anthropic'),
      api.llm.probeAuth('deepseek')
    ]);
    set({
      authStrategy: {
        openai: oa.strategy,
        anthropic: an.strategy,
        deepseek: ds.strategy
      }
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
