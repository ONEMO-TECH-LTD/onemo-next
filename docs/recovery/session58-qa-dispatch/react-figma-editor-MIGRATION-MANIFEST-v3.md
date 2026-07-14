# react-figma editor → `react-figma-editor` repo — MIGRATION MANIFEST v3

**Author:** @s58-designer · **2026-07-14** · supersedes v2 (`f5a9e883` / `0ae9fc2a…`, REWORKED V2-F1…F6). Tracked on `session58-task/qa-dispatch-recovery`. Zero source mutation; no repo created.
**Source:** `session58-task/s58-framer-architecture` @ `dd7299add730476e2f47a3eddff33b500339ca98` (CLEAN) · merge-base `2270b8a8…` · docs authority `79623bf7…` (203 files).
**Sections A–G and I of v2 stand except as amended below.** Legend unchanged (MOVE/FOLD/GENERATE/COPY/EXCLUDE/N-A).

## V2-F3 fix — MOVE set gains the pages root
| Path | Why | Evidence |
|---|---|---|
| `src/app/(dev)/react-figma-pages/**` (currently `new-page/page.tsx`) | REAL editor write/runtime target: `editor/lib.ts:2011` scaffolds new pages here; `editor-sandbox/route.ts:31` lists it in `HISTORY_PATHS` | MOVE, history-preserved. Standalone page lifecycle keeps its target + seed. |

## V2-F1 fix — replayable path-set count (THE literal set)
Canonical MOVE path-set = **PATHSET** (exactly): `src/app/(dev)/react-figma` · `src/app/(dev)/react-figma-components` · `src/app/(dev)/react-figma-pages` · `src/app/api/dev/editor` · `src/app/api/dev/editor-write` · `-authoring` · `-components` · `-fs` · `-image` · `-pages` · `-resolve` · `-sandbox` · `-source` · `-sources` · `-tokens` · `editor-engine` · `src/lib/editor-source-provenance.ts` · `tests/e2e` · `playwright.config.ts` · `vitest.config.ts` · `src/types/react-is.d.ts` · `storybook/design-system/variables/figma-export.json`
- Replayable: `git -C <src-worktree> rev-list --count HEAD -- <PATHSET…>` → **381** (verified 2026-07-14; QA replayed same).
- `--all` (407) is NOT the target metric — it counts recovery branches; equivalence binds to **HEAD lineage: 381**.
- Rename audit re-run on this exact set: delta `2270b8a..HEAD --diff-filter=R -M` → 1 rename (`src/app/favicon.ico→public/favicon.ico`, scaffold, non-MOVE). Full-history renames into PATHSET: none. (v2 §H equivalence criteria stand, with 381 as the count.)

## V2-F2 fix — executable history method
`git filter-repo` is NOT installed (verified: `git: 'filter-repo' is not a git command`). **Named method:** install via Homebrew — `brew install git-filter-repo` (brew present at `/opt/homebrew/bin/brew`; fallback `pip3 install git-filter-repo`, pip3 present). Installation is an APPROVED-STEP requiring Dan/QA ack before running; then the throwaway-clone proof per v2 §H with PATHSET + count 381. No deprecated `filter-branch`.

## V2-F4 fix — FULL standalone adaptation ledger (every source edit, gated; supersedes v2's "one token line")
Each edit lands as its own reviewable commit in the NEW repo (never in onemo-next), QA-gated with the acceptance listed:
| # | File:line (source) | Edit | Acceptance |
|---|---|---|---|
| A1 | `react-figma/page.tsx:2447,2589` | Canvas source list + DEFAULT canvas point at `/converted/mother-v2` (onemo product screen — does NOT migrate). Re-point default + list to migrated content: `react-figma-pages/new-page` and/or the E2E sample page | editor boots standalone with a working default canvas; no reference to non-existent routes |
| A2 | `editor-sources/route.ts:41` | Remove `editor-402` entry (F6-excluded demo) | sources list contains only migrated surfaces |
| A3 | `editor-fs/route.ts:20` | Remove `Editor402.stories.tsx → /react-figma/canvas` mapping | editor-fs map resolves only migrated files |
| A4 | `editor-sandbox/route.ts:31-34` | `HISTORY_PATHS`: drop `'src/app/(dev)/react-figma/canvas'` (excluded); keep pages/components roots | sandbox seed/history cycle green standalone |
| A5 | `editor-sandbox/route.ts` (full 298-line read done) | Registry `join(dirname(dirname(ROOT)),'.react-figma-sandboxes.json')`, fork (APFS `cp -c`, drops `.git`/`.next`, symlinks source node_modules, spawns `npm run dev -- --webpack`), history via private `.editor-history` git — ALL cwd-relative/generic, VERIFIED zero onemo literals beyond the A4 canvas entry; no edit, regression-test only. New repo MUST keep a `dev` script accepting `--webpack` (scaffold does) | sandbox fork/list/stop/snapshot/restore E2E |
| A6 | `editor/lib.ts:57` + `editor-engine/tagging-loader.cjs:29` + new `next.config.ts` transpilePackages + new `package.json` dep | `LIB_NAME 'onemo-component-library' → 'react-figma-component-library'` (Dan rename) — 4 coordinated sites, one commit | library components list/select/edit standalone |
| A7 | `editor-tokens/route.ts:20,92` | `FIGMA_EXPORT` path IF re-rooted from `storybook/design-system/variables/` (decision: keep same relative path in new repo → NO edit; re-root to `data/` → this edit) | `?figma=1` returns parsed JSON |
| A8 | `authoring-commands.ts:49` | `storybook/` prefix allowance — keep ONLY if A7 keeps the storybook/ path; drop with re-root | command source-path validation tests |
| A9 | `editor/lib.ts:1920` | comment mentions onemo-next consumer-root — comment-only, no behavior; optional cleanup | n/a |
No other onemo-specific literal exists in the editor surface (replayable: `grep -rn "converted/mother-v2\|effect-creator\|onemo-next\|storybook/" <editor dirs> --include="*.ts*"` minus tests/docs → exactly the sites above).

## V2-F5 fix — ds-pipeline exact allowlist (never wholesale)
COPY exactly the **18 tracked files** (`git -C onemo-ssot-global ls-files tools/ds-pipeline`): `.gitignore README.md blueprint-validator.mjs build-scan.mjs build-tokens.mjs generate-token-mapping.mjs naming.mjs package-lock.json package.json qa-blueprint-verify.mjs qa-mutation-test.mjs scan-tokens.mjs test-build-tokens.mjs token-mapping.json token-mapping.md tokens.config.mjs tokens.format-spec.json validate-tokens.mjs`. `node_modules/` + `scan-output/` NEVER copied; deps restored by `npm ci` in the new repo (lockfile in allowlist).

## V2-F6 fix — ERRORS.md disposition: SPLIT-EXTRACT
`ERRORS.md` (171 lines) holds load-bearing S58 E2E operational knowledge. Disposition: **extract the S58 sections** (from `## S58 authoring semantic integration test contention` L59 through EOF — incl. component-shell Playwright setup, committed-E2E cold-start stability, later S58 entries) into the new repo as `docs/E2E-OPERATIONAL-NOTES.md` (COPY, provenance line pointing at source commit). S57/Studio sections (L1–58) stay in onemo-next. Original untouched.

## Amended cutover order (v2 §I otherwise stands)
QA passes v3 → Dan/QA ack `brew install git-filter-repo` → throwaway-clone history proof (PATHSET, 381, blob-SHA + sample equivalence, QA re-runs) → create `react-figma-editor` → import filtered history → FOLD library (clean `0af96bd`; dirty bytes still HELD for Dan: `8f2d9300…` / `2d6faf10…`) → GENERATE scaffold → SKIN (18-file pipeline + v2.3.2 JSON + current outputs, regen as diffable commit) → docs relocation from `79623bf` → **adaptation ledger A1–A8 as gated commits** → standalone acceptance (install/typecheck/build/vitest/Playwright headed/route renders) → Dan review → separate Dan approval before ANY onemo-next strip-out.

## Open for Dan (unchanged + one new)
1. F3 dirty DemoButton bytes: keep-commit or drop.
2. GitHub remote now vs local-first.
3. A7 token-data location: keep `storybook/design-system/variables/` relative path (zero-edit) or re-root to `data/` (cleaner tree, +A7/A8 edits). Default if silent: keep path, zero-edit.
