# KAI-10216 independent QA ledger

## Denominator

- Baseline: `050d557e2ddbe99520c008e2090c202c554f03f8`.
- Candidate: `26d37579c0a119c2482212b6b84c482918937d75`.
- Branch/local/remote candidate: exact match.
- Candidate parent: exact baseline.
- Contract: 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`.
- Linear: KAI-10216 moved from Ready for QA to In QA review. KAI-10217 remains blocked.
- Tracked tree: clean at candidate; only `_WIP/` is untracked.

## Acceptance map

1. Preservation tests plus explicit later-task reproductions.
2. Keep the seven-file unit in place; classify every owner/dependency and map the direct adoption destination.
3. Move/re-export only existing reusable primitive and outline-producer owners; delete Cutout PerfHUD/perfGesture edges.
4. Preserve the current UI and existing flow `state`/`actions`/`view` API; no Figma/UI/interface project.
5. Delete dead `lastFileRef`.
6. Prove no intermediate package/relocation, no duplicate implementation, static gates, and the real Upload → Detect → edit → Preview/Save journey.

## Progress

- Contract and Builder handoff full-read.
- Candidate provenance, parent, remote equality, branch, and changed-file inventory verified.
- Diff: 10 tracked files, +370/-190. Full source/diff audit pending.
- Builder evidence values are not inherited. Independent headless and visual proof pending.

## Source read — `finish.ts`

- Full-read 378/378 lines.
- Candidate changes are limited to deleting the `perfGesture` dev import/two timing calls and switching the outline-control owner import to `@/lib/effect/trace-outline-controls`.
- Composition, output adapter, caches, settings, detector preparation, Blend behavior, and export behavior are unchanged. Later-increment defects remain intact.
- No new interface, Figma, relocation, or parallel output path appears.

## Source read — `flow.ts`

- Full-read 545/545 lines.
- Candidate removes only Cutout `perfGesture` import/marks and orphan timing variables/comments; operational flow, queue, history, lifecycle, detector, tool, output, and scheduler code remains unchanged.
- Existing return surface remains `state`, `actions`, `view`, plus top-level `measureNode`; no replacement interface is introduced.
- Six later-task defects remain visible in source, including non-atomic Upload, one-slot pending tool ownership, non-atomic restore, and unsettled output/lifecycle paths.

## Source read — `page.tsx`

- Full-read 449/449 lines.
- Candidate removes the Cutout `PerfHUD` import/mount only. Existing layout, controls, gesture wiring, admin calibration behavior, and flow consumption are unchanged.
- Existing UI still consumes `flow.state`, `flow.actions`, `flow.view`, and top-level `flow.measureNode`; no replacement API or UI project appears.
- Pre-existing future-Figma comment at line 6 is untouched historical prose, not an implementation. It belongs to the later stale-architecture/text closure, not this diff.

## Remaining changed files and move fidelity

- Full-read `v531seg.ts` 70/70, `core/primitives.ts` 95/95, `user/editor/producers.ts` 94/94, `cutout-v1-characterization.test.ts` 183/183, `trace-outline-controls.test.ts` 95/95, `src/lib/effect/cutout.ts` 15/15, and `src/lib/effect/trace-outline-controls.ts` 143/143.
- `runCutout` is an exact normalized move from the baseline primitive: only its local import specifiers changed. The legacy primitive now identity re-exports it.
- The trace-outline owner is an exact normalized move from the baseline producer: only its import ownership changed. The legacy producer identity re-exports the complete value/type surface.
- Current Cutout product callers use the new product-owned owners; legacy v5.3.1 callers remain compatible through re-exports. No second implementation survives.
- `git diff --check` is clean. Candidate remains 10 tracked files, +370/-190, with no product relocation or `onemo-effects-engine` edit.

## Adoption-map source check

- Full-read the clean repository root README, `src/lib/image-pipeline/README.md`, `src/lib/grid/README.md`, root `AGENTS.md`, and current `src/app/page.tsx`.
- The clean repo currently has only `src/app` and `src/lib/{grid,image-pipeline}` scaffolding. Its root law calls `src/lib` headless/no React/Next/DOM while the image-pipeline README calls that module browser-side; those statements conflict.
- The contract resolves that conflict by putting pure owners under `src/lib` and React/browser orchestration under `src/app`. The characterization map follows that locked split and does not populate or edit the clean repo. Exact target directories are a declared adoption map, not a claim that they already exist.

## Test-quality risk under review

- Identity re-export and outline-control tests exercise real values/behavior; `HistoryStack` is behavior-tested.
- Most broad preservation claims in `cutout-v1-characterization.test.ts` are source-string assertions rather than behavioral oracles. They prove surfaces/constants remain present, but not that Frame anchoring, Paint, Nodes, cancellation, GrabCut, Preview/Save, Clear, and Undo/Redo still behave correctly.
- The required live journey can cover one integrated happy path, but it cannot cover the full preservation set. Final QA disposition depends on whether the existing focused suite supplies the missing behavior coverage; no such Cutout flow/overlay tests are visible yet.

## Fresh QA static gates

- Focused characterization: 2 files passed; 10 passed plus six expected failures.
- Effect suite: 36 files passed; 410 passed plus six expected failures.
- Full repository suite: 56 files passed, one pre-existing skipped file; 520 passed, six expected failures, ten skipped. No unexpected failure.
- Typecheck: clean.
- Scoped ESLint across all ten changed files: clean.
- `git diff --check`: clean.
- Production build: clean; 22 routes generated. Only the repository's pre-existing Next middleware deprecation warning appeared.

## QA-owned live proof

- Surface: Chromium through Playwright on `http://127.0.0.1:4001/cutout-lab`.
- Provenance: PID 34639 serves this exact worktree; tracked HEAD is candidate `26d37579c0a119c2482212b6b84c482918937d75`.
- Exercised: Upload `public/assets/test-artwork.png` → Detect → observed `u2netp` success → Vector Detail 25 → Preview → Save.
- Repeated with a same-byte replacement under a different filename, then Detect and Save again. Both saved files are byte-identical: 1329x622, 8-bit RGBA, alpha present, SHA-256 `20ea0230c645f82ceefbb9f17dc5859466b5035928b8919ed13eb904ac80be3b`.
- Console: zero errors, zero warnings; only React DevTools info and HMR connection logs.
- Evidence: `KAI-10216-evidence/qa-upload-detect-detail25-preview.png` (SHA-256 `836ac8fda6fca5543992132d59e200289376378a21c321270f9008702ced34e6`), `qa-cutout.png`, and `qa-cutout-replacement.png`.
- Builder's corrected 1330x621/d7a28a claim is not reproducible on QA's exact-current path. QA's two independent saves reproduce Builder's earlier 1329x622/20ea result. This is an evidence-record discrepancy, not yet a product-code diagnosis.

## QA verdict — REVISE

### Finding 1 — preservation coverage is not behavioral

- Contract line 52 requires preservation tests across Frame, collective controls, Paint, Nodes, exact GrabCut, detector degradation, Clamp, Preview/Save, Clear, Undo/Redo, replacement, and cancellation.
- `cutout-v1-characterization.test.ts:104-140` checks most of that list by source-string presence. Those assertions can remain green when the named behavior is broken, so they do not freeze the working V1 behavior for later increments.
- Real behavioral coverage exists for outline controls and `HistoryStack`; QA's live path covers primary Detect, Detail, Preview/Save, and a successful replacement. Frame anchoring, Paint, Node interaction, exact GrabCut behavior, Clear/flow history semantics, cancellation, lazy Silueta, and visible flood-fill remain without behavior-level preservation oracles.
- Smallest correction: keep import/classification/absence checks static, but replace the broad behavior source-string test with behavior-level oracles at the existing seams. Do not add a new framework or product abstraction. Every contract behavior must either have a real automated oracle or an exact existing test cited in the characterization suite; known defects remain `it.fails` under their later owner.

### Finding 2 — adoption map overstates the current route shell

- The map assigns the whole current `page.tsx` directly to clean-repo `src/app/page.tsx`.
- Current `page.tsx:20-27,42,418-433` contains stale query stripping, eruda diagnostics, and the `?admin=1` calibration panel. Contract lines 13, 54, 60, 142, and 151 require route diagnostics/calibration to remain outside the portable product.
- Mapping `eruda` to `null` excludes only the dependency, not the route-owned admin/query code.
- Smallest correction: make the adoption record classify the current page as the test shell/donor and explicitly exclude stale query, eruda, and admin calibration sections from the final product shell; do not move or redesign UI in KAI-10216.

### Finding 3 — Builder proof record conflicts with exact-current QA

- Builder's superseding evidence claims 1330x621 / `d7a28a…`; QA reproduced 1329x622 / `20ea…` twice on the exact candidate, including a replacement run.
- Smallest correction: rerun from a recorded clean initial state and make the Builder handoff state the exact interaction/viewport that produced its retained artifact. Do not change product output in this task unless the discrepancy proves this diff caused a regression.

#### Reconciliation

- Builder's fixed 1280x720 preservation run reproduces 1330x621 / `d7a28a…`; QA's 1200px-wide run reproducibly yields 1329x622 / `20ea0230…`.
- The evidence conflict is explained by current viewport-dependent output. Pin the preservation oracle's viewport and record both pairs. Do not repair output in KAI-10216; carry this source-proven output dependence to KAI-10219.

Necessity — **shrink: no new framework, interface, relocation, or product fix.** Corrections are limited to truthful adoption classification, real preservation oracles, and accurate evidence.

Sufficiency — **partial: KAI-10216 does not yet deliver the contract's preservation-test and route-exclusion proof.** Exact moves, debug/dead-edge deletion, UI/API preservation, static gates, build, and the primary live journey are otherwise clear.

## QA rework pass — exact candidate provenance

- Candidate `78a21d9d0e93f5aaf81fc9c22ac05ae462c1a30e` is checked out and exactly matches its upstream branch.
- Parent is the first QA snapshot `26d37579c0a119c2482212b6b84c482918937d75`; product implementation remains unchanged in this repair.
- Exact tracked repair scope is four proof-only files: `package.json`, `scripts/verify-cutout-v1-preservation.mjs`, `cutout-v1-characterization.test.ts`, and `prepare-effect-fallback.test.ts`.
- Worktree has no tracked dirt. `_WIP/` remains the expected untracked evidence/context tree.

## QA rework pass — source and proof audit

- Full-read all 554 changed lines across the four proof files and the exact parent-to-candidate diff.
- The adoption map now truthfully classifies `page.tsx` as a selective test-shell donor and explicitly excludes stale `?seg`, eruda `?debug=1`, and `?admin=1` calibration UI. No product destination or UI is changed.
- The added fallback test reaches the existing `prepareEffect` catch and verifies both the `fallback` progress callback and the returned flood-fill adapter. The existing real flood-fill segmentation test proves the degraded mask remains functional.
- The fixed 1280x720 real-route oracle independently passes on PID 34639 serving this worktree at candidate HEAD. It reproduces 1330x621 RGBA `d7a28a…`, byte-identical replacement, forced lazy Silueta, Frame east-grip edit, Node drag, Paint pointer-leave settlement, OpenCV execution, Preview/Save, and Clear/Undo/Redo.
- Viewport evidence is now truthful: QA's earlier 1200px run remains 1329x622 `20ea0230…`; the fixed 1280x720 oracle is 1330x621 `d7a28a…`. KAI-10219 owns the output dependence.

## Fresh QA rework gates

- Targeted preservation suite: 3 files passed; 14 passed plus six expected failures.
- Full repository suite: 57 files passed, one pre-existing skipped file; 524 passed, six expected failures, ten skipped.
- Typecheck, scoped ESLint, `git diff --check`, and production build all pass. Build generated 22 routes; only the pre-existing Next middleware deprecation warning appeared.
- Local and upstream remain exact at candidate `78a21d9d0e93f5aaf81fc9c22ac05ae462c1a30e`; no tracked dirt follows the gates.

## QA rework verdict — REVISE

### Finding 1 — Frame oracle does not freeze the preserved Frame contract

- Contract lines 17 and 52 preserve eight grips plus opposite-side/corner anchoring.
- `verify-cutout-v1-preservation.mjs:98-127` exercises only the east side grip. It neither asserts eight grip targets nor exercises a corner. Losing/breaking the south-west or south-east grips would leave this oracle green.
- Smallest correction: in the existing Playwright script, assert eight resize targets and exercise one corner after the existing side case, proving its opposite corner remains fixed. No production seam or new test framework.

### Finding 2 — “exact GrabCut” is exercised but not asserted

- Contract lines 20 and 52 require exact GrabCut preservation.
- `verify-cutout-v1-preservation.mjs:156-166` accepts `nothing new` as success and only logs `editedInfo`. A no-op or changed mask can pass, so the test does not freeze current exact output.
- Smallest correction: assert the deterministic post-edit PNG info already produced by this fixed-viewport journey (`1415x660`, RGBA, `55e6178e…`) or capture/assert an equally exact before/after GrabCut mask/output pair. Keep the current real OpenCV route; do not extract or mock production.

Necessity — **shrink: two assertions inside the existing Playwright oracle only; no new seam, abstraction, product edit, or phase.**

Sufficiency — **partial: adoption, fallback, route evidence, and all static gates now clear, but the named eight-grip Frame and exact GrabCut preservation obligations are not yet frozen.**

## QA final correction pass — CLEAR

- Exact candidate `88dede13066dd7e22db365568943150f90e22e0a` matches upstream and adds one proof-only file delta over `78a21d9d`: `scripts/verify-cutout-v1-preservation.mjs` (+33/-2).
- Full-read the final 231-line oracle and exact one-commit diff. It asserts exactly eight Frame resize targets, the existing east-side opposite-edge behavior, a south-east corner drag with north-west x/y fixed, and exact deterministic post-GrabCut output.
- Independent current-code oracle passes on PID 34639 serving this worktree at exact candidate HEAD. Observed: clean Save 1330x621 RGBA `d7a28a…`; replacement byte-identical; post-edit/real-OpenCV Save 1415x660 RGBA `55e6178e…`; forced u2netp failure requests lazy Silueta and completes as Silueta.
- `node --check`, scoped ESLint, typecheck, and final diff check pass. The parent repair already passed the independent full suite and production build; this final delta changes only the executed `.mjs` oracle.
- Worktree remains tracked-clean; only the expected untracked `_WIP/` evidence tree exists.

Necessity — **no unnecessary elements.** The final delta contains only the two assertions QA requested and no product seam, framework, product/UI/API change, or later-task work.

Sufficiency — **delivers KAI-10216 in full.** The working V1 behavior is now frozen by executable or cited exact oracles; the adoption boundary is truthful; known later defects remain explicit and dependency-owned; the product-owner moves/debug cuts remain independently verified.
