# KAI-10218 Builder ledger

## Authority and boundary

- Base snapshot: `de31f1e3b16d4f756e2d805b7040decef2cb1738`.
- Branch: `session62-task/KAI-10218-flow-history-fifo-tools`.
- Contract: authoritative 177-line SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 3.
- Preserve: sibling flow, `HistoryStack`, current prepare/bake generations, current UI/API, existing history semantics, exact node insertion/deletion/selection, and GrabCut behavior outside the named defects.
- Repair in place: atomic upload/restore, artwork invalidation, FIFO tools, settlement on every exit, one-point Paint, selected-node base rebasing, pointer cancel/leave.
- Exclude: replacement frameworks, UI work, GrabCut no-op/provider work, output-adapter work, and KAI-10219 build-ahead.

## Fresh-read queue

- Full-read current flow/history/shell/overlay/finish owners, immediate callers/callees, and existing tests.
- Reproduce each named failure before editing.
- State the smallest exact deletions/edits that cover the complete Increment-3 deliverable.

## Fresh read — flow owner

- `upload` invalidates detection and destroys every accepted ref, revokes the accepted URL, publishes the new URL, and only then awaits decode. Decode failure therefore cannot preserve the accepted artwork/history/derived state and leaves `urlRef` pointing at the failed/revoked URL.
- The tool queue is exactly one overwriteable `pendingToolRef`; every additional accepted gesture while busy replaces the preceding pending gesture. The existing recursive runner is the right owner; the slot must become a real FIFO, not a new scheduler.
- `restore` publishes mask/drawn/settings/blend/hasCut before `prepareAI`; prepare failure is swallowed and keeps the prior prepared object against the newly published snapshot. Restore must prepare local candidate state first, then publish all fields together or change nothing.
- History is pushed inside `acceptMask`, `editCommit`, and `clearAll`; upload never resets it. Exact first-cut behavior depends on `HistoryStack` cursor semantics and must be checked against the module/tests before editing.
- `fullBakeWaiters` are resolve-only callbacks drained only on a successful current full bake. Failure, cancellation, replacement, Clear, and unmount can leave callers pending until the outer timeout; bake busy/pending/timer state also lacks one central settlement boundary.
- One-point Paint passes through `swathMask`; whether it produces area is owned by the pure helper and remains to be proven there.
- Selected-node rebasing is not inside `nodeApply`; the flow accepts a caller-supplied `base`, commits the adjusted shape, then leaves the caller responsible for refreshing that base. The shell must be read before choosing the minimum fix.
- Existing flow/API and scheduler owners are sufficient. No replacement store/history/queue/scheduler abstraction is justified.

## Fresh read — history, shell, overlay, and pure helpers

- `HistoryStack` already gives the required first-snapshot semantics: one first-cut push lands at index 0 and is non-undoable; later pushes and Clear are undoable; Undo/Redo add nothing. Successful Upload only needs to replace the current stack with a fresh instance. No history rewrite is justified.
- Restore can remain on the existing stack: peek-by-moving with `undo()`/`redo()`, prepare the target locally, publish only on success, and reverse the cursor move on failure. No transaction class or second history owner is needed.
- `swathMask` begins a path and strokes one `moveTo` for a one-point gesture; Canvas produces no deposited area. It must explicitly paint one round brush disk. The shell also renders only `st.length > 1`, so a valid tap is invisible.
- The main canvas has pointer-up and pointer-leave settlement but no pointer-cancel owner. `EditorOverlay` likewise commits on pointer-up/leave but has no pointer-cancel owner. The existing `onUp`/`up` paths are the only settlement paths needed; no gesture framework is justified.
- The selected-node defect is exact: `nodeBaseRef` is captured by `selectNode`, while `onEditCommit` only delegates to the flow. After a committed node drag, the next radius/curve adjustment applies to stale pre-drag geometry. Rebase `nodeBaseRef` and the displayed measured adjustment in `onEditCommit`; preserve insertion/deletion/selection.
- `finish.ts` already provides the required local preparation functions. KAI-10218 does not justify output/compositor edits. Its URL-keyed preseg cache cannot serve a replacement, but it retained the old artwork canvases until another prepare; the flow now drops that existing cache on successful replacement and unmount only.

## Minimal diff before implementation

1. `flow.ts`: add one artwork-intent generation fence to the existing owners; make replacement publish only after local decode/canvas preparation; reset history only on successful publication; turn the one pending slot into one FIFO; make restore local-and-atomic; settle/clear tool jobs, bake timers/waiters, busy/status publication, and stale async preparation on replacement, Clear, and unmount.
2. `mask-tools/index.ts`: render a one-point Paint gesture as the same round brush area the UI promises.
3. `page.tsx`: render one-point Paint, route pointer cancel through the existing settlement action, and rebase the selected-node base after committed geometry.
4. `EditorOverlay.tsx`: route pointer cancel through the existing commit/settlement action.
5. Existing tests plus the smallest task-specific real-route oracle: prove atomic corrupt replacement, lossless ordered burst gestures, first-cut/Clear history, atomic failed restore, one-point Paint, node rebase, pointer settlement, and long-edit -> Clear -> Undo. Do not change production solely for testing.

Necessity — no unnecessary elements; every planned edit maps directly to a named Increment-3 defect and reuses an existing owner.

Sufficiency — the minimal diff covers the complete Increment-3 deliverable; KAI-10219 output and KAI-10220 GrabCut-provider work remain excluded.

## Red-to-green implementation proof

- Activated the three existing Increment-3 expected failures. They reproduced atomic-upload ordering, the one-slot queue, and one-point Paint/pointer-cancel gaps; all now pass.
- Successful Upload now publishes only a fully decoded local canvas, resets history, invalidates prior artwork work/cache/output, then revokes the old URL. Corrupt replacement leaves accepted cut/history/output intact; the real route reproduced exact before/after PNG SHA-256 `22c8b0b5e51fcdc869f913d558cfd1e482705fd83f06364c4837d50c9600d160`.
- One inline FIFO replaces the pending slot. The real route captured rapid Add -> Erase -> Add and observed all three terminal states once in capture order.
- Restore prepares locally, publishes atomically, and rolls back the history cursor on failure. The forced current-route failure kept Clear and left Undo available.
- One-point Paint, canvas and overlay pointer cancellation, selected-node Curve-after-drag rebasing, Detect/Paint/standalone-GrabCut snapshot zero, and long edit -> Clear -> Undo all pass in the fixed 1280x720 Chromium route.
- Focused Vitest: 15 passed, two later-increment expected failures. Typecheck, scoped ESLint, syntax, and diff hygiene pass.

## Fresh read — history, shell, overlay, finishing, and tool math

- `HistoryStack` already gives the required snapshot-zero rule: the first push lands at index 0 and `canUndo()` stays false; later accepted pushes, including Clear, become undoable. It only lacks a reset for successful replacement Upload.
- Undo/Redo currently move the history cursor before `restore`; atomic failure therefore needs cursor rollback as well as local-first restore publication. The existing opposite navigation operation can restore the cursor without adding a second history API.
- `swathMask` performs only `moveTo` plus `stroke`; one point deposits no pixels. The smallest correction is a round filled disk at the single point using the existing brush width.
- The canvas commits on pointer leave but has no pointer-cancel owner. `EditorOverlay` likewise has pointer-up/leave but no cancel/lost-capture settlement. The current `onUp`/`up` owners are sufficient; wire all termination events to them.
- `nodeBaseRef` is captured on selection only. A committed node/handle drag publishes new geometry through `onEditCommit` but does not update that base, so the next radius/curve operation can revert the drag. Rebase and remeasure in the existing commit callback; preserve insert/delete/selection.
- `finish.ts` owns the existing prepared/bake adapter and preseg cache. Increment 3 needs no output/compositor rewrite; stale prepared/bake publication is stopped in the flow generation and settlement owners.
- The existing fixed-route Playwright oracle is preservation evidence, not an adequate new-Increment flow oracle. Add one scoped Playwright journey using the already-installed package; do not add a test framework or production seam.

## Minimal diff

- Delete `pendingToolRef` and replace it in place with one FIFO array/drain loop.
- Add one artwork-generation token shared by upload, Clear, tool acceptance, restore, and async edit preparation.
- Add one bake/waiter settlement function used by replacement, Clear, failures, cancellation, and unmount.
- Add `HistoryStack.clear()`; reset only after a replacement has decoded/prepared locally and is ready to publish.
- Publish upload and restore candidates only after their local work succeeds; roll back Undo/Redo cursor movement on restore failure.
- Fill one single-point Paint disk; wire existing gesture termination handlers; rebase the selected-node base after committed drag geometry.
- Add focused history assertions plus one current-route flow/history/FIFO/tool journey. No new store, queue class, scheduler, gesture system, UI/API, detector, output adapter, or later-task code.

## Implementation and first proof

- Successful Upload now has a request generation, decodes and constructs its bounded working canvas locally, then invalidates prior work, publishes the new URL/canvas and cleared derived state/history, and only then revokes the old URL. Failed or superseded uploads revoke only their candidate URL and leave accepted state unchanged.
- One artwork generation guards Detect, queued tools, restore, edit re-prepare, Save, replacement, Clear, and unmount. The prior one-slot queue is deleted; one inline FIFO settles each captured Paint/GrabCut job in order and invalidates stale jobs on owner exit.
- Full-bake waiters now own resolve/reject/timeout and are drained on success, error, replacement, restore, Clear, preview cancellation, and unmount. Bake timer/pending/dragging state is settled by the same existing scheduler owner.
- Restore builds the candidate mask/prepared result locally, publishes them together only if the artwork generation is current, and rolls the HistoryStack cursor back on failure. Successful Upload replaces the stack, preserving snapshot-zero semantics without a parallel history owner.
- Single-point Paint deposits the exact round brush disk in the existing swath rasterizer and draws the same live disk. Existing canvas and overlay termination handlers now own cancel/lost-capture; node drag commit rebases the existing selected-node base and measurement.
- Targeted characterization is green: 14 pass, only KAI-10219/10220 remain expected failures. Typecheck, scoped lint, syntax and diff hygiene pass.
- Fixed-1280x720 real-route oracle passes: exact corrupt-replacement output preservation (`22c8b0…`), one-point Paint, Detect and standalone GrabCut snapshot-zero histories, FIFO terminal order add→erase→add, canvas and overlay pointer-cancel exactly once, node drag→zero-radius rebase, forced restore failure atomicity, long edit→Clear→Undo/Redo, and active/queued-tool invalidation on replacement. No browser console warnings/errors.

## Completion audit correction

- Full source/diff audit found one synchronous-ref leak: accepted masks, replacement, restore, and Clear changed React `hasCut` state without synchronously changing `hasCutRef`, so the next FIFO job in the same drain could observe the prior cut state. Replacement/restore also retained the prior outgrowth transition latch. The existing flow owner now updates those refs at the same publication boundary; no new state owner was added.
- This correction is required by the exact Increment-3 rules that FIFO jobs consume the preceding accepted result and new artwork receives no old derived state. All affected gates must rerun on these final bytes.
- Removed the final cumulative history-tick diagnostic from the oracle output: deliberately racing active/queued work against replacement can cancel after a different number of already-completed snapshots, while the asserted new stack is deterministically clean. The proof retains only deterministic asserted outputs.
- Necessity review cut one overreach: ordinary Clear no longer disposes the upload-owned preseg cache. Increment 2 owns release on artwork replacement/unmount; retaining it across same-artwork Clear avoids an unnecessary re-decode and preserves current performance.

## Final Builder audit

- Atomic replacement and artwork invalidation: `flow.ts:363-408`; corrupt replacement exact-output oracle `verify-cutout-v1-flow.mjs:70-79`.
- Single FIFO and stale-job fence: `flow.ts:243-284`, with accepted-result ref synchronization at `flow.ts:317-321`; ordered burst and replacement cancellation oracle `verify-cutout-v1-flow.mjs:81-99,198-210`.
- History reset/first-cut/Clear/Undo/Redo and atomic restore: `flow.ts:398-402,582-651`; unit semantics `cutout-v1-characterization.test.ts:182-193`; real-route proof `verify-cutout-v1-flow.mjs:60-66,149-196`.
- Waiter/timer/status/busy settlement: `flow.ts:132-149,167-199,633-671,675-698,717-732`; replacement, failed restore, Clear/Undo, and stale-job exits are exercised by the route oracle.
- One-point Paint and pointer settlement: `mask-tools/index.ts:75-103`, `page.tsx:129-148,408-410`, `EditorOverlay.tsx:128-132`; route oracle `verify-cutout-v1-flow.mjs:60-66,101-110,137-147`.
- Selected-node rebase: `page.tsx:253-260`; route oracle `verify-cutout-v1-flow.mjs:112-135`.
- Cache lifetime uses the existing owner only: `finish.ts:161-175`; release is called only by successful replacement and unmount.
- Static gates on final product bytes: TypeScript pass; scoped ESLint zero output; full Vitest 57 files/529 passed, two expected later-increment failures, ten skips; full ESLint zero errors/404 pre-existing warnings; Next 16.2.12 production build pass with 22 pages and `/cutout-lab` static; `git diff --check` pass.
- Browser gates on final product bytes: preservation exact PNGs `d7a28a…` and `55e6178…`; Chromium/WebKit detector chain u2netp → Silueta; new flow oracle exact corrupt-output SHA `22c8b0…` and terminal order Add → Erase → Add.
- Visual gate: port 3217 is served by the exact worktree (`next dev --webpack --port 3217`, baseline HEAD `de31f1e3` plus the audited diff). The real route completed the full flow oracle; the captured final replacement visibly shows new artwork with Save/Undo/Clear disabled and `image ready`, proving no old cut/history/status/output survived. Evidence: `_WIP/context/builder-space/evidence/KAI-10218/final-clean-replacement.png`, SHA-256 `f888fce51cf564cbe9ef2f218e9fa5a7caba9883aa1428cd537290f8c319aee1`.

Necessity — no unnecessary elements. The completion review removed same-artwork Clear cache disposal and the nondeterministic diagnostic field; every remaining product/test line maps to an Increment-3 defect or its required proof.

Sufficiency — delivers Increment 3 in full. No KAI-10219 output work, KAI-10220 GrabCut-provider work, UI redesign, new framework, route relocation, or effects-engine edit is present.

## Snapshot

- Commit and remote rollback snapshot: `0b747d813e62f0ce77b7f2b3f9a93e213a7741a7`.
- Branch: `session62-task/KAI-10218-flow-history-fifo-tools`.
- Local/remote equality verified; tracked tree clean; `_WIP/` excluded from the commit.
