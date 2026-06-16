import Anthropic from '@anthropic-ai/sdk';
import { applyModeToSystemPrompt, type ProviderAdapter, type StreamChatParams } from './types';
import { streamViaClaudeCli } from './cli-runner';

/**
 * Anthropic adapter.
 *  - cli mode:    spawn `claude -p` subprocess (uses user's Claude Code OAuth)
 *  - apikey mode: standard Anthropic Messages API with x-api-key
 */

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  defaultModel: 'claude-sonnet-4-5',
  models: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5',
    'claude-haiku-4-5-20251001'
  ],

  async streamChat(p: StreamChatParams): Promise<void> {
    if (p.token.source === 'cli') {
      await streamViaClaudeCli(p);
      return;
    }
    await streamChatViaApiKey(p);
  }
};

async function streamChatViaApiKey(p: StreamChatParams): Promise<void> {
  const client = new Anthropic({ apiKey: p.token.accessToken });
  try {
    const msgs = p.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const stream = await client.messages.stream(
      {
        model: p.model,
        max_tokens: 8192,
        system: applyModeToSystemPrompt(p.systemPrompt, p.mode),
        messages: msgs
      },
      { signal: p.abortSignal }
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        p.onChunk(event.delta.text);
      }
    }
    p.onDone();
  } catch (err) {
    p.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
