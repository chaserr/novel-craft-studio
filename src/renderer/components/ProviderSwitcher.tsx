import { Select, Group } from '@mantine/core';
import { useSettings } from '../stores/settingsStore';
import type { ProviderId } from '../../shared/types';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  deepseek: 'DeepSeek',
  anthropic: 'Claude',
  openai: 'OpenAI'
};

const MODELS: Record<ProviderId, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  anthropic: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5',
    'claude-haiku-4-5-20251001'
  ],
  // 前 5 个走 codex CLI（ChatGPT 订阅），后 3 个走 OpenAI Platform API key。
  // 选错 (e.g. ChatGPT 订阅却选 gpt-4o-mini) 时由 cli-runner 的 CODEX_COMPATIBLE
  // 白名单兜底，丢弃 -m，使 codex 走账户默认 model。
  openai: [
    'gpt-5.5',
    'gpt-5',
    'gpt-5-codex',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o1-mini'
  ]
};

export default function ProviderSwitcher(): JSX.Element {
  const active = useSettings((s) => s.settings.activeProvider);
  const models = useSettings((s) => s.settings.models);
  const authStrategy = useSettings((s) => s.authStrategy);
  const setActive = useSettings((s) => s.setActiveProvider);
  const setModel = useSettings((s) => s.setModel);

  return (
    <Group gap="xs" wrap="nowrap">
      <Select
        size="xs"
        w={120}
        value={active}
        onChange={(v) => v && void setActive(v as ProviderId)}
        data={(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((id) => ({
          value: id,
          // ⚠ 只在真没配置（既无 CLI 登录也无 API key）时显示。CLI 配好了就别打 ⚠。
          label:
            authStrategy[id] === 'none'
              ? `${PROVIDER_LABELS[id]} ⚠`
              : PROVIDER_LABELS[id]
        }))}
      />
      <Select
        size="xs"
        w={200}
        value={models[active]}
        onChange={(v) => v && void setModel(active, v)}
        data={MODELS[active]}
      />
    </Group>
  );
}
