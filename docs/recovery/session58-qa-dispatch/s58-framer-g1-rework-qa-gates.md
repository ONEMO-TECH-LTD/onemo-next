# S58 Framer G1 Rework QA Gates

Owner: `@s58-qa`
Status: COMBINED G1 QA PASS; G2 FUNCTIONAL/RUNTIME PASS; FINAL TRIAD REWORK — CONTRACT-MAP AND DESLOP GATE NOT SIGN-READY; DAN SIGNS FINAL PRODUCT ONLY
Current gate: exact `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f` — a fresh full source/test audit and unmodified empty-cache system-Chrome run pass the required selection -> extraction -> one reload -> create/rename/move -> Home -> persistence reload -> undo flow. Final triad remains REWORK: the live inventory/read API still violates the required SourceProjection/error/stable-identity contract, the authoritative binding artifacts carry stale pre-build/G2-active status, and four lower-severity deslop items require reviewed disposition before final sign-off.
Current live binding files: Hard Contract `470/470`, SHA `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`, and Architecture `672/672`, SHA `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`. HC §0 names that exact Architecture. Their amended migration paragraphs correctly require historical fingerprints and semantic proof from durable revision-specific bytes, never current compiler authority; exact `8d64fd3` implements that distinction for both pre-split and post-split history. Architecture header/§§0/11-13 still describe a pre-build/no-code state and require document-hygiene correction before the package is sign-ready.
Current HMR readiness status: **CLOSED at exact `977efcf2`**. Source-changing commands arm the recursive component-context accept lifecycle before POST and keep the canvas busy until that exact generation advances; the E2E-only 300ms same-DOM poll is removed. Exceptional invalid-JSON and aborted-import paths also clear the exact resume marker before retry. Two independent cold committed Playwright runs pass the full flow.
Current projection-authority status: **CLOSED in code at exact `59cd5915`**. Complete ordered CSS semantics, including base rules and recursively nested at-rules, now enter `projectionFingerprint`; legacy-fingerprint upgrades require unchanged authored hashes; non-finite projection values fail closed; accepted V1 authority and migrated multi-level undo have committed regressions.

This is the rolling QA record for G1 rework snapshots. It does not replace the source architecture, hard contract, corrected-model audit, Meta gate, or Dan sign-off.

## Combined G1 Gate

Verdict: **PASS — combined G1 package only; no G2 or final-Done claim**

Exact onemo-next SHA: `9e9adf4808c2a046893eb35d3aef91b65eb20dbe`
Exact component-library SHA: `0af96bd6f6ebce08a8934b4dfc209e8016606ce1`

### Passing rows

- **Hard Contract §§4/8/9 and Architecture §§5.2/6.3/8/10/11-G1: PASS at exact `1e7e1e8`.** The dev-only caller exposes classify/import only; request keys, paths, and SHA-256 values validate before filesystem access; the same exact TSX/CSS bytes feed parser, hash preconditions, migration, history, and the single-root transaction. Single-axis import persists without source mutation; stale, unsupported, and multi-axis paths write no sidecar.
- **Revision-zero sidecar race: PASS at exact `9e506cd`.** `requireMissingSidecar` is evaluated under the acquired store lease, after unresolved-recovery preflight and before revision/hash/prepared-record work. The committed regression preserves existing bytes and creates no transaction directory. QA additionally injected a sidecar at the locked `loadSnapshot()` boundary; refusal remained `AUTHORING_SIDECAR_EXISTS` and the checkout was restored clean.
- **Hard Contract §8 and Architecture §6.4 mode preservation: PASS at exact `1e7e1e8`.** The no-follow temp descriptor is explicitly `chmod`ed to the intended mode before write/fsync/rename, closing umask narrowing. Serial installer/transaction evidence: `36/36`.
- **Hard Contract §§4/8 and Architecture §§5.2/6.3 source-hash authority: PASS at exact `c5ec65f` and retained at `9e9adf4`.** Ordinary updates preserve untouched hashes and compute touched hashes from exact current/staged bytes. `mutate()` receives a cloned map; overwrite, delete, and add attempts cannot alter the transaction-private final authority.
- **Hard Contract §8 and Architecture §7 durable history: PASS at exact `9e9adf4`.** One journal snapshot supplies both validated entries and the exact `before` bytes used to build the append. QA corrupted disk after planning; the transaction refused `METADATA_PREIMAGE_STALE` before participant creation.
- **Hard Contract §8.2-3 and Architecture §§5.2/6.1/6.3 expected-hash preconditions: PASS at exact `7bdbb83`.** Every source named by `sourceFiles`, `sourcePatches`, or the expected map requires a valid expected SHA before source access or prepared evidence. Partial maps, patch-only calls, invalid SHA values, and a missing file all refuse `SOURCE_HASH_PRECONDITION_REQUIRED`; source-empty sidecar transactions remain valid.
- **Hard Contract §11 and Architecture §11 G1 boundary: PASS.** The five unaccepted G2 snapshots are neutralized by new revert commits. Semantic variant command/compiler/session/gesture files and imports are absent; `components-canvas/page.tsx` is byte-identical to pre-G2 `25c0b26`.
- **Architecture §§5.1.2/9 two-repository Git lifecycle: PASS at library `0af96bd6` plus next `9e9adf4`.** Both isolated worktrees are clean. Project and library runtime history/transactions/stage/locks resolve to ignore rules; both canonical `authoring-v1.json` paths resolve to explicit negations. The original library master retains only Dan's pre-existing `DemoButton` modifications and was not touched.
- **Combined-G1 package authority at acceptance: PASS.** The accepted G1 gate used Hard Contract `463/463`, SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`, and Architecture `636/636`, SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`. The current G2 binding package is amended and recorded in the current gate below; this historical G1 row is not a claim that the old hashes remain current.
- Earlier bounded PASSes remain valid: migration `578bced`, durable history `dfbc708` plus lineage `ffb8a5e`, relocation `0f43111`, prepared graph inverse `5477294`, real killed-process recovery `ebd504e`, and milestones 1-2 through `f490c9c`.

### Blocking findings

None for the combined G1 QA gate. G2 proceeds continuously through Builder -> QA -> Meta; Dan signs the final product only.

### Independent evidence

- Full authoritative reads: current Hard Contract `463/463`, binding Architecture `636/636`, the complete G1 implementation/test surfaces, restored `components-canvas`, strict parser/import/route call chain, both code-blocker repairs, and the library lifecycle diff.
- Exact `1e7e1e8` clean baseline: `44 passed + 1 skipped` files; `314 passed + 10 pre-existing skipped` tests; typecheck, scoped ESLint, diff-check, detached status, forbidden-scope scan, and pre-G2 canvas comparison clean. Builder reports exact `532404a` baseline `317 passed + 10 pre-existing skipped`; QA did not reuse that claim after the adversarial failure.
- Focused independent evidence: route/import/transaction `39/39`; installer/transaction serial `36/36`; locked-boundary sidecar injection `7/7`. QA-only probe removed and exact worktree restored clean.
- History append QA extension at exact `532404a`: committed tests plus probe `14/15`; the one failure is the deterministic snapshot race above. QA-only probe removed and checkout restored clean.
- Exact `0254819` committed focused store/import/transaction evidence: `39/39`. QA source-authority extension: `6/7`; the one failure persisted a forged untouched hash. QA-only probe removed and checkout restored clean. Builder reports full `318 passed + 10 pre-existing skipped`; QA did not reuse the full-suite claim after the decisive adversarial failure.
- Exact `7bdbb83` committed store/import/transaction evidence: `40/40`. QA precondition extension: transaction `29/29`. Exact-current source-authority extension with required hash inputs: `6/7`, confirming the alias remains. QA-only probes removed and checkout restored clean. Builder reports full `319 passed + 10 pre-existing skipped`; QA did not rerun the full suite because the combined gate remains blocked.
- Exact `9e9adf4` committed focused history/store/import/transaction: `55/55`. QA post-plan journal-drift extension: history `16/16`, with named transaction refusal and no participant. Full repository: `44 passed + 1 skipped` files, `320 passed + 10 pre-existing skipped` tests. Typecheck, scoped ESLint, diff-check, detached status, and QA-probe cleanup are clean.
- Exact library `0af96bd6`: one `.gitignore` change, 7 insertions, isolated status/diff-check clean. `git check-ignore -v --no-index` proves runtime ignores and canonical sidecar negation. Original master remains exactly `DemoButton.tsx` modified plus `DemoButton.module.css` untracked.
- Current Builder combined ledger SHA-256: `f55afe9f8239b714070d6917a6719fc0a593e8e427214aad93c7515bf834b856`. Architecture SHA-256: `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`; Hard Contract SHA-256: `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`.

## G2 QA Preparation

Operational decision: Dan requires continuous phase progression. G2 snapshots gate Builder -> QA -> Meta without an intermediate Dan pause; only genuine blockers escalate. Dan signs the final product.

Every G2 gate will pin one exact clean SHA in an isolated QA checkout and cite Hard Contract §§3-5/8/10/11-G2 plus Architecture §§4/5.2/6.1-6.5/7/10/11. Required code evidence:

- Stable component/variant IDs survive display-name changes and geometry moves; labels, line/column, and union values never become canonical identity.
- One authoritative SourceProjection parser feeds classification, staged compiler reparse, source hashes, and round-trip comparison. No weaker duplicate parser or legacy-board fallback.
- Create/rename/move compile through staged TSX/CSS plus type-aware assertions. Move is sidecar-only; create/rename modify only intended source bytes. Every write uses the G1 transaction/hash/history path.
- Unsupported literal-dependent rename, stale hash, ambiguous/missing anchor, multi-axis hold, and malformed staged output refuse by name without source/sidecar/history drift.
- G1 recovery, mode, lock, hash-authority, and journal guarantees remain green; no G3/G4 interaction, preview, folder, or instance scope leaks into G2.

Real-browser gate once the canvas lands:

1. Start a pinned isolated dev server with explicit non-secret local placeholders; do not copy or shell-source the root `.env.local`, and never serve the Engineer's live worktree.
2. Use Playwright CLI headed mode with snapshot -> action -> snapshot discipline. Capture trace, screenshots, DOM/a11y state, console, failed network requests, and source/sidecar hashes in a QA evidence directory outside the Git checkout.
3. Enter through the real editor selection flow, not a direct test route: select component -> same canvas -> one scoped component -> create through ghost frame -> inline rename -> physical drag move -> Home -> return -> reload -> command-Z undo.
4. Assert reload identity/geometry, Home context restoration, no inventory-gallery leakage, zero legacy overlay fallback, and zero console errors. Prove move leaves TSX/CSS hashes unchanged; create/rename change only expected files; undo restores exact bytes and graph revision.
5. Run negative fixtures in-browser/API: literal-dependent rename refusal, stale source hash, multi-axis hold, missing edited component, and failed compiler round-trip. Each must preserve prior disk/browser state.
6. Compare the same free-variant lifecycle against the authenticated Framer Components module in the existing user Chrome window: same-canvas edit context, Primary/default treatment, free frame placement, create/rename/move affordances, and Home/breadcrumb behavior. Record observed versus ONEMO product decisions; never convert visual similarity into semantic parity.
7. Designer Meta receives the same screenshots, computed styles, geometry, accessibility tree, and interaction trace. No visual/fidelity closure from unit tests alone.

## Triad Final Audit `8d64fd3`

Verdict: **FUNCTIONAL G1+G2 PASS / FINAL TRIAD REWORK — required runtime flow is sound; exact implementation map and no-slop gate are not sign-ready**

Exact SHA: `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f`.

Binding files: Hard Contract `470/470`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`; Architecture `672/672`, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.

### Passing rows

- **Canonical model, source authority, transaction, recovery, migration, and history: PASS under Hard Contract §§1-4/8-10 and Architecture §§4-8/10.** Full current reads confirm exhaustive graph validation, store-relative no-follow jails, mode-safe durable installation, cross-process lease ordering, prepared participant/coordinator evidence, disk-only recovery, exact source/environment authority, revision-owned historical migration, one transaction-owned history chain, and strict named refusal boundaries. No direct component-authoring source/sidecar/history writer remains reachable from the live semantic route.
- **Required G2 authoring lifecycle: PASS under Hard Contract §§5-6/11-G2 and Architecture §§6.1-6.5/7/10-11.** The live selection path performs strict preview and transactional extraction, one permitted document reload with different-document marker consumption, stable-ID variant create/rename, sidecar-only physical move, Home restoration, ordinary persistence reload, and component undo through the canonical compiler/session/transaction stack.
- **One-canvas and parity mechanics: PASS for implemented G2 scope under Hard Contract §§2/7/11-G2 and Architecture §§3.2-3.4/9-11.** The retained iframe and graph-backed component canvas do not coexist as competing authoring domains. Inline rename implements Enter/Escape/blur, unselected frames are borderless, selection is solid while dashed grammar is reserved, Primary is not doubled, the breadcrumb remains fixed outside zoom, and component surfaces use ONEMO semantic tokens.
- **Fresh exact-SHA execution: PASS.** Full Vitest: `53` passed plus `1` declared-skipped files / `455` passed plus `10` declared-skipped tests, zero unhandled failures. Typecheck, scoped authoring ESLint, diff-check, exact detached status, fixture cleanup, server cleanup, and cache restoration pass. A fresh unmodified empty-cache system-Chrome run passes `1/1` in `1.1m`, covering selection -> create-from-selection -> exactly one bootstrap reload -> variant create/inline rename/physical drag -> Home -> persistence reload -> undo with the committed console/network assertions.

### Blocking findings

1. **P1 — the live component inventory/read API still violates the exact implementation map and can fail silently.** Hard Contract §10 requires `editor-component-model/route.ts` to return the named `SourceProjection`, and `editor-components/route.ts` to expose projection errors while joining stable component IDs/folders. Architecture §§3.2.4/3.2.8 and §9 require the same strict inventory boundary. Current `editor-component-model/route.ts:2-15` still exposes raw `ComponentModel` and has no production caller. Current `editor-components/route.ts:21-31` converts parser/export failure into `[]`; its response at lines 50-85 has no stable ID/folder metadata. `page.tsx:250-258` models the reduced payload and swallows route/network failure with `.catch(() => {})`. The healthy browser fixture does not exercise this negative path; a real parse failure can silently empty or degrade the Components rail.

   Required disposition: **FIX/COLLAPSE.** Make the inventory use the authoritative SourceProjection and explicit named error payload, join canonical component/folder identity, and either refactor or archive the unused raw `editor-component-model` endpoint. Commit parse/export/network negative UI evidence; do not retain empty-array success as corrupt-state recovery.

2. **P1 — both authoritative binding artifacts misstate the accepted package state.** Architecture line 3 still says `WORKING ARCHITECTURE GATE — not product code, not approved`; line 7 pins baseline `804ffe7`; line 22 forbids product implementation; §§11-13 and the handoff at lines 629-672 still describe no-code/future G1 and an obsolete quota warning. Hard Contract lines 3/7/447/470 still say G2 is active rather than implemented and under final triad review. Operative laws are coherent, but the artifacts' status/handoff language contradicts exact accepted SHA `8d64fd3` and is therefore not final-signoff truth.

   Required disposition: **ARCHIVE/REFRESH.** Preserve historical architecture decisions, but replace live status, baseline, handoff, and actor-state prose with the exact implemented SHA and current final-audit state; rehash both authoritative documents and their manifest pointer.

### `/o-deslop --sweep` findings

3. **P2 — unreachable raw semantic component writers remain compiled in production.** `editor-write/route.ts:12-25` rejects every semantic component kind before `applyWrite`, and no other production caller reaches those branches. `lib.ts` still carries the old semantic `WriteOp` variants, direct implementations, dispatch, and exclusive helpers for component creation/rename, axes/values, props, instances, connectors, and variant structure (`lib.ts:2114-2701`). This conflicts with Hard Contract §10's refactor-away requirement and Architecture §§3.1.6/3.2.2/9. **KEEP-FLAGGED/KILL after reviewed kill-list:** remove only unreachable raw semantic branches and exclusive helpers; preserve live parsers, jails, and planners. No QA deletion was performed.

4. **P2 — component orchestration remains embedded in the 4,449-line editor shell.** Hard Contract §10 and Architecture §9 require component authoring state to leave `page.tsx` and prohibit another monolith. `page.tsx` still owns inventory, editing target, resume phase/marker, component bounds, canvas mode, rail UI, breadcrumb, and canvas orchestration around lines 2359-2415 and 3900-4020. `component-authoring/` contains the canvas plus small session/gesture helpers but no `useAuthoringGraph`/controller or inspector boundary. **EXTRACT:** move only current G2 orchestration/state into one hook/controller and component inspector boundary; do not pull G3/G4 Assets/Preview work forward.

5. **P2 — committed E2E port authority is internally contradictory.** `playwright.config.ts:3` supports `PLAYWRIGHT_PORT` and lines 6-8 reject `PLAYWRIGHT_BASE_URL`, while `react-figma-authoring.spec.ts:165,269` reads `PLAYWRIGHT_BASE_URL` and defaults assertions to `localhost:3045`. Non-default isolated ports fail despite advertised support. **FIX:** derive one allowed origin from Playwright `baseURL`/the configured port. The default-port cold proof above remains valid.

6. **P3 — stale source comments and phase labels remain.** `page.tsx:5` says `NO engine wiring yet`; `editor-components/route.ts:6-7,77` describes `insert-component` as live although the UI disables it and the semantic route refuses it; `page.tsx:3933-3934` assigns duplicate/delete to an undefined `E10 lifecycle phase`. **KILL/UPDATE:** remove or replace these statements with current binding terminology; no behavior change required.

### Independent evidence and self-audit

- Full rereads: Hard Contract `470/470`, Architecture `672/672`, every current G1/G2 production module, `page.tsx` `4449/4449`, `lib.ts` `2750/2750`, the committed browser harness, and all contract-bearing tests. Green history was not reused as a substitute for current source inspection.
- Reference-aware sweep traced production imports and route reachability before classifying cemetery code. Findings are separated by mechanism: active API truth, authoritative artifact truth, unreachable writer cemetery, shell ownership, E2E authority, and stale labels.
- No product, Engineer-worktree, binding-document, or library bytes were changed. QA removed only generated Playwright metadata and restored the isolated checkout to exact clean SHA.
- This section supersedes the earlier `PASS TO META` status for final-triad purposes. It does not revoke the functional/runtime pass, claim G3/G4, provide Framer-complete parity, authorize destructive cleanup, infer Dan sign-off, or mark the product Done.

## G2 Combined Implementation And Browser Gate `8d64fd3`

Verdict: **PASS TO META — exact G2 implementation/browser package; not final Dan sign-off**

Exact SHA: `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f`, including post-split historical default authority `e40408df9d29e5985daaeab2d5d8ba51fc7b840b`, graph-owned consumer authority `bdcaab4a34e3207b259c32d7b93643a2611f3cc1`, cold-shell retry `96286628a5624ce0edd26558236ad0836e5bb7d8`, pre-split authority refusal `5a7e67d0a66d8353027e3b80005b496d27a9ccf0`, and exact readiness `8d64fd3`.

Binding files: Hard Contract `470/470`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`; Architecture `672/672`, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.

### Passing rows

- **Historical compiler authority: PASS under Hard Contract §11-G2 line 390 and Architecture §6.2 line 468.** Pre-split component-bearing history without a recorded `tsconfig.json` now always named-refuses, regardless of current project topology. Post-split history with an `environmentFingerprint` and proven config absence still reconstructs default compiler authority. QA replayed both directions independently; route suite `27/27` passes.
- **Graph-owned consumer authority: PASS under Hard Contract §§3-4/8 and Architecture §§5.2/6.3/7.** Extraction -> formatting-only component edit -> revalidation retains the consumer page and its dependency hashes, then undo restores the durable graph/source state. The exact regression passes at the current SHA.
- **Cold-shell and reload readiness: PASS under Hard Contract §11-G2 lines 393-396 and Architecture §§6.5/10.** Two independent unmodified runs started with `.next` absent on the committed default port. Each passed `1/1` in `1.1m`, covering selection -> extraction -> exactly one import-bootstrap reload -> create/rename/drag -> Home -> persistence reload -> undo. Readiness uses exact iframe route/live-layer/dialog/token-document parity and resumed canvas/phase/component/token parity; both generic `networkidle` waits are absent.
- **Exact-head repository gates: PASS.** Full Vitest: `53 passed + 1 declared-skipped` files, `455 passed + 10 declared-skipped` tests, zero unhandled failures. Typecheck, five-file scoped ESLint, cumulative diff-check, exact detached status, fixture cleanup, port cleanup, and cache restoration are clean.

### Nonblocking follow-ups before final sign-off

- **P2 E2E portability:** `playwright.config.ts` supports `PLAYWRIGHT_PORT` and explicitly forbids `PLAYWRIGHT_BASE_URL`, but two E2E abort assertions still consult `PLAYWRIGHT_BASE_URL` and hardcode `localhost:3045`. This breaks isolated non-default-port reuse. It did not weaken the two unmodified default-port cold proofs above, so it does not block Meta.
- **P1 binding-document status hygiene:** Architecture line 3, §0 lines 19-22, §§11-13, and line 672 still claim pre-build/no-code/baseline `804ffe7` state. Semantic clauses and hashes used for this gate remain authoritative, but the status/handoff prose must be reconciled before final Dan sign-off.

### `/o-deslop --sweep`

- `currentSnapshotsUseConfig` and its current-snapshot migration input are removed; no stale authority predicate remains.
- `readExactCompilerConfig` and `parseExactCompilerConfigFromSources` share one private `parseCompilerConfig` core; no duplicate compiler-config parser was introduced.
- Graph-owned source collectors remain coherent trust-boundary logic; extracting a one-use helper would add abstraction without reuse.
- Legacy semantic writer branches remain unreachable behind the strict `editor-write` semantic-kind refusal. They stay `KEEP-FLAGGED` for a reviewed kill-list, not opportunistic QA deletion.
- No `TODO`/`HACK`/`FIXME`, stale G4 wording, `networkidle`, dead helper, untracked fixture, or `.onemo` residue exists in the current delta. The isolated-port assertion mismatch is the only `FIX` disposition.

## G2 Historical Snapshot And Revalidation Rework `17e53e96`

Verdict: **REWORK — the three requested regressions and deferred-control wording close, but two generalized authority P0s and the cold-flow P1 remain**

Exact SHA: `17e53e96dd38377024c5ac806a165f37d4eab93e`, including historical snapshot reconstruction `db699a970eabacad0ec234d9e16cc997a8e0d373`, exact hash replacement `96f0679`, reload-readiness test `1b1dc34`, and roadmap-neutral wording `17e53e96`.

Binding files: Hard Contract `470/470`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`; Architecture `672/672`, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.

### Closed rows

- **Historical options and dependency topology: PASS for the requested repro under Hard Contract §11-G2 line 390 and Architecture §6.2 line 468.** The shared config parser consumes supplied historical config-chain bytes only. The exact committed/QA replay preserves old `strict:false`, `Old.ts`, and their hashes while current `strict:true`/`New.ts` remain excluded from the historical graph.
- **Old-to-New revalidation hash replacement: PASS for the requested single-component repro under Hard Contract §§4/8 and Architecture §§5.2/6.3.** `Old.ts` is deleted from the committed hash map and `New.ts` enters exact authority. Transaction-owned `replaceSourceHashes` starts empty and the final transaction graph overwrites any `mutate()` hash attempt.
- **Deferred controls and wording: PASS under Hard Contract §10/§11-G2 and Architecture §§6.1/9/11.** Blank create remains absent; insert and rename remain disabled with canonical-path titles. All three say only `not available in this phase`; no unsupported G4 assignment remains and no legacy semantic request is reachable.
- **Committed baseline: PASS for covered behavior.** Focused route/tsconfig/transaction `66/66`; full repository `53` passed plus `1` declared-skipped files / `453` passed plus `10` declared-skipped tests; typecheck, changed backend/E2E lint, diff-check, and exact detached status clean. The shell retains its exact inherited `12 errors/11 warnings` outside the wording delta.

### Blocking findings

1. **P0 — missing historical compiler authority is still classified from current topology.** `authoring-sidecar-migration.ts:215-223` sets `historicalNeedsConfig` by inspecting today's component snapshots. QA reused the committed missing-historical-authority fixture and changed only today's state from `tsconfig present` to `tsconfig absent`. Identical missing historical evidence changed the required `409 AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE` into HTTP `200` migration. Current compiler topology therefore still decides whether an historical revision is considered complete.

   This violates Hard Contract §11-G2 line 390 and Architecture §6.2 line 468: historical authority must derive solely from revision-owned bytes/evidence, and missing evidence must named-refuse with zero writes. Required fix: remove every current-snapshot predicate from historical reconstruction. Track revision-owned presence/absence provenance while rewinding; parse exact historical config when proven present, use the default only when absence is durably proven, otherwise refuse.

2. **P0 — exact revalidation replacement omits graph-owned instance source authority.** `authoring-session.ts:237-269` rebuilds the map only from component snapshots. After canonical create-from-selection, a formatting-only edit to the extracted component revalidated through the production route, but commit returned `422 AUTHORING_GRAPH_INVALID`: the replacement dropped `src/app/page.tsx` while the live instance still references it (`instances...source.file missing source hash`). Undo was never reached.

   This violates Hard Contract §§3-4/8 and Architecture §4's `ComponentInstance.source`, §5.2 exact per-file hashes, §6.3 transaction truth, and §7 durable undo lineage. Required fix: derive the exact replacement from every live graph-owned source reference, not components alone; recompute component closures, verify and retain unchanged instance/consumer sources under the same lease, reject orphan authority, and commit extraction -> formatting edit -> revalidate -> undo coverage.

3. **P1 — the committed cold browser flow remains nondeterministic and the `1b1dc34` readiness fix is too narrow.** Two isolated fresh-cache Chrome runs at exact product SHA failed. Port `3052` observed the Components search field, then a cold remount returned the shell to File and the fixture locator timed out. Port `3053` found the fixture and passed the new disabled-control assertions, then navigation began during `fixtureButton.dblclick()` and the test exhausted its `120s` ceiling. The `1b1dc34` change waits for token-count/canvas-idle only after the ordinary persistence reload; it does not guard the initial cold document/remount boundary.

   This fails Hard Contract §11-G2's clean exact lifecycle and Architecture §10's committed E2E requirement. Required fix: expose one product-owned initial shell/context readiness boundary or make the committed test re-establish rail/locator state after an observed document replacement without retrying a semantic command. Prove two fresh-cache runs from isolated ports; a warm retry does not close this row.

### Independent evidence and deslop

- Mandatory reads: all eight `df0e80c..1b1dc34` files `3808/3808`, all three commit diffs, exact `17e53e96` wording diff, current binding hashes, and the complete rolling ledger before edit. Backend blobs are byte-identical between `1b1dc34` and `17e53e96`.
- QA requested-repro replay passed; generalized migration probe received `200` instead of `409`; extraction/revalidation probe received the exact missing-instance-hash `422`. Both QA-only edits were removed and exact checkout restored clean.
- `/o-deslop --sweep`: one canonical config-parser core; `parseExactCompilerConfigFromSources` and `replaceSourceHashes` are live/kept. Current-snapshot `historicalNeedsConfig` is **COLLAPSE**; component-only exact replacement is **FIX**. Unreachable legacy semantic direct-writer branches remain **KEEP-FLAGGED** for the approved kill-list; no deletion was performed.
- The first `3045` browser attempt was excluded because Engineer claimed that port concurrently. Both reported failures are independent isolated QA runs. Generated fixtures/markers are absent, QA ports are closed, the pre-gate `.next` cache is restored, and failure caches/evidence are preserved under `/tmp/s58-qa-17e53e96-*`.

No G2 PASS, Meta PASS, Framer-complete parity, G3/G4 implementation, Dan sign-off, or final-Done claim is inferred.

## G2 Deferred Component-Control Boundary `df0e80c`

Verdict: **REWORK overall — the P1 live-control behavior is closed, but inherited migration/revalidation P0s remain; full browser evidence and two roadmap labels need correction**

Exact SHA: `df0e80c2382d917678b4f951e4d6615849ae94fe`, direct child of `bf459ccb1cb2f996e3642835e4869cfc601b027d`.

Binding files: Hard Contract `470/470`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`; Architecture `672/672`, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.

### Closed control row

- **P1 broken live controls: bounded PASS under Hard Contract §10/§11-G2 and Architecture §§6.1/9/11.** The blank-create form and its project/global/category state and legacy callback are absent. Component insertion and component rename remain visible only as disabled context-menu buttons with explanatory titles. Their callbacks are removed. Source search finds no live page reference to `create-component`, `rename-component`, or `insert-component`; the legacy route remains closed for all component-semantic kinds. Canonical create-from-selection and project-component edit remain live.
- **Focused real-browser evidence: PASS.** A QA-only system-Chrome test re-entered the Components rail across the dev-HMR reset, proved the blank field absent, deferral note visible, insertion/rename buttons disabled with exact titles, and observed zero matching `/api/dev/editor-write` requests. It passed `1/1` in `12.3s`; the temporary test was removed.
- **Static/unit baseline: PASS for committed behavior.** Full repository `53` passed plus `1` declared-skipped files / `450` passed plus `10` declared-skipped tests; typecheck, changed E2E lint, diff-check, and exact detached status clean. The shell retains its exact `12` errors / `11` warnings baseline; none points to the control delta.

### Remaining findings

1. **P0 — both exact `bf459cc` authority findings remain byte-identical.** `df0e80c` changes only the shell and E2E. Historical migration still validates revision-owned bytes with current compiler options/dependency topology, and `revalidate-source` still retains removed dependency hashes. Required clauses, repros, and remediation remain in the immediately following exact-SHA section; they are referenced rather than duplicated.

2. **P1 — the committed full browser gate is not independently reproducible at this SHA.** QA ran the exact committed spec twice. Run 1 passed the new control assertions, completed extraction POST/reload, then Next surfaced `Unexpected end of JSON input` on both editor and fixture routes and the authoring canvas timed out. A genuinely fresh-cache run failed earlier because `AuthoringE2EButton` disappeared before the control assertions. The focused control test passes only after explicitly re-entering the Components rail across that dev-HMR reset.

   This fails Hard Contract §11-G2's clean exact flow and Architecture §10's committed E2E evidence requirement. Required fix: make the managed cold test reproducible without retry/prewarm, preserve the new control assertions, and prove the complete selection -> extraction -> one reload -> variant flow from a clean cache. The two failed runs are not overridden by the Builder's one green run or the narrower QA control PASS.

3. **P2 — two G4 labels overstate the current phase contract.** Hard Contract G4 and Architecture §11 explicitly assign assets/folders/instances and menu insert to G4; they do not explicitly assign blank component creation or component rename. `Blank component creation comes in G4` and `Canonical component rename comes in G4` therefore promise an unbound roadmap decision. Behavior may remain deferred, but the text should say `not available in this phase` / `deferred beyond G2`, or the binding package must explicitly assign those operations to G4. Menu insertion's G4 label is contract-backed.

### Deslop and cleanup

- Exact two-file diff read; current E2E `280/280`; page delta applied over the prior full `4496/4496` baseline; context-menu renderer and legacy route boundary rechecked.
- `/o-deslop --sweep`: no orphan blank-create/rename/insert state or callbacks. `compNonce` remains live through canonical authoring refresh. Legacy backend handlers remain the previously approved kill-list-only zombies behind route refusal; no deletion was performed.
- Failed and focused browser fixtures were restored; ports `3047-3051` closed; generated `.last-run.json` and QA test removed. Pre-gate cache was restored; cold/focused cache preserved at `/tmp/s58-qa-df0e80c-next-after`. Exact checkout is clean.
- No migration PASS, full G2 PASS, Meta PASS, G3/G4 implementation, Dan sign-off, or final-Done claim is inferred.

## G2 Historical Migration Authority Re-Gate `bf459cc`

Verdict: **REWORK — the original current-tsconfig injection is closed, but historical semantic validation still uses current compiler authority; source revalidation also persists an obsolete dependency hash**

Exact SHA: `bf459ccb1cb2f996e3642835e4869cfc601b027d`.

Binding files: Hard Contract `470/470`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`; Architecture `672/672`, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.

### Closed rows

- **Original current-tsconfig injection repro: PASS under Hard Contract §11-G2 line 390 and Architecture §6.2 line 468.** A component-bearing historical V1 graph that lacks its exact compiler authority now refuses `AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE`; the committed test proves sidecar, journal, and transaction entries unchanged. Migrated historical graphs retain their recorded authored `sourceHashes` instead of expanding them with every current file.
- **Pre-split generated-environment partition: bounded PASS.** Generated-environment paths retained in legacy `sourceHashes` are partitioned, their historical bytes are hash-verified, and their fingerprint is derived from that verified set. Current sidecar migration still uses the exact current snapshot, as required for the live graph.
- **Nominal committed gates: PASS for covered behavior.** Route `24/24`; full repository `53` passed plus `1` declared-skipped files / `450` passed plus `10` declared-skipped tests; typecheck, two-file ESLint, diff-check, and exact detached status clean. Cold committed system-Chrome Playwright passes `1/1` in `1.1m`, including selection, extraction, exactly one bootstrap reload, create/rename/drag, Home, persistence reload, undo, and fixture/server cleanup.

### Blocking findings

1. **P0 — historical graph validation still borrows today's compiler options and dependency topology.** `authoring-sidecar-migration.ts:214-225` labels current `ExactAuthoringSourceSnapshot` objects as `historicalSnapshots`, derives required historical files from their current `sourceHashes`, and `:271-276` validates historical source with the current snapshot's `compilerOptions`. The historical graph's recorded hashes and reconstructed bytes are preserved, but the semantic proof is not revision-specific.

   QA supplied complete, hash-coupled historical source and `tsconfig.json` preimages. The old component is valid under its durable historical `strict:false` configuration; current source/config are valid under `strict:true`. Migration typechecked the old source with current options and refused `STAGED_TYPECHECK_FAILED / TS2322`. A second complete fixture changed dependency topology from historical `Old.ts` to current `New.ts`; migration incorrectly required `New.ts` for the historical graph and refused `AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE` despite exact `Old.ts` evidence.

   This violates Hard Contract §11-G2 line 390 and Architecture §6.2 line 468: historical projection, registry, environment, and semantic proof must be reconstructed from revision-specific durable bytes, never current authority. Required fix: build one exact historical snapshot from `historicalSources` plus the historical graph hash map, parse its jailed config chain from those bytes, recursively resolve its dependency graph, and feed those historical compiler options/sources into the existing SourceProjection and TypeScript checker. Current snapshots may validate only the live sidecar. Missing historical evidence must retain the current named zero-write refusal.

2. **P0 — `revalidate-source` retains removed dependency authority.** A valid component changed its import from `Old.ts` to `New.ts`; `Old.ts` was deleted, the exact current snapshot contained `New.ts`, and `revalidate-source` returned `200`. The persisted graph added `New.ts` but retained the deleted `Old.ts` SHA. The next exact load/migration therefore sees a stale, impossible authority set.

   `authoring-session.ts:246-265` supplies current snapshot files to the transaction but returns the prior graph from `mutate()`. The transaction's correct ordinary rule of preserving untouched hashes cannot infer that an omitted old dependency is authoritatively removed. This violates Hard Contract §4 per-file exact authority and §8 locked commit truth, plus Architecture §§5.2/6.3. Required fix: revalidation must pass an explicit exact replacement/removal authority set under the same lease, while ordinary patch transactions continue preserving unrelated files. Commit old-import -> new-import and removed-ambient/config-root regressions proving no stale hash, exact history, and a loadable committed revision.

3. **P1 — live blank-create/Rename/Insert controls remain open at this exact SHA.** `bf459cc` does not include the separately announced `df0e80c` control-boundary commit. The remediation remains the agreed G2 boundary: remove or disable deferred controls with truthful G4 language, never reopen the legacy route or build G4 commands early. This row must be gated independently at exact `df0e80c`.

### Independent evidence and deslop

- Mandatory reads: changed route test `1025/1025`, migration `361/361`, exact compact diff, and full immediate authority chain `authoring-import.ts 334/334`, `authoring-history.ts 405/405`, and `authoring-session.ts 496/496`.
- QA-only probes reproduced both historical-current conflations and the stale revalidation hash. All probes were removed with `apply_patch`; exact checkout restored clean before committed gates.
- `/o-deslop --sweep`: the migration entrypoint is live and architecture-bearing, not dead. The defect is one duplicated authority concept: current snapshots are aliased as historical snapshots. Disposition is **COLLAPSE** into the existing exact snapshot/parser/checker pipeline parameterized by revision-owned bytes, not a second historical parser. No deletion or cleanup was performed.
- No migration PASS, G2 PASS, Meta PASS, Framer-complete parity, G3/G4, Dan sign-off, or final-Done claim is inferred.

## G2 Combined Create-From-Selection Re-Gate `0ec9be6`

Verdict: **REWORK — all five `faefbb9` mechanisms are closed, but corrected historical-migration authority and three visible component controls remain non-compliant**

Exact SHA: `0ec9be61b6b5a951003664f0550be19983d642e9`.

Binding files: Hard Contract `470/470`, SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`; Architecture `672/672`, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.

### Closed rows

- **Legacy semantic-route bypass: PASS under Hard Contract §10 and Architecture §§3.2.6/6.1/9.** `editor-write/route.ts` refuses all twelve component-semantic operation kinds before `applyWrite`, independent of the supplied file. QA additionally proved `create-component` without any file target still returns `AUTHORING_TRANSACTION_REQUIRED`; non-component `set-jsx-text` remains on the legacy route.
- **Patch-image preflight: PASS under Hard Contract §8 steps 3-4/10 and Architecture §6.3 steps 3-4/8.** Empty or malformed source/metadata images now refuse before path reads, transaction-ID reservation, or blob/record creation. QA supplied a runtime-invalid numeric image, observed `SOURCE_PATCH_IMAGE_INVALID`, no transaction directory, then committed successfully with the same transaction object and ID.
- **Lexical ownership: PASS under Hard Contract §5 validation/refusal and Architecture §6.2 steps 1-2/6.** The planner uses TypeScript symbol declarations and subtree ownership rather than a flat binding-name set. Exact outer-capture/nested-shadowing refuses `SELECTION_LOCAL_CAPTURE`; nested function, arrow, block, catch, and destructuring bindings pass. QA additionally proved namespace JSX imports remain free while member names, local object keys, and locally declared values do not false-positive.
- **Dependency-safe install: PASS under Hard Contract §8 steps 5-12 and Architecture §§6.3-6.4.** Extraction emits the new component before the importing consumer; rollback restores the consumer before removing the dependency. A recording `DurableFileInstaller` observed exactly `[dependency, consumer]` for real source destinations.
- **Exactly-one bootstrap reload and complete G2 browser flow: PASS under Hard Contract §11-G2 lines 388/393-396 and Architecture §6.5/§10.** Cold committed Playwright at exact `0ec9be6` passes `1/1` in `57.0s`: real selection, extraction, one measured document replacement, resumed target, create/rename/physical drag, Home, ordinary persistence reload, undo, and the spec's zero-unexplained-console/network checks. Both temporary source fixtures are absent afterward and port `3045` is closed.
- **Corrected migration wording: PASS as document semantics only.** Hard Contract line 390 and Architecture line 468 now distinguish post-split exact V1 from the earlier authored-hash subset, partition only proven generated environment, require jailed semantic/projection/registry proof for later authority, and require historical graph fingerprints from durable historical bytes rather than current source. The implementation blocker below prevents package acceptance.

### Blocking findings

1. **P0 — historical V1 graph migration still fabricates later authority from current bytes.** `authoring-sidecar-migration.ts:89-94` initializes `historicalSources` from the current exact snapshots. Reverse history traversal rewinds only command `preimages` and committed undo transaction files (`195-225`). Any later-required authority absent from old history evidence therefore remains today's bytes and is copied into every migrated historical graph.

   QA modified `tsconfig.json` after the command/undo history existed, while the legacy sidecar and every legacy graph preimage intentionally contained only the then-known component hash and generated-environment hash. Migration still returned `200`; every migrated historical graph received the new current `tsconfig.json` SHA. No durable historical tsconfig preimage existed. This directly violates Hard Contract §11-G2 line 390 and Architecture §6.2 line 468: historical fingerprints must come from reconstructed historical bytes, never current source; missing evidence must named-refuse with zero writes.

   Required fix: track provenance while rewinding. A historical graph may admit a file only from that revision's durable command preimage, committed undo image, or other exact historical evidence. If a later authority has no revision-specific bytes, refuse `AUTHORING_MIGRATION_HISTORY_SOURCE_UNAVAILABLE` before sidecar/history/transaction mutation. Commit a changed-post-history tsconfig/dependency fixture proving zero writes, plus a positive fixture where exact historical evidence exists.

2. **P1 — the legacy-route repair leaves three visible Components controls broken.** The live Components rail still POSTs blank create through `create-component` (`page.tsx:2420-2427`, form `3955-3970`), component Rename through `rename-component` (`2432-2437`, menu `3978`), and Insert into selection through `insert-component` (`3086-3091`, menu `3976`). The repaired route now correctly returns `409` for all three, so the visible controls can only display failure.

   This violates Hard Contract §5's component/instance command ownership, §6's observed blank-component behavior, and §10's non-component-only legacy route; Architecture §§6.1 and 9 require those lifecycle operations to move behind canonical commands rather than remain dead callers. Required fix: migrate in-scope actions through strict authoring commands, or visibly disable/remove deferred actions with truthful phase language. Add browser regressions for every control that remains enabled.

### Independent evidence

- Mandatory current reads: all twelve cumulative changed files; six blobs were byte-identical to the fully read `39b20ce` gate and six new blobs were read in full, including `lib.ts 2750/2750` and `authoring-transaction.ts 957/957`. Compact `faefbb9..0ec9be6` diff read completely. Corrected Hard Contract `470/470`, Architecture `672/672`, and migration implementation `335/335` read end to end.
- QA adversarial extensions: route/planner/transaction matrix `57/57`; migration current-byte probe `1/1` passed by proving the defect. Every QA-only edit was removed with `apply_patch`; detached checkout restored clean.
- Exact committed baseline: `53` passed plus `1` declared-skipped files / `449` passed plus `10` declared-skipped tests; zero unhandled errors. Typecheck passes. The changed shell retains its exact parent `12` errors / `11` warnings and `lib.ts` retains two known warnings; no new lint regression is claimed. Diff-check and exact detached status are clean.
- Cold browser: committed Playwright `1/1`, `57.0s`. Playwright's generated `.last-run.json` was inspected and removed; selection/extracted fixtures and test server residue are absent.
- `/o-deslop --sweep`: re-export-aware production trace finds `applyWrite` imported only by `editor-write/route.ts`. The component-semantic direct-write branches in `lib.ts` are zombie code behind a route that refuses their kinds; proposed disposition is **COLLAPSE/KILL after canonical callers exist**, never deletion without an approved kill list. The removed fixed-board route has no tracked file or dangling reference. Architecture's stale pre-build header/§§0/11-13 is **ARCHIVE or refresh**, not silent deletion.

No G2 PASS, Meta PASS, Framer-complete parity, G3/G4, Dan sign-off, or final-Done claim is inferred.

## G2 Create-From-Selection UI Vertical `faefbb9`

Verdict: **REWORK — the real selection UI now reaches the canonical transaction and undo, but five code-contract blockers remain**

Exact SHA: `faefbb9241b4f896746f232939b9e3827dfa09e4`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

### Closed rows

- **Production selection vertical: bounded PASS under Hard Contract §§5-6/8/11-G2 and Architecture §§6.1-6.3/7.** The real inspector action opens a PascalCase naming dialog, obtains exact preview revision/source/environment/component-hash authority, issues the structured resume marker, and sends one `execute-create-component` command. The committed response publishes the project component and same-canvas edit context. The button no longer posts legacy `make-component`.
- **Canonical persistence and inverse: bounded PASS.** Cold system-Chrome execution selected a real page element, preview GET returned `200`, command POST returned `200`, and the graph-backed canvas rendered the extracted Primary. `Meta+Z` issued the authoring undo POST, restored the consumer byte-for-byte, deleted the newly created component, advanced the sidecar to revision 2, and persisted committed create/undo history and transaction evidence.
- **Covered baseline: PASS.** Focused route/planner/session/transaction suites pass `61/61`. Full repository passes `53` files plus `1` skipped / `433` tests plus `10` declared skips, with zero unhandled errors. Typecheck passes. The four changed backend/test files lint with `0` errors/warnings; the changed shell reports the same inherited `12` errors / `11` warnings as its exact parent, so this snapshot adds no lint regression. Diff-check and exact detached status are clean.

### Blocking findings

1. **P0 — legacy component authoring remains an executable second write path.** `editor-write/route.ts:23-31` rejects only when the request's `file` is already under the component root. A QA route probe POSTed legacy `{kind:'make-component', file:'src/app/page.tsx'}`; exact `faefbb9` returned HTTP `200` and called `applyWrite`. `lib.ts:2549-2564` then remains capable of sequentially writing the component and consumer outside graph/compiler/transaction/history authority.

   This violates Hard Contract §10 lines 314-318, which retains `editor-write` for non-component low-level writes only and requires component primitives to leave direct-write ownership; Architecture §3.2.2 lines 101-106, §3.2.6 lines 121-124, and §6.2 line 457. Required fix: reject every component-authoring operation kind at the legacy route regardless of the input file, retain only explicit non-component low-level operations, and commit the page-source refusal regression.

2. **P0 — null-to-null patches still persist invalid transaction evidence before refusal.** `authoring-transaction.ts:151-225` validates paths/preimages, allocates transaction blobs, and only later reaches `assertFileImage()` at lines 865-872. QA's `{before:null,after:null}` probe refused `TRANSACTION_RECORD_INVALID` but left `tx-1` on disk. This is unchanged from the parent and can poison the next valid commit with `RECOVERY_REQUIRED`.

   This violates Hard Contract §8 validation-before-prepare ordering and Architecture §6.3 steps 4/8/13 (lines 475/479/484). Required fix: validate every patch image shape before transaction-ID availability or any blob/directory write; commit zero-evidence plus valid-follow-up regressions.

3. **P1 — extraction planner lexical ownership remains unsound.** `lib.ts:2474-2498` collects every nested binding into one flat set. QA's selected root used an outer free `{label}` plus `.map((label) => ...)`; the nested parameter masked the outer free reference and the planner returned a plan instead of refusing. The canonical compiler's staged semantic check currently prevents that invalid plan from committing, so this is a planner/defense contract defect; the executable legacy path above remains more exposed because it performs syntax-only validation.

   This violates Hard Contract §5 validation/refusal and Architecture §6.2 steps 1-2/6 (lines 459-466). Required fix: lexical-scope or TypeChecker-symbol ownership with nested function/arrow/block/catch/destructuring fixtures; the planner itself must refuse unsupported capture.

4. **P0 — successful first extraction performs zero bootstrap reloads and strands the origin marker.** `page.tsx:3185-3190` assumes Next's route-tree rescan will reload the document but issues no reload. The cold real-browser run instrumented the origin DOM plus an init-script reload counter before submit. After preview `200`, command `200`, component inventory refresh, canvas entry, and 30 seconds: reload count remained `0`, the exact origin DOM marker remained, the versioned resume marker remained in `sessionStorage`, and the shell reported `data-authoring-resume-phase='originating'`. Undo restored disk state but the stale same document kept rendering the deleted component and emitted a real `component-status` HTTP `422` console error.

   This violates Hard Contract §11-G2 lines 393-396 and Architecture §6.5 lines 501-514: exactly one bootstrap reload, different-document consumption, and exact phase/count E2E evidence are mandatory. Required fix: explicitly trigger the one permitted document reload only after committed success, preserve the marker for that different document, prove exactly one `domcontentloaded`/document-identity transition, and add the complete real selection-to-component E2E. Do not rely on incidental dev-server HMR/rescan behavior.

5. **P1 — extraction installs the importing consumer before the newly created dependency.** `authoring-compiler.ts:137-140` emits source patches in `[consumer, component]` order. `authoring-transaction.ts:202-210/232` preserves that array order and installs each after-image sequentially. A deterministic QA installer probe required `[new Card.tsx, importing Button.tsx]`; exact `faefbb9` produced `[Button.tsx, Card.tsx]`. Next can therefore observe and compile the rewritten consumer while its import target is still absent, producing a transient module-not-found failure even though the eventual transaction is durable.

   This violates Hard Contract §8's validated staged-output transaction and the clean E2E requirement in §10 lines 327-337; Architecture §3.2.2 lines 101-106 identifies partially observable multi-file authoring as the defect being replaced, while §§6.3-6.4 require a coherent staged install and §10 line 621 requires the real create flow. Required fix: make extraction source installation dependency-safe, with newly created imported files before consumers (and reverse-safe rollback), and commit both installer-order and cold browser no-transient-module-error regressions.

6. **Binding-document REWORK remains unchanged.** Hard Contract line 390 and Architecture line 468 still misstate historical V1 graph-preimage/current-byte authority and assume the later authored/environment split existed in every accepted V1. This is separate from the five code blockers above.

### Independent evidence

- Mandatory full reads: all five changed files `6384/6384`, exact compact `331a2c1..faefbb9` diff, complete resume-marker/session and committed E2E harness, immediate legacy route/writer, planner, and transaction validation seams.
- QA adversarial probes: legacy route required behavior `3 passed / 1 failed` because HTTP `200` reached `applyWrite`; planner/transaction matrix `34 passed / 2 failed` on lexical capture and durable `tx-1` residue; dependency-order probe `0/1`, receiving `[consumer, component]` instead of `[component, consumer]`. All QA-only test edits were removed.
- Browser evidence: headed system Chrome at `http://localhost:3437/react-figma`, fresh `.next`, real page selection, snapshot/action/snapshot, screenshots before/after create, request/console capture, document marker/counter, exact source/sidecar/history/transaction reads, and product undo. Before undo the console had zero errors/warnings; the missing reload left the marker live; post-undo stale component polling produced one `422` console error.
- Reversible cleanup: source/component were restored by product undo; the temporary page was removed with `apply_patch`; generated `.onemo` evidence and fresh `.next` were moved intact to `/tmp`; the prior `.next` was restored. Exact checkout is clean at `faefbb9` and the Engineer worktree was untouched.
- `/o-deslop`: canonical UI reachability is credited once; the legacy bypass, transaction preflight, planner lexical proof, reload lifecycle, and dependency-install order are behavior-distinct roots. The post-undo `422` remains a consequence of the reload root; transient module-not-found remains the consequence of install order. Neither is duplicated as another finding. No Meta PASS, Framer-complete parity, G3/G4, Dan sign-off, or final-Done claim is inferred.

## G2 Transactional Create-From-Selection Backend `331a2c1`

Verdict: **REWORK — the canonical backend is real and transaction-backed, but the production UI does not call it and two inherited preflight defects remain**

Exact SHA: `331a2c10816bd0d6d43066da4d5ee6b4751c9746`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

### Closed rows

- **Canonical backend vertical: bounded PASS under Hard Contract §§4-6/8 and Architecture §§6.1-6.3/7.** `create-component-preview` classifies the exact selection snapshot; strict command parsing validates identity/path/location/name; `compileCreateComponentFromSelection()` produces staged consumer/component patches, runs exact TypeScript checks, rebuilds SourceProjection, imports the canonical component/Primary graph, and resolves a stable instance anchor. `ProjectAuthoringSession` commits source, sidecar, instance, history, and inverse through one `SingleRootAuthoringTransaction`; undo restores the consumer and deletes the created component.
- **Nominal refusal: bounded PASS.** Component-file collision, stale revision/hash/environment, invalid command shape, staged semantic failure, unsupported projection, ambiguous anchor, and graph/instance collision refuse before the canonical transaction installs source. The route/session tests prove source, graph, history, and undo for the supported nominal fixture.
- **Committed baseline: PASS for covered behavior.** Focused route/planner/session/transaction suites pass `61/61`. Full repository passes `53` files plus `1` skipped / `433` tests plus `10` declared skips. Typecheck passes. Scoped eight-file ESLint reports `0` errors and the same two pre-existing `lib.ts` warnings. Diff-check and detached status are clean.

### Blocking findings

1. **P0 — the real selection UI still bypasses the canonical backend.** `page.tsx:3071-3080` POSTs `{kind:'make-component'}` to `/api/dev/editor-write`. That route blocks only files already under the project component root; page/storybook selections reach `applyWrite()`. `lib.ts:2549-2565` then creates the component and rewrites the consumer through two direct `fs.writeFile` calls. No production UI code references `create-component-preview` or `execute-create-component`.

   The new backend is therefore test/API reachable but not product reachable. The actual user flow still lacks expected hashes, graph/instance publication, prepared evidence, history/inverse, naming flow, asset registration, and component edit-context transition. This violates Hard Contract §4 lines 125-143, §5 lines 151-174, §6 line 189, §8, and §11-G2 line 388; Architecture §6.1 line 416, §§6.2-6.3, and §10 line 621.

   Required fix: make the production selection action perform preview -> naming -> `execute-create-component` with the exact returned revision/hashes/environment fingerprint, remove or named-refuse legacy `make-component` for every project selection source, publish the new component/edit context only from the committed response, and commit the Architecture §10 browser flow from a real selection.

2. **P0 — null-to-null source patches still persist invalid evidence before refusal.** `authoring-transaction.ts:151-225` validates paths and preimages, then allocates transaction blobs for every patch. The impossible `{before:null,after:null}` shape is rejected only later by `assertFileImage()` at lines 865-872 while writing the participant. QA's required-behavior probe failed: `tx-1` existed after refusal. The observational follow-up confirmed a valid `tx-2` then refuses `RECOVERY_REQUIRED` for the orphan.

   This violates Hard Contract §8 steps 4/10 and Architecture §6.3 steps 4/8/13 plus §10. Required fix: validate all source/metadata image shapes before transaction-ID availability or any blob/directory write; commit zero-evidence and valid-follow-up regressions.

3. **P1 — planner lexical ownership remains unsound.** `planMakeComponentFromSelection()` still uses one flat `bound` set. In `Page({label})`, selecting `<div><strong>{label}</strong>{[1].map((label) => <span>{label}</span>)}</div>` returns a plan because the nested callback parameter masks the outer free reference globally. The new canonical compiler catches the resulting unbound staged component before transaction writes, so this is now a defense/plan-contract defect rather than canonical-route corruption. The still-live legacy UI remains exposed because it performs syntax-only checks.

   This violates Hard Contract §5 validation/refusal lines 165-174 and Architecture §6.2 steps 1-2/6 plus §10. Required fix: symbol- or lexical-scope-aware free-reference ownership with nested function/arrow/block/catch/destructuring fixtures; the planner itself must refuse unsupported capture before returning a compile plan.

4. **Binding-document REWORK remains unchanged.** Hard Contract line 390 and Architecture line 468 still misstate historical V1 preimage/current-byte authority and accepted authored/environment lineage. No code conclusion changes that separate document blocker.

### Independent evidence

- Full reads: all eight cumulative changed files `5230/5230`, complete exact `f403a0a..331a2c1` diff, immediate production UI/legacy route/write path, transaction preflight/record validation, and exact binding clauses.
- QA adversarial probes: lexical required behavior failed `1/1`; nullable-patch required behavior failed because `tx-1` existed; observational poison-chain assertion passed and proved `tx-2 -> RECOVERY_REQUIRED`. Both QA-only fixtures were removed.
- Browser is **N/A for the new flow** at this SHA: the product UI has no caller to the new preview/execute route. Running the existing browser path would only exercise the already-proven legacy bypass and cannot support a canonical-flow PASS.
- `/o-deslop`: one unreachable-vertical root, one transaction-preflight root, one planner-defense root, and one unchanged binding blocker. Nominal backend improvements are credited without promoting API tests to product reachability, Meta, parity, G3/G4, Dan sign-off, or final Done.

## G2 Creation Transaction And Inverse Checkpoint `f403a0a`

Verdict: **REWORK — missing-file transaction/history infrastructure is directionally correct, but an impossible nullable patch can leave durable invalid recovery evidence before refusal**

Exact SHA: `f403a0a620c281ba97b777379a8d4f109d5caae5`, including transaction-backed source creation `cf5a216` and creation-aware inverse/history `f403a0a`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

### Closed rows

- **Missing-file history preimages: bounded PASS under Hard Contract §8 step 10 and Architecture §§6.3.8/7.** A source that did not exist before the command is encoded as the exact `{sha256:null,path:null}` state, not a fabricated empty blob. Partial null markers refuse. Undo/migration consumers interpret the marker as absence.
- **Transactional create/delete images: bounded PASS under Hard Contract §8 steps 2-12 and Architecture §§6.3/7.** A `before:null -> after:bytes` source patch is checked under the store lease, installed through the durable installer, included in participant evidence, and added to transaction-private `sourceHashes`. Pre-decision rollback removes it. The inverse `before:bytes -> after:null` durably deletes the file and removes its hash.
- **Committed baseline: PASS for covered behavior.** History/transaction/session focused evidence passes `54/54`. Full repository passes `52` files plus `1` skipped / `428` tests plus `10` declared skips. Typecheck, scoped six-file ESLint, diff-check, and exact detached status pass.

### Blocking findings

1. **P0 — null-to-null source patches are validated after durable transaction evidence is written.** `SourcePatch` now permits nullable endpoints, but preflight does not reject `{before:null,after:null}`. The transaction computes the candidate graph and writes content-addressed transaction blobs before `writeParticipant()` calls `assertFileImage()`, where the impossible image finally refuses `TRANSACTION_RECORD_INVALID`.

   QA executed that exact patch. The refusal left `.onemo/transactions/qa-invalid-null-patch/` containing blobs but no valid participant/coordinator. A subsequent valid revision-zero commit then refused `RECOVERY_REQUIRED` for the orphan. An invalid compile plan can therefore permanently poison normal writes despite being rejected.

   This violates Hard Contract §8 steps 4 and 10 (validate before prepared evidence) and Architecture §6.3 steps 4 and 8/13 plus §10's failure/no-poison evidence. Required fix: validate every source/metadata patch shape before transaction-ID allocation or blob persistence; reject null-to-null and any other impossible image with a named command/preflight error and zero transaction directory. Commit both no-evidence and valid-follow-up regressions.

2. **Inherited create-from-selection REWORK remains open.** Exact `f403a0a` does not change the planner or production entry path. The `0c63d59` flat lexical-bound-set failure and the legacy route's sequential raw writes remain current under Hard Contract §§5-6/8/11-G2 and Architecture §§3.1.6/3.2/6.1/10. The Engineer's later planner edits are dirty and were not gated.

3. **Binding-document REWORK remains unchanged.** Hard Contract line 390 and Architecture line 468 still misstate historical V1 preimage/current-byte authority and accepted authored/environment lineage. The exact required correction remains recorded below.

### Independent evidence

- Full reads: all six changed files, `3086/3086` current lines, complete `0c63d59..f403a0a` diff, and exact Hard Contract §8/Architecture §§6.3/7/10 clauses.
- QA required-behavior probe: `0/1`; transaction directory unexpectedly existed. Observational rerun passed only by asserting the defect chain: `TRANSACTION_RECORD_INVALID` -> orphan transaction directory -> next valid commit `RECOVERY_REQUIRED`. The QA-only fixture was removed.
- Browser was not run because this snapshot adds backend transaction/history infrastructure only and does not wire the UI/route/session create flow. No end-to-end or visual closure is inferred.
- `/o-deslop`: one new preflight-order root; prior lexical and vertical blockers are inherited once rather than duplicated. No Meta PASS, Framer parity, G3/G4, Dan sign-off, or final-Done claim is inferred.

## G2 Create-From-Selection Planner Checkpoint `0c63d59`

Verdict: **REWORK — the extraction planner is pure, but its free-reference proof is lexically unsound and the live command still bypasses the authoring transaction**

Exact SHA: `0c63d59466af3dc8a5ca69da5d28dd9798cca924`, including migration identity fixtures `1c58f68`/`04f15cd`, recursive CSS coverage `3ed5222`, and planner extraction `0c63d59`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`. The relayed `831dcaf8...` Hard Contract was the valid 468-line manifest-correction snapshot for the then-667-line Architecture; it remains historical exact-gate evidence and is not the current authority.

### Closed rows

- **Pure extraction plan: bounded PASS under Hard Contract §5 lines 151-174 and Architecture §3.1.6 lines 85-89.** `planMakeComponentFromSelection()` accepts source bytes and selection identity, performs no filesystem access, and returns exact component/source replacement buffers. The live legacy caller consumes this plan, so extraction logic is now separable from installation.
- **Migration identity and recursive CSS regression durability: PASS for the committed fixtures under Hard Contract §§4/9 and Architecture §§5.2/6.2/8/10.** Store/root ownership negatives and generalized recursive CSS semantic distinctions are committed rather than remaining QA-only probes. These additions do not claim create-from-selection transaction closure.
- **Committed baseline: PASS for covered behavior.** Focused planner/migration/projection evidence passes `48/48`. Full repository passes `52` files plus `1` skipped / `422` tests plus `10` declared skips. Typecheck and scoped ESLint pass with only the same two pre-existing `lib.ts` warnings; diff-check and exact detached status are clean.

### Blocking findings

1. **P0 — free-reference validation uses a flat bound-name set rather than lexical scope.** A nested callback parameter can globally mask an outer free reference with the same name. QA selected the root `<div>` in:

   `function Page({ label }) { return <div><strong>{label}</strong>{[1].map((label) => <span>{label}</span>)}</div> }`

   Correct behavior is a named refusal because the first `{label}` is owned by the enclosing component. Exact `0c63d59` returned a plan. The generated component therefore contains an unbound `label`, and the current caller's syntax-only validation does not catch it. This violates Hard Contract §5 validation/refusal lines 151-174 and §6 line 189, plus Architecture §3.1.6 lines 85-89, §3.2 lines 101-106, §6.1 line 416, and §10 line 621.

   Required fix: derive free references with lexical scope or TypeChecker symbol ownership, add nested function/arrow/block-binding shadow-collision regressions, and run exact staged semantic diagnostics before any durable transaction.

2. **P0 vertical residual — the production command still performs two raw writes.** The new planner does not change `page.tsx -> /api/dev/editor-write -> applyWrite(make-component) -> makeComponent`. The caller still writes the new component and then rewrites the source file sequentially, without expected hashes, prepared participant/coordinator evidence, graph/asset registration, history/inverse, or immediate edit-context publication. The `59cd591` root finding remains open under Hard Contract §6 line 189/§8/§11-G2 and Architecture §§3.1.6/3.2/6.1/10.

3. **Binding-document REWORK remains unchanged.** Hard Contract line 390 and Architecture line 468 still describe historical V1 graph preimage authority as derivable from current bytes and assume the later authored/environment split existed in every accepted V1. The exact correction remains recorded in the `59cd591` gate below.

### Independent evidence

- Full reads: all four cumulative changed files, `3574/3574` current lines, complete `59cd591..0c63d59` diff, and the immediate legacy route/caller path from the preceding exact gate.
- QA lexical-shadow extension: `2` passed / `1` failed because the planner did not throw. The QA-only fixture was removed and the checkout restored clean at exact SHA.
- Browser was intentionally not rerun: this snapshot changes no route/UI/E2E behavior and does not expose the missing vertical flow. No browser PASS is inferred from the unchanged prepared-fixture scenario.
- `/o-deslop`: one planner-validation root, one vertical transaction residual, and one unchanged binding blocker. The raw-write mechanism is referenced rather than duplicated as a second new cause. No Meta PASS, Framer parity, G3/G4, Dan sign-off, or final-Done claim is inferred.

## G2 Projection Authority Closure `59cd591`

Verdict: **REWORK — projection/CSS/runtime slice PASS; create-from-selection bypasses the authoring transaction, and binding migration authority remains incorrect**

Exact SHA: `59cd5915e6fd8660032009acf6c4b38c67439add`, including recursive CSS authority `a261c04`, non-finite refusal `c04ffbb`, migrated-undo proof `e7f3fe1`, and accepted-V1 authority proof `59cd591`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

### Closed rows

- **Complete CSS projection authority: PASS under Hard Contract §4/§11-G2 line 390 and Architecture §§5.2/6.2 line 468/10.** `SourceProjection.cssSemantics` preserves ordered rules, recursively nested at-rule context, ordered declarations, duplicate declarations, `!important`, selectors, and normalized values while excluding formatting/comments. Production-route regressions now refuse both base-declaration and nested-media drift as `SOURCE_PROJECTION_DRIFT` with zero sidecar/history/transaction writes. This closes the inherited `6895b68`/`977efcf` P0.
- **Legacy fingerprint upgrade: PASS under Hard Contract §4 and Architecture §§5.2/6.2.** Existing V2 fingerprints that predate complete CSS semantics may advance only when the graph's authored `sourceHashes` exactly equal the current snapshot. Drifted old baselines refuse; `revalidate-source` cannot use compatibility logic to bless changed authored bytes.
- **Projection canonicalization: PASS under Hard Contract §1 law 6/§4 and Architecture §§6.2/10.** Non-finite numeric registry values refuse before evidence, and canonicalization independently rejects any non-JSON numeric value instead of serializing it as `null`. Equivalent numeric spellings, CSS formatting, comment placement, and at-rule case normalize; declaration order, nested context, and nested rule order remain semantic.
- **Accepted V1 and undo runtime migration: PASS for implementation under Hard Contract §§4/8/9 and Architecture §§5.2/7/8/10.** The committed production route accepts the combined-G1 authored-only V1 authority shape without fabricating an environment fingerprint, and the migrated journal preserves a multi-level semantic undo chain. Historical graph preimages are derived from their recorded historical source images, not current bytes.
- **Exact committed projection/runtime gate: PASS for its exercised scope.** Focused route/migration/projection evidence is `68/68`. Full repository is `51` passed plus `1` skipped files / `417` passed plus `10` declared skipped tests. Typecheck and scoped changed-file ESLint pass with only the same two pre-existing `lib.ts` warnings. Cold committed Playwright passes `1/1` in `47.4s`, exercising invalid marker cleanup, exactly one bootstrap reload, existing-component create/rename/physical drag, Home, ordinary reload, re-entry, undo, and the committed zero-unexplained-console/network assertions. It starts from a prepared component fixture and does not cover create-from-selection.

### Blocking findings

1. **P0 — Create Component from selection still bypasses the canonical command/compiler/transaction/history pipeline.** `page.tsx` posts `{kind:'make-component'}` to legacy `/api/dev/editor-write`. That route blocks only files already under `react-figma-components`, so an ordinary selected page source is allowed through. `lib.ts:2426-2522` creates the new component with `fs.writeFile(compAbs)` and then rewrites the source page with a second `fs.writeFile(abs)`, protected only by the in-process `writeQueue`. It produces no canonical graph mutation, CompilerAdapter plan, per-file expected hashes, prepared participant/coordinator evidence, history/inverse, asset registration, or immediate component-edit context; an I/O failure between writes leaves a half-commit.

   QA executed the route boundary with a temporary page-source `make-component` case: HTTP `200`, legacy `applyWrite` called, route suite `4/4`. The committed browser spec starts from a prepared component fixture and never operates create-from-selection. This violates Hard Contract §5 lines 151-174, §6 line 189, §8, and §11-G2; Architecture §3.1.6 lines 85-89, §3.2 lines 101-106, §6.1 line 416, and §10 line 621.

   Required fix: expose `create-component-from-selection` through the strict authoring route/session as one validated command. Low-level extraction may return a staged plan only. The same G1 durable transaction must atomically install the new component, source replacement/import, canonical graph/asset registration, history/inverse, and edit-context target; stale/missing/ambiguous/local-scope/compiler failures write nothing. Commit the exact Architecture §10 browser flow beginning with a real canvas selection.

2. **Binding-document REWORK — historical migration text does not describe the passing migration implementation.** Hard Contract line 390 and Architecture line 468 still say every V1 sidecar/history graph preimage can be fingerprinted by re-deriving it from current tracked source bytes. Historical graph preimages require their own recorded historical source images; current bytes may represent a later command. The same text also assumes every accepted V1 already had today's authored/environment authority split, while combined-G1 accepted authored-only hashes and no `environmentFingerprint`.

   Required correction: state separately that the live V1 graph uses exact current tracked bytes, each historical V1 graph preimage uses its transaction/history-owned source image, and accepted authored-only V1 authority may adopt newly required config/dependency/environment fields only after the exact jailed semantic/projection/registry proof now covered by the implementation tests. No code rework is required for this finding.

### Independent evidence

- Full binding reads: Hard Contract `470/470`, Architecture `672/672`. Exact current authored surface covered through complete prior full-file baselines plus the complete six-file `977efcf..59cd591` diff and every new implementation/test context.
- QA generalized recursive-CSS matrix: `35/35`; nested formatting and at-rule case normalize, while at-rule kind and nested rule order change the fingerprint. A separate unreferenced-class probe confirmed full-module authority; this is retained as conservative contract-consistent behavior because the whole authored CSS module is hash authority and narrowing selectors would miss globals, keyframes, composition, or shared use.
- QA-only tests were removed, Playwright's `.last-run.json` was removed, and the isolated checkout is restored clean at exact SHA. The Engineer worktree was never modified.
- QA-only create-from-selection route probe passed `4/4`, then was removed. Static call-chain proof confirms two raw writes and no authoring transaction/compiler/history dependency in the legacy path.
- `/o-deslop`: one current projection closure, one implementation P0, one binding blocker, and historical exact-SHA sections retained without relabeling. No Meta PASS, Framer-complete parity, G3/G4, Dan sign-off, or final-Done claim is inferred.

## G2 Source Refresh And Marker Follow-Up `977efcf`

Verdict: **REWORK overall — bounded PASS for source-refresh readiness and exceptional marker cleanup; inherited CSS projection authority remains unsafe**

Exact SHA: `977efcf2a06eaad5e4f472a626f0b3ad6f756553`, direct child of rejected `6895b68dde09e774927e087c0a6676875be5d38f`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

### Closed rows

- **Component-source HMR readiness: PASS under Hard Contract §11-G2 and Architecture §§6.2/6.5/10.** The route returns only `graph` plus evidence-derived `sourceChanged`, not the compiler plan. `ComponentCanvas` arms the exact webpack recursive-context accept lifecycle before POST, replaces the context inside its accept callback, increments one generation, and keeps `busy=true` until that generation advances. Sidecar-only rename/move commands cancel the refresh lease immediately. The former E2E-only 300ms same-DOM settling poll is removed. Two independent cold runs complete create -> rename -> physical drag without disposed-context warnings or a doomed-tree interaction.
- **Exceptional import-marker cleanup: PASS under Hard Contract §11-G2 and Architecture §6.5.** `prepareSource()` now cancels its exact transaction marker from the outer catch as well as named non-OK/wrong-kind branches. The committed browser scenario injects a successful response with invalid JSON and then an aborted import request; both show a visible refusal and an absent resume marker before the legitimate import retry. The subsequent import proves exactly one bootstrap reload, then Home -> ordinary reload -> re-entry -> undo.
- **Committed regression/static/browser gates: PASS for this bounded slice.** Focused route/gesture/session evidence is `25/25`. Full repository is `51` passed plus `1` skipped files / `407` passed plus `10` declared skipped tests. Typecheck and scoped changed-file ESLint pass. Cold system-Chrome Playwright passes twice independently: `53.8s` and `46.7s`, with zero unexplained product console warnings/errors, page errors, failed responses, or failed requests after the deliberately injected failure evidence is cleared.

### Blocking finding

1. **P0 — base declarations and nested at-rule rules remain outside projection authority.** `lib.ts` and `source-projection.ts` are byte-identical to `6895b68`. QA replayed both production-route regressions at exact `977efcf`: changing `.base { color:red }` to blue and changing a nested `@media` `.base` declaration to blue each returned HTTP `200` instead of `SOURCE_PROJECTION_DRIFT 422`. The QA route extension was `18/20`. This still violates Hard Contract §11-G2 line 390 and Architecture §6.2 line 468; the required recursive, context-preserving CSS projection fix and no-write regressions remain exactly as recorded in the `6895b68` section below.

### Independent evidence

- Full reads: Hard Contract `470/470`, Architecture `672/672`, all five changed files `1589/1589`, complete exact diff, component resume-marker module `113/113`, authoring session `329/329`, and the unchanged parent shell call site. The `4375`-line shell is byte-identical to the fully audited `6895b68` baseline.
- QA-only CSS authority test was removed with `apply_patch`; Playwright's generated `.last-run.json` was removed; fixture, sidecar, history, transactions, marker, and browser evidence were restored/cleaned by the committed wrapper. Exact detached status and diff-check are clean.
- `/o-deslop`: the HMR and marker mechanisms are closed once, the inherited base/nested-rule failures remain one deduplicated projection-authority P0, and historical snapshot sections remain `KEEP-FLAGGED`. Engineer's later dirty projection work is untouched and ungated. No Meta, full-G2, Framer parity, or final-Done routing is authorized.

## G2 Projection Authority Follow-Up `6895b68`

Verdict: **REWORK overall — accepted V1 migration, ordered CSS declarations, and clean-install reproducibility pass; CSS projection authority remains incomplete**

Exact SHA: `6895b68dde09e774927e087c0a6676875be5d38f`, including migration/projection commit `06f1ad3` and lockfile commit `6895b68`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

### Closed rows

- **Accepted combined-G1 V1 migration: PASS for the exact prior repro under Hard Contract §4/§9/§11-G2 line 390 and Architecture §§5.2/8/10 plus line 468.** A V1 graph without `environmentFingerprint` validates every retained authored hash as a subset of the current exact snapshot, partitions known generated environment paths, then adopts newly required config/dependency authority only after exact TypeScript, SourceProjection, and registry proof. The production route migrates the TSX/CSS-era shape, preserves source bytes, rewrites history graph preimages to schema 2, and leaves the latest semantic command undoable. Tracked authored drift and invalid regenerated ambient syntax still refuse without durable writes.
- **Order-sensitive CSS declarations: PASS for the exact shorthand/longhand collision.** `rules[].decls` is now an ordered array retaining duplicate declarations and `important`; selector/value normalization remains formatting-insensitive. Reversed shorthand/longhand order and `!important` produce distinct fingerprints; comment/format-only CSS and equivalent numeric defaults remain equal.
- **Clean-install reproducibility: PASS under Hard Contract §1 law 6 and Architecture §10.** The lockfile declares the root file dependency, target package record, and `node_modules/onemo-component-library` link. Entire JSON parses with 1,207 valid package records; `npm ci --ignore-scripts --no-audit --no-fund` succeeds and installs the expected link. The inherited package-lock blocker is closed.

### Blocking finding

1. **P0 — base declarations and nested at-rule rules are absent from `projectionFingerprint`.** `parseComponentModelSnapshot()` identifies the bare base rule but explicitly skips it (`d === 'base'`), so its declarations never enter `SourceProjection.rules`. It also iterates only `root.nodes`; component rules nested under `@media` or another at-rule are never projected. QA imported `.base { color:red }`, changed it to blue, and separately changed `@media (...) { .base { color:red } }` to blue. Both production `revalidate-source` requests returned HTTP `200`, advanced graph revision `1 -> 2`, rewrote sidecar and history, and added transaction evidence instead of refusing `SOURCE_PROJECTION_DRIFT` with zero writes.

   This violates Hard Contract §11-G2 line 390 and Architecture §6.2 line 468, which require structural, prop, **rule**, or connector drift to refuse. Required fix: SourceProjection must represent/fingerprint base declarations and recursively scoped at-rule rules, including at-rule context and observable order, while retaining formatting-insensitive selector/value normalization. Commit both production-route regressions and negative no-write assertions.

### Independent evidence

- Full authored-source read: route test `733/733`, projection test `475/475`, migration `333/333`, parser `2662/2662`, projection `246/246`; lockfile first 1,000 lines plus whole-file JSON/package-record validation and clean-install execution.
- Committed focused suites: `46/46`. Full repository: `51` passed plus `1` skipped files / `407` passed plus `10` declared skipped tests. Typecheck clean; scoped ESLint `0 errors / 2 unchanged warnings`; diff-check and exact detached status clean.
- QA-only production probes: `0/2`, both with HTTP `200`, revision advancement, and changed sidecar/journal/transaction evidence. Probes were removed with `apply_patch`; the isolated checkout is restored clean at exact SHA.
- `/o-deslop`: base and nested-at-rule failures share one incomplete CSS projection mechanism and are reported once. The prior V1 subset, declaration-order, and package-lock blockers are closed rather than repeated. HMR readiness, exceptional-marker cleanup, and binding migration-authority wording remain separate current rows; no Meta, full-G2, parity, or final-Done routing is authorized.

## G2 Reload And Malformed-Sidecar Gate `a3984dd`

Verdict: **REWORK overall — bounded PASS for ordinary reload and malformed-sidecar refusal; both `f402acb` P0s remain byte-identical**

Exact SHA: `a3984ddd14cf55f2d317680778b0edbe0199cfc7`, including ordinary-reload commit `5d51b82`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`.

- **Ordinary post-consumption reload: PASS under Hard Contract line 395 and Architecture §6.5/§10.** Consuming the one bootstrap marker removes it without persisting a poison tombstone. A later plain reload returns resume phase `none`, re-enters through the Components rail, preserves moved geometry, and permits undo. Exact cold system-Chrome Playwright passes the complete committed flow in `38.0s`; editor document count is exactly two, with no captured console warning/error, page error, failed response, or failed request.
- **Malformed persisted JSON: PASS under Hard Contract §1 law 6/§4 and Architecture §§5.2/10.** Store load returns named `AUTHORING_SIDECAR_INVALID` `409`, preserves malformed bytes, and creates no transaction directory.
- **Regression/static gates: PASS.** Focused session/store/route evidence is `30/30`. Full repository is `51` passed plus `1` skipped files / `404` passed plus `10` declared skipped tests. Typecheck, scoped five-file ESLint, diff-check, and exact detached status pass.
- **Overall REWORK inherited by exact byte identity.** `authoring-sidecar-migration.ts` and `source-projection.ts` are unchanged from `f402acb`; accepted `9e9adf4` V1 state still refuses migration, and shorthand/longhand CSS order still collides and is blessed by `revalidate-source`. The E2E-only 300ms HMR-settling poll and exceptional import marker catch remain unchanged. Clean-install reproducibility remains red for the inherited lockfile omission. No Meta or full-G2 routing is authorized.

## G2 Projection And V1 Migration Gate `f402acb`

Verdict: **REWORK — projection authority closes the original structural-TSX repro, but rejects accepted V1 lineage and collides on order-sensitive CSS semantics**

Exact SHA: `f402acbbff6c388ac60c7d71254a0a6bef04d386`.

Binding files: Hard Contract `470/470`, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`; Architecture `672/672`, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`. Their manifests agree, but their V1 history/source-authority migration wording remains QA REWORK as recorded at the top of this ledger.

### Closed rows

- **Original type-valid JSX structural-drift repro: PASS under Hard Contract §11-G2 line 390 and Architecture §6.2 lines 459-468.** Import and CompilerAdapter results persist `projectionFingerprint`; compiler commands, `revalidate-source`, and `environment-rebase` compare the exact current projection before committing. The committed root `<button>` to `<section><button>` regression refuses `SOURCE_PROJECTION_DRIFT` with no durable writes.
- **Fingerprint hardening: bounded PASS.** Native registry entries are ID-sorted with binary ordering; prop access/default order remains preserved; SourceAnchor line/column are excluded; TypeScript tokens use structural tuples; default expressions use TSX AST context; selectors and CSS values use declared parser dependencies; non-finite numbers cannot serialize as `null`. QA additionally confirmed comment-only CSS and numeric default `1` versus `1.0` normalize equally.
- **Modern-downgraded migration path: bounded PASS.** A V2 graph/history generated by the current parser, stripped to V1 fields, migrates under the store lock through one durable transaction; source-restoring undo evidence is rewound from committed transaction blobs, graph history preimages become V2, and the latest semantic command remains undoable.
- **Committed regression/static gates: PASS.** Focused migration/projection/compiler/store/history/transaction/route evidence passes `135/135`. Full repository passes `51` files plus `1` skipped / `403` tests plus `10` declared skips. Typecheck, scoped changed-file ESLint, diff-check, and exact detached status pass.

### Blocking findings

1. **P0 — the accepted combined-G1 V1 hash shape cannot migrate.** Exact `9e9adf4` classified and persisted only the TSX/CSS bytes consumed by its parser and had no `environmentFingerprint`. `authoring-sidecar-migration.ts` filters legacy generated `.next` hashes, then exact-compares that historical set against today's `readExactAuthoringSourceSnapshot()`, which additionally includes tsconfig/config-chain, ambient declarations, and project dependencies. QA recreated the accepted V1 shape from exact historical source: component TSX hash only, `schemaVersion: 1`, no environment/projection fingerprint. Component load returned HTTP `409`, not a migrated V2 graph. The committed fixture only downgrades a graph produced by today's expanded snapshot, so it misses this lineage. Violates Hard Contract §4, §9, and line 390 plus Architecture §§5.2/8/10 and line 468.

   Required fix: define and implement the authority transition from the exact accepted V1 set. Preserve and verify every V1-authored hash; add newly required config/dependency authorities only after exact jailed semantic/projection/registry proof; partition only proven generated environment inputs; refuse genuine drift without requiring historical graphs to predict authorities introduced later.

2. **P0 — projection fingerprints erase order-sensitive CSS cascade semantics.** `SourceProjection.rules[].decls` is an object and `canonicalize()` sorts object keys. `.base { margin: 0; margin-left: 1px }` and the reverse order therefore produce the identical projection SHA `94ff072d...`, although their computed `margin-left` differs. Production-route proof imported the first form, wrote the second, and `revalidate-source` returned HTTP `200` instead of `SOURCE_PROJECTION_DRIFT 422`, advancing canonical authority. Violates Hard Contract §4 and §11-G2 line 390 plus Architecture §6.2 lines 459-468 and §10.

   Required fix: fingerprint a lossless ordered declaration representation, or named-refuse projection shapes whose order semantics cannot be represented. Sorting declaration-object keys cannot certify untouched CSS semantics.

3. **Inherited P0/P1 runtime blockers remain byte-identical from `0061807`.** This commit changes no component-authoring frontend or E2E file. Ordinary post-consumption reload still expects `AUTHORING_SECOND_RELOAD_REFUSED` instead of the success required by Hard Contract line 395 and Architecture §6.5; create-source readiness still depends on the E2E-only 300ms same-DOM poll; exceptional import `fetch/json` failures can still strand the marker. The prior exact browser evidence remains applicable, but no new browser PASS is inferred.

4. **P1 acceptance reproducibility remains red.** `npm ci --ignore-scripts --no-audit --no-fund` refuses because `onemo-component-library` is missing from the lockfile. The two newly direct parser dependencies are correctly declared and locked; this is inherited package debt, not an `f402acb` regression, but the exact package still lacks a clean-install proof required by Hard Contract §1 law 6 and Architecture §10.

### Independent evidence

- Exact cumulative scope: one commit, 20 files, `1,154` insertions / `59` deletions. New migration module and all changed production/test seams were read; generated lockfile was audited by exact diff and clean-install attempt.
- QA adversarial route/projection matrix: `45` pass / `1` accepted-V1 failure in the first run; production CSS impact rerun: route `17` pass / `2` failures. QA-only regressions were removed and the checkout restored byte-clean at exact SHA.
- Full committed suite: `403 passed / 10 declared skipped`; typecheck and scoped ESLint exit `0`.
- `/o-deslop`: the two new P0s are behavior-distinct. Existing `0061807` findings are inherited by byte identity rather than duplicated as new mechanisms. No Meta, full-G2, parity, or final-Done routing is authorized.

## G2 Environment And Import-Reload Gate `0061807`

Verdict: **REWORK — environment/marker infrastructure passes bounded checks; authored-source round-trip and interaction readiness still fail**

Exact SHA: `0061807afacbaa8b44995c9e39492f20a3120d8c`.

Binding package: Hard Contract `468/468`, SHA-256 `831dcaf8e59bfb6e26efb11c563d54a4ce324492d1e6456309181db21d54c82b`; Architecture `667/667`, SHA-256 `b368f814a866cfb2d0913b33b5a219a22c1aa2e4cc0266d06ff00dbe56300f4c`.

### Closed rows

- **Authored/environment authority split: bounded PASS under Hard Contract §4/§11-G2 and Architecture §5.2.1/§§6.2-6.3.** Generated Next ambient declarations remain in the exact compiler snapshot but no longer enter authored `sourceHashes`; their consumed exact-byte set produces `environmentFingerprint`. `environment-rebase` is explicit, transaction-backed, preserves authored source hashes/bytes, typechecks the exact snapshot, and does not hide the latest semantic variant undo. Missing or changed environment inputs refuse by named fingerprint errors under the transaction lease.
- **Structured import marker: bounded PASS for committed cases under Hard Contract §11-G2 and Architecture §6.5.** The client issues `{version,targetFile,expectedHash,transactionId,issuedAt,ttlMs}` outside tracked `.onemo`; tests cover origin non-consumption, exact different-document resolution, consumed-marker second-reload refusal, malformed/expired/mismatched cleanup, canonical component paths, and duplicate-marker refusal. `ComponentCanvas` is file-keyed by the parent and load responses use a generation guard.
- **Committed regression/static gates: PASS.** Environment/marker/transaction focused suites pass `87/87`. Default full suite passes `51` files plus `1` skipped / `386` tests plus `10` declared skips. Typecheck and diff-check pass; the detached QA checkout is clean.
- **Committed cold browser scenario: functional PASS only.** Isolated system-Chrome Playwright on port `3052` passes create, rename, physical move, Home/re-entry, undo, exact first-import document count, named second-reload refusal, cleanup, and zero captured page console/network failures. This does not close the product-readiness or binding-sequence findings below.

### Blocking findings

1. **P0 — type-valid authored structural drift is still blessed.** `ProjectAuthoringSession.revalidateSource()` runs the exact TypeScript checker and `projectVariantRegistry()`, then commits the new source authority. It still does not compare fresh SourceProjection structure/anchors against the accepted projection or run the required CompilerAdapter round-trip. QA imported the canonical single-axis fixture, changed the root from `<button>` to `<section><button>...</button></section>` without changing registry/types, then called `revalidate-source`. Exact `0061807` returned HTTP `200`; the route suite with the temporary probe was `12 passed / 1 failed` because required refusal expected `422`. This violates Hard Contract §4/§11-G2 and Architecture §5.2.1 items 2-3, §§6.2-6.3/10.
2. **P0 — ordinary post-consumption reload is refused.** The post-gate binding package is now internally consistent: Hard Contract `a159f5bb...` §11-G2 and Architecture `faed7e12...` §6.5 require `Home -> reload -> undo` to succeed after the bootstrap marker is consumed. Exact `0061807` deliberately expects `AUTHORING_SECOND_RELOAD_REFUSED` instead, so it fails both clarified artifacts. The earlier document contradiction is closed; this is now solely an implementation/E2E defect.
3. **P1 — E2E settling masks a product interaction race.** The Engineer's cold failures proved create-source HMR can remount the authoring canvas after `Variant 3` is visible and after product `busy` clears. Exact `0061807` waits until one DOM instance survives a 300ms polling window before renaming; no product state prevents a real user from targeting the doomed pre-HMR tree. A green test therefore proves a safe test schedule, not that the UI interaction boundary is safe. This violates Hard Contract §11-G2 same-canvas behavioral acceptance and Architecture §§3.2/10 until product readiness is explicit or the binding package dispositions the dev-HMR boundary.
4. **P1 — exceptional import failures can strand the live marker.** `prepareSource()` cancels the marker for non-OK responses and wrong success kinds, but its catch path does not cancel after a thrown `fetch()` or `response.json()` failure. The next attempt then refuses as a second reload even though the import never completed. Architecture §6.5 requires invalid/failed marker evidence to refuse and clean up rather than strand the session.

### Independent evidence

- Mandatory cumulative scope: 22 changed files, `739` insertions / `83` deletions; exact production/test diff read plus complete marker, ComponentCanvas, route/session/environment, transaction authority, and E2E paths. Historical parser/schema/G1 transaction context was retained from prior full-file gates and rechecked at changed seams.
- QA structural-drift extension: `12/13`, receiving HTTP `200` instead of required refusal. QA-only test removed immediately; exact checkout restored clean at `0061807`.
- Focused committed evidence: `87/87`. Full repository: `386 passed / 10 declared skipped`. Typecheck clean.
- Cold committed E2E: `test-results/.last-run.json` reports `passed`; fixture/store cleanup succeeded and no process remained on isolated port `3052`. Server logs retain only known development/deprecation warnings outside the page's captured console gate.
- `/o-deslop`: one current exact-SHA section, one binding contradiction, and behavior-distinct product readiness/marker cleanup findings. No duplicate current verdict, no historical rewrite, no G3/G4/Meta/final-Done claim.

## G2 Revalidation And Active-Session Gate `67a6e1d`

Verdict: **REWORK — narrow type-diagnostic fix passes; full authored-source round-trip and import-bootstrap session laws still fail**

Exact SHA: `67a6e1d434159800f13fc9fa956a9591ab1c4c6f`, including active-session snapshot `3c90119`.

Binding package: Hard Contract `468/468`, SHA-256 `831dcaf8e59bfb6e26efb11c563d54a4ce324492d1e6456309181db21d54c82b`; Architecture `667/667`, SHA-256 `b368f814a866cfb2d0913b33b5a219a22c1aa2e4cc0266d06ff00dbe56300f4c`.

### Closed rows

- **Narrow semantic diagnostic: PASS under Hard Contract §4/§8/§11-G2 and Architecture §§5.2.1/6.2-6.3.** `revalidateSource()` now runs the compiler's exact-snapshot TypeScript checker before history/transaction planning. The committed route regression changes a native registry value from a valid string to a number, receives `STAGED_TYPECHECK_FAILED`, and proves source, sidecar, history, and transaction entries unchanged. This closes the exact invalid-TypeScript repro from `7a4e8b9`, not the broader round-trip obligation below.
- **D5 and visible G2 lifecycle remain present.** The fixed breadcrumb remains outside the transform. The cold E2E reaches create, Enter/Escape/blur rename, physical drag, Home, re-entry, manual reload, persisted geometry, and Meta-Z undo before its final network failure. This is functional evidence only; the session/reload semantics used by that flow violate the binding contract below.

### Blocking findings

1. **P0 — Type-valid authored structural drift is still blessed.** `revalidateSource()` typechecks, then calls only `projectVariantRegistry()` before committing every new source hash. It never compares the fresh SourceProjection fields/anchors against the prior accepted projection or routes the authored change through a CompilerAdapter round-trip. QA changed a valid component root from `<button>` to `<section><button>...</button></section>` while preserving registry/type correctness. Exact `67a6e1d` returned HTTP `200`; the QA assertion requiring named no-write refusal failed (`11 passed / 1 failed`). This violates Hard Contract §4 and §11-G2 plus Architecture §5.2.1 items 2-3, §§6.2-6.3, and §10.
2. **P0 — the new active-session string contradicts the exactly-one bootstrap reload contract.** `AUTHORING_ACTIVE_FILE_KEY` stores only a file string in `sessionStorage` whenever any component is edited, survives every document reload, and is cleared only by Home/rail exit. It has no version, expected hash, transaction ID, issue time, TTL, origin-document rule, consumed state, mismatch cleanup, or second-reload refusal. The committed E2E explicitly performs a later manual `page.reload()` and expects automatic authoring resume. This is the opposite of Hard Contract §11-G2 and Architecture §6.5, which allow one first-import reload only and require a named refusal for a second/later reload.
3. **P0 — exact reload-phase/count evidence remains wrong.** The E2E still accepts either immediate canvas or `Revalidate source`, and asserts token responses equal however many editor documents occurred rather than requiring exactly one bootstrap reload at the import phase. It proves neither origin/different-document identity nor structured marker consumption. Required by Hard Contract §11-G2 and Architecture §6.5/§10.
4. **P0 environment authority remains absent.** No `environmentFingerprint` or transactionally verified `environment-rebase` exists. Ambient inputs are still handled through the authored-source hash model, contrary to Hard Contract §4 and Architecture §5.2.1.
5. **P1 cold browser runtime is not clean.** The fresh-cache exact-SHA E2E completes all action assertions, then fails `failedRequests === []` because manual reload aborts an in-flight `component-status` request with `net::ERR_ABORTED`. The implementation therefore does not meet the zero-failed-network acceptance gate even on its own permissive reload model.

### Independent evidence

- Mandatory cumulative reads: current ComponentCanvas `222/222`, active-session module `1/1`, route test `340/340`, compiler `343/343`, session `242/242`, E2E `175/175`, exact page delta over the fully read `832441b` shell, and both commit diffs.
- QA structural-drift extension: route suite `11 passed / 1 failed`; received HTTP `200` instead of required `422`. Probe removed and exact checkout restored clean.
- Committed focused backend: `27/27`. Default full suite: `50 passed + 1 skipped` files; `380 passed + 10 declared skips` tests. Typecheck/diff-check clean; six scoped changed files ESLint-clean; page retains `12 errors/11 warnings` baseline.
- Cold system-Chrome Playwright on isolated port `3051`: one test failed after `39.8s` only at the final aborted-request assertion. Generated cache isolated and the pre-gate cache restored; fixture cleanup and exact worktree cleanliness verified.
- `/o-deslop`: one active-file owner and one close helper, but the abstraction is contract-wrong rather than duplicated. Historical sections remain exact-snapshot evidence. No Meta, full G2, parity, or final-Done routing is authorized.

## G2 Breadcrumb Gate `832441b`

Verdict: **REWORK overall — bounded source-level PASS for D5 breadcrumb transform only; no clean browser or full G2 PASS**

Exact SHA: `832441b9cd1ecdb01a74729ce238610b6021003a`.

Current binding package: Hard Contract `468/468`, SHA-256 `831dcaf8e59bfb6e26efb11c563d54a4ce324492d1e6456309181db21d54c82b`; Architecture `667/667`, SHA-256 `b368f814a866cfb2d0913b33b5a219a22c1aa2e4cc0266d06ff00dbe56300f4c`.

### Closed row

- **D5 breadcrumb transform: bounded source PASS under Hard Contract §§6-7/11-G2 and Architecture §§3.2-3.4/9-11.** The sole component breadcrumb is an absolute child of the canvas `<main>` and a sibling preceding the dotted background and `translate(... ) scale(...)` wrapper. Pan/zoom therefore cannot transform it. The design-only frame label remains inside the transformed wrapper and is suppressed in component mode. The committed E2E captures the breadcrumb bounding box, zooms in, asserts exact equality, then zooms out. `/o-deslop` finds one breadcrumb owner, no duplicate transformed breadcrumb, no dead helper, and no TODO/HACK marker in the two-file slice.
- **Binding manifest integrity: PASS at Hard Contract `831dcaf8...`.** HC §0 now names the actual amended Architecture as `667/667`, SHA `b368f814...`; the stale pre-amendment pointer is removed.

### Blocking findings

1. **P0 authored-source revalidation remains invalid under Hard Contract §4/§11-G2 and Architecture §§5.2.1/6.2-6.3/10-11.** `832441b` does not change the rejected `revalidate-source` path. QA's exact `7a4e8b9` probe proved that path accepts TypeScript-invalid authored TSX with HTTP 200. The amended documents explicitly preserve the obligation: authored TSX/CSS/dependency changes, including `revalidate-source`, must run the full CompilerAdapter, semantic typecheck, SourceProjection rebuild, and round-trip proof before commit.
2. **P0 environment authority is not implemented under Hard Contract §4/§11-G2 and Architecture §5.2.1.** The amended contract separates authored `sourceHashes` from `environmentFingerprint` and permits advancement only through a named, transactionally verified `environment-rebase` with unchanged authored hashes and proven projection/registry equivalence. This snapshot has neither the separate field nor that operation.
3. **P0/P1 reload-marker and evidence contract is not implemented under Hard Contract §2/§11-G2 and Architecture §6.5.** The exactly-one first-import reload is now authorized, closing the old governance absence. The implementation still uses an unversioned file string rather than `{ version, targetFile, expectedHash, transactionId, issuedAt, ttlMs }`; origin/consumer/expiry/mismatch/second-reload rules are absent. The E2E accepts either immediate canvas or `Revalidate source`, maps token responses to arbitrary document count, and does not prove the exact permitted reload phase/count or before/after identity.
4. **P0 cold runtime entry still fails.** A fresh-cache exact `832441b` Playwright run on isolated port `3050` timed out after 60 seconds before the import preview at the Components-rail/double-click predicate. The new breadcrumb assertion never executed. This leaves Hard Contract §11-G2 and Architecture §10 runtime acceptance open.
5. **P1 full G2 lifecycle remains unproven under Hard Contract §11-G2 and Architecture §10.** The committed spec covers create/rename/Home but omits physical move, post-command reload persistence, and undo. It therefore does not encode the required selection -> named component -> same canvas -> create/move/rename -> Home -> reload -> undo flow.

### Independent evidence

- Mandatory reads completed: Hard Contract `468/468` at the amended behavior package plus the exact §0 manifest correction to current SHA `831dcaf8...`; Architecture `667/667`; current `page.tsx` `4345/4345`; E2E `136/136`; and exact two-file commit diff.
- Exact unit baseline: `50 passed + 1 skipped` files; `379 passed + 10 declared skips` tests. Typecheck and diff-check pass. Full page/E2E lint remains `12 errors + 11 warnings`, all on the known page-wide baseline; the E2E introduces no reported diagnostic.
- Cold E2E: one failed test, exact 60-second pre-import timeout. Fixture cleanup succeeded; the QA checkout is restored clean at the exact SHA. Generated cache was isolated during the run and the pre-gate cache restored.
- This section supersedes the prior current-gate wording only. Historical `7a4e8b9` and `d5cddb5` evidence remains exact-snapshot audit history. No Meta, parity, full G2, or final-Done routing is authorized.

## G2 Rename And Frame Grammar Gate `d5cddb5`

Verdict: **REWORK overall — bounded PASS for F-P1 inline rename and D2-a/D2-b frame grammar only**

Historical exact-snapshot gate. The later `832441b` section is current and records the amended binding package; the reload-governance absence below was subsequently closed by document amendment, while its implementation requirements remain open.

Exact SHA: `d5cddb5d2a932b14f5ea34de68e01b3ae272bb48`, including `1fa79ba01b74485ec2cadd8ab279f81b3b42bb9a`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Closed rows

- **F-P1 inline rename: PASS under Hard Contract §7 line 239, §11/G2 line 386, and Architecture §§6.1/7/9-11.** Enter prevents default and blurs; blur is the sole rename-command dispatcher, so the input is removed before another Enter can dispatch. Escape sets the cancel ref and blurs; the same dispatcher clears without a command. Clicking another visible frame produces ordinary blur commit. Every command carries the existing `variantId` into the already-proven rename-by-ID compiler path; `ERRORS.md` records the failed locator/timing approaches and stable pattern.
- **D2-a/D2-b frame grammar: PASS under Hard Contract §7 lines 220/225/239, §11/G2 line 389, and Architecture §§9-11.** Unselected frames have no border or outline; selected frames use one solid semantic-accent outline. The Primary suffix remains available for a renamed Primary but is suppressed when the label already equals `Primary`, eliminating `Primary · Primary`.
- **Exact static baseline: PASS.** Default Vitest passes `50 passed + 1 skipped` files / `379 passed + 10 declared skips` tests. Typecheck is clean. Scoped ComponentCanvas/E2E lint has zero errors; `ERRORS.md` is outside ESLint configuration and reports only the expected ignored-file warning. Diff-check and detached status are clean.

### Remaining blockers

1. **P0 source authority remains unchanged from `7a4e8b9`.** `authoring-session.ts` is byte-identical, so `revalidate-source` still bypasses CompilerAdapter/type-aware validation and can bless the TypeScript-invalid source reproduced in the prior exact gate. Required clauses/remediation remain Hard Contract §§4/5/8/11-G2 and Architecture §§3.3-3.4/6.2-6.3/7/10-11.
2. **P0 reload/console acceptance is not clean or stable.** The first exact cold system-Chrome run passed D2, create, Enter, Escape, click-away, Home identity, and geometry, then failed the final zero-warning assertion on Next's Fast Refresh full-reload warning. A second fresh-cache run failed before import after 60 seconds at the preview predicate. This contradicts the Builder's clean cold-E2E claim and leaves Hard Contract §11/G2 plus Architecture §§3.2-3.4/9-10 open.
3. **Historical P0 contract-authority gap, subsequently closed by amendment.** At exact `d5cddb5`, neither then-binding artifact defined the proposed reload. Current Hard Contract `831dcaf8...` and Architecture `b368f814...` now authorize exactly one import-bootstrap reload with structured marker and exact phase/count rules; `832441b` still does not implement those rules.
4. **P1 marker, response-race, D5, and full-flow evidence remain open.** `resume.ts` and `page.tsx` are byte-identical to `7a4e8b9`; the marker remains an unversioned file string, successful async publication remains generation-unguarded, and the breadcrumb remains inside the transform. The committed browser spec still omits move, hard reload, and undo and accepts any editor-document count.

### Independent evidence

- Full reads: cumulative changed files `446/446` lines and both exact commit diffs; relevant binding clauses and both artifact hashes reverified.
- Browser run 1 proves the F-P1/D2 assertions execute successfully before the later warning failure. Browser run 2 proves the cold entry remains nondeterministic. QA did not filter the warning or relabel either run green.
- A QA-only command-count/stable-ID extension was attempted on the second cold run, but that run never reached import. The extension was removed and no unexecuted assertion is claimed as evidence; exact source control plus the existing compiler identity test support the bounded F-P1 result.
- `/o-deslop --sweep`: one rename state owner, one blur dispatcher, no duplicate frame-selection grammar, no dead helper or TODO/HACK marker, and no parallel report. Historical `7a4e8b9` remains root-cause evidence rather than a duplicate current verdict.
- QA fixture/store residue is absent and the isolated checkout is clean at exact SHA. No Meta, full G2, Framer parity, or final-Done routing is authorized from this snapshot.

## G2 Import Recovery Gate `7a4e8b9`

Verdict: **REWORK — the import/status UI is directionally useful, but the new authority command accepts TypeScript-invalid source and the exact committed cold Chrome flow cannot reach import**

Historical exact-snapshot gate. The later document amendment closes only the governance absence described below; it explicitly preserves this gate's semantic-invalid `revalidate-source` P0.

Exact SHA: `7a4e8b99759967f2bf2689393dec7b42b8c3bff4`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`. Neither artifact authorizes the implemented `revalidate-source` command or the proposed exactly-one import-bootstrap reload exception.

### Passing rows

- **Hard Contract §9 and Architecture §8 import classification: bounded PASS.** `component-status` exposes an explicit import preview for missing graphs, preserves unsupported holds/refusals, and `import-source` remains exact-hash/transaction backed.
- **Hard Contract §8 and Architecture §7 history selection: bounded PASS.** `revalidate-source` journal entries do not hide the prior real G2 command from undo. The committed create -> ambient change -> revalidate -> undo route test passes.
- **Committed backend/static baseline: PASS with one environment qualification.** Focused route/session/history/import/compiler suites pass `62/62`; the full default suite passes `50 passed + 1 skipped` files / `379 passed + 10 declared skips` tests. Seven changed files are ESLint-clean; `page.tsx` retains its known `12 errors + 11 warnings` baseline. A stale ignored `.next/dev/types` cache first failed typecheck on generated Next internal-type drift; after preserving that cache and regenerating cleanly, typecheck passes. This reinforces that `.next/dev/types` is volatile compiler environment rather than ordinary authored source.

### Blocking findings

1. **P0 — `revalidate-source` can bless TypeScript-invalid source authority.** `ProjectAuthoringSession.revalidateSource()` reads a fresh snapshot and checks only the native variant registry against the existing graph. It does not use `parseG2VariantCommand`, `CompilerAdapter`, staged semantic TypeScript diagnostics, or a full before/after SourceProjection equivalence proof before committing the fresh hash map and advancing revision.

   QA imported a valid single-axis component, changed its TSX to contain `const invalid: number = 'not-a-number'` without changing the variant mapping, then POSTed `revalidate-source`. Correct behavior was a named `STAGED_TYPECHECK_FAILED` refusal with unchanged sidecar/history. Exact `7a4e8b9` returned HTTP `200`. This violates Hard Contract §4 exact source authority/no auto-merge, §5 command compiler/validation/inverse contract, §8 transaction steps, and §11/G2 staged type-aware round-trip; it also violates Architecture §§3.3-3.4, 6.2-6.3, 7, 10, and 11.

   Required fix: do not allow generic revalidation to accept arbitrary TSX/CSS/dependency changes. If an environment-rebase command remains necessary, define it in both binding artifacts, restrict changed authority to the permitted compiler-environment inputs, run exact jailed semantic diagnostics plus full registry/projection/anchor equivalence, preserve exact history/inverse semantics, and write nothing on refusal. Authored source changes require an explicit reconciliation/compiler path, not hash refresh.

2. **P0 runtime — the exact committed cold system-Chrome scenario fails twice before import.** Two independently fresh-cache runs of `npm run test:e2e -- tests/e2e/react-figma-authoring.spec.ts` both time out after 60 seconds inside the Components-rail/double-click retry. Neither reaches the required `AuthoringE2EButton · legacy-single-axis · 2 variants` preview. The captured page ends back in normal design mode with the Components panel closed. Fixture, marker, backup, and Git cleanup succeed after both failures.

   This fails Hard Contract §11/G2 selection -> named component -> same-canvas flow and Architecture §10's real selection/import lifecycle. It also means the committed test supplies no runtime proof for its later Home, console, network, reload, or revalidation assertions at this exact SHA.

3. **Historical P0 governance gap at this SHA, subsequently closed by amendment.** The then-current Hard Contract §2/§11 and Architecture §§3.2-3.4/10 did not authorize a bootstrap reload. Current Hard Contract `831dcaf8...` and Architecture `b368f814...` now define the allowed phase/count, exact structured marker, later-reload prohibition, and E2E evidence; the implementation rows remain open in the current `67a6e1d` gate.

4. **P1 — resume marker lifecycle remains unsafe.** The marker is an unversioned file-path string. Same-document success can clear it before replacement; a committed import followed by an aborted/stale load enters `catch` and clears it; invalid, expired, renamed, and missing targets lack explicit cleanup/refusal semantics. This violates the exact identity/reload/error obligations in Hard Contract §5 and Architecture §§6.2/9/10.

5. **P1 — cross-file async publication remains unsafe.** `ComponentCanvas` is reused without `key={file}` and successful async status/load paths do not apply a request-generation or abort guard. A delayed component-A result can publish preview/hashes into component B. The transaction may later refuse, but the visible state is stale and dead-ended. This violates Hard Contract §§4-5 and Architecture §§5.2/6.2/10.

6. **P1 evidence — the committed E2E does not encode the required lifecycle.** It conditionally accepts either immediate canvas or `Revalidate source`; it equates token responses to however many editor documents occurred without constraining allowed count/phase; and it stops after Home. It does not prove exactly one permitted bootstrap reload, no later reloads, or Architecture §10 create/move/rename/Home/reload/undo.

### Independent evidence

- Full current-file reads: all eight changed files, `5697/5697` lines, plus complete immediate import/transaction/compiler/projection seams. Exact binding clauses were re-read and both artifact hashes reverified.
- QA-only invalid-source regression failed as described, then was removed. Exact checkout is restored clean at `7a4e8b9`.
- In-app Browser was attempted first and reported no `iab` backend. The repository's configured Playwright fallback used system Chrome, an isolated port, cold generated caches, and the committed fixture/server lifecycle. Both exact runs failed at the same pre-import predicate; this is product/test runtime evidence, not an authentication or browser-install block.
- Manual deslop/self-audit: this section credits the real import/status/history improvements, keeps the prior dirty-preflight section historical, and does not promote green unit tests into runtime, Meta, parity, full G2, or final-Done closure. Existing F-P1/D2-a/D2-b/D5-a Meta findings remain open and are not duplicated here.

## G2 F-P0 Dirty Preflight On Parent `4aea05b`

Verdict: **REWORK PRE-COMMIT — no exact snapshot gate; the proposed import UI is directionally correct but cannot lawfully complete the cold flow under the current binding model**

Committed parent: `4aea05bed41995f628f85d6ceb1c6ad17e992741`. Engineer worktree is intentionally dirty and was inspected read-only; QA changed no product bytes.

Binding package remains unchanged: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Directionally correct work

- A non-mutating `component-status` read converts only `AUTHORING_GRAPH_MISSING` into an HTTP-200 import preview while preserving the direct named 409 route. The preview exposes exact classification/hashes, imports only `native-v1` or `legacy-single-axis`, and leaves unsupported mappings refused. This aligns with Hard Contract §§4/9 and Architecture §§6.2/8.
- The E2E removes raw API seeding and enters through Components -> exact project component -> import preview -> Import. This is required user-path evidence, but the current test does not yet prove the complete Architecture §10 flow.

### Blocking findings

1. **P0 — the current source-authority model deadlocks cold import.** The import commits, then `.onemo` mutation under `src/app` makes Next regenerate the already-hashed `.next/dev/types/routes.d.ts`. Resumed `ProjectAuthoringSession.loadComponent()` recomputes exact authority and correctly refuses `SOURCE_HASH_STALE`. This is required by Hard Contract §4: per-file exact raw-byte hashes, named 409 on mismatch, and no overwrite/auto-merge. It also means the earlier decision to keep generated ambient declarations in `sourceHashes` is no longer harmless churn; it prevents F-P0 from completing cold.

   Required architecture choice: either move runtime metadata churn outside App Router source authority while preserving the tracked canonical sidecar law, or separate compiler-environment fingerprints from authored source hashes and define an explicit staged, typed, projection-equivalent, transaction/history-backed environment-rebase command. Do not exclude `.next`, mutate hashes during GET/resume, or weaken `SOURCE_HASH_STALE`. Automatic refresh would violate Hard Contract §4 and Architecture §3.3 item 5 navigation-read-only.

2. **P0 — an import-bootstrap document reload is not authorized by the current artifacts.** Hard Contract §2 still requires a persistent one-canvas component-edit context; §11/G2 requires the same canvas and no fixed-board remount; Architecture §§3.2/3.4 require one persistent authoring canvas; §10 requires edit-same-canvas. Lead selected a constrained Option-B exception in its lane, but neither binding document has been edited or rehashed. QA remains bound to the current text.

   Required contract revision: permit exactly one import-bootstrap document reload, define its allowed phase/count, require exact-component session resume, forbid later authoring reloads, and encode the exception in E2E. One token request per document remains a useful secondary invariant; arbitrary document count is not.

3. **P1 — the resume marker is not identity- or lifecycle-safe.** The WIP stores only a file string. The originating document's successful `load()` can clear it before Next reloads; a committed import followed by stale/aborted load enters `catch` and also clears it. There is no schema/version/document identity/timestamp/expiry, so missing/renamed components can leave stale state indefinitely.

   Required fix: a strict structured marker carrying file, origin document identity, version, and expiry; only a different document that successfully loads the exact component/graph may clear it. Same-document post-import load and committed-import/aborted-load must preserve it. Invalid, expired, and no-match markers must have explicit cleanup/refusal behavior.

4. **P1 — cross-file responses can publish stale preview/hash state.** `ComponentCanvas` is reused without `key={file}` and successful async `load()` paths have no abort/request-generation guard. Rapid component switching can let an older graph/classification response overwrite the new file's UI, pairing current file with stale hashes. The transaction will safely refuse, but the UI becomes incorrect and dead-ended.

   Required fix: key the canvas by exact file or use an abort/generation guard so only the latest file request may publish state. Commit delayed-response A -> B fixtures for graph and import-preview results.

### Independent preflight evidence

- Full reads: current dirty F-P0 diff and untracked `resume.ts`; `authoring-session.ts` `193/193`; `authoring-import.ts` `309/309`; `authoring-transaction.ts` `870/870`; `authoring-compiler.ts` `343/343`; `source-projection.ts` `100/100`; exact binding clauses re-read.
- Cold Engineer trace reports import preview and POST success followed by `SOURCE_HASH_STALE` on `.next/dev/types/routes.d.ts`. QA's source read confirms that `loadComponent()` compares the graph hash map against a fresh exact snapshot and that no existing lawful environment-rebase path exists.
- Manual deslop/self-audit: this section does not gate mutable bytes, does not repeat the document-reload proxy as the ambient-hash defect, and does not promote a UI preview into F-P0, §10, Meta, parity, or final-Done closure.

## G2 Document-Scoped Token Assertion `4aea05b`

Verdict: **REWORK — test evidence is weakened to accept the import-time document reload proven at `6409df3`; no product behavior changes**

Exact SHA: `4aea05bed41995f628f85d6ceb1c6ad17e992741`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Blocking finding

1. **P0 evidence validity — the new assertion makes arbitrary full-document reloads pass.** The only change records `/react-figma` document requests, then replaces `tokenResponses === [200]` with `tokenResponses === editorDocumentRequests.map(() => 200)`. It never constrains `editorDocumentRequests.length` or allowed phases. Two, four, or more editor remounts now pass as long as each document performs one token request. This does not change the import/metadata write path that QA proved reloads at `6409df3`.

   This conflicts with Hard Contract §2 line 86 persistent one-canvas context and §11/G2 lines 386/388 same-canvas/no-remount, plus Architecture §3.2 line 119 persistent authoring canvas, §9 line 550 retained-shell correctness, and §10 line 585. Required: preserve the useful per-document dedupe assertion as a secondary check, but also assert the contract-allowed document count and phase. Fix the product reload or obtain an explicit binding-contract revision; do not redefine the test around current failure.

### Independent evidence

- Complete one-file diff read: 7 insertions/1 deletion in the Home E2E only; zero production files changed.
- Exact parent `6409df3` cold proof remains decisive: Home assertions pass, then token responses are `[200, 200]`. `4aea05b` converts that known failure into a passing formula without changing the reload mechanism.
- Manual deslop/self-audit: timeout and same-document request-stampede closures remain credited. This finding is about test truth, not duplicate product symptoms. Full §10 and five Meta findings remain open.

## G2 Cold Reload And Test-Stability Follow-Up `6409df3`

Verdict: **REWORK — the two measured test budgets and favicon fix pass, but exact cold browser execution reloads the document during import and performs a second token request**

Exact SHA: `6409df3e15f15e6c5c446c85af4ccdf18e7b1a3c` (includes favicon/marker correction `1e899a5c54eedff42f395e72fe0260508b259aa9`).

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Closed rows

- **Hard Contract §1 law 6 and Architecture §10 test stability: PASS.** Only the local-`typeRoots` semantic case and source/graph/history undo case receive explicit 15-second integration ceilings. Focused measurements were `1.32s` and `1.72s`; assertions and suite parallelism are unchanged. QA's default parallel run passes `50 passed + 1 skipped` files / `377 passed + 10 skipped` tests; the two formerly failing cases complete at `2.65s` and `2.92s`.
- **Hard Contract §7 lines 242-249 clean runtime evidence: PASS for the favicon and Home transition.** `1e899a5` moves the identical favicon bytes to static `public/favicon.ico`, declares `/favicon.ico` in root metadata, and removes the cold 404. The E2E identity marker is set immediately before Home, so its retained iframe/document proof no longer spans unrelated setup HMR. Home geometry/inspector assertions pass before the later token-count failure.

### Blocking findings

1. **P1 — import-source still causes a full-document reload.** From a fresh Next cache, the exact committed E2E receives two successful `/api/dev/editor-tokens` responses, `[200, 200]`, rather than one. The first request belongs to the initial document; import-side metadata writes cause another document lifecycle and therefore another module instance. In-document promise dedupe works; global cache cannot survive or legitimize a navigation. This breaks Hard Contract §2 one persistent editor canvas, §11/G2 selection-to-authoring continuity, Architecture §3.2 persistent one-canvas context, §9 retained-shell correctness, and §10 line 585's clean flow.

   Required fix: make import/metadata writes invisible to the Next dev route watcher so the current document remains mounted, or explicitly revise the binding one-canvas contract. Do not prewarm, filter duplicate requests, or persist token data globally across HMR as substitutes for stopping the reload.
2. **Architecture §10 line 585 and the five Meta findings remain open.** The committed spec is still Home-only and raw-API-imported; it does not cover the full create/move/rename/Home/reload/undo user flow or F-P0/F-P1/D2-a/D2-b/D5-a.

### Independent evidence

- Exact cumulative reads: complete `1e899a5` and `6409df3` diffs; full current `layout.tsx` and Home E2E; both timeout test contexts; identical favicon blob `718d6fe` moved without byte change.
- Exact committed gates: default full `377 passed + 10 skipped`; typecheck inherited clean from the preceding exact checkpoint; diff-check/status clean. Cold system-Chrome E2E fails only at `tokenResponses`: received `[200, 200]`; all prior assertions passed and no favicon/network error preceded it.
- Cold generated cache preserved at `/tmp/s58-qa-6409-next-after`; pre-gate cache restored. Fixture, marker, backup, and checkout status are clean.
- Manual deslop/self-audit: `8bf21e5`'s timeout blocker is closed, not repeated. The remaining token symptom is attributed to cross-document reload, not the already-fixed same-document request stampede. No full G2, Meta, parity, or final-Done claim is inferred.

## G2 Cold Home E2E Follow-Up `8bf21e5`

Verdict: **REWORK — the committed cold Home regression, token-request dedupe, and failure cleanup work; a fresh default-parallel full suite is not stable, the browser spec is narrower than Architecture §10, and five Meta findings remain**

Exact SHA: `8bf21e51b129058dca63b4214c405b7adf36d0e5`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Passing rows

- **Hard Contract §1 law 7, §2 lines 57/67/86, §7 lines 242-249, and §11/G2 line 386: PASS.** `loadDsTokens()` now has one module-level in-flight promise in addition to the completed-value cache. The cold browser run observed exactly one `/api/dev/editor-tokens` response with status `200`, zero failed requests/responses, zero console errors/warnings, and the retained iframe/document plus immediate `402 x 874` Home inspector reconciliation.
- **Architecture §6.4 and §10 cleanup/evidence hygiene: PASS for this narrow harness.** The managed server owns fixture preparation and signal/startup-failure teardown; external-server reuse is refused. QA forced spawn failure and independently reproduced the missing-original-backup case in a disposable root. Restore refused by name while preserving the marker and replacement-store bytes; ordinary E2E teardown left no fixture, marker, or backup in the exact checkout.
- **Committed Home regression: PASS.** System-Chrome Playwright ran from a fresh Next cache on an isolated port: `1/1` passed in `1.0m`. It proves no navigation, retained iframe and `contentDocument` identity, authoring host expansion, Home restoration, iframe/host geometry, inspector W/H, one token request, and clean console/network state.

### Blocking findings

1. **P1 acceptance stability — the clean default-parallel full suite is not reproducibly green.** The first fresh exact-SHA run timed out `authoring-import` local-`typeRoots` and `authoring-session` undo at their 5-second budgets: `48 passed + 2 failed + 1 skipped` files; `375 passed + 2 failed + 10 skipped` tests. Both files pass focused and single-worker (`26/26`), and the complete single-worker suite passes `50 passed + 1 skipped` files / `377 passed + 10 skipped` tests. This proves semantic correctness but not the normal cold parallel gate required by Hard Contract §1 law 6 and Architecture §10. Required: measured bounded budgets or isolation that makes the default clean-checkout command pass without a retry.
2. **Architecture §10 line 585 remains incomplete.** The committed spec covers the Home regression only and imports through the raw API. It does not encode `create-from-selection -> edit same canvas -> create/move/rename -> Home -> reload -> undo`, and therefore does not close the user-entry dead end or full lifecycle acceptance row.
3. **Five product/Meta findings remain unchanged.** F-P0 import UI, F-P1 rename keyboard/click-away semantics, D2-a Primary caption, D2-b unselected border grammar, and D5-a fixed breadcrumb chrome remain current in the next section.

### Independent evidence

- Exact diff/full reads: all 10 committed files and complete 285-line patch; current `page.tsx` established by the prior `4314/4314` full read plus exact token-loader delta.
- Static gates: typecheck clean; new Playwright/E2E files ESLint clean; page remains at the exact pre-existing `12 errors / 11 warnings`, with no diagnostic on the token-loader delta; diff-check/status clean at exact SHA.
- QA cold cache preserved outside the checkout at `/tmp/s58-qa-8bf21e5-next-after`; the pre-gate cache was restored. Disposable cleanup-probe evidence remains outside Git. No Engineer-worktree bytes were changed.
- Manual deslop/self-audit: this section does not promote a narrow Home test into full §10, repeat the closed token race as active, or infer Meta/G2/final completion.

## G2 Framer-Parity Meta Reconciliation At `29113b6`

Verdict: **REWORK — Designer's fresh measured parity pass found five fix-before-close findings; QA confirms every underlying source mechanism remains present at exact `29113b6`**

Binding evidence: Designer Meta `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-g2-framer-parity-designer.md`, `66/66` lines, SHA-256 `9f162b44153ec600f5eff5be0073778aab0c947efeb8b69879572a0cc6cf5a97`; authenticated expert Framer probe `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-live-probe-expert-2026-07-12.md`, `46/46` lines, SHA-256 `ad2ba9fc4ba2f70039545bd47f2be725eb2180f26c0bbd878bb12416c5cebbfd`. ONEMO measurements were pinned to `b9d72f1`; QA reread current `ComponentCanvas.tsx` `151/151` and the current page render at `29113b6`. The later commits do not alter these mechanisms.

### Blockers at `29113b6`

1. **F-P0 HIGH — graph import has no authoring UI.** `ComponentCanvas.load()` turns `AUTHORING_GRAPH_MISSING` into a terminal `role=alert`; no classify/import action exists. The successful internal probes used the raw API, which a user cannot. This breaks Hard Contract §9 lines 299-306 migration entry, §10 lines 318-335 frontend/E2E map, and §11/G2 line 386 selection-to-authoring flow; Architecture §8 items 2-8 and §10 line 585.
2. **F-P1 MED — inline rename is blur-only.** The current input has `onBlur` only: Enter does not commit and Escape does not cancel. Designer also measured a click-away loss path; QA accepts Enter/Escape absence from source and requires the click-away case in the committed browser matrix. This fails Hard Contract §7 line 239 and §11/G2 line 386 plus Architecture §10 line 585.
3. **D2-b — unselected frames misuse dashed selection grammar.** Current frame CSS is solid when selected and dashed when unselected. Hard Contract §7 line 225 reserves solid for frame selection and dashed for child deep-selection; live Framer leaves unselected frames borderless.
4. **D2-a — Primary renders `Primary · Primary`.** The current caption always appends ` · Primary` to the Primary frame, even when its display name already equals `Primary`. This violates the unambiguous Primary-tag lifecycle required by Hard Contract §7 line 239.
5. **D5-a — breadcrumb is inside the pan/zoom transform.** Current page markup nests `data-component-breadcrumb` under the transformed canvas container, so it scales and drifts. Live Framer keeps it fixed chrome. This fails the measured breadcrumb semantics gate in Hard Contract §7 lines 223/228 and §11/G2 line 389, plus Architecture §9 line 550's retained-shell correctness rule.
6. **P1 cold-start runtime — token hooks stampede the same API.** Exact `29113b6` source caches only the completed `_dsTokenCache`; every mounted `useDsTokens()` instance sees `null` and independently starts `/api/dev/editor-tokens` because no shared in-flight promise/provider exists. QA's warm browser trace recorded roughly 30 duplicate successful requests. The cold-cache E2E then reproduced aborted/failed token requests while the route compiled. Pre-warming that endpoint would hide the real first-load behavior rather than fix it. This violates Hard Contract §1 law 7, §7 lines 242-249 execution-backed runtime evidence, and Architecture §10 line 585's clean browser-flow requirement. **Closed at exact `8bf21e5` by the shared in-flight request and independently passing cold E2E above.**

### Reconciliation decisions

- Core-model parity remains measured: one canvas, Primary suffix mechanism, selection-scoped ghost placement, create-at-ghost, free sidecar-only drag, and Home exit. These passing rows do not override the blockers above.
- Designer's `.next/dev/types` churn note does **not** reopen source authority. Generated ambient declarations remain part of the exact configured TypeScript environment and are intentionally hashed; safe stale-hash friction is preferred over silent ambient drift.
- D5-b component-chip context menu, state ghosts, icons, resize/connect handles, and snap guides remain mapped to later phases. They are not promoted into G2 blockers.
- The two Framer gesture sub-items not live-operated remain explicitly unverified; no parity claim is made for exact Framer rename/Escape or drag/snap behavior.

## G2 Home Inspector Follow-Up `29113b6`

Verdict: **REWORK — the Home inspector runtime defect is fixed, but the exact snapshot has no committed browser regression required by Architecture §10**

Exact SHA: `29113b6abc4e4fb2db41f1539726f0ba4a5cdcf5`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Runtime closure

- **Hard Contract §2 lines 57/67/86 and §11/G2 line 386: PASS.** The one-file, 11-line effect runs only when `canvasMode` returns to `design`, waits one animation frame for the retained iframe to reflow from authoring bounds to page bounds, resolves the existing `selIdRef` through `engineElement`, and reuses `applySelection`. It does not remount the iframe, add a timer, create a second selection owner, or add a parallel inspector-sync path.
- **Architecture §3.2 line 119 and §9 line 550: PASS.** Real Chrome retained the exact same connected iframe object through component entry and Home. Component mode measured iframe/host `1088 x 600`; Home restored both to `402 x 874`, made the iframe visible, removed the authoring canvas, restored the design inspector, and immediately reconciled inspector W/H to `402/874`. Navigation count remained `1`; no reload occurred.
- **Surrounding behavior: PASS.** Component inventory entry, graph-backed canvas, existing two variant frames, Home, page label, console, and network remained correct. Console: `0` errors and `0` warnings. Relevant API requests returned `200`.

### Blocking finding

1. **P1 evidence durability — Architecture §10 line 585 is still unimplemented.** The binding architecture explicitly names `tests/e2e/react-figma-authoring.spec.ts` for `create-from-selection -> edit same canvas -> create/move/rename variant -> Home -> reload -> undo`. The repository has no `tests/e2e` directory, no named spec, and no equivalent committed Home-inspector regression. The Engineer's `/tmp` Playwright proof and this independent QA run demonstrate current behavior but cannot prevent recurrence in the normal suite. This exact user-visible defect already survived the prior full green suite and multiple browser passes, so a temporary-only check is insufficient for final combined G2 acceptance.

   Required fix: commit the smallest repository-standard browser regression proving the same iframe survives component mode, Home performs no navigation/reload, actual iframe/host dimensions and inspector W/H immediately agree at `402 x 874`, and console errors remain zero. The test must run from a clean checkout; no new product behavior is requested.

### Independent evidence

- Exact committed-tree gates: `50 passed + 1 skipped` files; `377 passed + 10 pre-existing skipped` tests; zero unhandled errors; typecheck and diff-check clean; exact worktree clean at `29113b6`.
- Direct page lint remains pre-existing debt: `12 errors/11 warnings`; the new effect produces no diagnostic. No clean whole-file lint claim is made.
- Browser environment: isolated webpack dev server at `127.0.0.1:3046`, explicit non-secret local Supabase placeholders, real Chrome through Playwright CLI after the in-app browser runtime returned no available backend.
- Evidence: `/tmp/s58-qa-g2-home-29113b6-browser/`, including screenshot `page-2026-07-12T19-10-56-110Z.png`, final snapshot, console log, and transaction/sidecar evidence. QA fixture and generated `.onemo` state were removed from the checkout; exact SHA/status reverified clean.
- Source audit: prior complete `page.tsx` `4314/4314` read plus the exact current 11-line delta, followed by current full affected-path reads of `canvasMode`, `hostDims`, retained iframe rendering, `selIdRef`, `engineElement`, and `applySelection`.
- Manual deslop/self-audit: at exact `29113b6`, the stale-dimension runtime finding is closed while the missing durable e2e regression, five reconciled Meta findings, and cold-start token race remain open. Exact `8bf21e5` later closes the Home regression and token race only; full Architecture §10 plus the five Meta findings remain active. No G2, Meta, G3/G4, Framer-complete parity, or final-Done claim is inferred.

## Full G2 Re-Gate `8821024`

Verdict: **REWORK — all prior backend/UI findings and the detached-HMR defect are closed, but Home restores the correct canvas with stale component-mode inspector dimensions**

Exact SHA: `882102479788844c38905663c14dfcd2515a069c`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Blocking finding

1. **P1 — Home restores the real `402 x 874` canvas, but the design inspector remains at stale component-mode `1432 x 600` until a hard reload.** After the complete component flow, Home makes the same iframe visible and connected, and both the iframe/host geometry and frame label correctly report `402 x 874`. The inspector width and height fields instead remain `1432` and `600` after one second. A hard reload corrects them to `402` and `874`. Component-mode authoring bounds update the hidden host, while Home restores `hostDims` and remeasures selection geometry without reapplying current DOM dimensions to the inspector field state.

   This violates the retained computed-style inspector and one-authoring-canvas contract in Hard Contract §2, the required `selection -> named component -> same canvas -> create/move/rename variant -> Home -> reload -> undo` G2 flow in Hard Contract §11, the persistent one-canvas requirement in Architecture §3.2, the rule that retained shell/viewport behavior must remain correct in Architecture §9, and the exact Home/reload/undo acceptance flow in Architecture §10.

   Required fix: when leaving component mode, reconcile inspector dimensions from the restored connected iframe/selection after host geometry is restored. Add a browser regression proving the Home inspector immediately equals the actual frame dimensions without reload. Do not remount the iframe or add a second editor state domain.

### Closed rows

- **Prior backend findings #1-3 and project-resolution jail: PASS.** Default authority is source-owned; the complete jailed and hashed TS config/dependency snapshot drives compilation; unresolved local imports fail closed; `baseUrl`, `rootDirs`, and `paths` authorities outside the registered root refuse before evidence. An outside-root `typeRoots` configuration is also refused by production classify/import as `SOURCE_DEPENDENCY_OUTSIDE_ROOT` before sidecar evidence, so its earlier config-reader acceptance is non-blocking. This verifies Hard Contract §§1.6/4/8.2-9/9/11-G2 and Architecture §§4.1.7/5.1.1/5.2/6.2/6.3/8/10-11.
- **Prior UI findings #4-6: PASS.** Component mode uses one graph-backed canvas and the same retained iframe; the legacy component authoring domain and inspector overlay are absent; the create ghost is reachable inside computed board bounds; component surfaces use existing semantic DS tokens; breadcrumb semantics are labelled; and the browser console is clean. This verifies Hard Contract §§2/5/10/11-G2 and Architecture §§3.2/3.3/3.4/6.1/9/10-11.
- **Detached-HMR runtime identity: PASS at exact `8821024`.** Runtime element entries are weak references, disconnected elements are evicted on access, and reconnecting an evicted node does not resurrect it. The committed regression proves connected -> detached -> refused -> reconnected-still-refused. This verifies Hard Contract §1 law 6 and §10 engine/frontend ownership plus Architecture §§3.2/5.1.1/9.
- **Authoring state persistence and undo: PASS.** Production classify/import, Components-rail entry, ghost create, inline rename, physical drag, Home/re-entry, hard reload, and three-step command-Z undo use the real graph/compiler/transaction path. Variant identity, name, and geometry persist; move leaves source hashes unchanged; undo restores exact initial bytes and graph state. The separate Home inspector-state defect above prevents the complete lifecycle from passing as one user-visible flow.
- **Post-hydration override identity: PASS.** Automatic wiring creates no DOM `data-eng-id`. A real committed X override adds exactly one ID and generated CSS applies `left: 9px`; the final console has zero errors and zero warnings.

### Independent evidence

- Exact committed-tree gates: `50 passed + 1 skipped` files; `377 passed + 10 pre-existing skipped` tests; zero unhandled errors; typecheck and diff-check clean; worktree clean at exact `8821024`.
- Repository lint remains pre-existing debt: `18 errors/229 warnings`. G2-scoped files report `13 errors/13 warnings`; blame traces every error to pre-G2 commits. Exact `8821024` adds no lint regression.
- Real system-Chrome/Playwright gate on isolated port `3043`, using a production-classified single-axis fixture and real Components-rail entry. Create advanced revision `1 -> 2`; rename `2 -> 3`; drag `3 -> 4`; Home/re-entry and reload preserved ID/name/frame; undo revisions `4 -> 7` restored two variants and the initial source hash.
- Browser geometry evidence: drag moved `{x:688,y:0}` to `{x:738,y:40}` without source-hash change. Before any override the iframe had zero `data-eng-id`; committed override produced one. Final browser console: zero errors and zero warnings.
- Exact screenshot: `/tmp/s58-qa-g2-b9d72f1-browser/.playwright-cli/page-2026-07-12T18-56-06-958Z.png`. Preserved before/after sidecars and Next caches: `/tmp/s58-qa-g2-b9d72f1-browser/`.
- Full current reads: `engine.ts` `507/507`, `engine.test.ts` `40/40`, and exact `8821024` diff, following prior full reads of the complete G2 compiler/config/import, `page.tsx` `4314/4314`, `ComponentCanvas.tsx` `151/151`, and the binding documents.
- Manual deslop/self-audit: one current blocker only; superseded findings remain historical evidence, not current blockers. No G2 PASS, Meta PASS, Framer parity, or final-Done claim.

## G2 One-Canvas UI Follow-up `a9c1e2f`

Verdict: **BOUNDED PASS — default/config authority and UI findings #4/#5 are closed at this exact tip; overall G2 remains REWORK for the outside-root `baseUrl` P0 and finding #6**

Exact SHA: `a9c1e2f051ba3fc8dcb8ce2d8a0daac7e11fd2e0` (includes `d31318e`, `983a54e`, hybrid-domain removal `203f401`, and ghost geometry `a9c1e2f`).

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Closed rows

- **Findings #1/#2 remain closed at the current tip.** Missing, dynamic, and out-of-union legacy defaults refuse rather than selecting the first union member. The root plus nested `extends` chain is jailed, captured, frozen, hashed, and option-only drift is refused before prepare. Current-tip source-projection/config/import/session evidence is `47/47`. This verifies Hard Contract §§1.6/4/8.2-9/9 and Architecture §§5.1.1/5.2/6.2/6.3/8/10. It does not close the distinct outside-root `baseUrl` authority defect below.
- **Finding #4, one component-authoring domain: PASS.** `page.tsx` removes the legacy component model/fetch/write domain and derives component mode from `rail + editingComponent`. The real project-component double-click keeps the existing iframe connected and identical while hiding it, removes Insert tools plus `data-page-design-inspector`, and mounts one `data-authoring-canvas`. Home removes the graph canvas, restores design chrome, and reveals the same iframe object. This verifies Hard Contract §2, §10 frontend map, §11 G2 and Architecture §§3.2.5-6/3.3.4-6/3.4.8/9/11.
- **Finding #5, create-ghost clipping: PASS.** Frame bounds and ghost placement share `componentCanvasGeometry()`, and the host includes the ghost's own extent. Browser evidence starts with two imported frames, creates a real third variant through the production command path, and measures the next ghost inside its host. The initial viewport can place the next ghost off-screen, but the same canvas horizontal-pan path moves it fully into view; it is reachable rather than clipped. This verifies Hard Contract §§5/10/11-G2 and Architecture §§3.2.5/6.1/9/10/11.

### Remaining blockers

1. **P0 backend authority remains open.** Exact `9332a27` still accepts an outside-root `compilerOptions.baseUrl`, treats an unresolved bare import as external, and can persist a fabricated revision-1 graph. Required clauses and remediation remain in the next section.
2. **Finding #6 remains open.** The real Chrome flow emits the known `data-eng-id` hydration mismatch from the rendered Mother v2 iframe, so the zero-console requirement is not met. The component breadcrumb remains hardcoded rather than DS-token-backed, and final visual/Framer-parity plus Designer Meta evidence is not complete. Required by Hard Contract §10/§11 G2 and Architecture §§3.2.5/9/10/11.

### Independent evidence

- Full current source reads: `page.tsx` `4308/4308`, `ComponentCanvas.tsx` `155/155`, `gestures.ts` `20/20`, `gestures.test.ts` `17/17`, `ERRORS.md` `71/71`; complete `203f401`/`a9c1e2f` diffs and cited contract/architecture clauses re-read.
- Real system-Chrome/Playwright gate on isolated port `3041`: actual Components rail entry, production import, double-click edit, DOM identity assertions, Home round-trip, real create command, geometry measurements, horizontal-pan reachability, screenshots, network/console capture. QA-only TSX, sidecar, history, and transaction evidence were deleted; exact checkout restored clean.
- Exact committed-tree gates: full repository `49 passed + 1 skipped` files / `372 passed + 10 pre-existing skipped` tests; typecheck and diff-check clean. Direct changed-surface lint is red from page-wide pre-existing debt, not this snapshot: parent `6d14467` = `12 errors/13 warnings`; current `a9c1e2f` = `12 errors/11 warnings`.
- Browser console distinction: stale `BrowserFixture.tsx` module warnings came from the QA checkout's prior Next cache and are not attributed to this commit; the reproducible `data-eng-id` hydration mismatch is product evidence and remains blocking under finding #6.
- Manual deslop/self-audit: bounded closures are not promoted to G2 PASS, Meta PASS, Framer parity, or final Done. Historical exact-SHA sections remain unchanged.

## G2 BaseUrl Authority Follow-up `9332a27`

Verdict: **REWORK — the in-root `baseUrl` gap from `74e1889` is closed, but outside-root `baseUrl` authority can still classify and persist an invalid native graph; UI findings #4-6 remain open**

Exact SHA: `9332a27b6709f3654a399c7a2c569b81f5fc42b9`.

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Closed row

- **In-root `baseUrl` ownership: PASS.** An existing `baseUrl='.'` dependency enters `sourceHashes`; a missing sibling refuses `SOURCE_DEPENDENCY_UNRESOLVED` before sidecar/transaction evidence; installed ordinary and scoped package subpaths remain external rather than being falsely reclassified as project files. This closes the exact `74e1889` mechanism under Hard Contract §§1.6/4/8.2-9/9 and Architecture §§5.2/6.2/6.3.2,5-7/8.2-8/10.

### Blocking finding

1. **P0 — Outside-root `baseUrl` bypasses the runtime jail and persists invalid authority.** With `compilerOptions.baseUrl` resolving outside the registered root and an unresolved bare import, `readExactCompilerConfig()` accepts the path-valued option and `requiresProjectResolution()` returns false because its candidate is outside the root. Classification returns `native-v1` with only TSX and `tsconfig.json` hashed. Passing that exact hash set to production import commits revision `1`, fabricates a Primary variant, writes `authoring-v1.json`, and creates a durable transaction record instead of refusing without writes.

   This violates Hard Contract §1 law 6, §4 runtime jail/per-file source authority, §8 steps 2-9, and §9 refusal/no-write; Architecture §5.1.1 path-escape refusal before locking/staging, §5.2 exact source authority, §6.2 immutable exact compiler snapshot, §6.3 steps 2-7, §8 items 2/6/8, and §10 negative dependency fixtures.

   Required fix: validate `baseUrl` and every project-resolution path authority against `RuntimeRootRegistry` immediately after parsing configuration and before dependency discovery/classification. Retain module-resolution jail checks as defense in depth. Commit absolute and relative outside-root fixtures proving named refusal and zero source/sidecar/history/transaction writes.

UI findings #4-6 from exact `6d14467` remain active independently: legacy component domain/stale inspector coexistence, clipped create ghost, and hydration/DS breadcrumb/console quality. `9332a27` touches only importer logic/tests.

### Independent evidence

- Full reads: `authoring-import.ts` `309/309`, `authoring-tsconfig.ts` `228/228`, `authoring-import.test.ts` `415/415`, `source-projection.ts` `100/100`, `authoring-migrations.ts` `83/83`, production handler `121/121`, and session integration test `143/143`; exact binding clauses re-read from both documents.
- QA extension: `3/4` passed. In-root hash/refusal, ordinary installed package, and scoped installed package passed. The outside-root case failed with concrete revision-1 sidecar bytes and a durable transaction directory. The temporary test was removed.
- Committed exact-SHA gates: importer/compiler/session/route `43/43`; full repository `49 passed + 1 skipped` files / `371 passed + 10 skipped` tests; typecheck, scoped ESLint, diff-check, and detached worktree status clean.
- Manual deslop/self-audit: this section supersedes only the current closure state. The `74e1889` and `6d14467` sections remain exact historical verdicts. No UI, Meta, parity, G3/G4, or final-Done closure is inferred.

## G2 Backend Authority Follow-up `74e1889`

Verdict: **REWORK — the two `6d14467` P0 findings are closed; unresolved project-import refusal remains incomplete for configured `baseUrl`, and the independent UI findings remain open**

Exact SHA: `74e1889dc57efe7f5d71802a04cc3f91b4e1fb03` (includes default fix `d31318e`, config-authority fix `983a54e`, and unresolved-import fix `74e1889`).

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Closed rows

- **Lossy legacy defaults: PASS.** Missing, dynamic, and out-of-union defaults now produce named unsupported SourceProjection and import writes no sidecar/transaction evidence. QA independently replayed missing and out-of-union defaults at the exact tip; both passed. This closes `6d14467` finding #1 under Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.
- **Compiler-config authority: PASS.** One `readExactCompilerConfig` path now reads the complete root/extends chain through the runtime jail, hashes every config byte, freezes the parsed compiler options, and threads that exact object into dependency discovery and CompilerAdapter. QA proved nested in-root config hashes plus inherited `strict`, frozen options, and outside-root refusal; source grep finds no second production config reader. This closes `6d14467` finding #2 under Hard Contract §4/§8.2,5-9/§11-G2 and Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.
- **Unresolved relative and `paths` alias imports: PASS for those classes.** Both now refuse `SOURCE_DEPENDENCY_UNRESOLVED` before classification/import with no sidecar/transaction evidence. This is a partial closure of `6d14467` finding #3, not the full row.

### Blocking finding

1. **P1 — Configured `baseUrl` project imports still bypass unresolved-project refusal.** With `compilerOptions.baseUrl = '.'`, `import type { Missing } from 'src/missing'` resolves to no module but `requiresProjectResolution()` checks only relative/absolute specifiers and explicit `paths` patterns. Classification therefore succeeds as `native-v1`, hashes the component plus `tsconfig.json`, and omits the unresolved store-owned dependency.

   Required fix: classify a non-relative unresolved specifier as project-owned when the configured `baseUrl` candidate is inside the registered root, while retaining deliberate external-package behavior. Commit existing/missing baseUrl imports and package-name collision fixtures. Required by Hard Contract §§1.6/4/8.2-9/9 and Architecture §§4.1.7/5.2/6.2/6.3.2,5-7/8.8/10.

UI findings #4-6 from exact `6d14467` remain active independently: legacy component domain/stale inspector coexistence, clipped create ghost, and hydration/DS breadcrumb/console quality. These commits do not touch those surfaces.

### Independent evidence

- QA extension: `6/7` passed. Both default cases, nested config hashing/freeze, outside-root config refusal, unresolved relative import, and unresolved `paths` alias passed; unresolved baseUrl import failed exactly as described. Temporary probe removed.
- Committed exact-tip gates: focused projection/config/import/compiler/session/route `65/65`; full repository `49 passed + 1 skipped` files / `370 passed + 10 skipped` tests; typecheck, diff-check, exact detached status clean.
- Manual deslop/self-audit: the historical `6d14467` verdict remains correct for that exact SHA; this section supersedes only its later closure state. Findings #1/#2 are not repeated as current blockers. Finding #3 is narrowed to its remaining mechanism. No UI, G3/G4, parity, Meta, or final-Done closure is inferred.

## G2 One-Canvas and Backend Snapshot `6d14467`

Verdict: **REWORK — the core browser lifecycle and test stability work, but three source-authority blockers remain open and the one-canvas UI does not yet satisfy its geometry, single-client, design, or console contract**

Exact SHA: `6d144670d7a5060c309b6197591e7b7d84616866`

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

Scope: cumulative commits `0652258` (legacy component-write refusal), `9afe244` (one-canvas UI/session flow), and `6d14467` (three bounded integration-test timeouts), gated from the prior rejected `3f4e7e3` baseline. No G3/G4 or final-Done claim is judged.

### Closed rows

- **Required G2 lifecycle: PASS functionally.** In a clean isolated QA worktree and fresh Chrome Playwright session, the real Components-rail double-click flow loaded one graph-backed component, created a free variant, renamed it inline, physically dragged it, returned Home, re-entered, hard-reloaded, and undid the move with `Meta+Z`. Stable variant ID `variant_829f74348a151920` survived every step. Geometry moved `(688,0) -> (748,40)` and undo restored `(688,0)` at revision 5. This satisfies the behavioral core of Hard Contract §11/G2 and Architecture §§6.1-6.3/7/11, but not the full UI quality gate below.
- **Transactional byte behavior: PASS for the operated flow.** Create changed the fixture TSX from SHA `78d61634...` to `52cf865a...`; rename and sidecar-only move did not change that TSX hash; undo of move also retained `52cf865a...`. Every authoring POST returned 200 and reload re-read the committed graph. This satisfies Hard Contract §§4/8.5-12 and Architecture §§5.2/6.2-6.3/7 for this operated command sequence.
- **Legacy fixed board removal: PASS.** `components-canvas/page.tsx` is deleted, the iframe remains keyed only by the page route, navigation no longer auto-promotes source, and the legacy editor-write route refuses project component paths with `AUTHORING_TRANSACTION_REQUIRED`. This closes Hard Contract §§2/10/11-G2 and Architecture §§3.3.4-6/9/11 for the removed board/remount and navigation-write mechanisms.
- **Test stability: PASS.** Focused changed-surface suites pass `55/55`. Two independent default `npm test -- --run` executions pass exactly `48` files plus `1` skipped / `355` tests plus `10` pre-existing skips, without retries. Typecheck is clean. The three explicit 15s/20s integration ceilings are local and justified in `ERRORS.md`; no global timeout was loosened. This closes the prior P2 under Hard Contract §§1.6/10/11-G2 and Architecture §10.
- **Generated Next ambient declarations: confirmed correct behavior, not a defect.** Production classification captured `.next/dev/types/cache-life.d.ts` and `routes.d.ts` as exact source hashes because the active tsconfig includes them and they contribute globals. The QA ambient fixture also passed. Regeneration may cause safe `SOURCE_HASH_STALE` friction, but excluding these files would reopen silent ambient drift. This is consistent with Hard Contract §4 and Architecture §§5.2/6.2-6.3.
- **Redo guard: PASS for G2's undo-only scope.** `Shift+Meta+Z` is parsed distinctly and component mode refuses redo rather than accidentally dispatching another undo. Hard Contract §8 requires redo eventually; G2's required path requires undo only.

### Blocking findings

1. **P0 — Lossy union defaults still fabricate Primary semantics.** The unchanged `lib.ts:1595-1596` still substitutes `values[0]` for a missing default and again for an out-of-union default. QA execution at exact `6d14467` received `legacy-single-axis` for both cases instead of `unsupported`.

   Required fix: require a static string-literal destructuring default contained in the resolved union before declaring a clean legacy axis; otherwise return named unsupported before import. Commit projection and production-import fixtures for missing, dynamic, non-string, and out-of-union defaults. Required by Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.

2. **P0 — Compiler configuration remains live, unhashed, and outside the root jail.** The unchanged `authoring-import.ts:90-103` and `authoring-compiler.ts:195-203` still use TypeScript's disk-backed config readers. QA's outside-root `extends` configuration succeeded, while `sourceHashes` omitted `tsconfig.json`; compiler options can therefore change outside the transaction authority boundary.

   Required fix: jail and snapshot the full tsconfig/extends chain, derive one immutable options object for discovery and staged compilation, and include config bytes or an equivalent exact fingerprint in the same locked precondition. Commit nested in-root, outside/symlink escape, and option-only drift fixtures. Required by Hard Contract §4, §8.2,5-9, §11-G2 and Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.

3. **P1 — Unresolved store-owned local imports still disappear.** The unchanged `authoring-import.ts:126-128` continues when module resolution returns no result. QA's `./missing` import classified `native-v1` rather than refusing, so strict import can persist metadata for an incomplete source graph.

   Required fix: named-refuse unresolved relative, project-alias, and import-type dependencies before classification/import while retaining explicit external-package behavior. Commit zero-sidecar/zero-transaction fixtures. Required by Hard Contract §§1.6/4/8.2-9/9 and Architecture §§4.1.7/5.2/6.2/6.3.2,5-7/8.8/10.

4. **P1 — The new authoring canvas coexists with a live legacy component domain and stale page inspector.** `page.tsx:2338-2434` retains `editTarget`, `editModel`, component preview mutation, and legacy model reload; `page.tsx:2927-2943` still routes inspector edits through `write-scoped-declaration` whenever a component is open. The route guard prevents corruption, but the user sees the ordinary page inspector and a second refusal-only component path rather than one `useAuthoringGraph` client.

   Required fix: remove the legacy component authoring state/effects and component-mode inspector routing from the shell; render only the graph-backed G2 surface while component mode is active. Keep low-level inspector writes strictly non-component. Required by Hard Contract §§2/10/11-G2 and Architecture §§3.2.6/3.3.4-6/6/9/11.

5. **P1 — The create-variant ghost is clipped by construction.** `ComponentCanvas.tsx:55-60` sizes the host to the last persisted frame plus 80px, but `ComponentCanvas.tsx:112-117` places the full-width ghost 24px after that frame. With the 320px fixture frame and the component wrapper clipped, Playwright measured a 192px scaled ghost with only 33.6px visible (56px unscaled); the centered `+ Variant` label is outside the visible area.

   Required fix: include the ghost's full right/bottom extent in reported bounds or place it inside available bounds, then commit a DOM geometry test proving the complete hit target and label are visible after every create. Required by Hard Contract §§7/11-G2 and Architecture §§6.1/9/10/11.

6. **P1 — G2 visual and console quality gates are not met.** Real Chrome shows a hydration mismatch on every load from runtime `data-eng-id` mutation in the retained page iframe. The component breadcrumb is plain hardcoded `SEL` blue/Inter text rather than ONEMO neutral/accent chip primitives, and the stale Figma-shell inspector remains visible. This fails the explicit zero-console and ONEMO breadcrumb/selection requirements even though command behavior works.

   Required fix: eliminate the hydration mismatch, implement the breadcrumb/selection/ghost surface with the binding DS tokens/primitives, and provide fresh computed-style/geometry/a11y/screenshots to Designer Meta. Required by Hard Contract §7, §11/G2 quality gates and Architecture §§9-11.

### Independent evidence

- QA-only adversarial suite: `1/5` passed. Generated Next ambient capture passed; missing default, invalid default, unhashed/outside config authority, and unresolved relative import failed. The temporary suite was removed before final status.
- Browser: Playwright headed Chrome at isolated `127.0.0.1:3038`; real Components rail entry, snapshot/action/snapshot, physical pointer drag, Home/re-entry/reload, command-Z, DOM geometry, console, network, and disk hashes inspected. Functional POSTs were 200; console remained `1 error`.
- Committed gates: focused `55/55`; default full run 1 `355/355` executed plus 10 skipped; default full run 2 identical; typecheck clean; diff-check clean. Full changed-surface lint is not clean at `12 errors / 13 warnings`; several displayed errors are on unchanged shell lines, but QA does not claim every diagnostic is pre-existing and issues no clean lint claim.
- Cleanup: browser/server stopped; QA fixture, sidecar, history, transaction records, and copied `.env.local` removed; isolated checkout restored to exact clean SHA.
- Manual deslop/self-audit: the prior P2 is closed rather than repeated; the three backend mechanisms remain open by fresh execution; generated Next churn is explicitly dispositioned as correct; functional lifecycle PASS is separated from full G2 REWORK; no G3/G4/Framer parity or final-Done claim is made.

## G2 Compiler Rework Snapshot `3f4e7e3`

Verdict: **REWORK — all three `d153f9a` P0 mechanisms close generally, but lossless default and compiler-configuration authority remain unsafe**

Exact SHA: `3f4e7e378e9af07bfc48d4bda25cd8f75fe8fdbf`

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

Scope: nine-file backend-only parser, dependency-snapshot, compiler, test, and fixture-portability rework. No one-canvas UI, browser-parity, G3/G4, or G2-completion claim is judged.

### Closed rows

- **Local alias/nullish axis meaning: PASS.** Direct, parenthesized, local alias, alias chain, explicit nullish, and duplicate literal members resolve to one clean axis; mixed/container/object types remain non-axes; alias cycles become explicit unsupported projection. This closes `d153f9a` P0 #1 under Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.
- **Outside-root source dependency jail: PASS for resolved modules.** Relative import-type, path alias, and symlink escape fixtures refuse before classification. The CompilerHost also denies an existing unstaged non-`node_modules` TypeScript source outside the owning root rather than reading live bytes. This closes `d153f9a` P0 #2 under Hard Contract §4, §8.2,5-9, and §11-G2; Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.
- **Ambient/project declaration closure: PASS for the tested configured graph.** Configured global declarations, local `typeRoots`/`types`, nested triple-slash path/type declarations, and recursive imports enter jailed hashes and Program roots. Syntax and semantic diagnostics run across loaded exact Program files; a nested ambient `TS2304` refuses before new transaction evidence. This closes `d153f9a` P0 #3 under Hard Contract §4, §8.2,5-9, and §11-G2; Architecture §§5.1.1/5.2/6.2.6/6.3.2,5-7/10.
- **Shallow-checkout portability: PASS.** `createRequire(import.meta.url)` replaces fixed cwd ancestry in one shared helper. The three formerly fragile suites pass `22/22` from a genuinely shallow `/private/tmp` worktree at exact `3f4e7e3`. This closes the prior P2 under Hard Contract §1.6 and Architecture §10.
- **Focused static gates: PASS.** Changed-surface suites `48/48`; typecheck clean; scoped ESLint `0 errors` with two unchanged `lib.ts` warnings; diff-check/status and backend-only scope clean.

### Blocking findings

1. **P0 — SourceProjection fabricates Primary/default semantics for a lossy union.** A union prop with no source initializer and one whose initializer is outside the union both publish `legacy-single-axis`; `lib.ts:1595-1596` substitutes `values[0]` whenever the default is absent or invalid. Import can therefore persist a Primary value the component source never declared, contradicting actual undefined/default behavior instead of refusing the non-clean mapping.

   Required fix: a legacy axis is importable only when its destructured default is a static string literal contained in the resolved union. Missing, dynamic, non-string, or out-of-union defaults must produce named unsupported SourceProjection before graph import. Commit direct/alias/nullish valid defaults plus missing, dynamic, and invalid-default fixtures through projection and production import. Required by Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.

2. **P0 — `tsconfig.json` and its extends chain remain live, unhashed, and outside the runtime jail.** Classification and compilation independently call TypeScript's disk-backed config readers (`authoring-import.ts:90-103`; `authoring-compiler.ts:195-203`), but config bytes never enter `sources`/`sourceHashes`. A project `tsconfig.json` extending `../outside/base.json` succeeds, and even an in-root config is absent from exact hashes. Compiler semantics can therefore come from outside the registered root and change between compile planning and the transaction without a hash precondition.

   Required fix: resolve the complete config/extends chain through `RuntimeRootRegistry`, refuse absolute/relative/symlink escape, snapshot exact config bytes, and derive one immutable parsed-options object consumed by dependency discovery and CompilerAdapter. Include every config byte in transaction preconditions or an equivalent exact config fingerprint guarded under the same lock. Commit nested in-root extends, outside/symlink escape, config drift-before-prepare, and option-only drift fixtures. Required by Hard Contract §4 runtime-root/source authority, §8.2,5-9, and §11-G2; Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.

3. **P1 — Unresolved local imports disappear from the exact dependency graph.** `authoring-import.ts:126-128` silently continues when module resolution returns no result. A missing relative `./missing` import therefore classifies as `native-v1` and hashes only the component instead of producing a named refusal. G2 semantic compilation later refuses if invoked, but strict classification/G1 import can already persist metadata for an incomplete source graph.

   Required fix: unresolved relative and configured project aliases must refuse by a named source-dependency error before classification or sidecar import; explicitly distinguish permitted external-package resolution from store-owned modules. Commit unresolved relative, unresolved project alias, unresolved import-type, and external-package fixtures with zero sidecar/transaction evidence. Required by Hard Contract §§1.6/4/8.2-9/9 and Architecture §§4.1.7/5.2/6.2/6.3.2,5-7/8.8/10.

4. **P2 — The full repository test budget remains nondeterministic at this snapshot.** Default parallel execution timed out two 5-second integration tests (`346 passed / 2 timed out / 10 skipped`); serial execution still timed out the ambient integration test (`347 passed / 1 timed out / 10 skipped`). That exact test passes alone in `847ms`, and all focused assertions pass, so this is test scheduling/budget fragility rather than a semantic failure. The reported clean full-suite result was not independently reproducible.

   Required fix: remove avoidable test-wide contention or give the transaction-backed integration cases an explicit justified timeout, then prove the default full command twice without retries. Required by Hard Contract §§1.6/10/11-G2 quality evidence and Architecture §10.

### Independent evidence

- Mandatory full reads: all nine changed files `4494/4494`, Hard Contract `463/463`, Architecture `636/636`, plus the unchanged production session call chain used to confirm compile-before-transaction config reads.
- QA extension: `3/7`. Generalized alias/axis, nested ambient diagnostic/no-prepare, and outside-root CompilerHost denial pass. Missing/invalid default, unresolved local import, outside-root config extends, and missing config hash fail; the last two share one config-authority root.
- Committed evidence: focused `48/48`; shallow-worktree `22/22`; exact timed-out test rerun `1 passed / 9 skipped`; typecheck and scoped lint clean. Full default and serial timeout results are recorded above rather than relabeled green.
- QA-only test removed with `apply_patch`; temporary shallow worktree removed after clean status; exact detached QA checkout restored clean at `3f4e7e3`.
- Manual deslop/self-audit: all three `d153f9a` P0s and its P2 are closed, not repeated as blockers. New findings are separated by mechanism and severity: source default fabrication, compiler-config authority, unresolved local dependency, and test-budget fragility. No UI/browser/fidelity or G2-completion inference is made.

## G2 Compiler Rework Snapshot `d153f9a`

Verdict: **REWORK — the exact three `6449b70` findings close, but generalized projection and exact dependency authority remain unsafe**

Exact SHA: `d153f9a31cf8a6661a3a88895f21e412cf81dd8e`

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

Scope: backend-only compiler, parser, dependency-snapshot, session, and route rework. No one-canvas UI, browser behavior, G3/G4 scope, or G2-completion claim is judged.

### Closed rows

- **Concise-arrow root projection: PASS for the reported class.** Direct and parenthesized JSX expression bodies now resolve as the component root, while a conditional expression refuses rather than publishing fabricated structure. This closes the exact `6449b70` concise-arrow failure under Hard Contract §§1.6/4/9/11-G2 and Architecture §§4.1.7/6.2/8.8/10.
- **Nested-literal false axes: PASS for the reported class.** `ReadonlyArray<'Primary' | 'Secondary'>` and object discriminant unions remain ordinary props rather than fake axes; a direct or parenthesized top-level string-literal union remains an axis, and a string/number mixed union remains non-axis. This closes the exact regex-flattening failure under Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.
- **Registered-root dependency checking: PASS for imported files contained by the owning root.** Recursive relative/path-alias/re-export dependencies are snapshotted from the registered root. A dependency changed after snapshot and before the transaction lock refuses `SOURCE_HASH_STALE` before sidecar or transaction evidence. This closes the exact process-cwd relocation failure under Hard Contract §4 and §8.2,5-9 and Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.
- **Committed gates: PASS.** Focused projection/compiler/session/import/route `42/42`; full repository `46 passed + 1 skipped` files, `342 passed + 10 skipped` tests; typecheck clean; scoped ESLint `0 errors` with the two unchanged `lib.ts` warnings; diff-check/status clean.

### Blocking findings

1. **P0 — Axis classification still publishes unresolved clean string-union semantics as variant-free native success.** A local alias (`type Tone = 'Primary' | 'Secondary'; variant?: Tone`) and an explicit-nullish union (`variant: 'Primary' | 'Secondary' | undefined`) both return zero axes with `compatibility: 'native-v1'`. `topLevelStringLiteralUnion` only accepts literal members written directly at the property site; it neither resolves the local alias nor removes explicit nullish members. The authoritative parser therefore converts valid single-axis source into successful variant-free source instead of preserving the axis or refusing.

   Required fix: resolve local alias meaning at the AST/type level or return a named unsupported classification; strip only `null`/`undefined`, then require at least two unique remaining string-literal members. Commit direct, parenthesized, local-alias, alias-chain/cycle, nullable, duplicate, mixed-union, container, and object-union fixtures. Required by Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.

2. **P0 — A tsconfig-resolved dependency outside the registered root bypasses both the jail and exact snapshot.** A path alias resolving to `../outside/dep.ts` is silently omitted by `readProjectModuleDependencies`, classification succeeds, and the projection hashes only the component. The compiler host then permits live-disk reads for non-snapshotted files outside `projectRoot`, because its refusal predicate covers only unstaged files inside the root. This is an untracked second source authority and can make semantic evidence depend on bytes outside the store jail.

   Required fix: refuse every non-external resolved module outside the canonical registered root before classification, including relative escape, tsconfig path alias, and symlink escape; the compiler host must never live-read non-`node_modules` project source outside the exact snapshot. Prove named refusal and zero sidecar/transaction evidence. Required by Hard Contract §4 runtime-root/source-hash authority, §8.2,5-9, and §11-G2; Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.

3. **P0 — The exact dependency snapshot omits tsconfig-owned ambient project declarations.** A component that uses a global type from a tsconfig-included `src/global.d.ts` classifies without hashing that declaration. `readProjectModuleDependencies` follows only import/export edges, while the semantic program roots only the staged component and synthetic CSS declaration. The claimed project TypeScript environment is therefore neither complete nor immutable: ambient semantics can be absent from the proof, and future fallback expansion would reintroduce live-disk authority.

   Required fix: include all relevant parsed project roots/ambient declarations in the exact jailed snapshot and semantic program, or explicitly refuse unsupported ambient dependencies before authoring. Commit global `.d.ts`, triple-slash reference, configured `types`/extends, relocation, drift-before-evidence, and missing-snapshot fixtures. Required by Hard Contract §4 source authority, §8.2,5-9, and §11-G2; Architecture §§5.1.1/5.2/6.2/6.3.2,5-7/10.

4. **P2 — Three committed tests depend on the checkout's directory depth.** `authoring-session.test.ts`, `authoring-compiler.test.ts`, and `editor-authoring/route.test.ts` all locate dependencies with `path.resolve(process.cwd(), '../../..', 'node_modules')`. They pass in the current nested `.codex/worktrees/...` checkout but fail in a shallower isolated worktree, so the relocation/type-authority evidence is not portable even though the production failure is not reproduced there.

   Required fix: resolve the actual package/repository dependency root without a fixed cwd ancestry, share one fixture helper, and run the three suites from both nested and shallow isolated checkouts. Required by Hard Contract §1.6 evidence truth and Architecture §10 relocation/compiler test requirements.

### Independent evidence

- Mandatory full reads: Hard Contract `463/463`, Architecture `636/636`, all ten cumulative changed files `4283/4283`, and the complete immediate projection/root-registry/schema/transaction dependencies.
- QA matrix: `3/7`. The old concise-arrow, nested-container/object-axis, registered-root import, and recursive drift classes pass. Local alias, explicit-nullish union, outside-root dependency, and ambient declaration fail; the first two share one classifier mechanism and are reported once.
- Static replay independently confirms the three duplicated cwd-depth-dependent `node_modules` fixtures. It is tracked as a P2 test-portability defect, not misreported as a production regression.
- QA-only test file was removed with `apply_patch`; the detached checkout is restored clean at exact `d153f9a`.
- Manual deslop/self-audit: the three exact `6449b70` findings are closed rather than relabeled. The three P0 blockers are distinct generalized roots: incomplete axis meaning, outside-jail live source authority, and incomplete project dependency closure. The P2 is isolated to test portability. No UI/browser/fidelity or G2-completion conclusion is inferred.

## G2 Compiler Rework Snapshot `6449b70`

Verdict: **REWORK — the three reported `b7ae9e1` repros close, but strict projection and owning-root type authority remain unsafe**

Exact SHA: `6449b702388571aa6378dd31cc482a3552150089`

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

Scope: four-file compiler/projection rework only. The unchanged session and route are exercised as production callers; one-canvas UI, browser behavior, reload navigation, and G2 completion are not judged.

### Closed rows

- **Nested executable boundary: PASS for the reported class.** `findRootReturnedElement` now stops at every nested `ts.isFunctionLike`, class declaration, and class expression. The committed fixture covers a nested object method plus named function, and the outer section remains the projected root. This closes the exact `b7ae9e1` nested-return contradiction under Hard Contract §4/§8 steps 4 and 9 and Architecture §§4.1.7/6.2/10.
- **Direct generic alias substitution/refusal: PASS for the reported class.** Local generic type aliases are substituted at the AST level; arity mismatch, interface inheritance, imported/unresolved aliases, and component-owned unresolved type parameters refuse instead of becoming empty-axis success. This closes the exact `Props<'Primary' | 'Secondary'>` and `Props<T>` repros under Hard Contract §§1/4/9 and Architecture §§4.1.7/6.2/8/10.
- **Current-checkout tsconfig loading: PASS only for process-cwd roots.** The compiler loads and validates the nearest real `tsconfig.json`, and the committed repository `@/*` alias fixture passes. Assertion evidence remains conditional on an executed semantic check. This improves Hard Contract §8 steps 6-9 and Architecture §6.2, but does not satisfy registered-root authority below.
- **Committed gates: PASS.** Focused compiler/projection/session/route `32/32`; full repository `46 passed + 1 skipped` files, `338 passed + 10 skipped` tests; typecheck clean; scoped ESLint `0 errors` with the two unchanged `lib.ts` warnings; diff-check/status clean.

### Blocking findings

1. **P0 — Concise-arrow components publish incomplete SourceProjection as native success.** `export const Button = () => <button><span /></button>` selects the correct export but `findRootReturnedElement` only searches `ReturnStatement` nodes. The projection returns `structure: null`, `compatibility: 'native-v1'`, while the source has a concrete JSX root. Compiler round-trip can therefore certify unchanged `null` rather than the component structure it is required to model.

   Required fix: treat a concise arrow's JSX expression body as its returned root, with the same parenthesis and nested-boundary law. Commit concise JSX, parenthesized JSX, block-body arrow, and non-JSX expression refusal fixtures. Required by Hard Contract §§1.6/4/9/11-G2 and Architecture §§4.1.7/6.2 steps 1-6/8.8/10.

2. **P0 — Variant-axis classification still flattens any nested quoted literals.** `variantAxes` uses a regex over printed `tsType`, so both `ReadonlyArray<'Primary' | 'Secondary'>` and `{ kind: 'Primary' } | { kind: 'Secondary' }` become a fake string-valued `legacy-single-axis`. AST-level generic substitution is correct, but its output is fed into a structurally unsound classifier. Migration/compiler may convert non-string prop semantics into variant slots instead of refusing or treating them as ordinary props.

   Required fix: derive axes only from a top-level union whose every non-nullish member is a string literal; do not infer semantic shape from printed text. Preserve ordinary container/object props as non-axes and explicitly refuse unresolved structures. Commit container, object-union, mixed-union, alias, parenthesized, nullable, and direct-string-union fixtures. Required by Hard Contract §§1.6/4/9 and Architecture §§4.1.7/6.2.6/8.2-6/10.

3. **P0 — Semantic checking still uses process cwd rather than the registered owning root.** `ProjectAuthoringSession` reads exact source through `RuntimeRootRegistry`, but `assertSemanticTypecheck` receives only store-relative `file` and calls `path.resolve(file)`. In a real session registered to a relocated temporary project with its own valid `tsconfig` and `@/*` dependency, create-variant resolves against the QA checkout and falsely returns `STAGED_TYPECHECK_FAILED / TS2307`. The same authority mismatch can read a same-named dependency from the wrong checkout.

   Required fix: thread the registry-resolved owning root/absolute staged target and exact dependency snapshot into CompilerAdapter. Load tsconfig from that root, serve staged/current dependency bytes from the immutable transaction snapshot, and refuse unavailable dependencies without cwd fallback. Commit registered-root relocation, same-path divergent dependency, relative import, path alias, imported type, and CSS-module fixtures. Required by Hard Contract §4 runtime-root/source authority, §8 steps 2 and 5-9, and §11-G2; Architecture §§5.1.1/5.2/6.2/6.3 steps 2 and 5-7/10.

### Independent evidence

- Full reads: Hard Contract `463/463`, Architecture `636/636`, all four changed files `3444/3444`, plus complete SourceProjection/session/command/route/migration/type interfaces.
- QA matrix: `0/4`. Concise-arrow structure, generic-container axis, object-union axis, and registered-root typecheck each failed exactly as described. The two axis failures share one classifier root and are reported once.
- QA-only test file was removed with `apply_patch`; detached checkout reverified at exact SHA with clean status before committed gates.
- Manual deslop/self-audit: closed `b7ae9e1` mechanisms remain closed and are not restated as blockers. No UI/browser/fidelity or G2-completion claim is inferred.

## G2 Compiler, Session, And Route Snapshot `b7ae9e1`

Verdict: **REWORK — exact b94 regressions close; generalized strict-projection/typecheck contract remains open**

Exact SHA: `b7ae9e138a1f65703b0b560f392174d1eea39ceb`

Scope: compiler fixes at `9f839bd`, the `5b4339b` production session/transaction integration, and strict GET/POST route exposure. One-canvas UI, reload navigation, undo route, and browser behavior are not present and are not judged.

### Closed rows

- **Original stable-export/type/stale-move findings: PASS.** File/export divergence, an earlier top-level PascalCase helper, and a local non-generic named Props alias now bind to the intended export. Valid `string | number` registry values pass; a wrong generic-value registry fails with real `TS2322`; stale native IDs block move. Label-independent command IDs and replay collision remain correct. This closes the exact `b94ef011` repros under Hard Contract §§3-5/8.4-9 and Architecture §§4/4.1.7-8/6.1-6.3.
- **Assertion evidence: PASS for executed checks.** `staged-typescript-semantics` is emitted only when a semantic check ran; native-registry round-trip is emitted only for a native projection. The prior unconditional evidence overclaim is closed.
- **Session/route transaction path: PASS for this bounded slice.** Exact command keys, revision, hash map, display name, and finite/positive frame validate before command execution. Create/rename/move persist through the G1 transaction; semantic compiler refusal leaves TSX, sidecar, history, and transaction directory entries byte-identical. This satisfies Hard Contract §8 steps 2-12 and Architecture §§6.2-6.3 for tested single-root commands.
- **Committed gates: PASS.** Focused compiler/projection/session/route `29/29`; full repository `46 passed + 1 skipped` files, `335 passed + 10 skipped` tests; typecheck clean; scoped ESLint `0 errors` with the same two pre-existing `lib.ts` warnings; diff-check/status clean.

### Blocking findings

1. **P0 — ComponentModel root traversal still crosses nested executable boundaries.** Export selection is fixed, but `findRootReturnedElement` recursively enters a nested function. For `NestedButton` containing `function Inner(){ return <span/> }` before its own `return <button/>`, SourceProjection reports `structure.tag = 'span'` while SourceAnchor correctly binds the outer `button`. The compiler therefore receives a self-contradictory projection and can mark untouched semantics against the wrong JSX model. Violates Hard Contract §4 strict SourceProjection and §8 steps 4/9; Architecture §4.1 rule 7, §6.2 steps 1/3-5, and §10 projection fixtures.

   Required fix: use the same nested-function/class boundary law already proven in `source-anchor.ts`; the model and anchor extractors must resolve the identical returned root. Commit named function, arrow, object-method, getter/setter, and class-boundary fixtures at the SourceProjection layer.

2. **P0 — Generic variant prop aliases silently collapse to variant-free native source.** `componentPropMembers` returns the raw members of `type Props<T> = { variant?: T }` but does not substitute `Props<'Primary' | 'Secondary'>`; the property becomes `tsType: 'T'`, producing zero axes and `compatibility: 'native-v1'`. This reopens the exact corrupt-state class the strict parser was meant to close: unresolved source structure becomes successful empty-axis/native classification rather than a lossless axis or explicit unsupported result. Violates Hard Contract §§1/4/9 and Architecture §4.1 rule 7, §6.2, §8 items 2/6, and §10 migration/projection fixtures.

   Required fix: resolve generic/local/interface/inherited prop types through the authoritative TypeChecker, or refuse `COMPONENT_PROPS_UNRESOLVED` before classification. Never publish `unknown` for a destructured binding and then infer variant-free success. Commit generic substitution, interface-extends, imported Props, and explicit-unsupported fixtures.

3. **P0 — Staged semantic checking does not use the project TypeScript environment.** `assertSemanticTypecheck` constructs hardcoded options and resolves the virtual file under process `cwd`; it does not load the registered root's `tsconfig`, `paths`, or exact dependency snapshot. A valid native component importing `StoreId` through this repository's configured `@/* -> ./src/*` alias fails compiler execution with `STAGED_TYPECHECK_FAILED / TS2307`, while the exact same fixture passes the real repository `tsc --noEmit`. Common project components using aliases would be falsely un-authorable. Violates Hard Contract §4 CompilerAdapter authority, §8 steps 6-9, and §11/G2; Architecture §6.2 steps 1-5, §6.3 steps 6-7, and §10 compiler fixtures.

   Required fix: load the owning runtime root's actual tsconfig/compiler options, root the virtual target at that registered checkout, and serve every exact staged/current dependency through the compiler host. Preserve named semantic diagnostics. Commit path-alias, relative import, imported type, CSS module, relocated checkout, valid-union, and invalid-generic fixtures.

### Independent evidence

- Full current reads: all 10 files in `b94ef011..b7ae9e1`, including `lib.ts` `2528/2528`, plus the unchanged G1 transaction/history/store interfaces used by the session.
- QA matrix: original combined regression row passed; semantic refusal no-write passed; three generalized fixtures failed exactly as listed. The alias-import fixture independently passes project `npm run typecheck`, proving compiler `TS2307` is a false refusal rather than invalid source.
- QA-only test/fixture files were removed with `apply_patch`; exact SHA and clean status were reverified before full committed gates.
- Manual deslop/self-audit: nested-root and generic-prop failures are separate parser mechanisms; project module resolution is a compiler-environment failure. Closed b94 cases are not restated as active blockers. No UI/browser/fidelity conclusion is inferred.

## G2 Compiler Snapshot `b94ef011`

Verdict: **REWORK — compiler checkpoint only; no route/session/persistence or end-to-end G2 claim**

Exact SHA: `b94ef01167dcfa0f246b1439ca3f7853e4ef5cf7`

Binding package: Hard Contract SHA-256 `289f944638bb1ebb3d382eed25aa8702701c83afbf0fd917ef4dd54e7286952f`; Architecture SHA-256 `ca2e63a9e02b284e34414a01688e33d73173e975b66ff869ae7465e501427cf0`.

### Passing evidence

- **Stable identity: PASS for this slice.** `create-variant` derives `stableId('variant', component.id, commandId)`; different labels with the same command identity produce the same variant ID, replay against the applied graph refuses `VARIANT_ID_COLLISION`, rename preserves ID, and the happy-path move emits no source patch. This satisfies Hard Contract §§3-5 and Architecture §§4.1.8/6.1 for the bounded cases.
- **Committed baseline: PASS.** Focused compiler/projection/migration `26/26`; full repository `45 passed + 1 skipped` files, `328 passed + 10 skipped` tests; typecheck clean; scoped ESLint `0 errors` with only the two reported pre-existing `lib.ts` warnings; diff-check and exact checkout status clean.
- Lead's independent `/o-deslop` found no mechanical diff slop. QA agrees on code hygiene; that result does not override the semantic failures below.

### Blocking findings

1. **P0 — SourceProjection is not bound to the actual exported component.** `lib.ts` derives `ComponentModel.name` from the filename and selects the first PascalCase function/arrow without requiring that it is the selected export. `source-projection.ts` then feeds that filename-derived name into anchor extraction. Three probes fail: a valid `FileAlias.tsx` exporting `ActualButton` becomes unsupported; a preceding `Helper` function supplies props/structure while anchors resolve from the later exported component; a named props alias containing a two-value union is silently classified `native-v1` instead of `legacy-single-axis` or explicit unsupported. This can bootstrap or compile the wrong component model as variant-free. Violates Hard Contract §4 source authority, §5 phase law, and §8 steps 4-9; Architecture §4 `SourceRef.exportName`, §4.1 rule 7, §6.2 steps 1-5, §8 items 2/6, and §11 G2 strict SourceProjection requirement.

   Required fix: make one export-aware parser authoritative. Resolve the exact `SourceRef.exportName` to one exported function/variable; derive props, structure, runtime model, and anchors from that same declaration. Resolve named prop types through TypeScript or refuse them explicitly; never turn unresolved type structure into empty axes/native success. Commit filename/export, earlier-helper, named-type, missing-export, and ambiguous-export regressions.

2. **P0 — “Type-aware” validation is textual and accepts TypeScript-invalid staged source.** `assertRegistryPropTypes` regexes quoted strings and checks whether `tsType` text contains `boolean`, `number`, or `string`; no `Program`/`TypeChecker` runs. A valid `string | number` prop rejects its string member because the number branch wins. A prop typed `Counter<number>` accepts the literal `1` merely because the type text contains `number`; the compiler returns all three `verifiedAssertions` as passed. Writing that exact registry into the repo and running `tsc --noEmit` produces `TS2322: Type 'number' is not assignable to type 'Counter<number>'`. Violates Hard Contract §4 CompilerAdapter boundary, §5 phase law, §8 steps 7-9, and §11/G2; Architecture §6.2 steps 1-5, §6.3 steps 6-7, §10 compiler fixtures, and §11 G2 type-aware/round-trip gate.

   Required fix: stage exact outputs in a TypeScript program using the project compiler options and dependency set; reject syntax and semantic diagnostics. Validate registry values with checker assignability, including unions, aliases/generics, null, and imported types. Emit `verifiedAssertions` only after the corresponding check actually ran. Commit valid-union acceptance plus invalid alias/generic rejection and a staged-source semantic-diagnostic fixture.

3. **P1 — Sidecar-only move bypasses native registry/graph identity validation and reports a false round-trip PASS.** The move branch returns before `assertNativeRegistryMatchesGraph`. Replacing the Primary registry ID with another validly shaped ID still allows the graph geometry mutation and returns `native-registry-round-trip`, `untouched-source-semantics`, and `geometry-sidecar-only` as passed. Rename/create correctly call the identity check; move does not. Violates Hard Contract §4 graph/source authority and §8 steps 4-9; Architecture §6.2 steps 2-5 and §6.3 steps 4-7.

   Required fix: validate source registry identity against the canonical graph before every native command branch, including sidecar-only geometry. A stale ID set must refuse `NATIVE_VARIANT_REGISTRY_STALE`; assertion labels must be evidence-derived, not unconditional return metadata. Commit the exact stale-move regression.

### Verification and scope

- Mandatory full reads: all 8 changed files, including `lib.ts` `2490/2490`, plus immediate parser/import callers and relevant binding clauses. No production caller invokes `compileG2VariantCommand` at this SHA.
- QA adversarial matrix: `1/7` passed; 6 failures collapse into the 3 root findings above. A separate exact staged-source fixture independently reproduced TypeScript `TS2322`.
- QA-only files were deleted with `apply_patch`; exact SHA, diff-check, and worktree cleanliness were reverified.
- Manual deslop/self-audit: findings are root-cause distinct; filename/export, helper selection, and named-props outcomes remain one parser-authority finding; valid/invalid type outcomes remain one semantic-checker finding. No G2 route/session, transaction, browser, UI, reload, or undo conclusion is inferred from this compiler-only gate.

## G1 Migration Snapshot (superseded by migration PASS at `578bced`)

Verdict: **REWORK — bounded migration gate**

Exact SHA: `7db11e0c204c19faf5aff41e35c4acac61bd4e5f`

Scope: pure SourceProjection-to-AuthoringGraph bootstrap for native no-axis and legacy single-axis components, deterministic IDs, exact-hash field validation, lineage, and explicit unsupported/hold results. Durable production integration and full G1 remain later gates.

### Passing evidence

- Every valid single-axis source value becomes one frame; the declared default is the sole Primary and every other value is linked to that Primary.
- The returned graph passes `assertAuthoringGraphV1` and carries the supplied SHA-256 under the exact projection file.
- Variant IDs derive from source-slot ordinal and stay stable across relabeling and valid source-hash changes; input projections remain unmodified.
- Native no-axis source imports one canonical Primary. Empty/duplicate values, missing default, invalid hash, and `legacy-single-axis` axis-count mismatch return unsupported.
- Actual multi-axis source remains a hold; parse failures remain unsupported.
- Clean committed baseline: focused migration/projection `12/12`; full repo `303 passed / 10 skipped`; typecheck, three-file ESLint, diff-check, and detached checkout clean.

### Blocking findings

1. **P1 — Reverse compatibility/axis-count mismatch is misclassified as a legitimate hold.** A projection labeled `legacy-multi-axis` with zero or one actual axis returns a `legacy-multi-axis` hold and reason claiming multi-axis source, rather than refusing corrupt classification. QA extension: `9/11`; both reverse mismatch cases fail.

   Required fix: validate compatibility against actual axis count before returning hold/import. Only two-or-more actual axes may return `legacy-multi-axis` hold; zero/one mismatch must return named unsupported/refusal without a graph. Required by Hard Contract §1 laws 2/6 and §9; Architecture §8 items 2-4 and §10 migration fixtures.

2. **Contract conflict — bootstrap identity inputs disagree.** Architecture §8 item 3 still says bootstrap IDs use `store/file/export/axis/value`, while Hard Contract §3 invariant 1 requires identity independent of label and the implementation intentionally uses source-slot ordinal.

   Required reconciliation: update Architecture §8 to the newer tested source-slot identity rule, or explicitly supersede it in the hard contract. Reverting to value-derived IDs would violate the hard-contract invariant and reopen relabel instability. No Architecture §8 PASS is issued while both rules remain binding.

### Full-G1 residuals

- The importer has no production caller. Actual file-byte hash computation, transaction-backed sidecar persistence, and refusal-without-disk-write must be proven in the combined G1 gate.
- Prepared-journal `graphPatches` and `inverse` disposition remains open under Hard Contract §8 step 10 and Architecture §6.3 step 8.

### Verification

- Full reread: Hard Contract `468/468`, Architecture `636/636`, and all three changed files `251/251` lines; `source-projection.ts` caller contract also read in full.
- QA native-no-axis, linked-lineage, hash-independent identity, and input-purity probes pass.
- QA worktree restored clean after temporary probes.

## Milestone 2 Final Recovery Gate

Verdict: **PASS — milestone 2 single-root lock/transaction/recovery/history scope only**

Exact SHA: `f490c9cf010acf0e1210ff842a58508b345679fb`

Scope: direct child of `1c65bdc`; Darwin cross-process lease lifecycle, recovery-before-write refusal, strict transaction evidence, participant/coordinator decision recovery, byte-and-mode source/sidecar/history rollback, and terminal marker convergence. Migration remains separately stashed and full G1/G2 are not accepted here.

### Clause verdict

- **Hard Contract §8 steps 1-3 and 10-12: PASS for single-root G1 scope.** The store lease precedes reads; unresolved/invalid evidence blocks writes; prepared evidence owns byte/mode preimages; recovery installs and verifies the correct decision image before terminal markers and releases the lease.
- **Architecture §§5.3/5.4 and 6.3 steps 1/8-13: PASS for single-root scope.** O_EXLOCK provides cross-process exclusion on the supported Darwin platform; participant/coordinator records are disk-authoritative; prepared/rolled-back states restore verified preimages; committed states finish after-images; contradictions refuse without changing evidence.
- **Architecture §7 and Hard Contract §8 undo/rollback distinction: PASS for transactional history images.** History metadata shares the transaction and rollback restores its recorded bytes and mode; this is not a claim that the full migration/history/G1 package has passed.

### Independent evidence

- Full reread: Hard Contract `468/468`, Architecture `636/636`, and all three changed files `1687/1687` current-file lines.
- Exact diff: three files, 106 insertions and 15 deletions; diff-check and detached checkout clean.
- Clean committed baseline: focused lock/transaction `33/33`; full repo `296 passed / 10 skipped`; typecheck and scoped ESLint clean; zero unhandled descriptor errors.
- Committed fixtures restore source and preexisting history bytes plus `0640` modes, delete the missing sidecar preimage, converge both marker directions, and block non-directory recovery evidence before any sidecar write.
- QA extension: `36/36` passed. Both marker mismatches with out-of-band source drift refused `RECOVERY_CONFLICT` while preserving bytes and marker states; invalid-root evidence created no participant; injected descriptor-close failure preserved the primary refusal and attached `AUTHORING_LOCK_CLOSE_UNCERTAIN`.
- QA worktree restored clean after temporary probes.

### Remaining gates

- Apply and independently gate the separated migration follow-up.
- Run one full G1 package re-gate at its exact final SHA before Meta/Dan or any rebuilt G2 work.

## Milestone 2 Lock Refusal Follow-up

Verdict: **PASS — refused-lock lease lifecycle only; milestone 2 remains REWORK**

Exact SHA: `1c65bdc116102ccdcae8ded60045697bbdc2aba6`

Scope: one-file correction for O_EXLOCK descriptors left open when release refuses corrupt, replaced, or missing lock evidence. Direct parent is `a68fec0df151a88334aa7129ad3ed0c805629f81`; migration work is excluded.

### Clause verdict

- **Hard Contract §8 step 12 and Architecture §6.3 step 11: PASS for refusal lifecycle.** Every validation-refusal path closes the held descriptor, preserves evidence, and terminalizes the lease without unlinking the refused record.
- **Hard Contract §8 and Architecture §§5.4/6.3 steps 12-13: still REWORK.** This commit does not change rollback byte restoration or invalid transaction-root entry classification.

### Verification

- Full read: `authoring-lock.ts`, `237/237` lines. Exact diff: one file, 11 insertions and 2 deletions.
- QA extension: corrupt record, replaced token, and missing path each release the kernel lock, preserve intended evidence, and make repeated release idempotent; `10/10` lock tests passed with the temporary probe.
- Clean exact-tree baseline: focused lock/transaction `30/30`; full repo `293 passed / 10 skipped`; typecheck, one-file ESLint, diff-check, and status clean; zero unhandled FileHandle/GC errors.
- The reported `300 passed / 10 skipped` count is not reproducible at this exact SHA. A direct-child one-source-file diff cannot add seven tests or one test file, so that count is not accepted as exact-SHA evidence.
- QA worktree restored clean after the temporary probe.

## Milestone 2 Recovery Rework Follow-up

Verdict: **REWORK**

Exact SHA: `a68fec0df151a88334aa7129ad3ed0c805629f81`

Scope: Darwin O_EXLOCK store leases, unresolved-recovery preflight before normal commits, and bidirectional rollback-marker convergence.

### Passing evidence

- Stale recovery opens the existing inode with nonblocking O_EXLOCK and updates ownership through that held descriptor; a live child-held replacement refuses atomically.
- Normal commit checks recovery decisions under the same lease before sidecar/revision/source reads or new transaction evidence.
- Both rollback-marker mismatch directions classify `finish-rolled-back` and finish the missing marker.
- Clean baseline: focused `30/30`; full repo `293 passed / 10 skipped`; typecheck, four-file ESLint, and diff-check clean.

### Blocking findings

1. **P0 — Marker convergence does not perform rollback.** In both mismatch directions, recovery returns `finished-rolled-back` and makes both markers terminal while source remains the transaction after-image and the sidecar remains revision 1.

   Required fix: verify current images, restore and verify every recorded before-image, then publish terminal rollback markers. Marker state cannot substitute for byte rollback. Required by Hard Contract §8 rollback/step 12 and Architecture §§5.4/6.3 steps 12-13.

2. **P1 — Transaction-shaped non-directory evidence is ignored.** A valid-ID regular file under `.onemo/transactions` is skipped, allowing a new transaction and revision to commit rather than refusing `RECOVERY_REQUIRED`.

   Required fix: classify unexpected transaction-root entries as invalid evidence and block writes, with explicit allowances only for contract-defined safe artifacts. Required by Hard Contract §1 law 6/§8 and Architecture §§5.1.2/5.4/6.3 step 13.

3. **P1 — Release refusals leak the held descriptor.** Corrupt release evidence produces the right named error, but a fresh recovery remains excluded by the abandoned O_EXLOCK descriptor.

   Closure: exact SHA `1c65bdc116102ccdcae8ded60045697bbdc2aba6` closes and terminalizes all three refusal paths; independently passed above.

### Verification

- Full read: hard contract `468/468`, architecture `636/636`, and all four changed files `1759/1759` current-file lines.
- QA extension: `30/34` passed; two rollback-image directions, invalid non-directory evidence, and descriptor lifecycle failed exactly as described.
- QA worktree restored clean after temporary probes.

## Milestone 2 Recovery Rework Checkpoint

Verdict: **REWORK**

Exact SHA: `b724a1ff5214dbfe6c1705814f249c11aacb753e`

Scope: strict participant/coordinator/blob validation, dead-PID recovery-lock takeover, disk-authoritative recovery under lease, root-kind sidecar derivation, transactional history metadata, mode-aware recovery conflicts, terminal committed no-replay, direct store/history writer removal, and transaction-ID collision protection. This is not a full G1, cross-root coordinator, G2, or end-to-end completion claim.

### Clause verdict

- **Hard Contract §8 steps 2-12 and Architecture §6.3 steps 2-12: partial PASS.** Durable evidence is strictly validated; source, sidecar, and history images share one transaction; nominal prepare/install/decision order remains correct.
- **Hard Contract §8 step 1 and Architecture §§5.3/5.4/6.3 step 1: REWORK.** Dead-lock takeover can unlink a newly installed live replacement lock between token validation and unlink.
- **Architecture §§5.4 and 6.3 step 13: REWORK.** Normal commits do not discover, resolve, or refuse older prepared transactions before writing, and rollback terminal-record convergence remains one-sided.
- **Hard Contract §4 and Architecture §§5.1.1/5.4: PASS for the four requested repairs.** Recovery rereads authoritative records under lease, discovery uses the no-follow runtime jail, global sidecars derive from root kind, and coordinator-rolled-back converges a prepared participant.

### Passing evidence

- `recover()` acquires the recovery lease and rereads/validates participant and coordinator records under that lease; pre-lock discovery supplies only transaction identity.
- Recovery discovery refuses symlink transaction directories and resolves record files through `RuntimeRootRegistry`.
- `AuthoringSidecarStore` is read-only and derives project/global sidecar paths internally from the registry-validated root kind.
- Coordinator `rolled-back` plus participant `prepared` durably converges the participant to `rolled-back`.
- Exact-key validation covers transaction records, coordinator pointers, file images, blob refs, hashes, modes, statuses, and safe relative paths.
- Source, sidecar, and history patches install through one transaction. Direct store/session/history writers are removed.
- Terminal committed records are not replayed over newer source, and recovery compatibility compares mode as well as hash.

### Blocking findings

1. **P0 — Dead-lock takeover can delete a replacement owner's live lock.** After the stale token is reread, `acquireForRecovery()` performs an unconditional path unlink. A deterministic interposition replaced the stale file with a valid current-PID owner before that unlink; recovery deleted the replacement and successfully acquired its own lease.

   Required fix: make takeover ownership-preserving atomically. Token re-read followed by pathname unlink is not a conditional unlink and remains TOCTOU-unsafe. Add a deterministic replacement-owner race fixture. Required by Hard Contract §8 step 1 and Architecture §§5.3/5.4/6.3 step 1.

2. **P0 — New writes proceed over unresolved prepared evidence.** With an older participant and coordinator both durably `prepared`, a new transaction committed revision 2 instead of resolving recovery or refusing `RECOVERY_REQUIRED`. Recovery execution exists only as an explicit caller path; normal commit has no unresolved-record preflight under its lease.

   Required fix: under the same store lease, enumerate and strictly validate unresolved records before loading/mutating new transaction state, then finish/rollback or refuse. Invalid, unavailable, or uncertain evidence must block writes. Required by Architecture §5.4 and §6.3 step 13, reinforced by Hard Contract §8 steps 1-3 and 10-12.

3. **P1 — Rollback terminal convergence is asymmetric.** Participant `rolled-back` plus coordinator `prepared` returns `ignored-rolled-back` but leaves the coordinator durably `prepared`. The opposite coordinator-rolled-back/participant-prepared direction is fixed.

   Required fix: under the recovery lease, converge both records to the rollback terminal state whenever rollback is the durable decision, or refuse a genuine contradiction. Commit both directional fixtures. Required by Architecture §§5.4 and 6.3 steps 12-13.

### Verification

- Full read: all nine changed files, `2264/2264` current-file lines.
- Commit diff check and detached QA checkout: clean at exact SHA.
- Clean committed snapshot: focused `32/32`; full repo `290 passed / 10 skipped`; typecheck and nine-file ESLint clean.
- QA extension: `27/30` passed; three failures reproduce the blockers above.
- QA worktree restored clean after temporary probes.

## Milestone 2 Coordinator/Recovery Checkpoint

Verdict: **REWORK**

Exact SHA: `de201f5290d360223a9d72f5cb8d86225b5bb4a1`

Scope: durable single-root participant/coordinator records and before/after blobs, source/sidecar/decision ordering, rollback, disk-image recovery, global metadata paths, and session source writes through the transaction. Strict record validation, stale-lock takeover, transaction-owned history, and direct `AuthoringSidecarStore.commit` removal remain explicitly deferred.

### Clause verdict

- **Hard Contract §8 steps 2-12 and Architecture §6.3 steps 2-12: partial PASS.** Nominal prepare/source/sidecar/coordinator/participant order and pre-decision rollback are correct; coordinator-commit uncertainty never rolls back committed state.
- **Architecture §§5.4 and 6.3.13: REWORK.** Recovery can act on a stale pre-lock decision, follows a symlinked participant record, and does not converge a prepared participant after a rolled-back coordinator.
- **Architecture §6.4: PASS for transaction images.** Before/after blobs and records use the durable installer, exact hashes, modes, and same-root relative paths.
- **Hard Contract §4 and Architecture §5.1: REWORK for default global store construction.** Transaction paths are root-kind aware, but the store default sidecar remains project-hardcoded.

### Passing evidence

- All three `57f4a97` lock blockers are closed: root-kind lock placement, named missing/corrupt ownership state, and primary-error preservation with attached release failure.
- Participant and coordinator `prepared` records plus real before/after blobs exist before source mutation.
- Source images install before sidecar; all after-hashes verify before the coordinator `committed` decision; participant finishes afterward.
- Pre-decision failure restores source/sidecar images and marks terminal rollback; post-decision failure returns `RECOVERY_REQUIRED` without rollback.
- Coordinator install uncertainty is checked against disk and treated as committed when the committed bytes are present.
- Disk-only rollback/finish uses record-owned blobs; bytes outside both images refuse `RECOVERY_CONFLICT`.
- Session create/rename/undo source patches now flow through `SingleRootAuthoringTransaction`; direct session file writes are removed.

### Blocking findings

1. **P0 — Recovery decision is stale before the lock.** `executeSingleRootRecovery` discovers coordinator status before constructing `tx.recover`; `recover` acquires the lock but never rereads the coordinator. A reproduced `prepared -> committed` change between those steps still executes rollback and restores committed source preimages.

   Required fix: acquire the store lock before decision classification, or reread and validate participant/coordinator under the acquired lease immediately before any recovery action. A changed decision must restart classification or refuse named. Required by Hard Contract §8 steps 1/12 and Architecture §§5.4, 6.3.1, 6.3.11-13.

2. **P1 — Recovery discovery bypasses the runtime jail for record files.** Transaction directories are found under a jailed root, but participant/coordinator files are built with `path.join` and read directly. An exact `participant.json` symlink to an outside file is followed and its bytes are classified as authoritative recovery evidence.

   Required fix: resolve every transaction record through `RuntimeRootRegistry.resolveStorePath` and preserve no-follow semantics for the read itself. Symlinked records must refuse/produce named invalid evidence without reading outside bytes. Required by Hard Contract §§4/10 and Architecture §§5.1.1/5.4.

3. **P1 — Global sidecar default is still project-specific.** `AuthoringSidecarStore` defaults `sidecarPath` to `PROJECT_AUTHORING_SIDECAR` regardless of `rootKind`. The committed global test passes only because it manually supplies `.onemo/authoring-v1.json`; normal global construction writes the nested project path.

   Required fix: default through `authoringMetadataPath(options.rootKind, 'authoring-v1.json')` and commit a no-override global fixture. Required by Hard Contract §4 and Architecture §5.1.

4. **P2 — Rolled-back coordinator does not finish participant state.** Discovery classifies coordinator `rolled-back` plus participant `prepared` as `ignore-rolled-back`; execution performs no write, leaving a permanent prepared participant.

   Required fix: terminal recovery must durably converge participant status to `rolled-back` before reporting completion. Required by Architecture §§5.4 and 6.3.12-13.

### Verification

- Full read: all seven changed files, `1509/1509` lines. The reported `1505` count did not match the exact checkout.
- Commit diff check: clean.
- Clean committed snapshot: focused `19/19`; full repo `282 passed / 10 skipped`; typecheck and changed-file ESLint clean.
- QA extension: `13/17` passed; four failures reproduce the findings above.
- QA worktree restored clean after temporary probes.

## Milestone 2 Lock Checkpoint

Verdict: **REWORK**

Exact SHA: `57f4a974e99b59d097ef2dc0d791696ba445527a`

Scope: cross-process store-lock acquisition/release and its integration before live transaction reads. Coordinator/participants, source-before-prepare ordering, stale-lock recovery, restart recovery, and full milestone 2 remain outside this snapshot.

### Clause verdict

- **Hard Contract §8 step 1 and Architecture §6.3 step 1: partial PASS.** Project transactions acquire an exclusive filesystem lease before sidecar/revision/hash reads.
- **Architecture §§5.3/5.4: REWORK.** The lock abstraction does not place a global-store lock at its owning root, so it is not yet a canonical every-store/root lock.
- **Hard Contract §8 step 12 and Architecture §6.3 steps 11-13: REWORK.** Release is durable in the nominal path, but dual transaction/release failures lose the primary failure and malformed ownership state is unnamed.
- **Architecture §6.4: PASS for lock-file mechanics.** Creation is exclusive/no-follow, file-synced and directory-synced; post-unlink sync uncertainty is named.

### Passing evidence

- Lock acquisition precedes `commitLocked`, which performs the first graph/revision/hash reads.
- Real child-process-held file excludes acquisition with `AUTHORING_STORE_LOCKED` 409.
- Replacement ownership token refuses release and leaves replacement bytes intact.
- Failed durable acquisition removes the created lock.
- Mutation and stale-revision errors release the project lock.
- Post-unlink sync failure returns `AUTHORING_LOCK_RELEASE_UNCERTAIN` and leaves no false lock.

### Findings closed by `de201f5`

1. **P1 — Global store lock path is project-hardcoded.** `CrossProcessAuthoringStoreLock` always uses `src/app/(dev)/react-figma-components/.onemo/locks/store.lock`. For a registered global root it creates that nested project path instead of `<global-root>/.onemo/locks/store.lock`.

   Closure: `de201f5` derives project/global lock paths from the registered root kind and commits both placements.

2. **P1 — Release uncertainty erases the primary transaction error.** When mutation throws and post-unlink directory sync also fails, `finally` replaces `INJECTED_MUTATION_FAILURE` with `AUTHORING_LOCK_RELEASE_UNCERTAIN`; the original failure is absent from the returned error and its cause.

   Closure: `de201f5` preserves the primary error and attaches the release failure.

3. **P2 — Corrupt or missing ownership state is unnamed.** Corrupt lock JSON escapes as raw `SyntaxError`; a missing lock escapes as raw `ENOENT`. Neither communicates whether ownership was lost or recovery is required.

   Closure: `de201f5` returns `AUTHORING_LOCK_RECORD_INVALID` or `AUTHORING_LOCK_MISSING` and preserves present evidence.

### Verification

- Full read: all five changed files, `920/920` lines. The commit changes five files, not four.
- Commit diff check: clean.
- Clean committed snapshot: focused `12/12`; full repo `275 passed / 10 skipped`; typecheck and changed-file ESLint clean.
- QA extension: `15/18` passed; the three failing fixtures reproduce the findings above.
- QA worktree restored clean after temporary probes.

## Milestone 1.3

Verdict: **PASS — milestone 1 only**

Exact SHA: `1a6f10f5606fffeb3e0e9ed0602dd5f8a8554848`

Scope passed: exhaustive bounded graph validation, portable path identity, exact-file and ancestor-symlink jail, same-store source-hash coverage, mode-safe/preflighted durable installation, and project-root Git lifecycle. This is not a pass for locks, coordinator/participants, crash recovery, persistent history, global-library lifecycle, G2, or full G1.

### Clause verdict

- **Hard Contract §3 invariants 4-6 and §10: PASS.** SourcePropertyRef owner/export and Primary lineage are coherent; wrong kind/channel rejects; module-CSS permits only variant-local class divergence.
- **Hard Contract §4, §8 steps 3-4, and §11 G1 exact-hash scope: PASS.** Every same-store component, module-CSS, and instance source ref requires an exact SHA-256 entry; cross-store refs correctly defer to their owning sidecar.
- **Hard Contract §§4/10 and Architecture §5.1.1: PASS.** Paths are canonical store-relative POSIX identity; absolute, `..`, `.`, empty segments, exact symlinks, ancestor symlinks, and escapes refuse.
- **Hard Contract §8 installer requirements and Architecture §6.4: PASS for installer scope.** Exclusive/no-follow sibling temps, intended mode, preflight capability refusal, sync/hash/rename verification, and named uncertain install/delete residue are proven. Later durable coordinator/recovery obligations remain open.
- **Architecture §§4/4.1/5.2/6.1.1/6.5/10/11: PASS for milestone scope.** The model, typed lineage, hash ownership, anchor path identity, negative fixtures, and G1 boundary match the contract.

### Independent evidence

- Full read: both changed files, `1122/1122` lines.
- Commit diff check: clean.
- Clean committed snapshot: schema `16/16`; full repo `271 passed / 10 skipped`; typecheck and changed-file ESLint clean.
- Replayed earlier failures: owner/export, wrong typed lineage, missing component/CSS/instance hashes, dot aliases, exact/ancestor symlinks, `0644` preservation, preflight refusal, and named uncertainty all behave as required.
- Additional QA boundary: module-CSS with different child `localClass` passes; wrong property, stylesheet, or store each rejects with `matching typed binding`.
- QA worktree restored clean after temporary probes.

## Milestone 1.2

Verdict: **REWORK**

Exact SHA: `111d4aaca387b9200145312607fdb4cfa4485c8c`

Scope: milestone 1 schema/source-identity corrections only. Locks, coordinator/participants, restart recovery, history, G2 compiler, and UI remain outside this snapshot.

### Closed in this snapshot

1. **Wrong typed channel lineage: PASS.** Cross-kind and same-kind/different-property lineage now reject.
2. **Component source hash coverage: PASS.** Each valid component source requires an exact SHA-256 graph entry.
3. **Dot-segment aliases: PASS.** The shared store-relative path predicate rejects `.` segments, so graph and runtime resolution use one serialized file identity.

These close the three milestone 1.1 findings under Hard Contract §§3/4/8/10/11 and Architecture §§4/4.1/5.1.1/5.2/6.1.1/6.5/10.

### Findings closed by milestone 1.3

1. **P1 — Full binding equality rejects valid module-CSS lineage.** A Primary property bound to `.primary { color }` and a linked variant override bound to `.secondary { color }`, in the same store and stylesheet, is rejected only because `localClass` differs. `inheritedFromPropertyId` declares correspondence; the variant-local selector identifies where its different source-owned value lives. Requiring identical `localClass` makes this ordinary linked CSS override unrepresentable.

   Violates Hard Contract §3 invariants 4-6 and §4 source ownership; Architecture §4.1 rule 12 and §6.1.1 duplicate/update-primary lifecycle.

   Closure: milestone 1.3 permits variant-local `localClass` while requiring the same stylesheet store/file/property; QA additionally proved wrong property/file/store refusal.

2. **P1 — Module-CSS source hash coverage is absent.** A same-store `SourcePropertyRef.binding.stylesheet.file` validates without a `sourceHashes` entry. Component-only coverage leaves CSS drift unguarded even though CSS values remain source-owned and compiler transactions may touch the file.

   Violates Hard Contract §4 per-file TSX/CSS authority and §8 step 3; Architecture §4 `module-css` binding and §5.2 hash contract.

   Closure: milestone 1.3 requires exact hashes for same-store module-CSS refs and defers cross-store refs to the owning sidecar.

3. **P2 — Instance source hash coverage is absent.** A same-store `ComponentInstance.source.file` validates without a hash, leaving future detach/consumer mutation without graph-level drift evidence.

   Violates Hard Contract §§3/4/10 and Architecture §§4/5.2/10.

   Closure: milestone 1.3 requires exact hashes for same-store instance source refs and defers cross-store refs to the owning sidecar.

### Verification

- Full read: both changed files, `1051/1051` lines.
- Commit diff check: clean.
- Independent clean-snapshot baseline: schema `15/15`; full repo `270 passed / 10 skipped`; typecheck and changed-file ESLint clean.
- QA replay: all three milestone 1.1 probes now reject as intended.
- QA extension: valid different-class module-CSS lineage rejects with only `matching typed binding`; missing module-CSS and instance hashes both return `ok: true`.

## Milestone 1.1

Verdict: **REWORK**

Exact SHA: `b6c9326f5bcd16654b78e255670c70c71adebadb`

Scope: milestone 1 plus the SourcePropertyRef owner-anchor/export correction. Locks, coordinator/participants, restart recovery, history, G2 compiler, and UI remain outside this snapshot.

### Binding clauses

- Hard Contract §3 invariants 4-6: primary lineage, typed override membership, and coherent component/variant/source/export/owner-anchor/channel/primary-property binding.
- Hard Contract §4: `AuthoringGraphV1` owns per-file source hashes.
- Hard Contract §8 steps 3-4: verify all source hashes and validate identities/references before mutation.
- Hard Contract §10: model ownership/lineage plus store hash/jail/relocation tests.
- Hard Contract §11 G1: graph/schema, runtime root registry, exact hashes, durable install, and full tests only.
- Architecture §4 and §4.1 rule 12: coherent typed `SourcePropertyRef` identity and lineage.
- Architecture §5.1.1: one portable store-relative path identity per file and jail checks before access.
- Architecture §5.2: exact-byte per-file hash preconditions.
- Architecture §6.1.1: `inheritedFromPropertyId` resolves the corresponding primary binding.
- Architecture §6.4: exclusive/no-follow, mode-safe, hash-verified, directory-synced install and tombstone uncertainty.
- Architecture §6.5: SourceAnchor fingerprints include the store-relative file identity.
- Architecture §10: ownership/lineage, jail/relocation, hash, and installer negative tests.

### Closed in this snapshot

1. **Owner anchor/export coherence: PASS.** `authoring-schema.ts:110-119` rejects an owner anchor whose export differs from `SourcePropertyRef.source.exportName`. The committed regression at `authoring-schema.test.ts:119-131` asserts the named error. The QA mismatch fixture now passes.
2. **Runtime jail: PASS for milestone scope.** Exact-target and ancestor symlinks refuse; missing in-root destinations resolve; the registry persists no absolute paths. This satisfies Hard Contract §§4/10 and Architecture §5.1.1 for the bounded snapshot.
3. **Durable installer: PASS for milestone scope.** Existing `0644` mode survives replacement; unsupported directory sync refuses before destination mutation; exact destination symlinks leave target bytes untouched; post-rename and tombstone sync failures remain named uncertainty with disk residue. This satisfies Hard Contract §8 installer requirements and Architecture §6.4, excluding later coordinator/recovery obligations.
4. **Git lifecycle: PASS for project-root scope.** Runtime `.onemo` paths are ignored while `authoring-v1.json` is unignored. Global-library repository rules remain a later two-root gate.

### Findings closed by milestone 1.2

1. **P1 — Typed primary-property lineage is not coherent.** A linked `inline-style/backgroundColor` property can set `inheritedFromPropertyId` to the Primary variant's `inline-style/color` property and validate successfully. `authoring-schema.ts:449-460` checks component and Primary ownership only, not corresponding binding identity. This violates Hard Contract §3 invariants 4-6 and §10; Architecture §4.1 rule 12, §6.1.1, and §10.

   Closure: milestone 1.2 rejects wrong kind and wrong semantic property. Its over-strict module-CSS path comparison is tracked separately above.

2. **P1 — Referenced source files need no graph hash.** A valid component and `SourcePropertyRef` remain accepted with `sourceHashes: {}`. `validateHashMap` validates entries that exist but never proves coverage for referenced source files. This removes graph-level drift evidence required by Hard Contract §§4/8/10/11 and Architecture §§4/5.2/10.

   Closure: milestone 1.2 covers component TSX sources. CSS and instance coverage remain active findings above.

3. **P2 — Dot-segment aliases create duplicate physical-file identities.** `isStoreRelativePath` at `authoring-schema.ts:30-35` accepts `src/./Button.tsx`, while runtime resolution normalizes it to the same file as `src/Button.tsx`. The graph can therefore carry two hash keys for one file and produce different anchor fingerprints for the same source. This violates the single portable identity implied by Hard Contract §4 and Architecture §§5.1.1/5.2/6.5.

   Closure: milestone 1.2 rejects `.` path segments in the shared predicate.

### Verification

- Full read: both changed files, `957/957` lines.
- Commit diff check: clean.
- Committed schema suite before QA probes: `12/12`.
- QA probe result: owner-anchor mismatch rejected; lineage mismatch, missing hash coverage, and dot alias accepted.
- Prior milestone foundation at `fb4ee16`: focused `19/19`, authoring backend `60/60`, full repo `266 passed / 10 skipped`, typecheck clean, changed-file ESLint clean.
- Milestone 1.1 Engineer baseline: full repo `267 passed / 10 skipped`, typecheck and changed-file ESLint clean; not reused as proof for the adversarial findings.

## Milestone 1

Exact SHA: `fb4ee1603c7bdd61e2c8664dd776a88b01be9c64`

Verdict: **REWORK, superseded by milestones 1.1 and 1.2.** Jail, installer, project Git lifecycle, and broad entity validation passed. Owner-anchor/export incoherence plus the milestone 1.1 findings blocked the schema gate.

## Self-Validation And Deslop

- Exact SHA, clause list, test counts, and scope exclusions rechecked before delivery.
- Findings are behavior-distinct; closed earlier issues remain historical and are not presented as current blockers.
- Combined G1 QA PASS remains exact next `9e9adf4` + library `0af96bd6`. Current live G2 binding files are Hard Contract `5893dced...` plus Architecture `a0efb7a5...`; their operative laws, reload scope, manifest, and amended historical-authority wording agree. Exact code `8d64fd3` functionally passes the required browser flow, but the fresh final-triad gate is REWORK for the active inventory/read contract and stale binding status/handoff truth. This is not final Meta, Dan sign-off, or Done.
- One rolling gate record is used instead of one artifact per snapshot. No superseded evidence was deleted.
- `/o-deslop --sweep` disposition: the live inventory boundary is `FIX/COLLAPSE`; binding status/handoff prose is `ARCHIVE/REFRESH`; unreachable legacy component direct-write branches are `KEEP-FLAGGED/KILL` after a reviewed list; component shell orchestration is `EXTRACT`; isolated-port E2E authority is `FIX`; stale comments/phase labels are `KILL/UPDATE`; the transferred temporary gate ledger is `KILL`. No broader archive, move, or code deletion was performed.
