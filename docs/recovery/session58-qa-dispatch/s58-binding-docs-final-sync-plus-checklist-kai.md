# S58 — Binding-doc final sync + consolidated dirty-WIP rework checklist

[Kai] [DIRECTIVE]

## 1. Binding-doc hash sync (do this first — you are both currently gating against stale hashes)

Both binding docs are now internally consistent and finalized:

- **Hard Contract**: `__qa-dispatch/s58-framer-component-authoring-HARD-CONTRACT-v0.md` — **470 lines**, SHA-256 `3ff8ae26ee5eb19f53bb4babfea2c6e73f1aae7c6145aaad3e985e4c0fa9e2e1`
- **Architecture**: `__qa-dispatch/s58-framer-source-architecture-codex.md` — **672 lines**, SHA-256 `513d352ea55112e2717a830c585e98eeb91549ed14214f242433c680a89c0cab`

What changed since the last hashes you had:
- Architecture §4 canonical `AuthoringGraphV1` type: `schemaVersion` bumped `1` → `2`, `environmentFingerprint: Sha256` added to the graph type.
- Architecture §4 canonical `ComponentDefinition` type: `projectionFingerprint: Sha256` added (this field was already required by §6.2 prose but missing from the canonical type block — pure doc-consistency fix, no new mechanism).
- HC §0 package-state manifest line re-pointed at Architecture's new line-count/hash (was stale, pointing at a pre-edit state).

**Gate against these two hashes going forward.** Do not accept or relay any hash pair older than this.

## 2. Consolidated DIRTY-WIP rework checklist — authoritative, supersedes prior fragmented relays

This is QA's own consolidated "five root rows, not duplicate symptoms" checklist, now expanded with two additional fingerprint-collision findings surfaced after the consolidation. Treat all of the following as the current open scope. **QA has explicitly stated the formal exact-SHA gate remains closed — do not commit any of this as gateable until each item below has its own regression fixture and independent re-verification.**

### (1) Real V1 historical-matrix gap
The accepted G1 tip `9e9adf4` has **no `environmentFingerprint` at all**. V1 snapshots prior to a commit QA references as "`006`" may have mixed `.next` ambient declaration hashes directly into `sourceHashes` (pre-split state). Current synthetic V1 test fixtures cover neither of these two real historical shapes. **Fix:** build fixtures from real git history covering (a) the no-`environmentFingerprint` case and (b) the pre-split ambient-hash case, not synthetic approximations.

### (2) Lock / ownership bugs
- (a) `loadSnapshot`'s auto-migration path recursively attempts to reacquire the store lock when a normal `SingleRootAuthoringTransaction.commit()` already holds it — reentrancy/deadlock risk. **QA has execution-proven this**: an isolated real-WIP probe created a valid empty schema-1 sidecar, called `commit()` at `expectedRevision: 0`, and got `ok:false, code AUTHORING_STORE_LOCKED` — the exact reentrant path (outer commit holds lease → `commitLocked` calls `loadSnapshot` → `loadSnapshot` launches migration transaction → second lease refuses). This is no longer theoretical; it's a confirmed live bug requiring a real fix and a committed regression test proving direct-commit-on-V1 succeeds without weakening exclusion.
- (b) The raw/legacy migration commit path (`commitLegacyMigration`) still bypasses `storeId`/root-kind validation before mutation — a real security/correctness gap allowing a mismatched-store sidecar to be migrated and committed under the wrong registered path. **Update:** QA has since confirmed the foreign-store load path itself now correctly refuses (`AUTHORING_MIGRATION_INPUT_INVALID`, zero transaction entries, sidecar preserved byte-identical) — but this closes only once the corresponding code+test are actually committed on the current branch. Verify the commit lands before treating this half as closed.

### (3) History migration correctness
The current per-record independent `Promise.all` approach falls back to *current* on-disk bytes for any file untouched by a given historical command — provably insufficient for a "move-then-later-rename" (or similar) multi-command history sequence, since an earlier command's preimage for an untouched-at-that-time file must reflect state *before* the later rename, not current disk. **Required:** reconstruct historical source state by replaying the validated journal sequentially in reverse from current bytes; prove semantic undo chains work end-to-end with a real multi-command fixture.

**Explicit retraction (already absorbed, do not re-relay as live):** QA's earlier claim that "the migration command itself blocks the user's semantic undo" is withdrawn — `ProjectAuthoringSession`'s `latestUndoableG2Command` filters via `parseG2VariantCommand(command) !== null`, so the schema-migration record is never selected as the latest undoable command and never blocks Command-Z.

### (4) Fingerprint determinism bugs — five distinct root causes (now seven with the two below), each needs its own fix + regression fixture, not one shared patch
- (a) **Native-variant-registry / destructured-prop array-order false-drift**: canonicalize sorts object keys but preserves array order, so semantically-identical reorderings of ID-keyed collections produce different hashes.
- (b) **CSS declaration-value formatting false-drift**: raw-text capture with no real CSS-value normalization (e.g. `rgb(255,255,255)` vs `rgb(255, 255, 255)`).
- (c) **`localeCompare`-based sort nondeterminism**: canonicalize's key-sorting is host-locale/ICU-dependent — a persisted cross-checkout SHA authority must not depend on process locale (projection keys can include user prop names and CSS custom-property keys, not just fixed ASCII field names). Requires explicit code-point/binary ordering, plus a non-ASCII/custom-property relocation fixture proving identical hashes under a changed locale.
- (d) **P0 non-finite-number hash collision** (execution-proven): a native-registry literal `1e999` (parses to `Infinity`) and a second source using literal `null` both serialize identically via `JSON.stringify` (non-finite → `null`), producing an **identical SHA** (`cfc1b7ff4d66ed3dad5d68aa038ae4bfcd051c4cae96075a1895679122d5a68d`) for two semantically-different projections. **Fix:** reject non-finite numeric literals in strict SourceProjection/native-registry parsing before fingerprint/typecheck; canonical serialization must fail closed on any non-JSON-safe value, never silently coerce. Commit regression fixtures for `1e999`, `-1e999` (if syntactically valid), NaN-like refusal, and null-distinction.
- (e) **P0 type-token-encoding collision** (execution-proven, newly surfaced): `normalizeTypeText` emits unescaped `kind:value` strings joined by a pipe delimiter. QA constructed two distinct valid prop types — a single literal `x|52:||11:y` and a union type `x | y` — whose token serialization is byte-identical; axes are both suppressed by native mode, and the **full projection fingerprints collide exactly** at `3290c42bdafa80491eb6598f35e228386fd8bffe23bbe72ee752826ccdf08d17`. This can bless real prop-type drift. **Fix:** serialize token tuples structurally (JSON canonical encoding or length-prefixing), never delimiter concatenation. Add this exact collision fixture plus escape/unicode cases. Note: the Infinity-encoding fix and code-point sort fix already in flight are directionally good but do **not** close this separate collision — it needs its own structural-encoding fix.
- (f) **Prop-default-expression formatting false-drift** (newly surfaced, distinct raw-text field from CSS): `ComponentModel.props.default` remains raw `getText()` — only `tsType` is normalized. QA's exact probe: an ordinary prop default object `{size:1}` versus the formatting-only-different `{ size: 1 }` produces identical component behavior/type/registry but **different full projection fingerprints** (`a2f0e50c...` vs `fc4c086b...`). **Fix:** canonicalize default expressions through a real TypeScript expression AST/printer, or a structural token-tuple encoding that is collision-safe (same discipline as (e)) — not raw text. Add object/array/numeric/string default-formatting fixtures plus true-default-value-drift fixtures (to prove the fix still distinguishes real changes, not just formatting).

## 3. Standing discipline reminder
QA's evidence ledger for all of this lives at `/tmp/s58-g2-projection-migration-preflight-qa.md`. QA has explicitly stated: **"Formal exact-SHA gate remains closed"** and **"DO NOT COMMIT AS GATEABLE YET."** Do not route anything from this checklist to Meta or imply Dan sign-off at any point — this stays open until every item above has its own fix + regression fixture, independently re-verified by both of you and by me directly against source (never trusting a summary).
