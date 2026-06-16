import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, StreamChatParams } from './types';

/**
 * Anthropic adapter.
 *  - apikey mode: x-api-key header
 *  - cli mode:    Authorization: Bearer <oauth_access_token>
 *                 + anthropic-beta with oauth-2025-04-20, claude-code-* flags
 *                 + system prompt MUST start with "You are Claude Code, ..." prefix
 *                   (Anthropic validates this on OAuth requests)
 */

const CLAUDE_CODE_SYSTEM_PREFIX =
  "You are Claude Code, Anthropic's official CLI for Claude.";

const OAUTH_BETA =
  'oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14';

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  defaultModel: 'claude-sonnet-4-5',
  models: [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5',
    'claude-haiku-4-5-20251001'
  ],

  async streamChat(p: StreamChatParams): Promise<void> {
    const isCli = p.token.source === 'cli';

    // Anthropic SDK takes apiKey *or* authToken. For OAuth bearer, use authToken.
    const client = new Anthropic(
      isCli
        ? {
            authToken: p.token.accessToken,
            defaultHeaders: {
              'anthropic-beta': OAUTH_BETA
            }
          }
        : {
            apiKey: p.token.accessToken
          }
    );

    // For OAuth: prepend "You are Claude Code..." to system prompt.
    const systemPrompt = isCli
      ? `${CLAUDE_CODE_SYSTEM_PREFIX}\n\n${p.systemPrompt}`
      : p.systemPrompt;

    try {
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
          system: systemPrompt,
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
