import type {
  ChatMessage,
  ChatMode,
  ProviderId,
  ReasoningEffort
} from '../../shared/types';
import type { ResolvedToken } from '../ipc/cli-token';
import { injectFingerprintIntoPrompt } from '../../shared/fingerprint';

export interface StreamChatParams {
  token: ResolvedToken;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Codex only: continue an existing ~/.codex/sessions/ thread by id. */
  resumeSessionId?: string;
  /** Codex-style mode. Defaults to 'ask' if omitted. */
  mode?: ChatMode;
  /** 推理强度 (low/medium/high)。Codex CLI 下映射到 model_reasoning_effort。 */
  reasoningEffort?: ReasoningEffort;
  /** Project root — Codex Agent 模式作为 CLI cwd（沙箱根）。 */
  projectRoot?: string;
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

/**
 * 给非 codex 通道（DeepSeek / Anthropic API / OpenAI Platform API）的 system prompt
 * 拼上 mode 前缀。CLI 通道里另行处理（详见 cli-runner.ts）。
 */
export function applyModeToSystemPrompt(
  systemPrompt: string,
  mode: ChatMode | undefined
): string {
  let out = systemPrompt;
  if (mode === 'edit') {
    out =
      systemPrompt +
      '\n\n[Edit 模式] 仅围绕"当前正在编辑的文件"提议修订。' +
      '输出 **完整修订后的文件内容**，放在单个 ```markdown ... ``` 代码块里，' +
      '不要输出 diff，不要解释，不要修改其他文件。';
  } else if (mode && mode !== 'ask') {
    out =
      systemPrompt +
      '\n\n[Agent 模式 / 受限] 你没有写盘工具。请：(1) 给出你打算做的步骤；' +
      '(2) 对每一步直接给出该步的最终文本内容，方便人工应用到对应文件。';
  }
  return injectFingerprintIntoPrompt(out);
}
