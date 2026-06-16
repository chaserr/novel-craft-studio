import type { ChatMessage, ProviderId } from '../../shared/types';
import type { ResolvedToken } from '../ipc/cli-token';

export interface StreamChatParams {
  token: ResolvedToken;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Codex only: continue an existing ~/.codex/sessions/ thread by id. */
  resumeSessionId?: string;
  abortSignal: AbortSignal;
  onChunk: (delta: string) => void;
  /** Codex only: fires when adapter observes the codex thread/session id. */
  onSessionId?: (sessionId: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface ProviderAdapter {
  id: ProviderId;
  defaultModel: string;
  models: string[];
  streamChat(params: StreamChatParams): Promise<void>;
}
