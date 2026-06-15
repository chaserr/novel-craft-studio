import OpenAI from 'openai';
import type { ProviderAdapter, StreamChatParams } from './types';

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  defaultModel: 'gpt-4o',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o1-preview'],

  async streamChat(p: StreamChatParams): Promise<void> {
    const client = new OpenAI({ apiKey: p.apiKey });
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
