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
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import type { StreamChatParams } from './types';

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
    p.systemPrompt
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

  // Codex exec takes the prompt as argv. Embed system prompt as the prologue.
  const fullPrompt =
    p.systemPrompt +
    '\n\n---\n\n' +
    p.messages
      .filter((m) => m.role !== 'system')
      .map((m) => m.content)
      .join('\n\n');

  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
    // service_tier "default" in user's config.toml may not parse; force valid value
    '-c',
    'service_tier="fast"'
  ];
  if (p.model) {
    args.push('-m', p.model);
  }
  args.push(fullPrompt);

  return runCli(codex, args, p, parseCodexChunk);
}

function parseCodexChunk(line: string, p: StreamChatParams): void {
  try {
    const obj = JSON.parse(line);
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

async function runCli(
  bin: string,
  args: string[],
  p: StreamChatParams,
  onLine: (line: string, p: StreamChatParams) => void
): Promise<void> {
  return new Promise<void>((resolve) => {
    let proc: ChildProcess | null = null;
    try {
      proc = spawn(bin, args, {
        // Inherit env so PATH / token lookups work
        env: process.env,
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
