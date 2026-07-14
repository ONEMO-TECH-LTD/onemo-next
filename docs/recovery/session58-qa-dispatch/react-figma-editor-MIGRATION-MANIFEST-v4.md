# react-figma editor → `react-figma-editor` repo — MIGRATION MANIFEST v4

**Author:** @s58-designer · **2026-07-14** · supersedes v3 (`7fdf53d0` / `3a25d67c…`, REWORKED V3-F1…F4). Tracked on `session58-task/qa-dispatch-recovery`. Zero source mutation; no repo created; filter-repo still approval-held (not installed).
**Source:** `session58-task/s58-framer-architecture` @ `dd7299a…ca98` (CLEAN). **v3 stands except as amended below** (PATHSET/381, method, F5/F6 dispositions, ds allowlist, ERRORS split all verified by QA and unchanged).

## ONE WORKSPACE-ROOT LAW (shared; QA requirement)
`WORKSPACE_ROOT = path.dirname(<repo root>)` — the directory CONTAINING the repo, computed structurally, NEVER a relative hop-count. Every workspace-relative feature derives from it with its own env override: FS jail (A10: `EDITOR_FS_ROOT ?? WORKSPACE_ROOT`), sandbox registry (A11: `REACT_FIGMA_SANDBOX_REGISTRY ?? join(WORKSPACE_ROOT,'.react-figma-sandboxes.json')`), sandbox fork dirs (already `join(WORKSPACE_ROOT, basename(ROOT)+'--sandbox-…')`). One law, three consumers, one shared relocation-depth test matrix.

## V3-F1 fix — A10: FS-root law (depth-independent)
**Fact (read):** `editor-pages/route.ts:18` and `editor-fs/route.ts:15` both default `FS_ROOT = process.env.EDITOR_FS_ROOT ?? path.resolve(APP_ROOT, '../../..' + '/..')` — a HOP-COUNT that lands on `onemo-dev` only from the deep worktree. From `onemo-dev/react-figma-editor` it resolves to `/Users/daniilsolopov` (jail widens, wrong tree scanned).
**A10 (gated edits, both files + comments):** standalone root law = `process.env.EDITOR_FS_ROOT ?? path.dirname(<repo root>)` — "the workspace containing the repo," expressed structurally (dirname of the repo root), NEVER a relative hop-count. Comments updated to state the law.
**Acceptance — relocation-depth test matrix (committed tests):** with the repo at (a) `~/Dev/onemo-dev/react-figma-editor` (depth 3), (b) a 2-deeper nested path, (c) `EDITOR_FS_ROOT` explicitly set: FS jail == dirname(repo) for a+b, == override for c; editor-fs listing + editor-pages scan stay inside the jail in all three; E2E continues to set `EDITOR_FS_ROOT` explicitly.

## V3-F2 fix — A11: sandbox registry law (A5's "no-edit" claim WITHDRAWN — it was wrong)
**Fact:** `editor-sandbox/route.ts:51` `REGISTRY = join(dirname(dirname(ROOT)), '.react-figma-sandboxes.json')` — same hop-count disease; from a top-level repo it lands at `~/Dev/.react-figma-sandboxes.json` (outside the workspace area).
**A11 (gated edit):** `REGISTRY = process.env.REACT_FIGMA_SANDBOX_REGISTRY ?? join(dirname(ROOT), '.react-figma-sandboxes.json')` — sibling of the repo (the workspace), depth-independent, env-overridable. Sandbox forks live at `join(dirname(ROOT), basename(ROOT)+'--sandbox-<name>')` (already sibling-relative — unchanged).
**Acceptance:** registry relocation test in the same depth matrix as A10; fork/list/stop E2E finds the registry at the sibling location from both depths.

## V3-F3 fix — A6 amended: library rename is FIVE sites (one commit)
`editor/lib.ts:57` (LIB_NAME) · `editor-engine/tagging-loader.cjs:29` (LIB_NAME) · **`react-figma/page.tsx:2421` (`LIB_PREFIX = 'onemo-component-library/'`)** · new `next.config.ts` transpilePackages · new `package.json` dep. Acceptance: package-root component list/select/edit AND `splitFilesByHistoryRoot` package-bucket routing (the LIB_PREFIX consumer) green after rename.

## V3-F4 fix — `editor-engine/audit/` RECLASSIFIED: EVIDENCE-COPY, not runtime MOVE
**Fact (read):** audit dir = E8-era conformance-evidence tooling (13 files: *.mjs drivers, census JSON/JS, E8 evidence md, figma-refs); `figma-vs-build-evidence.mjs:167` hardcodes `cd ~/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine` — a RETIRED worktree. These are historical audit artifacts, not maintained standalone tooling.
**Disposition:** REMOVE from MOVE/PATHSET → **EVIDENCE-COPY** into new repo `docs/audit-evidence/e8/` with a provenance README line ("historical E8 evidence; commands reference retired s58 worktrees; not standalone tooling — no adaptation claim"). `editor-engine/{tagging-loader.cjs, source-provenance-policy.cjs, .d.cts, tagging-loader.test.ts}` remain MOVE (runtime-critical, literal-clean).
**PATHSET/count impact:** PATHSET amended: `editor-engine` → `editor-engine/tagging-loader.cjs editor-engine/source-provenance-policy.cjs editor-engine/source-provenance-policy.d.cts editor-engine/tagging-loader.test.ts` (4 files, audit/ excluded). Replay: `git rev-list --count HEAD -- <PATHSET-v4>` = **373** (replayed 2026-07-14 on the exact PATHSET-v4 above; audit-only commits drop out; QA replays independently).

## Exhaustive extension-aware literal scan (V3's gap closed; replayable)
Command (verbatim): `git ls-files <MOVE dirs+files> | grep -E '\.(ts|tsx|cjs|mjs|json)$' | xargs grep -ln "/Users/\|onemo-next\|\.codex/worktrees\|onemo-dev\|converted/mother-v2\|effect-creator"`
**Complete result — 6 files, each dispositioned:**
| File | Hit | Disposition |
|---|---|---|
| `react-figma/page.tsx` | `:2447,2589` `/converted/mother-v2` canvas default/list | **A1** (v3) |
| `editor-fs/route.ts` | `:6,15` FS_ROOT hop-count + comment | **A10** |
| `editor-pages/route.ts` | `:18` FS_ROOT hop-count | **A10** |
| `editor/lib.ts` | `:1920` comment "onemo-next/ symlinks" | **A9** (comment-only) |
| `editor/__tests__/authoring-schema.test.ts` | `:90` fixture string `canonicalPath: '/Users/daniilsolopov/Dev/onemo-dev/onemo-next'` | **A12 (new, gated):** inert fixture string, but neutralize to a generic path in the new repo so tests carry no machine/user literal; acceptance: vitest green |
| `editor-engine/audit/figma-vs-build-evidence.mjs` | `:167` retired-worktree cd | **V3-F4 reclass** (evidence, not runtime) |
No other MOVE file matches (scan covers ts/tsx/cjs/mjs/json; md/docs carry historical references by design and are not runtime).

## Adaptation ledger — consolidated index (all gated, each its own commit in NEW repo)
A1 canvas default/list · A2 editor-sources demo entry · A3 editor-fs Editor402 map · A4 HISTORY_PATHS drop canvas · A5 (superseded by A11 — withdrawal recorded) · A6 five-site library rename · A7/A8 token-path pair (Dan default: keep path, zero-edit) · A9 comment · **A10 FS-root law + depth matrix** · **A11 registry law + relocation test** · **A12 test-fixture literal neutralization**.

## Cutover order (v3 stands, amended)
QA passes v4 → Dan/QA ack `brew install git-filter-repo` → throwaway proof (PATHSET-v4, count 373, blob-SHA 100%, ≥5 sample commits, QA re-runs) → create repo → filtered import → FOLD library (clean `0af96bd`; dirty bytes HELD: `8f2d9300…`/`2d6faf10…`) → scaffold → skin → docs relocation (from `79623bf`) + audit EVIDENCE-COPY → **A1–A12 gated commits** → standalone acceptance incl. A10/A11 depth matrix → Dan review → separate Dan approval for any onemo-next strip-out.

## Open for Dan (unchanged)
1. Dirty DemoButton bytes keep/drop. 2. GitHub remote now vs local-first. 3. A7 token-path (default: keep, zero-edit).
