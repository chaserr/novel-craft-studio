import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, StreamChatParams } from './types';

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  defaultModel: 'claude-opus-4-5-20251101',
  models: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5',
    'claude-haiku-4-5-20251001'
  ],

  async streamChat(p: StreamChatParams): Promise<void> {
    const client = new Anthropic({ apiKey: p.apiKey });
    try {
      // Anthropic 要求 messages 不能含 system role；system 单独传
      const msgs = p.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));

      const stream = await client.messages.stream(
        {
          model: p.model,
          max_tokens: 8192,
          system: p.systemPrompt,
          messages: msgs
        },
        { signal: p.abortSignal }
      );

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          p.onChunk(event.delta.text);
        }
      }
      p.onDone();
    } catch (err) {
      p.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
};
