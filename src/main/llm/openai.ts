import OpenAI from 'openai';
import type { ProviderAdapter, StreamChatParams } from './types';

/**
 * OpenAI adapter.
 *  - apikey mode: standard OpenAI Platform API (api.openai.com/v1/chat/completions)
 *  - cli mode:    ChatGPT subscription via Codex OAuth.
 *                 Codex CLI talks to the ChatGPT backend (chatgpt.com/backend-api/codex)
 *                 with Bearer access_token + ChatGPT-Account-ID header.
 *                 We hit the same /chat/completions-compatible endpoint OpenAI exposes
 *                 to Codex CLI, located under chatgpt.com (not api.openai.com).
 */

const CHATGPT_BASE = 'https://chatgpt.com/backend-api/codex';

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  defaultModel: 'gpt-4o',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-5-codex', 'o1-mini', 'o1-preview'],

  async streamChat(p: StreamChatParams): Promise<void> {
    const isCli = p.token.source === 'cli';
    const client = new OpenAI({
      apiKey: p.token.accessToken,
      baseURL: isCli ? CHATGPT_BASE : undefined,
      defaultHeaders: isCli
        ? {
            'ChatGPT-Account-ID': p.token.chatgptAccountId ?? '',
            'OpenAI-Beta': 'responses=v1',
            originator: 'codex_cli_rs'
          }
        : undefined
    });
    try {
      const stream = await client.chat.completions.create(
        {
          model: p.model,
          stream: true,
          messages: [
            { role: 'system', content: p.systemPrompt },
            ...p.messages.map((m) => ({ role: m.role, content: m.content }))
          ]
        },
        { signal: p.abortSignal }
      );
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) p.onChunk(delta);
      }
      p.onDone();
    } catch (err) {
      p.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
};
