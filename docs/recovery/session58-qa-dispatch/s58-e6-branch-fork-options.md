# E6.9 — Sandbox branching + time-capsule versioning — design (KAI-9359)

Dan's model (2026-07-05, supersedes the worktree proposal): no full git worktree ceremony — **a branch = a plain copy of the build folder run as a sandbox on its own port**. Everything runs sandboxed until explicitly saved to the original. Forks/versions = copies of the current sandbox state. Plus **automatic Figma/Framer-style time-capsule versioning** so any change can be reverted.

## Sandbox copies — how it works on this machine
- **Copy is instant and near-free on macOS:** APFS copy-on-write clone (`cp -c`) duplicates the whole build folder — *including node_modules* — in seconds, sharing disk blocks until files diverge. No npm install, no worktree setup. This is exactly "just a copy of the build folder".
- **Run:** sandbox gets the next free port (3026, 3027…); the builds dropdown lists original + sandboxes, badge shows which is a sandbox of what.
- **Fork a fork:** "Create branch…" from inside a sandbox clones the *current sandbox state* — Dan's "forks of current state of sandboxed builds".
- **Save to original:** explicit action — the changed source files sync back to the original build (a time-capsule snapshot of the original is taken first, so even a save-back is revertable). Until then the original is untouched.
- Under the hood each sandbox keeps a lightweight git history purely as the snapshot engine — never surfaced to Dan; the UX is copy/save/restore.

## Time-capsule versioning — extracted behavior (verified, not invented)
- **Figma:** autosave checkpoint **every 30 minutes** (not event-triggered), plus checkpoints on connection loss/crash; versions can be named/annotated; restore or duplicate-from-version. ([help.figma.com](https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history), [figma.com/blog autosave](https://www.figma.com/blog/behind-the-feature-autosave/))
- **Framer:** automatic snapshots with **tiered thinning — every 5 min for the last 4 hours, hourly for the last 24h, daily thereafter**; older versions view-only, copy elements forward; ⇧⌘H panel. ([framer.com/help revert](https://www.framer.com/help/articles/how-can-i-revert-to-a-previous-working-version-of-my-file/), [framer.com/updates](https://www.framer.com/updates/version-history-update))

## Our versioning model (Framer tiering + our natural event)
1. **Snapshot on every Publish** — each save-to-code is a named checkpoint (we already know exactly what changed: the staged-changes list becomes the version annotation). This is better than time-only: every meaningful change is capturable.
2. **Time tier on top** (Framer-style): 5-min snapshots kept 4h → hourly kept 24h → daily kept after — auto-thinned so history stays light.
3. **Version History panel** in the file menu (matches the extracted Figma menu's "Show version history" entry): list of checkpoints (publish-annotated + timed), click to preview the sandbox at that version on a temp port, **Restore** rolls the sandbox back, **Fork from here** clones that state as a new sandbox.
4. Storage: git commits inside the sandbox (invisible), thinning = dropping refs. Zero new infra, exact restores, diffs for free.

## Build order (backend = me, panel UI = engineer lane)
1. `sandbox-fork` op (APFS clone + port allocate + registry entry) + builds-dropdown wiring.
2. Snapshot engine (publish-hook + timed tier + thinning).
3. Version History panel (Figma menu anatomy already extracted) + restore/fork-from-version.
4. `save-to-original` sync op (snapshot-first, then apply).
