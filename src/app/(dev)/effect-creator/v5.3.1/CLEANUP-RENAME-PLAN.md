# Creator v5.3.1 — Final Cleanup + Rename Execution Plan

**Status:** APPROVED — code-verified, independently re-traced by **s57-qa** + **sidekick**, Dan's verdicts in. Ready to execute. Every kill/keep is grounded in an actual code read (file:line), not assumptions.

## Recovery anchors (roll back at any point)
- Snapshot commit `798b191` (clean as-is, on `creator-v5.3`).
- Backup branch `backup/creator-asis-pre-cleanup-2026-06-23` (pushed to origin).
- Tarball `~/Dev/onemo-dev/_creator-asis-backup-2026-06-23.tar.gz`.
- **Every step is its own commit** → `git revert <sha>` rolls back one step; the snapshot is the floor. **No force-push, ever.**

## Green gate — corrected (bare `tsc` lies on a stale cache)
After each commit, before the next:
1. **`next build`** — regenerates `.next/types` route stubs + typechecks. (Proven: bare `npm run typecheck` reports a false `TS2307` after deleting a route because the stale generated `.next/types/.../page.ts` still imports the deleted source. `next build` regenerates and is authoritative.)
2. **`npm test -- --run`** — full suite (baseline: 34 files / **210 pass** / 10 skip).
3. **Runtime-critical commits** (adapter extract, studio-kill, rename): load the live Creator route + **confirm the 3D golden scene renders** — build-green ≠ runtime-safe; the scene-format dep is a runtime load.
4. **Tiering (sidekick-approved):** the 4 decoupled dead-route deletions (0 external refs) get the next-build typecheck per commit + one full build+vitest+3D at the batch end; full 3D-load is spent on extract/studio-kill/rename.

## CODE-VERIFIED KEEP — off-limits
| keep | evidence |
|---|---|
| `studio-v2/` | ONEMO Studio v2 — three + electron, `dist-electron/mac-arm64/Studio.app`, runs on **8088** (`vite.config.ts:79`) / as the Mac app. The current 3D studio. Separate keeper, NOT Creator code. |
| scene-format adapter `studio/src/editor/adapter/{onemo-deserialize,onemo-format}` | imported by `v3/core/onemo-loader.ts:14-15` (the live `.onemo` 3D loader); deps = jszip + three (npm). **Extract into the Creator — don't lose.** |
| `lib/outline-core/index.ts` barrel + `math.ts` + ring-math in `resolver.ts` | 7 live tests + the engine import `fairingFromDetail`/`validateSelfIntersection` through it. |
| live lib `lib/{effect, vector-core, shape-library, export}` + `outline-core/{math,hash}` | imported by v3 (36/12/4/2 refs). |
| `effect-creator/v5.3.1` → renamed `v5.3.1` | the live build. |
| generated `src/app/tokens/*.css` | the live app renders from it until v5.4 adopts DS-V2.1. **Keep even though the `/dev/tokens` tool is being retired.** |

## CODE-VERIFIED KILL — 0 external refs (re-trace at delete-time)
| kill | evidence |
|---|---|
| `effect-creator/v1` | 0 external code/test refs. Imports the adapter → **delete BEFORE the extraction.** |
| `effect-creator/v2` | 0 external refs; imports the adapter. |
| `(dev)/prototype` | 0 external refs; imports the adapter. |
| `(dev)/shaped` | 0 external refs; imports the adapter. |
| `(dev)/studio` route | `page.tsx:3` iframes `http://127.0.0.1:3487` = the OLD `studio/` editor's dev server, whose runtime is DEAD (nothing serves 3487; `studio/package.json` serves *its* dist there). An orphan window onto the dead old studio → **dies with `studio/`** (step 7). studio-v2 (8088) untouched. |
| old `studio/` bulk (~885 files / 26M) | PlayCanvas-fork-on-three editor, superseded by studio-v2. KILL **after** the adapter is extracted + scene-storage handled (below). |
| `_3d-editor-eval/` (OUT-OF-REPO, `~/Dev/onemo-dev/_3d-editor-eval`) | three.js editor eval clone — 0 src refs. **Separate filesystem cleanup, NOT a v5.3.1 repo commit;** confirm recoverable clone before `rm`. |
| **`/dev/tokens` old-token pipeline** | `api/dev/generate/route.ts:12` runs `scripts/tokens/build-tokens.mjs` — the OLD converter DS-V2.1 retired (orphan, last touched 03-24). **Dan: "old dash can go — we have the current one in the storybook."** KILL the FULL surface: dashboard + `/api/dev/{validate,generate,output,save}` + `scripts/tokens/*` (build-tokens, blueprint-validator, tokens.config, test-build-tokens, validate-tokens, mappings) + package scripts + stale token docs. **KEEP `src/app/tokens/*.css`** (live app renders from it until v5.4). |

## Scene-storage — RESOLVED in code (the studio kill is scene-safe)
The live golden the Creator loads is `data/scenes/golden.onemo` — a real 22 MB app-level file (via `/api/dev/scenes/golden`). `data/scenes/` otherwise holds only `default.json`; `golden-v1.onemo`/`golden-v2.onemo` are **symlinks** into `public/assets/templates/golden-effect-70mm/` (where the real draco templates live). **All app-level, NONE in `studio/`** (verified: `ls -la data/scenes` + `git ls-files`). `studio/data/scenes/` is EMPTY; `api/dev/scenes/route.ts:10` guards a missing dir (`mkdir … {recursive:true}`) so the kill can't throw. In the studio-kill commit, strip ALL vestigial `STUDIO_SCENES_DIR` refs — `route.ts` (const + `mkdir` + `readdir` + binary-save) AND `[name]/route.ts` (`studioJsonPath`/`studioOnemoPath`) — so the kill is total (else `route.ts:10` re-creates a phantom `studio/data/scenes`).

## DEFERRED — separate surgical pass (not this cleanup)
- `outline-core` dead document-runtime (`sdf`/`livewire`/`reducer`/`resolveOutlineDocument` + unused `OutlineDocument` types) — mixed live/dead; current tests still cover them → a test-aware retirement pass, NOT part of the broad cleanup.

## EXECUTION SEQUENCE — one commit (rollback snapshot) per step
1. del `v1` → gate → commit
2. del `v2` → gate → commit
3. del `prototype` → gate → commit
4. del `shaped` → gate → commit  **(batch-end: full build + vitest + live-3D)**
5. extract adapter → `v5.3.1/core/scene-format/`, repoint loader, fix `ARCHITECTURE.md:71` doc-string → **full 3D gate** → commit
6. scene-storage cleanup — strip vestigial `STUDIO_SCENES_DIR` refs from `api/dev/scenes/{route,[name]/route}.ts` → gate → commit
7. del old `studio/` bulk **+ the `(dev)/studio` route** (both = the dead old studio) → **full 3D gate** → commit
8. del `/dev/tokens` FULL old-token-pipeline — dashboard + `/api/dev/{validate,generate,output,save}` + `scripts/tokens/*` + package scripts + stale token docs; **KEEP `src/app/tokens/*.css`** → gate → commit
9. rename `v3`→`v5.3.1` (route folder + imports + docs + `EffectCreatorV3Page` export + `next.config` distDir + V3 comments) → **full 3D gate** → commit
10. rename branch/worktree → `creator-v5.3.1`
11. *(out-of-repo)* `rm -rf ~/Dev/onemo-dev/_3d-editor-eval` after confirming it's a recoverable clone (no repo commit)
12. PR → onemo-next `staging` → s57-qa + sidekick re-trace each deletion commit → CI → **Dan's explicit go** → merge
13. Close-out: cancel the v5.3 blueprint + Linear `KAI-9132`; relabel the as-built `v5.2.1`→`v5.3.1`; cut `v5.4` from merged-clean v5.3.1 → then the `useCreator()`/CreatorAPI socket + design integration.

## Final baseline checks (snapshot 798b191, pre-cleanup) — GREEN ✅
- `next build`: **PASS** (0 errors)
- `npm test -- --run`: **PASS** — 34 test files (1 skipped) · **210 tests passed** / 10 skipped
- Verified 2026-06-23 on HEAD `798b191`. This is the green floor every step's gate must hold.

## Approval gate
- [x] **s57-qa** — independent code re-trace ✅ (scene wording precise; `/dev/tokens` kill = full old-pipeline surface, keep `tokens/*.css`).
- [x] **sidekick** — independent code re-trace ✅ (total `STUDIO_SCENES_DIR` strip in the studio-kill commit; `_3d-editor-eval` out-of-repo).
- [x] **Dan** — verdicts in: `(dev)/studio` route → kill **with** `studio/` (it's the dead 3487 old-studio window); `/dev/tokens` → **kill** (old dash retired, current is in the storybook), keep `tokens/*.css`.
