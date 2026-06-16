import { ipcMain, BrowserWindow } from 'electron';
import type {
  ChatMessage,
  ChatMode,
  LlmStreamEvent,
  ProviderId,
  ReasoningEffort
} from '../../shared/types';
import { getAdapter } from '../llm/registry';
import { getApiKey } from './keychain';
import { resolveToken, probeAuthStatus } from './cli-token';
import { loginClaudeViaBrowser } from './oauth-claude';
import { loginChatGPTViaBrowser } from './oauth-chatgpt';

const activeRequests = new Map<string, AbortController>();

export function registerLlmIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    'llm:stream',
    async (
      _e,
      req: {
        requestId: string;
        provider: ProviderId;
        model: string;
        systemPrompt: string;
        messages: ChatMessage[];
        resumeSessionId?: string;
        mode?: ChatMode;
        reasoningEffort?: ReasoningEffort;
        projectRoot?: string;
      }
    ) => {
      const send = (e: LlmStreamEvent): void => {
        getWindow()?.webContents.send('llm:event', e);
      };

      const token = await resolveToken(req.provider, () => getApiKey(req.provider));
      if (!token) {
        send({
          requestId: req.requestId,
          type: 'error',
          message:
            `未找到 ${req.provider} 的可用凭证。请：` +
            `(1) 用对应 CLI (codex/claude) 登录；(2) 在 Settings 里走 OAuth；(3) 或填手动 API key。`
        });
        return;
      }

      const adapter = getAdapter(req.provider);
      const controller = new AbortController();
      activeRequests.set(req.requestId, controller);

      try {
        await adapter.streamChat({
          token,
          model: req.model || adapter.defaultModel,
          systemPrompt: req.systemPrompt,
          messages: req.messages,
          resumeSessionId: req.resumeSessionId,
          mode: req.mode,
          reasoningEffort: req.reasoningEffort,
          projectRoot: req.projectRoot,
          abortSignal: controller.signal,
          onChunk: (delta) =>
            send({ requestId: req.requestId, type: 'chunk', delta }),
          onSessionId: (sessionId) =>
            send({ requestId: req.requestId, type: 'session', sessionId }),
          onDone: () => send({ requestId: req.requestId, type: 'done' }),
          onError: (err) =>
            send({
              requestId: req.requestId,
              type: 'error',
              message: err.message
            })
        });
      } finally {
        activeRequests.delete(req.requestId);
      }
    }
  );

  ipcMain.handle('llm:cancel', (_e, requestId: string) => {
    const c = activeRequests.get(requestId);
    c?.abort();
    activeRequests.delete(requestId);
  });

  ipcMain.handle(
    'llm:probeAuth',
    async (
      _e,
      provider: ProviderId
    ): Promise<{ strategy: 'cli' | 'apikey' | 'none'; label: string }> => {
      const hasKey = !!(await getApiKey(provider));
      return probeAuthStatus(provider, hasKey);
    }
  );

  ipcMain.handle('llm:oauthLogin', async (_e, provider: ProviderId) => {
    if (provider === 'anthropic') {
      await loginClaudeViaBrowser();
      return { ok: true };
    }
    if (provider === 'openai') {
      await loginChatGPTViaBrowser();
      return { ok: true };
    }
    throw new Error(`${provider} 不支持 OAuth`);
  });
}
