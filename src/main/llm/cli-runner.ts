/**
 * Spawns local Codex / Claude Code CLI subprocesses and streams their
 * JSONL output back to the renderer. This is the preferred runtime path
 * for OAuth-backed providers — the CLI handles auth, Cloudflare,
 * token refresh, model gating, and quota for us. We just pipe.
 *
 * Why CLI instead of our own HTTP client:
 *  - OpenAI Codex backend gates models per-account; the CLI knows the
 *    right model name for the user's ChatGPT Plus/Pro/Team plan.
 *  - Anthropic OAuth tokens require the "Claude Code" system prefix +
 *    a moving target of anthropic-beta headers; claude CLI tracks them.
 *  - No Cloudflare turnstile / rate-limit reverse-engineering for us.
 */

import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { applyModeToSystemPrompt, type StreamChatParams } from './types';
import { injectFingerprintIntoPrompt } from '../../shared/fingerprint';

interface CliResult {
  exitCode: number;
  stderr: string;
}

/** Resolve absolute path of a CLI binary by probing PATH + common install locations. */
function findCli(name: string): string | null {
  // 1. PATH lookup via `which`
  try {
    const probe = spawn('which', [name]);
    let out = '';
    probe.stdout?.on('data', (b) => (out += b.toString()));
    // synchronous-ish: wait for close via deasync alternative would be heavy;
    // instead we use known common locations as a fallback.
  } catch {
    /* ignore */
  }
  const home = homedir();
  const candidates = [
    `${home}/.nvm/versions/node/v20.10.0/bin/${name}`,
    `${home}/.local/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * Detect codex / claude CLI availability synchronously (for probeAuth UI).
 * Returns the absolute path or null.
 */
export function locateCli(name: 'codex' | 'claude'): string | null {
  return findCli(name);
}

/* ============================================================ */
/*                    Claude CLI streaming                       */
/* ============================================================ */

/**
 * Stream a single-turn chat via `claude -p`.
 *
 * Claude Code's print mode supports stream-json output. We parse the JSONL
 * events and emit `text_delta` chunks back to renderer.
 */
export async function streamViaClaudeCli(p: StreamChatParams): Promise<void> {
  const claude = findCli('claude');
  if (!claude) {
    p.onError(new Error('claude CLI 未找到。请先安装 Claude Code 并 `claude /login`'));
    return;
  }

  // Combine messages into a single user prompt (Claude `-p` is single-turn).
  const userPrompt = p.messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.content)
    .join('\n\n');

  // append-system-prompt is added to Claude's default system; --system-prompt
  // would REPLACE it (causing auth issues). For OAuth tokens we MUST keep
  // the default "You are Claude Code…" prefix, so use append.
  const args = [
    '-p',
    userPrompt,
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--dangerously-skip-permissions',
    '--append-system-prompt',
    applyModeToSystemPrompt(p.systemPrompt, p.mode)
  ];
  if (p.model) {
    args.push('--model', p.model);
  }

  return runCli(claude, args, p, parseClaudeChunk);
}

function parseClaudeChunk(line: string, p: StreamChatParams): void {
  try {
    const obj = JSON.parse(line);
    // stream_event with text_delta
    if (
      obj?.type === 'stream_event' &&
      obj.event?.type === 'content_block_delta' &&
      obj.event.delta?.type === 'text_delta'
    ) {
      const text = obj.event.delta.text as string | undefined;
      if (text) p.onChunk(text);
    }
    // result event with is_error
    else if (obj?.type === 'result' && obj.is_error) {
      p.onError(new Error(obj.result || 'claude CLI error'));
    }
  } catch {
    /* not JSON — ignore */
  }
}

/* ============================================================ */
/*                     Codex CLI streaming                       */
/* ============================================================ */

/**
 * Stream a single-turn chat via `codex exec --json`.
 *
 * Codex exec emits JSONL events. We parse text deltas.
 *
 * Limitations:
 *  - User's ChatGPT plan dictates which models are available; some plans only
 *    allow the latest gpt-5.x and require an up-to-date CLI.
 *  - We pass --skip-git-repo-check + --full-auto so it runs anywhere with no
 *    confirmation prompts.
 */
export async function streamViaCodexCli(p: StreamChatParams): Promise<void> {
  const codex = findCli('codex');
  if (!codex) {
    p.onError(new Error('codex CLI 未找到。请先安装 OpenAI Codex CLI 并 `codex login`'));
    return;
  }

  const isResume = !!p.resumeSessionId;
  const mode = p.mode ?? 'ask';

  // Codex CLI 沙箱权限：
  //  ask/edit → read-only（不能改文件，纯问答 / 给出建议）
  //  agent    → workspace-write（可自主读写 projectRoot 内文件）
  const sandbox = mode === 'agent' ? 'workspace-write' : 'read-only';

  // edit 模式给出固定指令前缀：让模型围绕"当前编辑文件"输出完整修订版本
  const modeInstruction =
    mode === 'edit'
      ? '\n\n[Edit 模式] 请仅修改"当前正在编辑的文件"，输出 **完整修订后的文件内容**，放在单个 ```markdown ... ``` 代码块里。不要解释，不要输出 diff，不要修改其他文件。\n'
      : mode === 'agent'
        ? '\n\n[Agent 模式] 你可以自主多步：读项目内任意文件、写回到对应文件，完成后简要汇报做了什么。\n'
        : '';

  // When resuming, only send the *latest* user message (codex remembers context).
  // When new, embed system prompt + all user messages as prologue.
  const userMessages = p.messages.filter((m) => m.role !== 'system');
  const newestUser = userMessages[userMessages.length - 1]?.content ?? '';
  const fullPrompt = isResume
    ? newestUser + modeInstruction
    : injectFingerprintIntoPrompt(p.systemPrompt) +
      modeInstruction +
      '\n\n---\n\n' +
      userMessages.map((m) => m.content).join('\n\n');

  // 推理强度：低 / 中 / 高 — 直接映射到 codex 的 model_reasoning_effort。
  // 默认 medium（codex CLI 自己的默认）。
  const effort = p.reasoningEffort ?? 'medium';

  const baseArgs = [
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    sandbox,
    // service_tier "default" in user's config.toml may not parse; force valid value
    '-c',
    'service_tier="fast"',
    '-c',
    `model_reasoning_effort="${effort}"`
  ];
  const args = isResume
    ? ['exec', 'resume', ...baseArgs]
    : ['exec', ...baseArgs];
  // codex CLI 只接受 ChatGPT 账户允许的 gpt-5.x 系。其它（如 gpt-4o*、o1-*）传过去会
  // 400 invalid_request_error。不在白名单里就不传 -m，让 codex CLI 走账户默认 model
  // —— 这一行同时修了 ChatPanel 和 workflow 里每个 agent 的「不被支持模型」错误。
  const CODEX_COMPATIBLE = new Set([
    'gpt-5.5',
    'gpt-5',
    'gpt-5-codex',
    'gpt-5-mini',
    'gpt-5-nano'
  ]);
  if (p.model && CODEX_COMPATIBLE.has(p.model)) {
    args.push('-m', p.model);
  }
  if (isResume) {
    args.push(p.resumeSessionId!);
  }
  args.push(fullPrompt);

  // Agent 模式需要把 cwd 设到 projectRoot，否则沙箱根落在 app 进程目录
  const cwd = mode === 'agent' && p.projectRoot ? p.projectRoot : undefined;

  return runCli(codex, args, p, parseCodexChunk, cwd);
}

function parseCodexChunk(line: string, p: StreamChatParams): void {
  try {
    const obj = JSON.parse(line);
    // Capture session id from thread.started for chat session resume.
    if (obj?.type === 'thread.started' && obj.thread_id) {
      p.onSessionId?.(obj.thread_id);
    }
    // codex exec --json (v0.140+) emits batch item.completed instead of deltas.
    // We treat it as one chunk for our UI (no true streaming, but works).
    if (
      obj?.type === 'item.completed' &&
      (obj.item?.type === 'agent_message' || obj.item?.type === 'text') &&
      obj.item?.text
    ) {
      p.onChunk(obj.item.text);
    }
    // legacy delta events (in case future CLI brings them back)
    else if (obj?.type === 'item.added' && obj.item?.type === 'text' && obj.item.text) {
      p.onChunk(obj.item.text);
    } else if (obj?.type === 'item.delta' && obj.delta) {
      p.onChunk(typeof obj.delta === 'string' ? obj.delta : obj.delta.text ?? '');
    } else if (obj?.type === 'text.delta' && obj.text) {
      p.onChunk(obj.text);
    } else if (obj?.type === 'turn.failed' || obj?.type === 'error') {
      const msg = obj.error?.message || obj.message || 'codex error';
      p.onError(new Error(msg));
    }
  } catch {
    /* not JSON — ignore */
  }
}

/* ============================================================ */
/*                          Generic runner                       */
/* ============================================================ */

/**
 * 打包后的 Electron 在 macOS 下 process.env.PATH 只有 `/usr/bin:/bin:...`，
 * 用户装在 homebrew / nvm 下的 node 不可见，导致 codex / claude 这种以
 * `#!/usr/bin/env node` 起头的 CLI 跑起来报「env: node: No such file」。
 * 这里把常见 node 安装位置都拼进 PATH，再覆盖给子进程的 env。
 */
function augmentedPath(): string {
  const home = homedir();
  const win = process.platform === 'win32';
  const sep = win ? ';' : ':';
  const extra: string[] = win
    ? [
        'C:\\Program Files\\nodejs',
        'C:\\Program Files (x86)\\nodejs',
        `${process.env.LOCALAPPDATA ?? ''}\\Programs\\nodejs`,
        `${process.env.APPDATA ?? ''}\\npm`
      ]
    : [
        `${home}/.local/bin`,
        `${home}/.bun/bin`,
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/local/sbin',
        '/usr/bin',
        '/bin'
      ];

  // nvm 装的 node：把所有版本 bin 目录都加上，新版本优先。
  if (!win) {
    try {
      const nvmDir = join(home, '.nvm', 'versions', 'node');
      if (existsSync(nvmDir)) {
        const versions = readdirSync(nvmDir).sort().reverse();
        for (const v of versions) extra.push(join(nvmDir, v, 'bin'));
      }
    } catch {
      /* nvm 没装就算了 */
    }
  }

  const existing = (process.env.PATH ?? '').split(sep);
  const merged = [...new Set([...extra, ...existing])].filter(Boolean);
  return merged.join(sep);
}

async function runCli(
  bin: string,
  args: string[],
  p: StreamChatParams,
  onLine: (line: string, p: StreamChatParams) => void,
  cwd?: string
): Promise<void> {
  return new Promise<void>((resolve) => {
    let proc: ChildProcess | null = null;
    try {
      proc = spawn(bin, args, {
        // 给子进程一份扩充过的 PATH（让 codex/claude 内部 env node 能找到 node）。
        env: { ...process.env, PATH: augmentedPath() },
        cwd,
        // Close stdin so CLI doesn't wait for piped input
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      p.onError(err instanceof Error ? err : new Error(String(err)));
      resolve();
      return;
    }

    let stdoutBuf = '';
    let stderrBuf = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (line) onLine(line, p);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    proc.on('error', (err) => {
      p.onError(err);
      resolve();
    });

    proc.on('close', (code) => {
      // flush remaining
      if (stdoutBuf.trim()) onLine(stdoutBuf.trim(), p);
      if (code === 0) {
        p.onDone();
      } else {
        const tail = stderrBuf.slice(-1500).trim() || 'no stderr';
        p.onError(
          new Error(
            `${bin.split('/').pop()} exited with code ${code}\n\nstderr (tail):\n${tail}`
          )
        );
      }
      resolve();
    });

    p.abortSignal.addEventListener('abort', () => {
      try {
        proc?.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    });
  });
}
