# S58 Framer Source Architecture — Codex Architecture Owner

**Status:** WORKING ARCHITECTURE GATE — not product code, not QA/Meta/Dan approved, not sign-ready.

**Owner role:** source architecture, complementing Expert Framer evidence, Designer behavior/visual fidelity, and independent QA.

**Baseline:** committed `804ffe7` in isolated worktree:

`/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s58-framer-architecture`

Branch: `session58-task/s58-framer-architecture`.

Claude's `s58-figma-engine` worktree had unrelated uncommitted changes (`ERRORS.md`, `MotherV2.tsx`, new `Component.tsx`). They are excluded and untouched.

## 0. Authority and current gate

Later evidence wins over stale summaries:

- Live QA pane: authenticated Playwright D1-D12 completed; current verdict is **REWORK**.
- Binding QA inputs: `s58-framer-clone-adversarial-qa.md` sections 10-13 and `s58-framer-extraction-qa-ledger.md`.
- Current Linear KAI-9419 still says the engine is broadly reusable and Expert owns the spec. That is superseded by Dan's Codex architecture-owner directive plus authenticated QA.
- No product implementation begins until this architecture passes QA, Meta, and Dan.

## 1. Read coverage — exact checkpoint

Fully read:

- QA day transcript: 274/274 lines. Its tail was stale at the auth hold.
- Live `@s58-qa` pane: current authenticated-pass verdict and team dispatch read.
- `s58-framer-clone-adversarial-qa.md`: 731/731 lines.
- `s58-framer-extraction-qa-ledger.md`: 136/136 lines.
- `s58-framer-contract-input-expert.md`: 137/137 lines.
- `s58-team-contract-design-acceptance-designer.md`: 79/79 lines.
- `s58-framer-source-architecture-qa-verdict.md`: 122/122 lines.
- `src/app/(dev)/react-figma/page.tsx`: 4502/4502 lines.
- `src/app/(dev)/react-figma/components-canvas/page.tsx`: 407/407 lines.
- `src/app/(dev)/react-figma/engine.ts`: 485/485 lines.
- `src/app/api/dev/editor/lib.ts`: 2373/2373 lines.
- `src/app/api/dev/editor-write/route.ts`: 22/22 lines.
- `src/app/api/dev/editor-component-model/route.ts`: 20/20 lines.
- `src/app/api/dev/editor-components/route.ts`: 90/90 lines.
- `package.json`: 70/70 lines.
- `vitest.config.ts`: 23/23 lines.
- Test-convention exemplars:
  - `src/app/(dev)/effect-creator/v5.3.1/core/__tests__/transactions.test.ts`: 109/109 lines.
  - `src/app/api/upload-permission/route.test.ts`: 200/200 lines.

Mandatory architecture/source coverage is complete. No unresolved source read remains for this deliverable.

## 2. Source-backed architecture verdict

The current code is a mixed foundation:

- Strong, reusable source-safety and inspection primitives exist.
- The component authoring domain is structurally the rejected model.
- The replacement is not a rewrite of every source tool. It is a canonical graph plus guarded compiler/transaction boundary around selected low-level primitives.

The current editor cannot be made Framer-equivalent by re-skinning or extending enums. Stable free-variant identity, geometry, primary/override lineage, edge identity, folders, instance lifecycle, preview sessions, revisions, and atomic multi-file writes do not exist in the authoring contract.

## 3. Keep / Modify / Replace / Build audit

### 3.1 KEEP — proven primitives, behind new boundaries

1. **Path jailing and root resolution**
   - `editor/lib.ts:48-119` centralizes project/package path resolution, traversal refusal, CSS/component roots, and `.tsx` write jail.
   - Keep as the only path authority. Extend it for sidecar/journal paths with explicit store-root jails.

2. **CSS declaration resolution and byte-addressed edits**
   - `editor/lib.ts:23-45`, `171-265` provide `DeclRef`, shorthand ownership, PostCSS parsing, byte offsets, and fallback insertion.
   - Keep as low-level `SourcePatch` planning primitives.

3. **TSX/PostCSS parse guards and refusal discipline**
   - `editor/lib.ts:327-335` syntax-guards generated TSX.
   - Multiple operations validate shapes before write and use named 409/422 refusals.
   - Keep, but add semantic/type fixtures because syntax parsing alone cannot catch TS2300/TS2322/TS17001.

4. **Style read bridge and cascade provenance**
   - `react-figma/engine.ts:1-385` reads computed/declared styles, handles cascade specificity, preserves `var()` text, maps shorthand slots, and builds the runtime layer tree.
   - Keep for SourceProjection/selection inspection.

5. **Ephemeral override staging**
   - `engine.ts:389-452` is a valid zero-disk preview mechanism.
   - Keep only as transient preview state; it is not persistence or authoring undo.

6. **Low-level lifecycle primitives with corrected names**
   - `make-component`: selection-to-component conversion (`page.tsx:3172-3182`; union at `editor/lib.ts:291`).
   - `create-component`: blank component scaffold (`page.tsx:2476-2485`; union at `editor/lib.ts:295`).
   - `insert-component`: inserts a component instance into selected JSX (`page.tsx:3143-3152`; union at `editor/lib.ts:294`).
   - Keep only as compiler primitives after they return plans or write into a staged filesystem.

7. **Error isolation concept**
   - `components-canvas/page.tsx:276-285` isolates component render failures with `FrameBoundary`.
   - Preserve this behavior in the new canvas/preview surfaces.

### 3.2 MODIFY — valuable seams with wrong responsibility or insufficient contract

1. **`ComponentModel` -> `SourceProjection`**
   - Current `ComponentModel` at `editor/lib.ts:1261-1280` is source-derived union axes/rules/structure/connectors.
   - Rename/reframe it as projection of what TSX/CSS currently encode. It must not be editor identity.

2. **Current parser/writers -> staged compiler primitives**
   - Current functions call `fs.writeFile` directly, including multi-file operations such as promotion (`editor/lib.ts:466-574`) and CSS/TSX prop bridging (`editor/lib.ts:854-966`).
   - `rename-component` validates all proposed TSX first, then sequentially writes every consumer, writes the renamed component, and removes the old file (`editor/lib.ts:1795-1875`). Validation prevents known-bad output, but an I/O failure can still leave a partial rename.
   - `create-component` writes a global component before regenerating its barrel (`editor/lib.ts:2080-2105`), and `make-component` writes its new file before its source replacement (`editor/lib.ts:2107-2203`). Both retain a half-commit window.
   - The global promise queue (`editor/lib.ts:2294-2301`) prevents concurrent lost updates only inside one process. It is not a transaction, durable lock, crash-recovery protocol, or cross-process exclusion mechanism.
   - Change them to operate through a `StagedFileSystem`/patch plan. No authoring command may partially write real files.

3. **`engine.ts` runtime IDs**
   - `ensureId` at `engine.ts:151-157` mints DOM-only `data-eng-id` values.
   - Keep for runtime selection. Add graph IDs separately; never persist DOM IDs as component/variant/instance identity.

4. **Inventory**
   - `page.tsx:2240-2263` and component board grouping use root/category/name/file/export. The route recursively walks both roots and derives category from source path (`editor-components/route.ts:33-80`).
   - `axesOf` silently turns any projection/parser failure into an empty axis list (`editor-components/route.ts:22-25`). That is acceptable for a defensive gallery, but forbidden for migration/compatibility classification because parse failure must become explicit `unsupported`, not indistinguishable from a component with no variants.
   - Modify to join SourceProjection with sidecar `AssetFolder` metadata and stable component IDs. Folder moves must not rename source paths.

5. **Preview/authoring iframe use**
   - Iframes are not the defect. Framer evidence confirms persistent `canvas-iframe` plus separate `preview-iframe`.
   - Modify navigation so one authoring canvas persists; build a separate compiled preview lifecycle.

6. **Write transport**
   - `page.tsx:2388-2400` has a partial `engineWrite` helper, while many later handlers call `/api/dev/editor-write` directly.
   - New component authoring UI uses one `useAuthoringGraph` command client. Low-level editor writes remain separate for non-component editing.

7. **Global/project root support**
   - Current source edits both app and package roots and already splits history roots (`page.tsx:2272-2282`, `3308-3361`).
   - Authoring persistence/transactions must use explicit root-aware IDs, deterministic multi-root lock ordering, and per-root revisions/hashes.

8. **Dev route shells**
   - `editor-write/route.ts:8-21` is a thin unvalidated JSON cast into `applyWrite`; retain only for legacy low-level writes and preserve its dev-only/error behavior.
   - `editor-component-model/route.ts:8-19` directly returns `parseComponentModel`; rename its response contract to SourceProjection before new authoring consumers depend on it.
   - New authoring commands require runtime schema validation at the route boundary; TypeScript casts are not input validation.

### 3.3 REPLACE — rejected authoring architecture

1. **Union-axis authoring identity**
   - `page.tsx:2333-2341` defines `EditModel.variantAxes` and fixed states.
   - `editor/lib.ts:275-281` exposes axis/state/switch operations.
   - `editor/lib.ts:725-871` mints/extends union props as variants.
   - Replace as primary authoring model. Preserve as legacy SourceProjection/compiler compatibility only.

2. **Fixed state vocabulary as authored frames**
   - `components-canvas/page.tsx:36-45` injects six ghost states.
   - `page.tsx:4016-4022` hardcodes the same state chips.
   - Replace with graph-owned free frames plus verified state-creation behavior. Do not fabricate New Event.

3. **Narrow connector model**
   - `editor/lib.ts:280-281` has state/switch modes and four triggers.
   - `components-canvas/page.tsx:134-137` hardcodes axis wire creation to tap/cycle.
   - `components-canvas/page.tsx:52-167` has no stable edge ID and removes by mode/axis.
   - Replace with stable interaction identities, override lineage, observed trigger/action/transition contracts, and explicit unsupported cases.

4. **Fixed component board/remount**
   - `page.tsx:3501-3502` fixes component host to 1480x1040.
   - `page.tsx:4093-4094` keys/swaps to `/react-figma/components-canvas`.
   - `components-canvas/page.tsx:345-407` renders inventory categories, flex rows, axes, then ghosts.
   - Retire this route after the one-canvas slice. Do not evolve it into another graph monolith.

5. **Navigation-triggered source mutation**
   - `page.tsx:2391-2408` auto-runs `promote-element` when entering edit mode.
   - Replace with explicit authoring command. Navigation is read-only.

6. **UI-local undo as authoring history**
   - `page.tsx:3503-3557` only tracks staged overrides and frame preset.
   - Replace for component authoring with revisioned transaction undo/redo. Keep local staging history for non-committed inspector previews.

7. **Generic nonexistent lifecycle labels**
   - There are no source operations for folder CRUD, detach, replace, replace-all, or go-to-main.
   - They must be new commands or navigation behavior, not renamed existing ops.

### 3.4 BUILD — new bounded architecture

1. `AuthoringGraphV1` schema and runtime validator.
2. Root-aware sidecar repositories and schema migration.
3. `SourceProjection` parser facade over current component parsing.
4. Pure `AuthoringCommand -> GraphPatch + SourceIntent` reducer.
5. `CompilerAdapter` producing staged source patches and round-trip assertions.
6. Multi-file/multi-root `AuthoringTransaction` with revision/hash preconditions, prepare journal, byte preimages, commit, rollback, and recovery.
7. Persistent transaction history supporting undo/redo after reload.
8. One persistent component-authoring canvas and separate compiled preview surface.
9. Folder metadata and instance lifecycle commands with referential guards.
10. Model/compiler/transaction/migration/route/E2E tests before broad UI work.

## 4. Canonical model — corrected hard contract

```ts
type StoreId = string
type EntityId = string
type PropertyId = string
type Sha256 = string

type AuthoringGraphV1 = {
  schemaVersion: 2
  storeId: StoreId
  revision: number
  root: { kind: 'project' | 'global' }
  sourceHashes: Record<string, Sha256>
  environmentFingerprint: Sha256
  components: Record<EntityId, ComponentDefinition>
  variants: Record<EntityId, VariantFrame>
  sourceProperties: Record<PropertyId, SourcePropertyRef>
  interactions: Record<EntityId, InteractionEdge>
  interactionOverrides: Record<EntityId, InteractionOverride>
  instances: Record<EntityId, ComponentInstance>
  folders: Record<EntityId, AssetFolder>
}

type SourceRef = {
  storeId: StoreId
  file: string
  exportName: string
}

type SourcePropertyRef = {
  id: PropertyId
  componentId: EntityId
  variantId: EntityId
  source: SourceRef
  ownerAnchor: SourceAnchor
  inheritedFromPropertyId: PropertyId | null
  binding:
    | { kind: 'jsx-prop'; propName: string }
    | { kind: 'inline-style'; property: string }
    | { kind: 'module-css'; stylesheet: { storeId: StoreId; file: string }; localClass: string; property: string }
    | { kind: 'text-content' }
}

type ComponentDefinition = {
  id: EntityId
  displayName: string
  source: SourceRef
  primaryVariantId: EntityId
  folderId: EntityId | null
  compatibility: 'native-v1' | 'legacy-single-axis' | 'legacy-multi-axis' | 'unsupported'
  projectionFingerprint: Sha256
}

type VariantFrame = {
  id: EntityId
  componentId: EntityId
  displayName: string
  frame: { x: number; y: number; width: number; height: number }
  inheritance:
    | { kind: 'primary' }
    | { kind: 'linked'; primaryVariantId: EntityId; overridePropertyIds: PropertyId[] }
    | { kind: 'detached' }
  kind: 'primary' | 'custom' | 'hover' | 'pressed'
  transition: TransitionSpec
}

type TransitionSpec =
  | { kind: 'instant'; delayMs: number }
  | { kind: 'ease'; durationMs: number; easing: string; delayMs: number }
  | { kind: 'spring-time'; durationMs: number; bounce: number; delayMs: number }
  | { kind: 'spring-physics'; stiffness: number; damping: number; mass: number; delayMs: number }

type InteractionEdge = {
  id: EntityId
  componentId: EntityId
  sourceVariantId: EntityId
  trigger: 'click' | 'click-start' | 'appear' | 'mouse-enter' | 'mouse-leave'
  action: { kind: 'set-variant'; targetVariantId: EntityId }
  repeat: 'once' | 'cycle'
  delayMs: number
  inheritedFromEdgeId: EntityId | null
}

type InteractionOverride = {
  id: EntityId
  variantId: EntityId
  inheritedEdgeId: EntityId
  disposition: 'suppressed' | 'replaced'
  replacementEdgeId: EntityId | null
}

type ComponentInstance = {
  id: EntityId
  componentId: EntityId
  source: { storeId: StoreId; file: string; anchor: SourceAnchor }
  variantId: EntityId
}

type SourceAnchor = {
  version: 1
  fingerprint: Sha256
  exportName: string
  semanticPath: Array<{
    syntaxKind: string
    symbol: string
    keyLiteral: string | null
    staticPropNames: string[]
  }>
  parentFingerprint: Sha256
  siblingSignatureOrdinal: number
  lastKnownLine: number
  lastKnownCol: number
}

type AssetFolder = {
  id: EntityId
  name: string
  parentId: EntityId | null
  sortKey: string
}
```

### 4.1 Deliberate corrections to the QA proposal

1. **Per-file hashes, not `ComponentDefinition.sourceHash`.** Existing operations touch TSX, CSS, generated barrels, and consumer files. Preconditions are a map of exact raw-byte hashes for every touched file.
2. **`Reset Override` is not a runtime edge action.** QA observed removing an inherited interaction yielding Reset Override. Canonically this is an `InteractionOverride` tombstone plus `reset-interaction-override` command. Runtime actions remain actual runtime behavior.
3. **Detach removes instance identity.** A successfully detached node becomes ordinary canvas/source structure. It must not remain a canonical `ComponentInstance { detached: true }`. The transaction journal preserves its former identity for undo.
4. **Preview sessions are transient.** `PreviewSession` belongs to runtime/session state, not the persisted authoring graph. Persist only authored data required to compile behavior.
5. **New Event remains absent.** The action model is unverified. No generic event abstraction is allowed until Expert/QA evidence closes it.
6. **Line/column is not stable identity.** Keep last-known positions as accelerators; re-resolve through a structural fingerprint and refuse on ambiguity.
7. **Defensive empty axes cannot mean migration success.** The current inventory intentionally collapses parser failures to `[]`. Migration must call strict SourceProjection and classify a failure as `unsupported`; otherwise an unparsable component could be silently treated as variant-free and bootstrapped incorrectly.
8. **Variant inheritance needs first-class override membership, not duplicated values.** Expert re-verified Show Primary / Detach From Primary / Update Primary / Reset Overrides. `VariantFrame.inheritance` therefore records linked/detached state plus stable property IDs whose values differ. The values themselves remain in TSX/CSS and are resolved through strict SourceProjection; the sidecar never becomes a second prop-value store.
9. **Instance prop overrides remain deferred.** Their depth/semantics are not yet verified, so V1 does not persist a generic `Record<string, unknown>`. Add a typed, source-referential representation only after G0 evidence closes it.
10. **Cycle is an observed label, not verified runtime semantics.** Once/Cycle exists in live UI; no lane independently operated the semantic difference end-to-end. Keep the enum so the graph can preserve the authoring choice, but CompilerAdapter execution/mapping is `UNVERIFIED` and blocked on the named evidence check.
11. **Tracked graphs contain no checkout path.** `storeId` plus `root.kind` is the persisted logical identity. Canonical real paths exist only in the runtime root registry and transaction-local lock state.
12. **Override membership resolves through typed bindings.** Every `overridePropertyIds` entry must resolve to one `SourcePropertyRef`. It identifies owner component/variant, source/export, stable owner anchor, typed property channel/path, and optional primary-property lineage; it never stores the property value.

### 4.2 Bounded preliminary-QA disposition

1. Cross-root coordinator/2PC recovery: **recorded** in section 5.4; ordered locks/per-root journals alone are rejected.
2. Git lifecycle: **recorded** in section 5.1.2; sidecars tracked, recovery/history/stage data ignored and pruned only under explicit retention rules.
3. Generic instance overrides: **removed from V1**; typed source-referential instance overrides deferred to G0 evidence.
4. SourceAnchor determinism/collisions: **recorded** in section 7.1 with exact fingerprint inputs and refusal tests.
5. Cycle compiler semantics: **explicitly UNVERIFIED**; persistence allowed, runtime generation blocked pending operated evidence.
6. Quota state: **updated** in section 12 to the current less-than-10% runtime warning.

### 4.3 Architecture-gate REWORK disposition (H1-H4)

1. **H1 resolved — portable roots:** tracked graph root is logical only; runtime registry, logical coordinator references, jail re-resolution, duplicate-store refusal, and relocation fixture are sections 4, 5.1.1, 5.3, 5.4, and 10.
2. **H2 resolved — typed property identity:** `SourcePropertyRef` plus explicit lifecycle/refusal rules bind override membership to source-owned properties without persisting values; sections 4, 6.1.1, and 10.
3. **H3 resolved — no graph-only semantic variants:** G1-Foundation contains classification/infrastructure only; semantic create/rename/duplicate begins in G2 only with compiler, staged reparse, type-aware assertions, and round-trip proof; section 11.
4. **H4 resolved — bounded durability:** `DurableFileInstaller` defines temp/file sync/rename/directory sync/hash/decision order, tombstone deletion, capability refusal, supported failures, and distinct test claims; sections 6.4, 9, and 10.

## 5. Persistence, revisions, hashes, and roots

### 5.1 Sidecar location

Use one sidecar per editable source root, not one project-only graph:

- Project: `src/app/(dev)/react-figma-components/.onemo/authoring-v1.json`
- Global library: `<library-src>/.onemo/authoring-v1.json`

The API exposes a merged read view but retains store/root identity. Cross-root references use `SourceRef.storeId + componentId`; `root.kind` is classification, not globally unique identity.

The sidecar stores only editor metadata: stable IDs, geometry, lineage, interactions, folder membership, references, schema/revision, and source hashes. JSX, declarations, prop values, imports, and CSS values remain source-owned.

### 5.1.1 Runtime root registry and relocation

- The tracked sidecar persists only `storeId` and `root.kind`; it never persists an absolute path, worktree path, device ID, or inode.
- A process-local `RuntimeRootRegistry` maps `storeId -> { kind, canonicalRealPath }` after discovering the project root and configured library root through the existing jailed root resolver. The map is runtime state and is never serialized.
- Every sidecar/source/journal path is store-relative POSIX text. Resolution joins it only after registry lookup and repeats realpath/jail containment checks before access.
- Duplicate simultaneously mounted `storeId` values, kind mismatches, unavailable roots, and paths escaping their registered root refuse before locking or staging.
- Relocation fixture: copy/checkout both repositories and the identical tracked sidecars beneath different absolute directories; assert byte-identical sidecars, identical store/entity IDs and graph hashes, successful runtime re-resolution, and no old checkout path in serialized output.

### 5.1.2 Git contract

- `authoring-v1.json` is version-controlled source-adjacent metadata in each repository.
- `.onemo/history/**`, `.onemo/transactions/**`, `.onemo/stage/**`, lock files, temp files, and content-addressed blobs are runtime/recovery data and must be Git-ignored in both repositories.
- Cleanup may prune only committed/rolled-back transaction records after their retained undo references expire. Prepared/uncertain records are never auto-deleted.
- The implementation slice must add explicit ignore rules while preserving a negated rule for tracked `authoring-v1.json`; two-repo cleanliness is a gate after every failure-injection test.

### 5.2 Hash contract

- SHA-256 over exact raw bytes; no line-ending or formatting normalization.
- Every transaction request carries expected store revisions and expected hashes for all touched files.
- A hash mismatch is a named 409 with changed paths. Never overwrite or auto-merge hand edits.
- Reconciliation is a separate explicit command/research gate, not fallback behavior inside commit.

### 5.2.1 Compiler-environment fingerprint vs. authored source hash

`sourceHashes` is exact authority over authored content only: component TSX/CSS, explicit command-declared dependencies, and the resolved tsconfig/`extends` chain. Nothing else may enter this map.

Dev-server-generated ambient build artifacts — most concretely Next's `.next/dev/types/*.d.ts` (`routes.d.ts`, `cache-life.d.ts`, and equivalents) — are compiler-environment inputs, not authored source. They are tracked as a separate `environmentFingerprint` (a SHA-256 over the exact set of ambient declaration bytes the current `CompilerAdapter` run actually consumed), never folded into `sourceHashes`, and never gate a `SOURCE_HASH_STALE` refusal on their own.

`environmentFingerprint` may only advance through one explicit, transactionally-verified `environment-rebase` operation:

1. Preconditions: every authored `sourceHashes` entry for the affected component is unchanged from the last accepted baseline; only the environment fingerprint drifted.
2. Re-parse and re-typecheck the exact current authored bytes against the new ambient environment (same `CompilerAdapter` path used by real commands — parse, type-aware assertions, SourceProjection rebuild).
3. Prove byte-for-byte equivalence of the resulting SourceProjection/registry against the prior accepted baseline. Any divergence refuses exactly like a `SOURCE_HASH_STALE` mismatch and writes nothing.
4. On proven equivalence, commit the new `environmentFingerprint` through the normal durable transaction/history path as its own named command kind — logged, never silent, never merged into an unrelated command's journal entry.

This is the only lawful mechanism that unblocks the cold-import deadlock (UI import commits -> Next regenerates `.next/dev/types` because `.onemo` metadata mutated under `src/app` -> a resumed load would otherwise refuse `SOURCE_HASH_STALE` forever). It does not relax `revalidate-source`'s separate, still-unmet obligation (Import Recovery Gate `7a4e8b9` P0-1): any command that changes authored TSX/CSS/dependency bytes must still run the full `CompilerAdapter`/type-aware/round-trip path before committing, with no exception for "the sidecar already existed."

Forbidden: excluding `.next` or any ambient artifact from all hashing; auto-rehashing on GET/resume without the equivalence proof above; treating `environment-rebase` as authorization to skip semantic validation of real authored-content changes.

### 5.3 Revision contract

- Each store has a monotonic integer revision.
- Single-store commands increment once.
- Multi-root commands carry a revision vector and lock roots in canonical path order to prevent deadlock.
- A transaction either advances every involved store revision once or advances none.
- Canonical real paths from `RuntimeRootRegistry` determine transient lock order; only the logical revision vector/store IDs enter persisted records.

### 5.4 Cross-root coordinator and recovery contract

Ordered locks are necessary but insufficient. Every transaction touching project and global repositories uses one discoverable coordinator:

- Coordinator record: project store `.onemo/transactions/<transactionId>/coordinator.json`.
- Participant records: each involved store `.onemo/transactions/<transactionId>/participant.json`; each contains transaction ID, `coordinator: { storeId, relativeTransactionPath }`, participant store IDs, before/after hashes, revision vector, and store-relative preimage/after-image blob references. Absolute paths are forbidden even in recovery records.
- A global participant can discover an unresolved cross-root transaction locally and follow its coordinator pointer. If the coordinator repository is unavailable, writes refuse with `RECOVERY_REQUIRED`; they never guess.
- Prepare phase: acquire canonical cross-process locks; persist/fsync blobs and every participant `prepared` record; persist/fsync the coordinator `prepared` record; only then mutate source.
- Commit phase: install and verify all participant source outputs, then sidecars/revisions; atomically persist coordinator `committed` as the sole commit decision; finish participant markers.
- Recovery: coordinator `prepared` or absent commit decision means rollback every participant to verified preimages. Coordinator `committed` means verify/finish after-images and participant markers. Any hash contradiction stops with `RECOVERY_CONFLICT` and preserves evidence.
- Single-root transactions use the same participant protocol with that store as coordinator. Cross-process locks and crash/failure tests are mandatory; the current in-memory promise queue is not reused as the lock.

## 6. Command, compiler, and transaction boundary

### 6.1 Commands

Correct lifecycle names:

- `create-component-from-selection` -> wraps low-level `make-component`.
- `create-blank-component` -> wraps low-level `create-component`.
- `insert-instance` -> wraps low-level `insert-component`.

New commands:

- `create-variant`, `rename-variant`, `move-variant`, `duplicate-variant`, `delete-variant`, `set-primary-variant`.
- `set-transition`.
- `create-interaction`, `update-interaction`, `delete-interaction`, `suppress-inherited-interaction`, `reset-interaction-override`.
- `create-folder`, `rename-folder`, `move-folder`, `move-component-to-folder`, `sort-folder`, `delete-folder`.
- `detach-instance`, `replace-instance`, `replace-all-instances` only after evidence/product contracts are approved.
- `enter-main-component` is navigation, not a source mutation.

Every command includes `commandId`, expected revision vector, and expected file hashes.

`repeat: 'cycle'` is accepted/persisted as an observed UI choice, but its generated runtime behavior is blocked as `UNVERIFIED_REPEAT_SEMANTICS` until Expert/QA operate and record Once versus Cycle end-to-end.

### 6.1.1 SourcePropertyRef lifecycle

- **Create/import:** strict SourceProjection creates a typed binding only after exactly one owner anchor and one property channel resolve. Bootstrap IDs are deterministic from `storeId/componentId/variantId/canonical binding path`; newly authored properties use command-derived stable IDs.
- **Rename variant/component/export:** property IDs remain stable; `SourceRef` and anchors update atomically with the compiled rename and staged reparse.
- **Duplicate variant:** mint new property IDs for the duplicate and set each `inheritedFromPropertyId` to its corresponding primary property; never alias the original variant's IDs.
- **Detach variant:** compile inherited values into independent source where required, change inheritance to `detached`, clear `inheritedFromPropertyId`, and retain bindings to the detached variant's own source properties. Former lineage remains only in transaction history for undo.
- **Update Primary:** resolve every override binding and its `inheritedFromPropertyId`, read values from staged SourceProjection, compile them into the primary source bindings, then reparse before removing only the successfully propagated override memberships.
- **Reset Overrides:** compile removal/reversion of each linked source override, reparse inherited effective values, then remove the override memberships. The sidecar never supplies a value.
- Missing owner/property/primary bindings refuse `PROPERTY_BINDING_MISSING`; zero anchor matches refuse `ANCHOR_MISSING`; multiple candidates refuse `PROPERTY_BINDING_AMBIGUOUS`. No line/column, nearest-node, or untyped fallback is allowed.

### 6.2 CompilerAdapter contract

The adapter receives a validated command and immutable graph/projection snapshots. It returns:

```ts
type CompilePlan = {
  graphPatches: GraphPatch[]
  sourcePatches: SourcePatch[]
  touchedStores: StoreId[]
  intendedSemantics: SemanticAssertion[]
  unsupported: UnsupportedCase[]
}
```

It does not write real files. Existing low-level operations must be refactored to accept staged bytes/FileIO or return patches.

After staging, the adapter:

1. Parses every output TSX and CSS file.
2. Runs command-specific semantic/type assertions.
3. Rebuilds SourceProjection from staged bytes.
4. Proves the intended graph delta is represented.
5. Proves untouched graph/source semantics remain stable for the supported projection.
6. Refuses explicit unsupported cases; never coerces free variants into union axes.

`ComponentDefinition.projectionFingerprint` (required, `AuthoringGraphV1.schemaVersion: 2`) is the round-trip proof this contract requires: a hash over the canonical SourceProjection fields (SourceAnchor line/col excluded as non-semantic), set on strict import and every CompilerAdapter result. `revalidate-source` and `environment-rebase` (§5.2.1) both require the current fingerprint to equal the prior accepted one; structural/prop/rule/connector drift refuses `SOURCE_PROJECTION_DRIFT` with zero writes, formatting/line-only drift (fingerprint unchanged) remains revalidatable. Existing `schemaVersion: 1` sidecars/history preimages migrate on load without fabricating later authority. V1 written after §5.2.1 must retain an exact authored hash set and matching environment fingerprint. Accepted earlier V1 is treated as the historical authored-hash subset it actually recorded: verify every legacy authored hash unchanged, partition only inputs proven to be generated compiler environment, and admit authorities added after that schema only from one jailed exact snapshot after staged semantic plus SourceProjection/registry equivalence proof. Derive the current sidecar fingerprint from those verified current bytes. For each historical graph preimage, reconstruct that revision's source state from its durable history preimages and committed undo-transaction blobs, verify its legacy hashes against the reconstructed bytes, and derive its fingerprint from those historical bytes rather than current source. Missing, stale, unparseable, ambiguous, or insufficient historical evidence named-refuses with zero writes. Persist sidecar, migrated graph preimages, and the version bump in one root-aware transaction under §§4/6.3; same migration mechanism, not a new write path.

### 6.3 Transaction protocol

1. Canonically order and acquire every store/root write lock.
2. Load sidecars and exact source bytes once.
3. Verify schema, revision vector, and all source hashes.
4. Run pure command validation: names, references, primary ownership, folder cycles, delete guards, target existence, compatibility.
5. Build `CompilePlan` against immutable snapshots.
6. Materialize all proposed sidecar/TSX/CSS/barrel/consumer outputs in a staged filesystem.
7. Run parse, semantic, SourceProjection, and round-trip assertions.
8. Persist a `prepared` journal record with command, before hashes, byte preimages/content-addressed blobs, after hashes, graph patches, and inverse.
9. For cross-root work, complete every participant prepare and the discoverable coordinator prepare before any real-file mutation.
10. Commit each file by sibling temp-file + atomic rename; sidecars commit after source outputs.
11. Verify all participant after-hashes, atomically persist the coordinator `committed` decision, finish participant markers, then release locks.
12. Before a committed coordinator decision, any failure restores every byte preimage, verifies original hashes, leaves revisions unchanged, and marks `rolled-back`.
13. On restart, follow section 5.4: rollback unresolved prepared transactions; finish/verify transactions with a durable committed decision; never guess.

Multi-file atomic rename is not globally atomic. The prepare journal plus verified byte-exact rollback is the required crash-consistency mechanism.

### 6.4 DurableFileInstaller and supported failure model

`AuthoringTransaction` may install real files only through `DurableFileInstaller` on a local, same-filesystem root that passes a startup capability probe for atomic sibling rename plus file and directory `fsync`:

1. Create a unique sibling temp with exclusive/no-follow semantics and the intended mode; never stage across devices.
2. Write all bytes, `fsync` the open temp file, close it, re-read it, and verify its planned SHA-256.
3. Atomically rename the sibling temp over the destination, then `fsync` the containing directory and verify the installed bytes/hash.
4. Represent deletion by atomically renaming the target to a transaction-owned sibling tombstone and `fsync` the directory. Retain the tombstone until the durable coordinator decision and recovery obligations are closed.
5. Apply the same temp-write/file-sync/rename/directory-sync sequence to sidecars, participant records, and coordinator decisions. Publish coordinator `committed` only after every participant output and sidecar is installed, directory-synced, and hash-verified.
6. Clean temps/tombstones only after durable terminal markers; cleanup also directory-syncs. A cleanup failure is recoverable residue, not a reason to reverse a committed decision.

Supported guarantee: process crash/kill and host/power loss on local filesystems that truthfully provide the probed same-filesystem atomic-rename and `fsync` semantics. Cross-device installs, network/virtual filesystems without those guarantees, unsupported directory sync, storage/controller corruption, and hardware that lies about flush completion are outside the guarantee and must refuse with `DURABILITY_UNSUPPORTED` rather than silently downgrade. Unit failure injection covers every installer boundary and subprocess-kill recovery; a platform integration test verifies capability/syscall behavior. Tests must not claim they simulated physical power loss.

### 6.5 Import-bootstrap reload exception

Persistent one-canvas continuity (§3.2-3.4) permits exactly one bounded exception. Writing a new file into the tracked sidecar directory (`src/app/(dev)/react-figma-components/`) during first-ever import unavoidably triggers Next's App Router route-tree rescan — a genuine full-document reload, not an HMR patch. Directory-presence tricks (`.gitkeep`, watcher-ignore) do not prevent it: the file write itself triggers the rescan, not directory absence.

Resume-marker contract:

- Schema: `{ version: 1, targetFile: <store-relative path>, expectedHash: <sha256>, transactionId: <uuid>, issuedAt: <epoch ms>, ttlMs: <bounded window> }`, persisted outside `globalThis` (must survive the document reload) and inside the untracked runtime-recovery scope — never `.onemo` tracked source.
- The originating document never clears its own marker on success — a self-clear cannot distinguish "I am the resumed document" from "I am still mid-import." Only a different document load that resolves the exact `targetFile`/`expectedHash` pair, after confirming the resolved component actually matches, may clear it.
- Any marker that is missing required fields, expired past `ttlMs`, naming a path/hash that no longer matches disk, or already consumed by a prior resolved load refuses the resume outright and deletes the stale marker. It never silently proceeds as an ordinary cold load.
- No authoring action other than this one first-import bootstrap may create a second marker, or resume/consume an already-live or already-consumed marker from any document other than the legitimate resuming one. Any such attempt is a named refusal, not a retry.
- `ComponentCanvas` and any other consumer keyed by the importing file must carry `key={file}` (or equivalent) and a request-generation/abort guard, so a stale async response from a superseded import cannot publish into a different document's canvas state after the reload.
- Scope of the restriction: it binds only the resume-marker lifecycle — a live-or-consumed marker existing that a second issuance/resume attempt would violate. It does not bind ordinary reloads that occur after the marker has already been consumed (tombstoned) and normal editing has resumed. Once consumed, no marker is present to violate; a subsequent reload is a plain page load reading current on-disk source-of-truth state, not a bootstrap-reload event, and is unrestricted.

E2E evidence must assert the exact permitted phase count — exactly one reload, with same-iframe/document identity proof before the reload and resumed-component proof after — never a blanket "zero reload" assertion and never a test that accepts either "immediate canvas" or "revalidate" as equally valid without distinguishing which phase actually occurred. The `Home -> reload -> undo` step of the §10 acceptance flow is exactly this ordinary, post-consumption reload: by that point in the flow the marker has already been consumed, so it must succeed and preserve state/undo normally — it is not the restricted bootstrap reload and any implementation refusing it is non-compliant.

## 7. Undo, redo, rollback, and recovery

- **Rollback** is automatic failure recovery inside one transaction; it restores byte preimages and the prior graph revision.
- **Undo** is a new revisioned transaction applying the recorded inverse against the exact current revision/hashes.
- **Redo** reapplies the original command as another transaction only while the undo lineage remains current.
- Preimages are content-addressed blobs under `.onemo/history/blobs/<sha256>`; transaction metadata is append-only under `.onemo/history/journal.ndjson` or an equivalently atomic small-record store.
- Bound history size is a product decision. Pruning cannot remove blobs referenced by retained undo records.
- Manual source drift invalidates undo with a named conflict; it never force-restores older bytes over hand edits.

### 7.1 Deterministic SourceAnchor contract

- `fingerprint = SHA-256(canonical JSON)` over anchor version, store-relative file, export name, semantic ancestor path, node syntax kind/symbol/key literal, sorted static prop names, and parent fingerprint. Whitespace, formatting, absolute paths, and line/column are excluded.
- `siblingSignatureOrdinal` and last-known line/column are resolution accelerators/guards, not identity inputs.
- Resolution reparses current source, scopes to the export, recomputes candidates, and accepts exactly one fingerprint match. Zero matches are `ANCHOR_MISSING`; multiple matches are `ANCHOR_AMBIGUOUS`; neither falls back to nearest location.
- Required tests: formatting and unrelated-line insertion preserve identity; a commanded node move updates its anchor atomically in the same transaction; an external structural move refuses rather than guessing; duplicate identical siblings refuse ambiguity; keyed siblings remain distinct; export rename is handled only by the same transaction; hand edit causing zero matches refuses; line/column drift never selects a different node.

## 8. Migration and legacy round-trip

1. Sidecar schema migrations are pure `vN -> vN+1` functions with golden fixtures; the migrated sidecar is committed through the same transaction protocol.
2. No sidecar: parse SourceProjection and classify each component.
3. One clean union axis may import losslessly as `legacy-single-axis`; generate deterministic bootstrap IDs from store/file/export/source-slot ordinal, never axis/value labels, then persist them. This preserves Hard Contract §3 invariant 1: display-label edits do not mint new entity identity.
4. Multi-axis source remains `legacy-multi-axis`. Do not create a Cartesian variant explosion automatically.
5. Explicit conversion must preview variant count, interaction mapping, structural differences, and unsupported cases.
6. Refuse conversion if SourceProjection -> graph -> source -> SourceProjection equivalence cannot be proved.
7. Existing `@fc-transition` / `@fc-connector` comments import only the semantics they actually encode. They do not prove general Framer interactions.
8. Hand-edited/ambiguous source becomes `unsupported` with read-only inspection until explicitly reconciled.

## 9. Exact file impact map — architecture contract

### Existing backend files

- `src/app/api/dev/editor/lib.ts`
  - Keep jails/parsers/guards/low-level transformations.
  - Extract or facade current `ComponentModel` as `SourceProjection`.
  - Refactor component primitives away from direct real-filesystem writes.
- `src/app/api/dev/editor-write/route.ts`
  - Retain for low-level non-component editor operations.
  - New component UI must not call it directly.
- `src/app/api/dev/editor-component-model/route.ts`
  - Return named `SourceProjection`; no authoring identity claim.
- `src/app/api/dev/editor-components/route.ts`
  - Join source inventory with stable IDs/root-aware folder metadata; expose projection errors explicitly rather than using empty axes for compatibility decisions.

### New backend files

- `src/app/api/dev/editor/authoring-types.ts`
- `src/app/api/dev/editor/authoring-schema.ts`
- `src/app/api/dev/editor/authoring-store.ts`
- `src/app/api/dev/editor/authoring-migrations.ts`
- `src/app/api/dev/editor/source-projection.ts`
- `src/app/api/dev/editor/authoring-commands.ts`
- `src/app/api/dev/editor/authoring-compiler.ts`
- `src/app/api/dev/editor/authoring-transaction.ts`
- `src/app/api/dev/editor/durable-file-installer.ts`
- `src/app/api/dev/editor/authoring-history.ts`
- `src/app/api/dev/editor-authoring/route.ts`

### Repository metadata files

- `onemo-next/.gitignore`
  - Ignore project `.onemo` runtime/history/transaction/stage data; explicitly keep `authoring-v1.json` tracked.
- `onemo-component-library/.gitignore`
  - Apply the equivalent global-library rule; verify no probe/runtime artifacts remain in either repository.

Small pairs may combine only if responsibilities remain explicit; do not create another monolith.

### Existing frontend files

- `src/app/(dev)/react-figma/page.tsx`
  - Remove component authoring domain state, direct component writes, auto-promote-on-entry, fixed target chips, and keyed component-board swap.
  - Retain shell/canvas viewport only where behavior remains correct.
- `src/app/(dev)/react-figma/components-canvas/page.tsx`
  - Retire after the one-canvas vertical slice.
- `src/app/(dev)/react-figma/engine.ts`
  - Keep read bridge/staging; add graph ID messaging only after model proof.

### New frontend files

- `src/app/(dev)/react-figma/component-authoring/useAuthoringGraph.ts`
- `src/app/(dev)/react-figma/component-authoring/ComponentCanvas.tsx`
- `src/app/(dev)/react-figma/component-authoring/ComponentInspector.tsx`
- `src/app/(dev)/react-figma/component-authoring/AssetsTree.tsx`
- `src/app/(dev)/react-figma/component-authoring/PreviewSurface.tsx`

## 10. Exact test map — confirmed against repository conventions

- `src/app/api/dev/editor/__tests__/authoring-model.test.ts`
  - stable identity, primary lineage, typed SourcePropertyRef ownership/lineage, create/rename/duplicate/detach/update/reset behavior, missing/ambiguous refusal, override tombstones, folders, instances, delete guards.
- `src/app/api/dev/editor/__tests__/authoring-store.test.ts`
  - sidecar schema, no persisted absolute paths, runtime root registry/jails, relocation across absolute checkouts, duplicate-store refusal, raw-byte hashes, revision vectors, reload persistence.
- `src/app/api/dev/editor/__tests__/authoring-migrations.test.ts`
  - schema migration, deterministic bootstrap IDs, single-axis import, multi-axis hold, unsupported refusal.
- `src/app/api/dev/editor/__tests__/source-projection.test.ts`
  - parse fixtures, public/local prop names, side channels, deterministic fingerprint inputs, formatting/line drift, keyed identity, missing/collision/ambiguity refusals.
- `src/app/api/dev/editor/__tests__/authoring-compiler.test.ts`
  - primary/custom variants, linked property-override membership with source-owned values, both Spring forms, Set Variant, override suppression/reset, staged outputs, reparse equality, unsupported cases; Cycle runtime compilation remains a failing/blocked fixture until evidence closes semantics.
- `src/app/api/dev/editor/__tests__/authoring-transaction.test.ts`
  - stale revision/hash, deterministic multi-root locks, discoverable coordinator/participant records, missing-coordinator refusal, concurrent-process exclusion, failure at every prepare/commit point in both repos, decision-based rollback/finish, byte-exact recovery, undo/redo conflicts.
- `src/app/api/dev/editor/__tests__/durable-file-installer.test.ts`
  - exclusive sibling temps, temp/output hash verification, file/directory sync ordering, same-device refusal, durable replace/delete tombstones, capability refusal, failure at every boundary, subprocess-kill recovery; no synthetic power-loss claim.
- `src/app/api/dev/editor/__tests__/authoring-history.test.ts`
  - content-addressed blobs, pruning references, restart, inverse lineage.
- `src/app/api/dev/editor-authoring/route.test.ts`
  - dev-only guard, malformed/untrusted JSON runtime validation, 409/422/error contract, one-command transaction response.
- `tests/e2e/react-figma-authoring.spec.ts`
  - G2 create-from-selection -> edit same canvas -> create/move/rename variant -> Home -> reload -> undo.
  - G3 interaction -> compiled preview -> Back; suppress/reset inherited interaction -> undo.
  - G4 folders/instances after evidence and command approval.

Placement matches existing Vitest conventions: colocated route tests use `route.test.ts`; domain tests use `__tests__`; `vitest.config.ts` resolves `@` to `src`. No G1 implementation passes without wrong-behavior fixtures failing first, round-trip fixtures, and byte-exact rollback tests.

## 11. Build gates and largest coherent implementation slice

### Architecture gate now

This document only. Mandatory source reads and corrections are complete; next gate is QA -> Meta -> Dan. No code.

### Largest coherent post-approval slice likely finishable and verifiable before a reset

**G1-Foundation: graph/store/transaction proof without production UI or semantic authoring commands.** Bounded scope:

1. `AuthoringGraphV1` types/schema, including linked override-property identity without duplicated values.
2. Project-root sidecar store first, with logical store identity, runtime root jail/relocation, revision, exact hashes, and durable sidecar install.
3. SourceProjection facade for existing parser.
4. Strict read-only classification/import; **no persisted create/rename/duplicate/delete variant command before its compiler exists**. Optional `move-variant-frame` may update sidecar-only x/y/w/h because geometry is explicitly not TSX/CSS component semantics.
5. Single-root transaction prepare/commit/rollback, DurableFileInstaller, and persistent history, using the participant/coordinator record shape that extends to two roots.
6. Legacy single-axis classification/import plus multi-axis hold/refusal.
7. Full model/store/migration/installer/transaction tests, including relocation and byte-exact injected failures.

Why this is the largest safe slice: it proves portable identity, persistence, drift detection, durable install, rollback, undo, and migration without coupling to the still-unapproved UI or creating graph semantics that source cannot represent. The next slice is **G2-Variant Compiler**: create/rename/duplicate variant only together with staged TSX/CSS output, strict SourceProjection reparse, type-aware semantic assertions, and round-trip fixtures. `Set Variant` follows unless enough verified time remains to finish its runtime evidence and compiler tests completely.

## 12. Quota/context risk

- Runtime now reports **less than 10% of the 5-hour quota remaining**. Quota exhaustion risk is immediate.
- No callable runtime quota API currently exposes the claimed remaining 5-hour quota to this lane. I will not fabricate a number.
- Operational stance: treat the explicit runtime warning as authoritative; persist this bounded revision and hand off now. Do not begin product code before architecture approval or without enough renewed quota to finish and verify G1-Foundation.

## 13. Durable handoff if quota/context expires

Authoritative artifacts:

1. This architecture file: `__qa-dispatch/s58-framer-source-architecture-codex.md`.
2. QA review: `__qa-dispatch/s58-framer-clone-adversarial-qa.md`.
3. QA evidence: `__qa-dispatch/s58-framer-extraction-qa-ledger.md`.
4. Working read ledger: `/tmp/s58-architecture-owner-ledger.md`.
5. Isolated worktree and baseline listed at the top of this document.

Resume protocol:

1. Reopen this artifact first.
2. Confirm worktree remains at `804ffe7` and clean.
3. Verify section 1 remains the complete coverage record; no unresolved source read remains.
4. Read any QA/Meta response added after this checkpoint and reconcile findings explicitly.
5. Send/read the `@s58-lead` readback if not already recorded; QA reviews architecture; Designer Meta reviews behavior/visual implications; Dan signs.
6. Only then start G1-Foundation.

**No-code status:** no product source modified. Only an isolated worktree/branch and architecture/temporary ledger artifacts exist.
