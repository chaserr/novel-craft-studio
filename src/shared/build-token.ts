// CI release pipeline overwrites this file with a per-tag unique token before
// running `electron-builder`. The mapping (tag → token) is kept in the author's
// private anti-misuse ledger, so any leaked build can be traced to its release.
// Do NOT change this file by hand. Do NOT remove it — see LICENSE.

export const BUILD_TOKEN = 'DEV-UNRELEASED';
export const BUILD_CHANNEL: 'dev' | 'release' = 'dev';
export const BUILD_TAG = 'dev';
export const BUILD_TIMESTAMP = '1970-01-01T00:00:00Z';
