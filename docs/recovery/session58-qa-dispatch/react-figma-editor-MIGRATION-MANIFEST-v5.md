# react-figma editor → `react-figma-editor` repo — MIGRATION MANIFEST v5

**Author:** @s58-designer · **2026-07-14** · supersedes v4 (`49944d95` / `d9e2599b…`, REWORKED V4-F1…F3). Tracked on `session58-task/qa-dispatch-recovery`. Zero source mutation; no repo; filter-repo approval-held.
**v4 stands** (workspace-root law, A1–A12, audit reclass direction, ds allowlist, ERRORS split) **except as amended below.**

## V4-F1 fix — PATHSET-v5: literal include set that CANNOT capture canvas
The parent dir `src/app/(dev)/react-figma` is REMOVED from the filter input; its children are enumerated instead (git-verified child census: 5 .md docs, `canvas/`, `component-authoring/` (10 files), `engine.ts`, `engine.test.ts`, `page.tsx`):

**PATHSET-v5 (exact filter input, verbatim):**
```
src/app/(dev)/react-figma/page.tsx
src/app/(dev)/react-figma/engine.ts
src/app/(dev)/react-figma/engine.test.ts
src/app/(dev)/react-figma/component-authoring
src/app/(dev)/react-figma/ENGINE-PLAN.md
src/app/(dev)/react-figma/ENGINE-PLAN-E2.4.md
src/app/(dev)/react-figma/FIGMA-SPEC-text.md
src/app/(dev)/react-figma/FIGMA-SPEC-variable-pill.md
src/app/(dev)/react-figma/INSPECTOR_STOCKTAKE.md
src/app/(dev)/react-figma-components
src/app/(dev)/react-figma-pages
src/app/api/dev/editor
src/app/api/dev/editor-write
src/app/api/dev/editor-authoring
src/app/api/dev/editor-components
src/app/api/dev/editor-fs
src/app/api/dev/editor-image
src/app/api/dev/editor-pages
src/app/api/dev/editor-resolve
src/app/api/dev/editor-sandbox
src/app/api/dev/editor-source
src/app/api/dev/editor-sources
src/app/api/dev/editor-tokens
editor-engine/tagging-loader.cjs
editor-engine/source-provenance-policy.cjs
editor-engine/source-provenance-policy.d.cts
editor-engine/tagging-loader.test.ts
src/lib/editor-source-provenance.ts
tests/e2e
playwright.config.ts
vitest.config.ts
src/types/react-is.d.ts
storybook/design-system/variables/figma-export.json
```
- Replayed count: `git rev-list --count HEAD -- <PATHSET-v5>` = **366** (2026-07-14; canvas-inclusive v4 set was 373; canvas itself touches 1 commit — the deltas beyond it are commits whose only PATHSET intersection was canvas/parent-dir capture).
- **Filtered-TREE assertions (commit count alone proves nothing about tree membership — QA law):** after the throwaway filter run: (1) `git ls-tree -r --name-only HEAD | grep -c '^src/app/(dev)/react-figma/canvas'` == **0**; (2) every PATHSET-v5 path present at filtered HEAD with blob-SHA == source HEAD blob-SHA (100%); (3) filtered repo BUILD PROOF — `next build --webpack` (with scaffold) has no unresolved Editor402/canvas import because canvas never entered the tree.

## V4-F2 fix — audit EVIDENCE-COPY: exact 20-file allowlist (git ls-files verbatim, no silent loss)
`E8-figma-vs-build-evidence.md · README-figma-parity.md · audit-export.mjs · field-pixel-fidelity.mjs · figma-census-full.json · figma-census.js · figma-parity.mjs · figma-refs/README.md · figma-refs/gap.png · figma-refs/manifest.json · figma-refs/resize-h.png · figma-refs/resize-w.png · figma-refs/rotation.png · figma-refs/x-position.png · figma-refs/y-position.png · figma-spec.json · figma-vars-census.js · figma-vs-build-evidence.mjs · input-behavior.mjs · inspector-conformance.mjs` → all 20 EVIDENCE-COPY to `docs/audit-evidence/e8/` (v4's "13 files" was a top-level visual count — corrected).

## V4-F3 fix — full extension census + corrected scan authority
**Extension census of MOVE files (git-derived):** `.ts×68 · .tsx×8 · .md×5 · .mjs×3 · .cjs×2 · .css×1 · .cts×1 · .json×1 · .gitkeep×1` — total 90.
**Corrected replayable scan (covers EVERY text extension present):** `git ls-files <PATHSET-v5> | grep -E '\.(ts|tsx|cts|cjs|mjs|json|css|md)$' | xargs grep -ln "/Users/\|onemo-next\|\.codex/worktrees\|onemo-dev\|converted/mother-v2\|effect-creator"` → **exactly 6 files** (replayed):
| File | Disposition |
|---|---|
| `react-figma/ENGINE-PLAN.md` | NEW vs v4: historical plan doc references old paths — inert documentation; disposition: MOVE as-is, provenance note in new-repo README (docs are history, not runtime) |
| `react-figma/page.tsx` | A1 |
| `editor-fs/route.ts` | A10 |
| `editor-pages/route.ts` | A10 |
| `editor/__tests__/authoring-schema.test.ts` | A12 |
| `editor/lib.ts` | A9 (comment) |
`.css` (AuthoringE2ECard.module.css) and `.cts` (policy d.cts) scanned — no hits. **`.gitkeep` disposition:** `react-figma-components/.gitkeep` = the only non-text-matched file; MOVE (empty write-target marker; required by require.context + inventory seed).

## Cutover (v4 order stands; substitutions)
PATHSET-v5 + count **366** + filtered-tree assertions (above) replace v4's set/count; audit EVIDENCE-COPY = the 20-file allowlist. Everything else unchanged: QA pass → Dan/QA ack brew install git-filter-repo → throwaway proof (QA re-runs) → repo → import → FOLD library (clean `0af96bd`, dirty bytes HELD `8f2d9300…`/`2d6faf10…`) → scaffold → skin → docs from `79623bf` → A1–A12 gated → standalone acceptance incl. depth matrix → Dan review → separate Dan approval for strip-out.

## Open for Dan (unchanged)
1. DemoButton dirty bytes keep/drop. 2. GitHub remote now vs local-first. 3. A7 token-path (default: keep, zero-edit).
