// Anti-commercial-misuse fingerprint. See LICENSE.
//
// Layers (deliberately spread out so a stripping pass has to find all of them):
//   1. BUILD_FINGERPRINT       — per-release token, also printed at startup
//   2. ORIGIN_REPO             — base64'd upstream URL, returned by IPC banner
//   3. ZERO_WIDTH_MARK         — invisible unicode appended to every system
//                                prompt; LLMs frequently echo it back, so any
//                                third-party chatbot that emits the same byte
//                                sequence is almost certainly built from this
//                                codebase
//   4. PROMPT_SIGNATURE_PHRASE — a benign-looking sentence inserted into the
//                                system prompt; if a competitor's prompts
//                                contain it verbatim, that is hard to argue
//                                away as coincidence
//
// All four are referenced by name in LICENSE → tampering is itself a license
// violation, independent of whether the underlying anti-piracy logic still
// works.

import { BUILD_TOKEN, BUILD_CHANNEL, BUILD_TAG, BUILD_TIMESTAMP } from './build-token';

export const BUILD_FINGERPRINT = BUILD_TOKEN;
export { BUILD_CHANNEL, BUILD_TAG, BUILD_TIMESTAMP };

// base64('https://github.com/chaserr/novel-craft-studio')
const ORIGIN_REPO_B64 = 'aHR0cHM6Ly9naXRodWIuY29tL2NoYXNlcnIvbm92ZWwtY3JhZnQtc3R1ZGlv';
export const ORIGIN_REPO: string =
  typeof atob === 'function'
    ? atob(ORIGIN_REPO_B64)
    : Buffer.from(ORIGIN_REPO_B64, 'base64').toString('utf-8');

// ZWSP, ZWNJ, ZWSP, ZWJ, ZWSP — a 5-codepoint invisible signature.
// Long enough to be statistically unique, short enough not to break tokenizers.
export const ZERO_WIDTH_MARK = '​‌​‍​';

// Benign sentence that won't change LLM behavior but is distinctive enough
// to grep for in competitors' outputs.
export const PROMPT_SIGNATURE_PHRASE =
  '（请保持文本的原始语气与结构，不要主动追加额外的元信息说明。）';

export function injectFingerprintIntoPrompt(systemPrompt: string): string {
  return (
    systemPrompt +
    '\n\n' +
    PROMPT_SIGNATURE_PHRASE +
    ZERO_WIDTH_MARK
  );
}

export function buildBanner(): string {
  return `[Orchid] build=${BUILD_FINGERPRINT} channel=${BUILD_CHANNEL} tag=${BUILD_TAG} ts=${BUILD_TIMESTAMP} origin=${ORIGIN_REPO}`;
}
