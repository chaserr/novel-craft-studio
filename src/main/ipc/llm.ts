import { ipcMain, BrowserWindow } from 'electron';
import type { ChatMessage, LlmStreamEvent, ProviderId } from '../../shared/types';
import { getAdapter } from '../llm/registry';
import { getApiKey } from './keychain';

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
      }
    ) => {
      const apiKey = await getApiKey(req.provider);
      const send = (e: LlmStreamEvent): void => {
        getWindow()?.webContents.send('llm:event', e);
      };

      if (!apiKey) {
        send({
          requestId: req.requestId,
          type: 'error',
          message: `未配置 ${req.provider} 的 API key，请在 Settings 中填写。`
        });
        return;
      }

      const adapter = getAdapter(req.provider);
      const controller = new AbortController();
      activeRequests.set(req.requestId, controller);

      try {
        await adapter.streamChat({
          apiKey,
          model: req.model || adapter.defaultModel,
          systemPrompt: req.systemPrompt,
          messages: req.messages,
          abortSignal: controller.signal,
          onChunk: (delta) =>
            send({ requestId: req.requestId, type: 'chunk', delta }),
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
}
