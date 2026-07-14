# S58 G1+G2 corrected-model consolidated QA

**Verdict: REWORK. G1 and G2 are both reopened.**

The implementation at `dd4010a` is not a sound implementation of the passed architecture or Hard Contract v0. The visible G2 gestures sit on top of a materially incomplete G1 transaction/identity foundation and a hybrid legacy authoring model.

No product fixes were made in this audit.

## Audit coverage

- QA day transcript: `2,090/2,090` lines.
- Source architecture: `636/636` lines.
- Hard contract: `468/468` lines.
- Engineer corrected-model self-audit: `297/297` lines.
- Complete implementation diff: all `28/28` files in `804ffe7..dd4010a` read in full.
- Immediate parent-shell component edit/remount/navigation callers read.
- Full repository suite rerun: `44` files passed, `1` skipped; `258` tests passed, `10` skipped.
- `npm run typecheck`: passed.
- Temporary higher-model adversarial suite: `10/10` probes reproduced the defects below; the temporary test was removed afterward.
- Dev route at pinned `dd4010a` loaded successfully on `127.0.0.1:3042`; the gesture sequence was stopped before mutation on Lead instruction because source-level blockers already reopened G1/G2.

Green tests and typecheck are therefore real but insufficient. Several committed tests encode the wrong contract.

## Consolidated findings

### P0-1: The canonical free-variant model was not built

Evidence:

- `authoring-compiler.ts:90-125` reconstructs the canonical variant set from the first string-literal union axis.
- `authoring-compiler.ts:166-190` creates a variant by appending a union member.
- `authoring-compiler.ts:216-230` injects a `variant` prop into prop-free components.
- `components-canvas/page.tsx:513` renders each frame by passing its display label through that one axis prop.

Impact:

- The rejected union-axis compatibility representation remains canonical.
- Free frames do not have independent stable source/property bindings.
- The graph is subordinate to SourceProjection labels rather than authoritative identity.

Required remediation:

- Define and implement the native-v1 source representation for free frames and stable bindings.
- Keep union-axis projection as legacy import/compatibility only.
- Prove source-owned per-variant semantics and untouched-source stability with round-trip fixtures.

### P0-2: Rename destroys stable variant identity

Evidence:

- `authoring-compiler.ts:129-137` includes the display value in `variantIdFor`.
- `authoring-compiler.ts:103-125` recreates/deletes variant records after reparse.
- `authoring-compiler.test.ts:47-70` explicitly expects old identity removal.
- The adversarial probe confirmed `Secondary -> Danger` changes the ID and deletes the old record.

Impact:

- Geometry, edges, instances, property ownership, and lineage cannot survive rename.
- Future G3/G4 references will fail schema validation or disappear.

Required remediation:

- Address rename by stable `variantId`; update alias/source bindings only.
- Add tests proving IDs and every referencing entity survive rename unchanged.

### P0-3: Source is installed before transaction prepare

Evidence:

- `authoring-session.ts:115-124` writes staged source bytes to the real filesystem.
- The transaction is created only at `authoring-session.ts:125-135`.
- Revision validation occurs later in `authoring-transaction.ts:39-48`.

Impact:

- Process death between source install and prepare leaves changed source with no recoverable transaction.
- A stale revision can be discovered after source mutation.

Required remediation:

- Move source installation inside the locked transaction.
- Required order: lock -> read/verify -> compile/stage -> persist blobs and prepared decision -> install source/sidecar -> verify -> commit decision.
- Add subprocess-kill tests at every boundary.

### P0-4: Restart recovery is not recoverable and can publish a false rollback

Evidence:

- `authoring-transaction.ts:9-19` persists only revision and sidecar hashes, not command/source preimages/after-images/inverse.
- `executeSingleRootRecovery` requires in-memory `preimages` from its caller.
- Without a supplied preimage, `rollbackPrepared` writes `rolled-back` without restoring the sidecar.
- The committed recovery test supplies the preimage from test memory.
- The adversarial fsync probe left sidecar revision `1` installed while participant status became `rolled-back`.

Impact:

- Real restart cannot restore source or sidecar from disk evidence.
- Recovery metadata can contradict installed state.

Required remediation:

- Persist complete participant/coordinator records and content-addressed preimage/after-image blobs before mutation.
- Make recovery decide solely from durable disk evidence and verify restored/finished hashes.

### P0-5: No cross-process lock; stale revision commits race

Evidence:

- No lock exists in store, transaction, session, or history.
- A deterministic two-store barrier probe forced both transactions to read revision `0`; both successfully committed expected revision `0`.
- History append is unlocked read-whole-file plus replace.

Impact:

- Concurrent commands can both succeed, overwrite graph/history, and lose updates.

Required remediation:

- Add canonical cross-process store/root locks before any reads or writes.
- Recheck revision/hashes while holding the lock.
- Put history writes inside the same durable transaction.

### P1-6: Exact-file symlinks escape the runtime jail

Evidence:

- `runtime-root-registry.ts:42-53` realpaths only the nearest existing containing directory, not the target file.
- The adversarial probe placed `src/Link.tsx` as a symlink to an outside file; resolution passed and `fs.readFile` returned outside-root bytes.

Impact:

- Hash/projection/history reads can escape the registered source root.

Required remediation:

- For existing targets, realpath the complete target and enforce containment.
- For writes, use `lstat`/no-follow policy and reject symlink targets/ancestors before staging and install.
- Add exact-file and ancestor-symlink refusal tests.

### P1-7: Durable installer changes permissions and reports failure after mutation

Evidence:

- `durable-file-installer.ts:35` always creates temp files with mode `0600`.
- Rename preserves that mode; adversarial replacement changed a `0644` source file to `0600`.
- Directory fsync happens after rename; failure throws after destination mutation.
- The existing fsync test checks only the error, not installed bytes/mode/recovery.
- No startup capability probe, full failure matrix, or subprocess-kill test exists.

Required remediation:

- Preserve intended/existing mode.
- Probe required durability capabilities before accepting writes.
- Treat post-rename uncertainty through the prepared recovery protocol.
- Test destination bytes/mode at every failure boundary and tombstone cleanup/restore.

### P1-8: Hash preconditions are bypassable and route validation is partial

Evidence:

- Session checks only truthiness of `expectedSourceHashes`; `{}` satisfies the requirement.
- The adversarial probe hand-edited source, sent `{}`, and the semantic command committed over the drift.
- `editor-authoring/route.ts:25-47` casts partial input; expected hashes and strict keys are not validated.
- Move accepts unchecked file/variant ownership and unbounded geometry.
- No committed route test exists.

Required remediation:

- Require the exact touched-file set and valid SHA-256 for every source-mutating command/undo.
- Add exhaustive discriminated runtime command schemas, strict keys, command IDs, relative paths, finite geometry, and file/component/variant ownership checks.
- Add dev-only, malformed input, 409/422, and transaction route tests.

### P1-9: Compiler proof is parse-only and can miss runtime corruption

Evidence:

- `authoring-compiler.ts:281-287` runs parse diagnostics only.
- `semanticAssertions` are descriptive strings and are never executed.
- `source-projection.ts:82-147` duplicates the real parser but hardcodes `rules: []`, `structure: null`, and `connectors: []`.
- No CSS is staged/reparsed.
- `assertNoUnsupportedRenameReferences` skips nested function-like bodies; an adversarial nested helper kept `variant === 'Secondary'` while the union was renamed to `Danger`.

Required remediation:

- Use one strict full SourceProjection over staged TSX/CSS.
- Run real type-aware and command-specific semantic assertions.
- Compare the complete supported before/after projection, including nested runtime references and untouched CSS/structure/connectors.

### P1-10: G2 is a hybrid legacy second-canvas implementation, not the specified one-canvas slice

Evidence:

- `components-canvas/page.tsx` remains the 707-line legacy “SECOND canvas” monolith.
- Parent `react-figma/page.tsx:4082-4083` still keys/swaps the iframe route, forcing remount.
- Parent fixed host and old Base/axis/state controls remain.
- Parent `page.tsx:2384-2400` still auto-promotes source on edit navigation.
- On authoring failure, `components-canvas/page.tsx:659` renders legacy `NodeLayer` wired to `/api/dev/editor-write` alongside the error.
- The new breadcrumb is static `Components / Name`; the backend “Home” test is two API calls, not UI navigation.

Impact:

- Old and replacement models coexist conditionally.
- Failure can route users back into the rejected direct-writer architecture.

Required remediation:

- Implement authoring within the persistent main canvas and remove keyed second-board remount/fixed host.
- Remove navigation-triggered mutation.
- On graph-authoring failure, refuse cleanly; never activate legacy writers.
- Add real Home/context restoration and browser E2E.

### P1-11: Runtime graph validation is materially incomplete

Evidence:

- `authoring-schema.ts` validates selected references but not variant geometry/name/kind/transition, component compatibility/folder membership, interaction trigger/repeat/delay/ownership, override disposition, or folder shape/cycles.
- The adversarial graph with invalid enums, strings as geometry, negative sizes, invalid transition, and malformed folder passed validation.

Required remediation:

- Implement exhaustive entity schemas and cross-entity invariants.
- Add negative fixtures for every entity field and reference law.

### P1-12: Migration claims completion while dropping variants

Evidence:

- `importProjectionToAuthoringGraph` creates only one Primary variant for a single-axis projection.
- The adversarial projection containing `Primary | Secondary` returned `imported` with only `Primary` persisted.
- Existing migration test checks deterministic equality/component compatibility, not preservation of all values.

Required remediation:

- Import every axis value with deterministic stable bootstrap IDs and correct primary/linked lineage, or refuse until equivalence can be proven.
- Add full projection -> graph -> source -> projection equivalence tests.

### P1-13: Persistent history is incomplete

Evidence:

- Journal append is unlocked read-whole-file plus atomic replace.
- Only latest undoable command exists; redo lineage, drift conflict, pruning references, and restart concurrency are absent.
- The only history unit test covers one blob and one journal string.

Required remediation:

- Make history part of the locked transaction.
- Implement revision/hash-bound undo and redo lineage, restart conflicts, and reference-safe retention/pruning.

### P2-14: SourceAnchor silently under-models real TSX

Evidence:

- Non-literal key expressions use raw source text, making identity formatting-sensitive.
- Traversal covers only direct JSX element children, not fragments/expression-contained structure.
- First returned JSX wins; an adversarial early-return component produced anchors only for the first branch.
- Required move/export/keyed/control-flow fixtures are absent.

Required remediation:

- Explicitly support or refuse control-flow/fragment/dynamic-key shapes; never silently produce partial identity.
- Use only actual key literals in fingerprint inputs.
- Add every Architecture §7.1 fixture and update anchors atomically with compiler transactions.

### P2-15: Repository lifecycle and completion tests are missing

Evidence:

- No `.onemo` runtime/history/transaction/stage ignore rules were added while keeping `authoring-v1.json` tracked.
- Missing required committed surfaces include authoring model coverage, route tests, and real browser E2E.
- Gesture tests inspect helper outputs/source strings; group/token tests inspect source strings rather than rendered behavior/computed style.

Required remediation:

- Add scoped Git ignore/negation rules and two-repo cleanliness tests.
- Replace cosmetic completion claims with rendered browser, route, crash/recovery, and full model tests.

## Engineer reconciliation

All `11/11` Engineer self-audit findings are independently confirmed.

Additional QA-specific reproductions:

1. exact-file symlink jail escape;
2. empty hash-map drift bypass;
3. nested-helper rename corruption;
4. first-sidecar fsync false rollback;
5. deterministic double commit at revision 0;
6. legacy writer fallback on authoring failure;
7. single-axis migration dropping non-primary variants;
8. multi-return anchor partial extraction.

There is no material disagreement between the independent audits.

## Required rework order

1. Freeze `dd4010a`; do not start G3.
2. Rebuild G1 transaction truth first: exhaustive schema, jailed no-follow paths, mode-safe installer, locks, durable prepared evidence, restart recovery, history, and Git lifecycle.
3. Re-gate G1 with adversarial crash/concurrency/relocation tests from disk-only evidence.
4. Rebuild G2 on stable label-independent free-variant identity and one strict staged SourceProjection/compiler path.
5. Replace the hybrid second-canvas/fallback path with the actual persistent one-canvas UI slice.
6. Re-gate G2 with real browser create/rename/drag/Home/reload/undo plus identity/hash/source-byte/console evidence.

No piecemeal UI polish should precede items 2-4. The current gesture implementation may be reusable only after the foundation and canvas ownership are corrected.

## Final gate

**REWORK.** This is not slop in the sense of being random code: there are useful parser, graph-shape, source-anchor, gesture, and test primitives. But the execution is structurally incomplete and in several places tests certify the wrong architecture. It is not a safe engine/foundation yet.
