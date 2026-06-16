# novel-craft-studio-private-ledger

> ⚠️ **PRIVATE REPOSITORY** — never make this public, never push from CI runners
> owned by anyone other than the project author.

This repo is the author's anti-commercial-misuse ledger for
**Orchid** (public repo: `chaserr/novel-craft-studio`). It is the single
source of truth for:

1. Which `BUILD_FINGERPRINT` was embedded in which public release
2. Which suspected commercial misuse incidents are under investigation
3. Evidence collected for each incident (screenshots, downloaded binaries,
   buyer receipts, etc.)
4. Legal correspondence (DMCA notices, takedown requests, lawyer drafts)

## Setup (one-time)

1. **Create the repo on GitHub as PRIVATE.**
   Suggested name: `novel-craft-studio-private-ledger`.

2. **Copy this folder into the new repo:**
   ```bash
   # from your local novel-craft-studio checkout
   cp -R .private-repo-template/* /path/to/new-private-repo/
   cp .private-repo-template/.gitignore /path/to/new-private-repo/ 2>/dev/null || true
   cd /path/to/new-private-repo
   git init
   git add .
   git commit -m "init: anti-misuse ledger scaffold"
   git remote add origin git@github.com:<you>/novel-craft-studio-private-ledger.git
   git push -u origin main
   ```

3. **Mint a fine-grained PAT** with `Contents: read+write` on this repo only.
   GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained → Generate new token. Save the value.

4. **On the PUBLIC `novel-craft-studio` repo**, add these Actions secrets
   (Settings → Secrets and variables → Actions → New repository secret):

   | Secret name        | Value                                          |
   |--------------------|------------------------------------------------|
   | `FINGERPRINT_SALT` | any random 32+ char string, never published    |
   | `LEDGER_REPO`      | `<you>/novel-craft-studio-private-ledger`      |
   | `LEDGER_REPO_PAT`  | the PAT minted in step 3                       |

5. **Done.** Next time you `git tag v0.x.y && git push --tags`, the public
   release workflow will:
   - generate a unique `BUILD_FINGERPRINT`
   - embed it in the distributed `.dmg` / `.exe`
   - append a new row to `releases/token-ledger.md` in THIS repo

## Folder layout

```
.
├── README.md                    ← this file
├── releases/
│   └── token-ledger.md          ← auto-appended by CI; tag → token mapping
├── incidents/
│   └── 0001-example.md          ← one file per suspected misuse case
├── evidence/
│   └── 0001/                    ← per-incident folder; binaries, screenshots
└── legal/
    ├── dmca-template.md         ← reusable DMCA takedown notice
    ├── cease-and-desist.md      ← reusable C&D letter template
    └── commercial-license.md    ← terms offered to legitimate commercial users
```

## Workflow when you suspect misuse

1. **Download the suspect binary / visit the suspect product.**
2. **Extract the fingerprint.** Three places to look:
   - launch the app; first line of stdout is `[Orchid] build=…`
   - in any chat the suspect product does, the LLM's system prompt often
     contains the zero-width signature `​‌​‍​` and
     the literal sentence `（请保持文本的原始语气与结构…）` (see
     `PROMPT_SIGNATURE_PHRASE` in `src/shared/fingerprint.ts`)
   - DevTools console: `await window.api.buildInfo?.()` returns the full
     `{fingerprint, channel, tag, timestamp, origin}` object (IPC channel
     `app:build-info`)
3. **Look up the fingerprint** in `releases/token-ledger.md`.
4. **Open an incident**: copy `incidents/0001-example.md` to a new numbered
   file, fill in suspect URL / fingerprint / dates / contact attempted.
5. **Collect evidence** under `evidence/<incident-id>/`.
6. **Send takedown** using `legal/dmca-template.md` (or escalate per
   jurisdiction).

## What this repo does NOT contain

- ❌ Source code of Orchid (that's the public `novel-craft-studio` repo)
- ❌ Anyone's API keys
- ❌ Personally identifying info about end users

It contains: tokens, URLs, timestamps, public screenshots, legal drafts.
That's it. Keep it that way.
