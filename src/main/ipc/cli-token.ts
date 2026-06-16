/**
 * Reads OAuth tokens from local Codex / Claude Code CLI installations.
 * This is the preferred token source (lowest revoke risk) because the tokens
 * were minted by the official CLI's own OAuth flow.
 *
 * Sources:
 *   ChatGPT:  ~/.codex/auth.json   (plaintext JSON)
 *   Claude:   macOS Keychain entry "Claude Code-credentials" / acct=$USER
 *             (on Windows / Linux: also via keytar with same service+acct)
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, userInfo } from 'node:os';
import keytar from 'keytar';
import type { ProviderId } from '../../shared/types';

export interface ResolvedToken {
  /** Where the token came from. */
  source: 'cli' | 'oauth' | 'apikey';
  accessToken: string;
  /** ChatGPT only — used as ChatGPT-Account-ID header. */
  chatgptAccountId?: string;
  /** Epoch ms when access token expires (if known). */
  expiresAt?: number;
  refreshToken?: string;
}

/* ----------------------- Codex (ChatGPT) ----------------------- */

interface CodexAuthFile {
  auth_mode?: string;
  OPENAI_API_KEY?: string | null;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    account_id?: string;
  };
  last_refresh?: string;
}

const CODEX_AUTH_PATH = join(homedir(), '.codex', 'auth.json');
const CODEX_ISSUER = 'https://auth.openai.com';
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

function parseJwt<T = Record<string, unknown>>(jwt: string): T | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

function readCodexAuthFile(): CodexAuthFile | null {
  if (!existsSync(CODEX_AUTH_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CODEX_AUTH_PATH, 'utf-8')) as CodexAuthFile;
  } catch {
    return null;
  }
}

export function readCodexToken(): ResolvedToken | null {
  const f = readCodexAuthFile();
  if (!f?.tokens?.access_token) return null;
  const t = f.tokens;
  const accessToken = t.access_token;
  if (!accessToken) return null;

  // Derive chatgpt_account_id from id_token claims if not directly present.
  let accountId = t.account_id;
  if (!accountId && t.id_token) {
    const claims = parseJwt<{ chatgpt_account_id?: string }>(t.id_token);
    accountId = claims?.chatgpt_account_id;
  }
  // Derive expiry from access_token (it's a JWT too).
  let expiresAt: number | undefined;
  const accessClaims = parseJwt<{ exp?: number }>(accessToken);
  if (accessClaims?.exp) expiresAt = accessClaims.exp * 1000;

  return {
    source: 'cli',
    accessToken,
    chatgptAccountId: accountId,
    expiresAt,
    refreshToken: t.refresh_token
  };
}

/** Refresh codex access token. Returns new ResolvedToken, also persists to auth.json. */
export async function refreshCodexToken(refreshToken: string): Promise<ResolvedToken> {
  const resp = await fetch(`${CODEX_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CODEX_CLIENT_ID,
      refresh_token: refreshToken,
      scope: 'openid profile email'
    })
  });
  if (!resp.ok) {
    throw new Error(`Codex refresh failed: ${resp.status} ${await resp.text()}`);
  }
  const body = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };
  const claims = body.id_token ? parseJwt<{ chatgpt_account_id?: string }>(body.id_token) : null;

  // Persist back so future reads stay fresh + native codex CLI sees them too.
  const cur = readCodexAuthFile() ?? {};
  cur.tokens = {
    ...(cur.tokens ?? {}),
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? cur.tokens?.refresh_token,
    id_token: body.id_token ?? cur.tokens?.id_token
  };
  cur.last_refresh = new Date().toISOString();
  try {
    writeFileSync(CODEX_AUTH_PATH, JSON.stringify(cur, null, 2), 'utf-8');
  } catch {
    // Non-fatal: even if we can't write back, the in-memory token is good for this session.
  }

  return {
    source: 'cli',
    accessToken: body.access_token,
    chatgptAccountId: claims?.chatgpt_account_id ?? cur.tokens.account_id,
    expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined,
    refreshToken: body.refresh_token ?? refreshToken
  };
}

/* --------------------- Claude Code (Anthropic) --------------------- */

interface ClaudeAuthBlob {
  claudeAiOauth?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    scopes?: string[];
    subscriptionType?: string;
    rateLimitTier?: string;
  };
}

const CLAUDE_KEYCHAIN_SERVICE = 'Claude Code-credentials';
const CLAUDE_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

async function readClaudeAuthBlob(): Promise<ClaudeAuthBlob | null> {
  const acct = userInfo().username;
  try {
    const raw = await keytar.getPassword(CLAUDE_KEYCHAIN_SERVICE, acct);
    if (!raw) return null;
    return JSON.parse(raw) as ClaudeAuthBlob;
  } catch {
    return null;
  }
}

export async function readClaudeToken(): Promise<ResolvedToken | null> {
  const blob = await readClaudeAuthBlob();
  const oauth = blob?.claudeAiOauth;
  if (!oauth?.accessToken) return null;
  return {
    source: 'cli',
    accessToken: oauth.accessToken,
    refreshToken: oauth.refreshToken,
    expiresAt: oauth.expiresAt
  };
}

export async function refreshClaudeToken(refreshToken: string): Promise<ResolvedToken> {
  const resp = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLAUDE_CLIENT_ID,
      refresh_token: refreshToken
    })
  });
  if (!resp.ok) {
    throw new Error(`Claude refresh failed: ${resp.status} ${await resp.text()}`);
  }
  const body = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const expiresAt = body.expires_in ? Date.now() + body.expires_in * 1000 : undefined;

  // Try to persist back to Keychain so Claude Code CLI shares the refresh.
  try {
    const acct = userInfo().username;
    const cur = (await readClaudeAuthBlob()) ?? {};
    cur.claudeAiOauth = {
      ...(cur.claudeAiOauth ?? {}),
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? cur.claudeAiOauth?.refreshToken,
      expiresAt
    };
    await keytar.setPassword(CLAUDE_KEYCHAIN_SERVICE, acct, JSON.stringify(cur));
  } catch {
    /* non-fatal */
  }

  return {
    source: 'cli',
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt
  };
}

/* --------------------- Per-provider token resolution --------------------- */

/** True when token expires within `bufferMs` (default 5 min). */
function isExpiring(t: ResolvedToken, bufferMs = 5 * 60_000): boolean {
  return !!t.expiresAt && t.expiresAt - Date.now() < bufferMs;
}

/**
 * Three-tier resolution (CLI → self-OAuth → API key).
 * For now only tier 1 + tier 3 are wired here; self-OAuth (tier 2) is added in P6.
 */
export async function resolveToken(
  provider: ProviderId,
  fallbackApiKey: () => Promise<string | null>
): Promise<ResolvedToken | null> {
  // Tier 1: CLI
  if (provider === 'openai') {
    let t = readCodexToken();
    if (t && isExpiring(t) && t.refreshToken) {
      try {
        t = await refreshCodexToken(t.refreshToken);
      } catch {
        /* fall through to apikey */
      }
    }
    if (t) return t;
  } else if (provider === 'anthropic') {
    let t = await readClaudeToken();
    if (t && isExpiring(t) && t.refreshToken) {
      try {
        t = await refreshClaudeToken(t.refreshToken);
      } catch {
        /* fall through */
      }
    }
    if (t) return t;
  }

  // Tier 3: API key from keychain
  const key = await fallbackApiKey();
  if (key) return { source: 'apikey', accessToken: key };

  return null;
}

/** Quick UI probe for which strategy is available for each provider. */
export async function probeAuthStatus(
  provider: ProviderId,
  hasApiKey: boolean
): Promise<{ strategy: 'cli' | 'apikey' | 'none'; label: string }> {
  if (provider === 'deepseek') {
    return hasApiKey
      ? { strategy: 'apikey', label: '已配置 API Key' }
      : { strategy: 'none', label: '未配置' };
  }
  if (provider === 'openai') {
    if (readCodexToken()) return { strategy: 'cli', label: '已登录 (Codex CLI)' };
    return hasApiKey
      ? { strategy: 'apikey', label: '已配置 API Key' }
      : { strategy: 'none', label: '未配置' };
  }
  if (provider === 'anthropic') {
    if (await readClaudeToken())
      return { strategy: 'cli', label: '已登录 (Claude Code CLI)' };
    return hasApiKey
      ? { strategy: 'apikey', label: '已配置 API Key' }
      : { strategy: 'none', label: '未配置' };
  }
  return { strategy: 'none', label: '未配置' };
}
