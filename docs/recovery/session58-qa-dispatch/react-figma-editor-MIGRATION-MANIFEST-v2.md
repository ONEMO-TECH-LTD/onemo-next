# react-figma editor → `react-figma-editor` repo — MIGRATION MANIFEST v2

**Author:** @s58-designer · **2026-07-14** · supersedes v1 (SHA `255b2b6a…`, REWORKED by @s58-qa F1–F7). Authored INSIDE tracked branch `session58-task/qa-dispatch-recovery` per QA requirement. Zero mutation of any source; no repo created.
**Source (verified):** worktree `onemo-next/.codex/worktrees/s58-framer-architecture` · branch `session58-task/s58-framer-architecture` · HEAD `dd7299add730476e2f47a3eddff33b500339ca98` · CLEAN · merge-base `2270b8a8…` · branch delta 380 commits / 131 paths (mixed; this manifest = editor subset only).
**Docs authority:** recovery commit `79623bf7fed6393eef2aa4d43e27269e77f08cdb` (203 files, byte-verified).

## Legend
**MOVE** = editor's own code, history preserved · **FOLD** = separate repo brought in with its history · **GENERATE** = fresh minimal scaffold (no history claim) · **COPY** = present-state bytes (no history claim) · **EXCLUDE** = not in new repo (never a source deletion) · **N/A** = test-fixture string.

## A. MOVE — history-preserved (updated per F1/F2)
| Path | Why / caller | Verification |
|---|---|---|
| `src/app/(dev)/react-figma/**` (incl. `component-authoring/`, `engine.ts`, ENGINE-PLAN docs; **excl. `canvas/` per F6**) | the editor route | route renders standalone |
| `src/app/(dev)/react-figma-components/` (`.gitkeep`) | project write-target — `ComponentCanvas.tsx:14,26` `require.context`; `lib.ts:2548` emits imports here | create-from-selection E2E |
| `src/app/api/dev/editor/**` | core API + `authoring-store/-transaction/durable-file-installer/runtime-root-registry/source-projection/authoring-types/lib.ts` + `__tests__/` | vitest suite |
| 12 fetched roots: `editor-write -authoring -components -fs -image -pages -resolve -sandbox -source -sources -tokens` + `editor` | verified runtime fetches (17/6/5/4/3/3/2/2/1/1/1/1) | route probes |
| `editor-engine/**` | tagging-loader + K-001 provenance policy + audit/ | loader tests 47/47 |
| `src/lib/editor-source-provenance.ts` | `@/lib/editor-source-provenance` ×2 | typecheck |
| **F1:** `tests/e2e/**` (spec, `authoring-fixture.mjs`, `restore-authoring-fixture.mjs`, `run-authoring-server.mjs`, `fixtures/authoring-real-page/{page.tsx,AuthoringE2ECard.module.css}`) + `playwright.config.ts` + `vitest.config.ts` + `src/types/react-is.d.ts` | the committed standalone acceptance system — repo cannot claim E2E/test parity without it | full E2E suite green standalone |
| **F2:** `storybook/design-system/variables/figma-export.json` | REAL runtime dep — `editor-tokens/route.ts:20,92` reads it for `?figma=1` + scope/original metadata | `?figma=1` returns data standalone |

**F2 boundary:** ONLY `figma-export.json` moves from `storybook/design-system/variables/` — `resolver.ts`/`save-plugin.ts`/`VariablesPanel*` have zero editor imports (verified) → EXCLUDE. Destination path in new repo may re-root (e.g. `data/figma-export.json`) with `route.ts` path updated in the same commit — flagged as the one permitted source-line change, QA-gated.

## B. FOLD — component library (F3 CONDITIONAL boundary per QA)
- **Migration input = CLEAN `0af96bd`** (preserved worktree `onemo-component-library-s58-framer-architecture`, branch `session58-task/s58-framer-architecture-library`). FOLD with its own history; rename to `react-figma-component-library` inside the tool (Dan naming directive) — rename recorded as a commit in the new repo, not history rewriting.
- **Dirty main bytes HELD for Dan disposition — never scratched, never averaged:** main dir HEAD `1b7732e` + uncommitted `src/buttons/DemoButton.tsx` (M, 4+/7−) SHA-256 `8f2d9300dc2912c86f15563df5f24fdcf490e07966488baab7ee215d05c94131` + untracked `src/buttons/DemoButton.module.css` SHA-256 `2d6faf104db948519ed12805aedf124bc6fd5d65c8c84a06ecff63cce5a032f6`. Bytes remain in place untouched. Final library fold binds only after Dan keeps/drops these.

## C. GENERATE — fresh minimal scaffold (no history claim) (updated per F7)
| Item | Content |
|---|---|
| `next.config.ts` | ONLY: editor dev webpack tagging block + `loadSourceProvenanceCapability` minting + `transpilePackages:["react-figma-component-library"]`. DROP Creator-only: COOP/COEP headers, `paper$` aliases, scripts IgnorePlugin. |
| `package.json` | Verified editor deps ONLY: `next@16.1.6, react@19.2.3, react-dom@19.2.3, react-is, @phosphor-icons/react, postcss, postcss-value-parser, postcss-selector-parser` + library (`file:` or workspace). Dev: `typescript, tailwindcss@4, @tailwindcss/postcss, vitest, @playwright/test, eslint, eslint-config-next, @types/{node,react,react-dom}, ajv, culori` (ajv/culori: used by ds-pipeline converter + tests — verify at build). Scripts: dev(`--webpack`)/build/test/test:e2e/typecheck/lint. |
| `tsconfig.json` | adapt from source; `@/*`→`./src/*`. |
| **F7:** `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `next-env.d.ts` (generated), `src/app/layout.tsx` (minimal, keeps tokens import + favicon ref), `public/favicon.ico` (COPY; note: delta's single rename `src/app/favicon.ico→public/favicon.ico` lands here) | present-state COPY/GENERATE, no history claim. |

## D. SKIN — tokens (converter contract closed per QA)
- **Converter:** `onemo-ssot-global/tools/ds-pipeline/` (`build-tokens.mjs` + `naming.mjs` + validators; verified present). COPY the pipeline dir into the tool (`tools/ds-pipeline/`), no history claim.
- **Input:** v2.3.2 JSON — `onemo-ssot-global/.claude/worktrees/s58-editor-token-loop/11-design-system/figma-var/figma variables v2.3.2 - 13 Jul 2026.json` (verified, 1,012,880 bytes). COPY into tool as the pinned token source.
- **Outputs:** `src/app/tokens/{tokens.css,tokens.tailwind.css,tokens.ts}` — COPY current (working baseline) THEN regenerate from v2.3.2 via the copied converter as a separate, diffable commit. `globals.css` COPY (imports tokens + tailwind).
- **F2 note:** `figma-export.json` (section A) is a DIFFERENT artifact than the converter input — it is the editor-tokens API's Variables metadata. Both move.

## E. EXCLUDE (QA-dispositioned; no source deletion)
| Path | Disposition |
|---|---|
| **F5** `src/app/api/dev/editor-component-model/` | EXCLUDE — documented CEMETERY: real dev route, ZERO callers (verified). Provenance retained via recovery branch + source branch; recorded here as explicitly excluded dead surface. |
| **F6** `src/app/(dev)/react-figma/canvas/` + `storybook/prototypes/create-studio/Editor402.{tsx,stories.tsx}` | EXCLUDE — separate DEMO surface (glass-screen host), not the editor acceptance target. Recorded as excluded demo; bytes stay in onemo-next. |
| `src/app/api/dev/assets`, `src/app/api/dev/scenes` | not editor's (never fetched/imported). |
| `storybook/design-system/variables/{resolver.ts,save-plugin.ts,VariablesPanel*,LEDGER.md}` | zero editor imports. |
| All Creator surfaces (effect-creator, three/theatre/paper/huggingface deps, other icon packs) | verified zero editor imports. |

## F. N/A — test-fixture strings (not deps)
`@/tone`, `@/missing`, `@/types`, `../../Icon`, `@/app/(dev)/react-figma-components/Card`, `@outside/tone` — occur only inside `.test.ts` template literals (fake user source compiled by the editor's own parser in tests).

## G. DOCS RELOCATION (per QA requirement)
The 203-file authority set relocates into the new repo at `docs/session58-qa-dispatch/` **from recovery commit `79623bf`** (cherry-pick/subtree of `docs/recovery/session58-qa-dispatch` so the recovery commit is the provenance anchor — not loose-byte copy). Loose `__qa-dispatch/` originals remain untouched until new-repo byte/hash verification of all 203 + Dan approval.

## H. F4 — HISTORY METHOD (enumerated, in-manifest)
**Predecessor-path audit (executed, results):**
- Delta scan `2270b8a..dd7299a` `--diff-filter=R -M`: **exactly 1 rename** — `src/app/favicon.ico → public/favicon.ico` (scaffold item, section C; not a MOVE surface).
- Full-history scan (`--all`) filtered to every MOVE surface: **ZERO renames whose new path enters the MOVE set.** Editor paths were born at their current locations; first editor commit `f9d0431` (2026-07-03, "Snapshot phase6 UI build"); 355 total editor-path commits.
- **Conclusion:** the MOVE path-set has NO historical predecessor paths → `git filter-repo` on the literal section-A path list preserves complete history; no `--path-rename` needed for capture (only for optional re-rooting, which does not lose history).
**Equivalence criteria (throwaway-clone proof, before any real run):**
1. Commit count: filtered repo commit count == `git rev-list --count HEAD -- <path-set>` in source (355 ± merge-commit pruning, each pruned merge listed).
2. Content: for every MOVE file, blob SHA at filtered HEAD == source HEAD blob SHA (100% match required).
3. Samples: ≥5 commits (incl. `f9d0431` first, `5b3b458` K-001 R4, `dd7299a` tip) — full diff equivalence source vs filtered.
4. Zero writes to any real source; throwaway clone only; QA independently re-runs the checks.

## I. CUTOVER (reversible; unchanged)
Order: QA passes v2 → history proof on throwaway clone (H) → create `react-figma-editor` repo → import filtered history + FOLD library (clean `0af96bd`) + GENERATE scaffold + SKIN + docs (G) → standalone acceptance: `npm install`, `npm run typecheck`, `next build --webpack`, vitest suite, Playwright E2E headed, editor route renders — ALL QA-gated → Dan reviews → ONLY THEN, with Dan's separate approval, onemo-next strip-out (separate plan, not authorized by this manifest). No source deletion exists in this manifest.

## Open for Dan (non-blocking per QA)
1. F3 dirty DemoButton bytes (hashes above): keep-and-commit into library, or drop (clean `0af96bd` stands)?
2. GitHub remote for `react-figma-editor` under ONEMO-TECH-LTD: create now or local-first?
