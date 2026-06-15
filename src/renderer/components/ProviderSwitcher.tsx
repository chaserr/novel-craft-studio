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
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o1-preview']
};

export default function ProviderSwitcher(): JSX.Element {
  const active = useSettings((s) => s.settings.activeProvider);
  const models = useSettings((s) => s.settings.models);
  const hasKey = useSettings((s) => s.hasApiKey);
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
          label: hasKey[id] ? PROVIDER_LABELS[id] : `${PROVIDER_LABELS[id]} ⚠`
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
