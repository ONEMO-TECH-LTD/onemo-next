# react-figma editor → `react-figma-editor` repo — MIGRATION MANIFEST v1 (FROZEN)

**Author:** @s58-designer · **2026-07-13** · built from FULL READS, zero mutation. For @s58-qa independent gate BEFORE any repo creation / history command / copy.
**Source (verified):** worktree `onemo-next/.codex/worktrees/s58-framer-architecture` · branch `session58-task/s58-framer-architecture` · HEAD `dd7299add730476e2f47a3eddff33b500339ca98` · CLEAN (0 uncommitted) · merge-base w/ staging `2270b8a88ee63e28b7cf35ef789b7fcfe90cbaee` · branch delta 380 commits / 131 paths (the delta MIXES editor + non-editor product work — this manifest is the EDITOR SUBSET only).

## History-treatment legend
- **MOVE** = the editor's own code; history MUST be preserved into the new repo (rename-aware, files moved over 380 commits).
- **FOLD** = separate existing repo, brought in with its own history.
- **GENERATE** = new minimal scaffold authored fresh in the new repo (NOT claimed as migrated history).
- **COPY** = present-state file taken as-is (history NOT preserved — labeled, per QA guardrail 2).
- **EXCLUDE** = not in the new repo (NOT a source deletion — per QA guardrail 1).
- **N/A** = test-fixture string, no real dependency.

## A. MOVE — editor code (history-preserved)
| Path | Why | Importer/caller | History |
|---|---|---|---|
| `src/app/(dev)/react-figma/**` | The editor UI, canvas, `component-authoring/`, `engine.ts`, ENGINE-PLAN docs | the app route | MOVE |
| `src/app/(dev)/react-figma-components/` (`.gitkeep`) | Project-component WRITE TARGET — `ComponentCanvas.tsx:14/26` `require.context('../../react-figma-components')`; `lib.ts:2548` writes `@/app/(dev)/react-figma-components/<name>` imports | editor runtime | MOVE |
| `src/app/api/dev/editor/**` | Core editor API + `authoring-store`, `authoring-transaction`, `durable-file-installer`, `runtime-root-registry`, `source-projection`, `authoring-types`, `lib.ts`, `__tests__/` | fetched `/api/dev/editor*`; internal `../` imports | MOVE |
| `src/app/api/dev/editor-write` `-authoring` `-components` `-fs` `-image` `-pages` `-resolve` `-sandbox` `-source` `-sources` `-tokens` | 12 editor-* endpoints the editor FETCHES (verified runtime fetch counts) | react-figma/** fetch calls | MOVE |
| `editor-engine/**` (`tagging-loader.cjs`, `source-provenance-policy.cjs` + `.d.cts` + test, `audit/`) | Build machinery: data-src tagging + K-001 provenance policy | `next.config.ts:82` webpack loader | MOVE |
| `src/lib/editor-source-provenance.ts` | `@/lib/editor-source-provenance` (2 imports) | react-figma + editor api | MOVE |

## B. FOLD — sibling repo into the tool
| Path | Why | History |
|---|---|---|
| `onemo-component-library/` (own git, HEAD `1b7732e`) | Editor's GLOBAL component root; `LIB_NAME='onemo-component-library'` (`lib.ts:57`, `tagging-loader.cjs:29`); consumed via `file:` dep + `transpilePackages` | FOLD (its own history; likely rename to `react-figma-component-library` inside the tool — Dan's naming directive) |

## C. GENERATE — fresh minimal scaffold (NOT migrated history)
| Path | Content (verified minimal set) |
|---|---|
| `next.config.ts` | ONLY the editor's dev webpack tagging-loader block + `loadSourceProvenanceCapability` minting. **DROP** the effect-creator COOP/COEP headers + `paper$`/paper-core aliases + scripts IgnorePlugin (all Creator-only, editor uses none). |
| `package.json` | **Verified editor npm deps ONLY:** `next, react, react-dom, react-is, @phosphor-icons/react, typescript, postcss, postcss-value-parser, postcss-selector-parser` + `onemo-component-library`(file:). Dev: `tailwindcss, @tailwindcss/postcss, vitest, @playwright/test, eslint, eslint-config-next, @types/{node,react,react-dom}`. **EXCLUDE the kitchen sink** — three/theatre/paper/@react-three/leva/@huggingface/supabase/all-other-icon-packs are Creator-only (editor imports NONE — verified). |
| `tsconfig.json` | COPY/adapt — `@/*` → `./src/*` (verified alias). |
| `postcss`/tailwind config | GENERATE (tailwind v4). |

## D. COPY / GENERATE — skin (present-state; Dan: bring converter + v2.3.2)
| Path | Treatment |
|---|---|
| `src/app/globals.css` + `src/app/layout.tsx` | COPY minimal (globals imports tokens + tailwind). |
| `src/app/tokens/{tokens.css, tokens.tailwind.css, tokens.ts}` | Converter OUTPUT. Dan's call: **regenerate from v2.3.2** — `onemo-ssot-global/.claude/worktrees/s58-editor-token-loop/11-design-system/figma-var/'figma variables v2.3.2 - 13 Jul 2026.json'` via the DS token converter (SSOT `tools/ds-pipeline`). COPY current as fallback. GENERATE (not migrated history). |
| DS token converter (SSOT ds-pipeline) | COPY into the tool so it can regenerate tokens. ⧗ locate exact path (OPEN-3). |

## E. MOVE (leaf) or EXCLUDE — decision needed
| Path | Note |
|---|---|
| `storybook/prototypes/create-studio/Editor402.{tsx,stories.tsx}` | Real runtime import in `react-figma/canvas/page.tsx:7` (the `/canvas` sub-route hosts Editor402, a glass-screen DEMO). Main editor route does NOT use it (`page.tsx:2588` says corpus, "not Editor402"). **DECISION:** include as a sample/demo host, or drop the `/canvas` route. |

## F. N/A — test-fixture strings (NOT real deps, no action)
`@/tone`, `@/missing`, `@/types`, `../../Icon`, `@/app/(dev)/react-figma-components/Card`, `@outside/tone` — all appear ONLY inside `.test.ts` backtick fixtures (fake user source the editor's own parser compiles in tests). NOT modules. No dependency.

## G. EXCLUDE (verified NOT editor's — never fetched/imported by react-figma)
`src/app/api/dev/assets`, `src/app/api/dev/scenes` — editor never fetches them. Not in scope.

## OPEN — for QA arbitration (I will not guess)
1. `src/app/api/dev/editor-component-model` — a 13th editor-* root NOT in the runtime-fetch list; confirm imported-type-module vs dead → MOVE or EXCLUDE.
2. Editor402 / `/canvas` route (section E) — include or drop.
3. Exact SSOT ds-pipeline converter path + whether v2.3.2 regen is in-scope-now or post-migration.
4. onemo-component-library: FOLD-with-history vs COPY-current; rename to `react-figma-component-library` now or later.

## HISTORY METHOD (proposed — proven on THROWAWAY clone before any real run)
`git filter-repo` with the section-A/B path-set + `--path-rename` audit (files moved across 380 commits → rename-aware). Prove on a throwaway clone: commit-count + sample-commit + rename/path-history equivalence, zero writes to real source. If `filter-repo` unavailable, review alternative before use.

## CUTOVER (reversible)
New repo built + standalone `npm install` + `next build --webpack` + editor route renders headed + tests pass (QA-gated) FIRST. onemo-next UNTOUCHED until Dan SEPARATELY approves strip-out. No source deletion in this manifest.
