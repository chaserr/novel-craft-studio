import type { ProviderId } from '../../shared/types';
import type { ProviderAdapter } from './types';
import { openaiAdapter } from './openai';
import { anthropicAdapter } from './anthropic';
import { deepseekAdapter } from './deepseek';

const registry: Record<ProviderId, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter
};

export function getAdapter(id: ProviderId): ProviderAdapter {
  return registry[id];
}

export function listProviders(): ProviderAdapter[] {
  return Object.values(registry);
}
