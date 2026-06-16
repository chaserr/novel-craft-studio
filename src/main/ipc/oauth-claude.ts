/**
 * Self-hosted Claude OAuth via BrowserWindow.
 * Used when ~/.claude/ keychain entry is absent (user hasn't run `claude login`).
 *
 * Flow:
 *  1. Open a BrowserWindow loading claude.ai/oauth/authorize?...
 *  2. User signs in to Claude.ai (Pro/Max)
 *  3. Anthropic redirects to console.anthropic.com/oauth/code/callback?code=...
 *  4. We intercept that navigation, grab `code`, close the window
 *  5. POST code to console.anthropic.com/v1/oauth/token to get tokens
 *  6. Save tokens to keychain so future runs find them
 */

import { BrowserWindow } from 'electron';
import keytar from 'keytar';
import { userInfo } from 'node:os';
import { generatePkce } from './oauth-pkce';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';
const AUTH_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const KEYCHAIN_SERVICE = 'Claude Code-credentials';

interface ClaudeOauthSuccess {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

export async function loginClaudeViaBrowser(): Promise<ClaudeOauthSuccess> {
  const pkce = generatePkce();
  const state = pkce.verifier; // minzique convention: state = verifier

  const params = new URLSearchParams({
    code: 'true',
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state
  });

  const win = new BrowserWindow({
    width: 720,
    height: 820,
    title: '登录 Claude',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  let code: string | null = null;

  return new Promise<ClaudeOauthSuccess>((resolve, reject) => {
    win.on('closed', () => {
      if (!code) reject(new Error('Claude 登录被取消'));
    });

    const handleNav = (url: string): void => {
      if (!url.startsWith(REDIRECT_URI)) return;
      const parsed = new URL(url);
      const c = parsed.searchParams.get('code');
      const errParam = parsed.searchParams.get('error');
      if (errParam) {
        reject(new Error(`Claude OAuth 错误：${errParam}`));
        win.close();
        return;
      }
      if (!c) return;
      code = c;
      // Don't let the BrowserWindow actually navigate to console.anthropic.com
      win.hide();

      exchangeCode(code, pkce.verifier)
        .then((tokens) => {
          persistToKeychain(tokens).catch(() => {
            /* non-fatal: tokens still usable in memory */
          });
          resolve(tokens);
        })
        .catch(reject)
        .finally(() => win.destroy());
    };

    win.webContents.on('will-redirect', (_e, url) => handleNav(url));
    win.webContents.on('will-navigate', (_e, url) => handleNav(url));
    win.webContents.on('did-navigate', (_e, url) => handleNav(url));

    win.loadURL(`${AUTH_URL}?${params.toString()}`);
  });
}

async function exchangeCode(
  code: string,
  verifier: string
): Promise<ClaudeOauthSuccess> {
  // code may contain a `#state` fragment per minzique convention; strip
  const cleanCode = code.split('#')[0];
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: cleanCode,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
      state: verifier
    })
  });
  if (!resp.ok) {
    throw new Error(
      `Claude token exchange failed: ${resp.status} ${await resp.text()}`
    );
  }
  const body = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    scope?: string;
  };
  const expiresAt = body.expires_in
    ? Date.now() + body.expires_in * 1000
    : Date.now() + 365 * 24 * 3600 * 1000; // fallback far future
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
    scopes: (body.scope ?? SCOPES).split(/\s+/)
  };
}

async function persistToKeychain(t: ClaudeOauthSuccess): Promise<void> {
  const acct = userInfo().username;
  const blob = {
    claudeAiOauth: {
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      expiresAt: t.expiresAt,
      scopes: t.scopes,
      subscriptionType: 'pro'
    }
  };
  await keytar.setPassword(KEYCHAIN_SERVICE, acct, JSON.stringify(blob));
}
