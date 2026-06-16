import OpenAI from 'openai';
import { applyModeToSystemPrompt, type ProviderAdapter, type StreamChatParams } from './types';

export const deepseekAdapter: ProviderAdapter = {
  id: 'deepseek',
  defaultModel: 'deepseek-chat',
  models: ['deepseek-chat', 'deepseek-reasoner'],

  async streamChat(p: StreamChatParams): Promise<void> {
    const client = new OpenAI({
      apiKey: p.token.accessToken,
      baseURL: 'https://api.deepseek.com'
    });
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
};
