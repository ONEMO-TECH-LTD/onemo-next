# S58 G1+G2 corrected-model self-audit — Codex Builder

**Verdict: REWORK.** The implementation at `dd4010a` does not satisfy the passed source architecture or Hard Contract v0. Green unit/type checks from the earlier run are insufficient and are not reused as proof here.

**Audit mode:** read-only. No product edits, G3 work, or fixes were made.

**Diff audited:** `804ffe7..dd4010a` in branch `session58-task/s58-framer-architecture`.

## Full-read coverage

- Builder day transcript: `2,047/2,047` lines.
- `s58-framer-source-architecture-codex.md`: `636/636` lines.
- `s58-framer-component-authoring-HARD-CONTRACT-v0.md`: `468/468` lines.
- Complete implementation surface: all `28/28` files in `git diff --name-status 804ffe7..dd4010a`, `4,164` insertions / `32` deletions.
- Immediate dependencies/callers additionally inspected: relevant `editor/lib.ts` jail, `ComponentModel`, and parser blocks; parent `react-figma/page.tsx` edit-entry, host/remount, and history blocks; full `.gitignore`.

## Blocking findings

### 1. Variant rename destroys stable identity; the test explicitly approves the contract violation

Evidence:

- `src/app/api/dev/editor/authoring-compiler.ts:129-137` derives `variantId` from axis **and display value**.
- `authoring-compiler.ts:103-125` recreates variants from projected union values and deletes IDs absent after reparse.
- `src/app/api/dev/editor/__tests__/authoring-compiler.test.ts:47-70` explicitly expects rename to remove the old graph identity.

Impact:

- Renaming `Secondary` to `Danger` changes the canonical variant ID.
- Geometry, interaction targets, instance references, SourcePropertyRef ownership, and lineage can detach or disappear.
- This directly violates Hard Contract §3.1/§3.3: stable IDs are label-independent; display names are aliases.

Required fix:

- Rename must address one stable `variantId`, retain it, update only the display/source binding, and atomically rebind SourceRefs/anchors.
- Add round-trip tests proving geometry, edges, instances, property membership, and primary lineage retain the same IDs after rename.

### 2. G2 reintroduces the rejected union-axis model instead of canonical free variants

Evidence:

- `authoring-compiler.ts:90-125` treats the first union axis and its values as the complete canonical variant set.
- `authoring-compiler.ts:166-190` implements create by adding another string-literal union member.
- `authoring-compiler.ts:216-230` bootstraps a `variant` prop into an otherwise prop-free component.
- `components-canvas/page.tsx:513` renders every frame by passing `variant.displayName` through one axis prop.

Impact:

- The canonical graph remains a projection of union-axis labels, the architecture explicitly rejected authoring identity.
- A newly created frame does not acquire independently authored source-owned structure/property bindings; it merely expands a prop type.
- Free variant semantics are coerced into the legacy compatibility representation, contrary to Architecture §§3.3, 6.2 and Hard Contract §§2-5.

Required fix:

- Define the actual native-v1 source representation for free frames and stable source bindings.
- Keep legacy single-axis import as compatibility only.
- Compiler fixtures must prove source-owned per-variant semantics and untouched-source stability, not just union membership.

### 3. Source is installed before transaction prepare; crash consistency is therefore false

Evidence:

- `src/app/api/dev/editor/authoring-session.ts:115-124` writes every staged source patch to the real filesystem.
- Only afterward, at `authoring-session.ts:125-135`, does it create and commit `SingleRootAuthoringTransaction`.
- Revision validation occurs inside `authoring-transaction.ts:39-48`, after those source writes.
- Recovery is only same-process best-effort at `authoring-session.ts:151-155`.

Impact:

- A crash/kill between lines 123 and 125 leaves mutated source with no prepared record.
- A stale revision can be discovered only after source installation.
- This violates the mandatory order: verify -> compile/stage -> persist/fsync prepared record and blobs -> mutate real files.

Required fix:

- Move source installation inside one transaction coordinator.
- Acquire the cross-process lock first; validate revision/hashes; durably persist preimage/after-image blobs and prepared decision; then install source and sidecar; then publish committed decision.
- Add subprocess-kill tests at every boundary with byte-exact restart recovery.

### 4. Transaction/recovery records cannot recover real source state after restart

Evidence:

- `authoring-transaction.ts:9-19` records only revisions and sidecar hashes: no command, touched source hashes, source preimage/after-image refs, graph inverse, or durable coordinator decision.
- `authoring-transaction.ts:69-75` writes `prepared`, saves only the sidecar, then overwrites the same participant with `committed`.
- No cross-process lock exists.
- `authoring-transaction.ts:180-199` requires callers to supply preimages in memory during “restart” recovery.
- `authoring-transaction.ts:200-207` “finishes committed” by rewriting the same record; it verifies/restores no source or sidecar after-image.
- `authoring-transaction.test.ts:227-294` supplies the prepared graph preimage directly from test memory and checks status/revision only.

Impact:

- Actual process restart has no durable source preimage to restore.
- Committed recovery cannot finish or verify an interrupted install.
- The recovery tests are classification/status tests, not crash recovery proof.

Required fix:

- Persist the full participant/coordinator record specified by Architecture §§5.4/6.3.
- Recovery must discover all evidence from disk and resolve by durable coordinator decision; in-memory preimage injection cannot be the production contract.

### 5. DurableFileInstaller mutates the destination before reporting unsupported durability

Evidence:

- `durable-file-installer.ts:47-55` renames the temp over the destination, then performs directory fsync.
- If directory fsync fails, `durable-file-installer.ts:57-60` throws but does not restore the prior destination; the temp is already gone.
- `durable-file-installer.test.ts:53-64` asserts only that an error surfaces, not that bytes remain unchanged or recoverable.
- There is no startup capability probe, every-boundary failure matrix, tombstone cleanup/restore lifecycle, or subprocess-kill recovery test.
- Existing destination mode is not preserved; writes always create mode `0600` at line 35.

Impact:

- `DURABILITY_UNSUPPORTED` can be returned after a real mutation.
- The implementation does not meet the stated process/host-loss guarantee.

Required fix:

- Probe required capabilities before accepting writes.
- Preserve intended/existing mode.
- Make post-rename uncertainty transaction-recoverable via durable prepared evidence.
- Test every installer boundary, installed bytes after failures, tombstone cleanup, and subprocess termination without claiming physical power-loss simulation.

### 6. Runtime/recovery files are not Git-ignored

Evidence:

- `.gitignore:1-113` contains no `.onemo` rules.
- The diff adds no repository metadata rule despite Architecture §5.1.2 and the exact file map requiring tracked `authoring-v1.json` plus ignored history/transactions/stage/temp/blob/tombstone data.

Impact:

- Running the feature in the real checkout will expose recovery/history residue as untracked Git files.

Required fix:

- Add scoped ignore rules for runtime `.onemo` data with an explicit negation for tracked `authoring-v1.json`.
- Add cleanliness tests for success and injected failure. Apply the equivalent rule to the global repository when that store is implemented.

### 7. Compiler “semantic/type assertions” are labels, not assertions

Evidence:

- `authoring-compiler.ts:281-287` performs TypeScript **parse** diagnostics only.
- `authoring-compiler.ts:64-70`, `166-213` returns strings such as `create-variant:...` as `semanticAssertions`; they are never executed.
- `source-projection.ts:82-147` implements a second, reduced TSX parser that hardcodes `rules: []`, `structure: null`, and `connectors: []`.
- No CSS is staged or reparsed.

Impact:

- Type-validity and behavior are unproved.
- Untouched structure/CSS/connectors can be lost or ignored while round-trip tests remain green.
- This fails the G2 gate: staged TSX/CSS, type-aware assertions, strict full SourceProjection, and untouched-semantic proof.

Required fix:

- Use one strict projection/compiler path over staged filesystem bytes, including CSS and side channels.
- Run real type-aware fixtures/type checking and command-specific semantic assertions.
- Compare the full supported before/after projection, not only one union axis.

### 8. “Same canvas -> Home -> back” is not implemented; tests simulate it at the session API

Evidence:

- `components-canvas/page.tsx:1-6` still declares itself “The SECOND canvas”.
- Parent `react-figma/page.tsx:4082-4083` still keys and swaps to `/react-figma/components-canvas?...`, forcing remount.
- Parent `page.tsx:3505-3506` retains the fixed `1480 x 1040` component host.
- Parent `page.tsx:2384-2400` still mutates source by auto-promoting on edit navigation.
- The new breadcrumb at `components-canvas/page.tsx:448-454` is static `Components / <name>`, not the required actionable `Home > Component` canvas breadcrumb.
- `authoring-session.test.ts:69-86` calls `loadCanvas(null)` followed by `loadCanvas(file)`; it does not navigate the UI or prove preserved canvas context.

Impact:

- Three explicit replacement requirements remain intact: second-board remount, fixed host, and navigation-triggered mutation.
- The required G2 acceptance journey has no committed E2E/browser proof.

Required fix:

- Implement authoring inside the persistent main canvas and remove the keyed board swap/fixed host.
- Make Home breadcrumb real navigation with reload/context restoration.
- Remove auto-promotion from navigation.
- Add the required browser E2E and measured selection/ghost/breadcrumb assertions.

### 9. Schema and route validation are materially incomplete

Evidence:

- `authoring-schema.ts:133-259` checks selected reference existence but does not validate complete variant frame geometry, transition shapes/ranges, variant kind/compatibility enums, folder references/cycles, interaction enums/ranges/component ownership, override disposition rules, or SourcePropertyRef source/lineage consistency.
- `editor-authoring/route.ts:25-47` accepts a partial cast; commands have no `commandId` or revision vector.
- `route.ts:58-76` accepts extra fields and unchecked numeric geometry; expected hashes are not runtime-validated.
- No `src/app/api/dev/editor-authoring/route.test.ts` exists.

Impact:

- Malformed/untrusted input can enter compiler/store code despite the contract requiring runtime schemas and named status/error behavior.

Required fix:

- Add exhaustive discriminated runtime schemas and graph invariants.
- Require `commandId`, exact expected revision/hash contract, finite/bounded geometry, strict keys, and source-relative paths.
- Add malformed JSON/command, 409/422, dev-only, and one-command transaction route tests.

### 10. History is not the contracted persistent undo/redo model

Evidence:

- `authoring-history.ts:70-80` implements journal append as unlocked read-whole-file + replace, allowing concurrent lost updates.
- `authoring-history.ts:98-112` supports only latest undoable command; no redo lineage exists.
- No retained-reference pruning contract exists.
- `authoring-history.test.ts:11-32` tests one blob and one journal string only.

Impact:

- Redo, concurrency safety, drift lineage, restart conflict behavior, and pruning-reference guarantees are absent.

Required fix:

- Make history writes part of the locked durable transaction.
- Implement revision/hash-bound undo and redo lineage, restart/conflict tests, and reference-safe pruning.

### 11. SourceAnchor coverage remains narrower than the contract

Evidence:

- `source-anchor.ts:177-186` treats non-literal key expressions as raw source text, making identity formatting-sensitive despite the key-**literal** contract.
- `source-anchor.ts:139-158` walks only direct JSX element/self-closing children; fragments and JSX-expression-contained structural children are absent.
- `source-anchor.ts:219-233` selects the first returned JSX found rather than representing multiple component control-flow returns.
- Tests do not cover commanded anchor move/update, external structural move refusal, export rename transaction, or full keyed-sibling distinction.

Required fix:

- Define/refuse unsupported JSX/control-flow shapes explicitly.
- Use only actual key literals in fingerprint inputs.
- Add every required Architecture §7.1 adversarial fixture and update anchors atomically with compiler transactions.

## Test-quality verdict

Several tests are useful unit checks, but important ones are cosmetic or encode the wrong contract:

- `authoring-compiler.test.ts:47-70` approves identity destruction.
- `component-canvas-gestures.test.ts:63-73` checks source strings, not rendered gesture behavior.
- `component-canvas-groups.test.ts:30-38` checks absence/presence of CSS strings, not computed styles.
- `authoring-session.test.ts:69-86` labels two backend calls as Home navigation.
- Transaction recovery uses caller-supplied in-memory preimages.
- Installer fsync refusal does not assert destination state.
- Missing committed surfaces: `authoring-model.test.ts`, `editor-authoring/route.test.ts`, and `tests/e2e/react-figma-authoring.spec.ts`.

## Complexity/slop assessment

- `source-projection.ts` duplicates the established parser with a weaker staged parser, creating two definitions of projection truth.
- The new graph board is embedded inside the existing 707-line legacy second-canvas/node-system page, so both rejected and replacement authoring models coexist conditionally.
- UI/backend command and state types are duplicated instead of sharing the runtime schema.
- This complexity is not buying the required contract: stable identity, durable transaction ordering, strict projection, and same-canvas lifecycle remain absent.

## Commands rerun in this corrected-model audit

Executed:

```text
wc -l <transcript> <architecture> <hard-contract>
git status --short
git branch --show-current
git log -1 --oneline
git diff --name-status 804ffe7..dd4010a
git diff --stat 804ffe7..dd4010a
git diff --numstat 804ffe7..dd4010a
git diff --check 804ffe7..dd4010a
git log --oneline --reverse 804ffe7..dd4010a
```

Not rerun after the lead's quota-wrap instruction:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- dev server / Chrome E2E

This omission does not weaken the REWORK verdict: the blocking findings are direct source/contract contradictions, including wrong behavior explicitly asserted by existing tests. Earlier model-run PASSes were deliberately not reused.

## Agreement/disagreement with parallel QA

QA's corrected-model report had not been delivered into this lane when this artifact was written, so line-by-line agreement is **not yet reviewed**. Confirmed self-audit themes to compare immediately when QA lands:

1. unstable label-derived variant IDs;
2. source-before-prepare transaction ordering;
3. non-recoverable restart protocol;
4. parse-only compiler assertions;
5. second-canvas/fixed-remount G2 gap;
6. weak/cosmetic tests and missing route/E2E coverage.

Any QA disagreement on these rows should be resolved against the cited source and contract, not prior PASS status.

## Handoff

- Product worktree remains clean at `dd4010a`.
- Only this QA-dispatch audit artifact was added.
- No fixes should start until Lead reconciles this report with independent QA and issues a bounded rework order.
