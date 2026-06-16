import OpenAI from 'openai';
import { applyModeToSystemPrompt, type ProviderAdapter, type StreamChatParams } from './types';
import { streamViaCodexCli } from './cli-runner';

/**
 * OpenAI adapter.
 *  - cli mode:    spawn `codex exec --json` subprocess (uses user's ChatGPT OAuth via Codex CLI)
 *  - apikey mode: standard OpenAI Platform API with x-api-key
 */

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  defaultModel: 'gpt-5.5',
  models: ['gpt-5.5', 'gpt-5', 'gpt-5-codex', 'gpt-4o', 'gpt-4o-mini', 'o1-mini'],

  async streamChat(p: StreamChatParams): Promise<void> {
    if (p.token.source === 'cli') {
      await streamViaCodexCli(p);
      return;
    }
    await streamChatViaApiKey(p);
  }
};

async function streamChatViaApiKey(p: StreamChatParams): Promise<void> {
  const client = new OpenAI({ apiKey: p.token.accessToken });
  try {
    const stream = await client.chat.completions.create(
      {
        model: p.model,
        stream: true,
        messages: [
          { role: 'system', content: applyModeToSystemPrompt(p.systemPrompt, p.mode) },
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
