import type { ChatMessage, ProviderId } from '../../shared/types';
import type { ResolvedToken } from '../ipc/cli-token';

export interface StreamChatParams {
  token: ResolvedToken;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  abortSignal: AbortSignal;
  onChunk: (delta: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface ProviderAdapter {
  id: ProviderId;
  defaultModel: string;
  models: string[];
  streamChat(params: StreamChatParams): Promise<void>;
}
