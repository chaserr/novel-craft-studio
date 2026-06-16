/**
 * Self-hosted ChatGPT (Codex) OAuth via BrowserWindow.
 * Used when ~/.codex/auth.json is absent.
 *
 * The OAuth callback URL `http://localhost:1455/auth/callback` is enforced by
 * OpenAI Hydra's allowlist for the Codex CLI client_id. We intercept the
 * navigation to it in the BrowserWindow (no local HTTP server needed).
 */

import { BrowserWindow } from 'electron';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { generatePkce, randomState } from './oauth-pkce';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const ISSUER = 'https://auth.openai.com';
const REDIRECT_URI = 'http://localhost:1455/auth/callback';
const SCOPES =
  'openid profile email offline_access api.connectors.read api.connectors.invoke';
const CODEX_AUTH_PATH = join(homedir(), '.codex', 'auth.json');

interface ChatGPTOauthSuccess {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  chatgptAccountId?: string;
  expiresAt: number;
}

export async function loginChatGPTViaBrowser(): Promise<ChatGPTOauthSuccess> {
  const pkce = generatePkce();
  const state = randomState();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state,
    originator: 'codex_cli_rs'
  });

  const win = new BrowserWindow({
    width: 720,
    height: 820,
    title: '登录 ChatGPT',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  let resolved = false;

  return new Promise<ChatGPTOauthSuccess>((resolve, reject) => {
    win.on('closed', () => {
      if (!resolved) reject(new Error('ChatGPT 登录被取消'));
    });

    const handleNav = (url: string): void => {
      if (!url.startsWith(REDIRECT_URI)) return;
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      const errParam = parsed.searchParams.get('error');
      const returnedState = parsed.searchParams.get('state');

      if (errParam) {
        resolved = true;
        reject(new Error(`ChatGPT OAuth 错误：${errParam}`));
        win.destroy();
        return;
      }
      if (!code) return;
      if (returnedState !== state) {
        resolved = true;
        reject(new Error('ChatGPT OAuth state mismatch'));
        win.destroy();
        return;
      }

      resolved = true;
      win.hide();
      exchangeCode(code, pkce.verifier)
        .then((tokens) => {
          persistToAuthJson(tokens);
          resolve(tokens);
        })
        .catch(reject)
        .finally(() => win.destroy());
    };

    win.webContents.on('will-redirect', (_e, url) => handleNav(url));
    win.webContents.on('will-navigate', (_e, url) => handleNav(url));
    win.webContents.on('did-navigate', (_e, url) => handleNav(url));

    win.loadURL(`${ISSUER}/oauth/authorize?${params.toString()}`);
  });
}

async function exchangeCode(
  code: string,
  verifier: string
): Promise<ChatGPTOauthSuccess> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  });
  const resp = await fetch(`${ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!resp.ok) {
    throw new Error(
      `ChatGPT token exchange failed: ${resp.status} ${await resp.text()}`
    );
  }
  const json = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in?: number;
  };
  const claims = decodeJwt(json.id_token);
  const expiresAt = json.expires_in
    ? Date.now() + json.expires_in * 1000
    : Date.now() + 30 * 60 * 1000;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    idToken: json.id_token,
    chatgptAccountId: claims?.chatgpt_account_id as string | undefined,
    expiresAt
  };
}

function decodeJwt(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    );
  } catch {
    return null;
  }
}

function persistToAuthJson(t: ChatGPTOauthSuccess): void {
  // Write in the same shape Codex CLI uses, so future reads (via cli-token.ts)
  // pick it up transparently.
  const dir = join(homedir(), '.codex');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Preserve existing fields if any
  let cur: Record<string, unknown> = {};
  if (existsSync(CODEX_AUTH_PATH)) {
    try {
      cur = JSON.parse(readFileSync(CODEX_AUTH_PATH, 'utf-8'));
    } catch {
      /* ignore */
    }
  }
  cur.auth_mode = 'chatgpt';
  cur.OPENAI_API_KEY = null;
  cur.tokens = {
    access_token: t.accessToken,
    refresh_token: t.refreshToken,
    id_token: t.idToken,
    account_id: t.chatgptAccountId
  };
  cur.last_refresh = new Date().toISOString();
  writeFileSync(CODEX_AUTH_PATH, JSON.stringify(cur, null, 2), 'utf-8');
}
