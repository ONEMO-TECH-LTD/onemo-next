# S58 Framer-like Component Authoring - Hard Contract v0

**Status:** CURRENT BINDING PACKAGE - G1-FOUNDATION BUILT AND QA-PASSED (exact `9e9adf4` + library `0af96bd`), G2 BUILD ACTIVE  
**Single-writer target:** `@s58-lead`  
**Current synthesis owner:** `@s58-lead`; `@s58-qa` remains the independent gate owner  
**Builder:** `@s58-engineer` under Dan's continuous-build directive  
**Build authorization:** G1-FOUNDATION AUTHORIZED, BUILT, AND QA-PASSED; G2 AUTHORIZED AND ACTIVE. Dan does not pause progression between phases — his sign-off gate applies once, to the finished final product, not to each intermediate phase.  
**Gate order:** Builder -> QA -> Meta, continuously across phases; Dan reviews only the final, complete product (never an interim phase gate)

## 0. Current Package State

Binding artifacts:

- Architecture: `__qa-dispatch/s58-framer-source-architecture-codex.md`, 672/672 lines, SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.
- Architecture QA verdict: `__qa-dispatch/s58-framer-source-architecture-qa-verdict.md` = `PASS`.
- Expert domain input: `__qa-dispatch/s58-framer-hard-contract-input-expert.md`, final reconciled input.
- Designer acceptance input: `__qa-dispatch/s58-team-contract-design-acceptance-designer.md`.
- Designer Meta reconciliation: `__qa-dispatch/s58-framer-hard-contract-input-designer.md` = `PASS` from design-satisfiability lens.
- Synthesis ledger: `__qa-dispatch/s58-framer-hard-contract-synthesis-ledger.md`.

Current state:

1. Architecture QA and Designer Meta gates are passed; the corrected architecture remains binding.
2. Dan explicitly authorized G1 implementation and directed the same Builder/QA team to continue the corrected-model rework.
3. Designer Meta reconciliation is passed: V1-V10 and S1-S9 have homes in the graph/projection/compiler model.
4. Expert G0 second pass closed Hover/Pressed creation+auto-wire and connector drag-pickup; asset-to-canvas insert remains the only v1 G0 manual-pass blocker.
5. C5 is corrected in Expert input: G1 is foundation-only; semantic variant/compiler behavior moved to G2.
6. Final product Done/sign-off remains Dan's gate.
7. G1 is built and combined-QA-PASSED (exact `9e9adf4` + library `0af96bd`). Per Dan's explicit direction, phase progression does not pause for an interim Dan gate: G2 build is authorized and active immediately following G1's QA/Meta pass.

## 1. Contract Law

1. Clone directly observed Framer component-authoring behavior and model; render it in ONEMO/Figma visual language.
2. Never convert an inference or desired ONEMO feature into a claimed Framer fact.
3. Current source is authoritative for what the existing engine can represent.
4. TSX/CSS remain the clean shippable output and own JSX, declarations, prop values, imports, and CSS values.
5. Editor-only identity, geometry, organization, lineage membership, and history may live in source-adjacent metadata.
6. Unsupported, ambiguous, stale, or lossy mappings fail by named refusal without writing.
7. No implementation phase starts until its evidence, model, tests, runtime, recovery, and actor gates are satisfied.
8. No agent marks Done. Dan alone signs the final gate.

Evidence classes:

- `OBSERVED`: independently operated in Framer or directly read from current source.
- `INFERRED`: reasoned from evidence but not operated end to end.
- `PRODUCT DECISION`: deliberate ONEMO choice, not claimed as Framer behavior.
- `UNVERIFIED`: required follow-up before the affected phase.

## 2. Existing Engine Verdict

The current implementation is a mixed foundation.

Keep:

- Filesystem jailing, root resolution, strict path/name validation, and traversal refusal.
- TypeScript/PostCSS parse guards, CSS declaration resolution, shorthand ownership, and byte-addressed edits.
- Style read bridge, cascade provenance, computed/declared style inspection, and transient override staging.
- Project/global component discovery and existing low-level lifecycle primitives after they are moved behind staged transactions.
- Error isolation for component render failures.

Modify:

- `ComponentModel` becomes `SourceProjection`. It is source-derived inspection, not canonical authoring identity.
- Existing writers become compiler primitives that produce staged plans or write into a staged filesystem.
- Runtime DOM IDs remain runtime-only. They are never persisted as component, variant, instance, or property identity.
- Inventory joins strict SourceProjection with sidecar folders and stable IDs. Parse failure becomes explicit `unsupported`, not empty axes.
- Component authoring UI uses one `useAuthoringGraph` command client. Low-level editor writes remain separate.

Replace:

- Union-axis authoring identity as the primary model.
- Fixed state authoring taxonomy as authored component frames (Base + 6 hardcoded ghost states — 3 interaction: hover/pressed/focus, 3 semantic: disabled/loading/error — 7 tabs total in the live UI; QA-verified 2026-07-11 against `components-canvas/page.tsx` INTERACTION_STATES/SEMANTIC_STATES).
- Narrow `state | switch` connector identity and four-trigger hardcoding as the canonical interaction model.
- Fixed inventory-wide component board and keyed component-board remount.
- UI-local undo as authoring history.
- Navigation-triggered source mutation.

Build:

- Canonical `AuthoringGraphV1`.
- Root-aware sidecar stores and schema migrations.
- Strict `SourceProjection` facade.
- Pure `AuthoringCommand -> GraphPatch + SourceIntent` reducer.
- `CompilerAdapter` with staged source output, strict reparse, type-aware assertions, and round-trip proof.
- Durable revisioned transactions, recovery, undo/redo, and history.
- Persistent one-canvas component-edit context and separate compiled preview lifecycle, bounded by exactly one import-bootstrap document-reload exception (see §4 and §11-G2; mechanism in Architecture §5.2.1/§6.5).

## 3. Canonical Authoring Model

Required graph entities:

- `ComponentDefinition`
- `VariantFrame`
- `SourcePropertyRef`
- `TransitionSpec`
- `InteractionEdge`
- `InteractionOverride`
- `ComponentInstance`
- `AssetFolder`

Required invariants:

1. Every entity has a stable ID independent of label, source line, source column, and canvas position.
2. One component has exactly one Primary variant.
3. Variant display names are aliases and may change without breaking edges, instances, or source bindings.
4. Non-primary variants record primary lineage and override membership.
5. Override membership is typed stable `SourcePropertyRef` membership only. Override values remain source-owned in TSX/CSS.
6. `SourcePropertyRef` binds component, variant, source/export, owner anchor, typed property channel, and optional primary-property lineage.
7. Interaction source and Set Variant target reference stable variant IDs.
8. Inherited interaction removal is modeled as `InteractionOverride` tombstone plus `reset-interaction-override` command. It is not a runtime edge action.
9. Successful instance detach removes canonical `ComponentInstance` identity. Undo/history retains the former identity as preimage only.
10. Preview sessions are transient runtime/session state and are not persisted in the authoring graph.
11. Asset folders organize editor assets without silently moving or renaming source files.
12. Hover/Pressed state wires are implicit state-lineage wires rendered from variant state kind. Do not synthesize a phantom explicit `InteractionEdge` for them.
13. `New Event` is excluded from v1 until its real action model is observed.

Source anchors:

- Identity uses structural fingerprints and semantic path data.
- Last-known line/column may accelerate resolution, but never decides identity.
- Zero matches refuse `ANCHOR_MISSING`.
- Multiple matches refuse `ANCHOR_AMBIGUOUS`.
- No nearest-node or line/column fallback is allowed.

## 4. Source Authority and Persistence

Architecture boundary:

- `AuthoringGraphV1`: stable IDs, geometry, lineage membership, interactions, folders, instance refs, revision, and per-file source hashes.
- `SourceProjection`: JSX structure, declarations, props, imports, CSS values, and generated runtime behavior parsed from TSX/CSS.
- `CompilerAdapter`: validated authoring command -> staged graph/source patches -> parse/type/projection/round-trip proof -> durable transaction.

Persistence contract:

- One tracked sidecar per editable source root.
- Project sidecar: `src/app/(dev)/react-figma-components/.onemo/authoring-v1.json`.
- Global-library sidecar: `<library-src>/.onemo/authoring-v1.json`.
- Sidecars persist logical `storeId` and `root.kind`, never an absolute checkout path.
- Runtime path resolution uses a process-local `RuntimeRootRegistry` and repeats realpath/jail checks before access.
- Source preconditions are per-file SHA-256 over exact raw bytes.
- Hash mismatch returns named 409 and changed paths. No overwrite or auto-merge.
- `sourceHashes` covers authored content only: component TSX/CSS, explicit command-declared dependencies, and the resolved tsconfig/`extends` chain. Dev-server-generated ambient compiler-environment artifacts (for example Next's `.next/dev/types/*.d.ts`) are never folded into `sourceHashes`; they carry a separate `environmentFingerprint` that never gates authored-content mismatch refusal (mechanism: Architecture §5.2.1).
- `environmentFingerprint` may advance only through the explicit, transactionally-verified `environment-rebase` command, which fires only when authored hashes are unchanged and requires proven SourceProjection/registry equivalence before committing. `.next` or any ambient artifact may never be silently excluded from authority, auto-rehashed on GET/resume, or used to bless real authored-content drift. Any command that changes authored TSX/CSS/dependency bytes (including `revalidate-source`) must still run the full `CompilerAdapter`/type-aware/round-trip path before committing — no exception for "the sidecar already existed."
- `.onemo/history/**`, `.onemo/transactions/**`, `.onemo/stage/**`, lock files, temp files, and blobs are runtime/recovery data and must be ignored.
- `authoring-v1.json` is tracked source-adjacent metadata.

## 5. Commands and Phase Ownership

Correct low-level mapping:

- `create-component-from-selection` wraps current `make-component`.
- `create-blank-component` wraps current `create-component`.
- `insert-instance` wraps current `insert-component`.

Command classes:

- Component: create from selection, create blank, rename display identity.
- Variant: create, rename, move, resize, duplicate, delete, set Primary, detach/update/reset Primary overrides.
- Transition: set Instant, Ease, Spring-Time, Spring-Physics.
- Interaction: create, update, retarget, suppress inherited, reset override, delete.
- Instance: insert, set variant, detach, replace, replace all.
- Folder: create, rename, move, sort, move component, delete folder.
- Preview: enter, reload/reset, exit/Back with context restoration.

Every command must define:

- prerequisites
- canonical graph mutation
- touched stores/files
- compiler mapping
- validation and named refusal states
- inverse/preimage
- reload behavior
- user-visible error

Phase law:

- G1 may not persist semantic create/rename/duplicate/delete variant commands.
- G1 may include sidecar-only geometry updates because geometry is editor metadata.
- Semantic variant commands belong to G2 only with compiler output, staged reparse, type-aware assertions, and round-trip fixtures.
- `repeat: cycle` may be persisted as an observed UI choice, but generated runtime behavior remains blocked until Once/Cycle semantics are operated end to end.

## 6. Observed Framer Behavior Contract

Confirmed minimum:

- Edit Component enters the same infinite canvas scoped to one component's free variants.
- Breadcrumb uses `Home > Component` in the canvas top bar.
- Create Component from selection is one transaction: naming dialog, source replacement with instance, asset registration, component edit context.
- Blank component create exists through Components/New Component.
- Variants are free named frames; Primary is default; x/y/w/h persist.
- Primary-linked variant menu includes Show Primary, Detach From Primary, Update Primary, Reset Overrides.
- State ghost exposes Hover/Pressed choice; live pass confirms it creates a named `<Variant> · Hover` state frame and renders a straight implicit Primary-to-Hover wire while the Interactions panel remains empty.
- Interactions plus menu exposes New Transition and New Event. New Event is excluded until observed.
- Trigger vocabulary: Click, Click Start, Appear, Mouse Enter, Mouse Leave.
- Set Variant params: On, Delay, Once/Cycle, target Variant.
- Removing inherited behavior exposes Reset Override; undo restores inherited behavior.
- Play badge tracks an effective interaction in the tested state.
- Wires are straight edge-to-edge with arrowhead at target and selection-scoped visibility.
- Transitions: Instant, Ease, Spring-Time, Spring-Physics.
- Preview is separate runtime iframe/surface; Back restores authoring context.
- Instance menu exposes Detach, Replace With, Replace All Instances With.
- Component asset deletion is disabled while live instances exist.

Unverified before affected phase:

- Menu insert and drag insert end to end.
- New Event action/trigger model, deferred from v1.
- Exact badge matrix beyond tested effective-interaction behavior.
- Full destructive/undo/error behavior for folders, variants, interactions, and instances.

Observed G0 closures:

- Hover/Pressed creation and auto-wire are observed. The wire is implicit state behavior, not an explicit Set Variant interaction.
- Connector drag-pickup is observed. Dragging the canvas handle to a target creates an interaction and opens the trigger/Delay popover.

## 7. ONEMO/Figma Design and Meta Contract

Visual invariants:

- Zero Framer tokens in shipped UI: no Framer purple, Framer font stack, or copied Framer chrome assets.
- One ONEMO accent token for selection borders, wires, arrowheads, breadcrumb component chip, ghost-hover tint, badges, and handles.
- Icons are Phosphor light or Figma-extracted only. No invented SVG paths or unicode icons.
- Segmented controls use DS v2.3.1 control-states Option B.
- Breadcrumb chips use ONEMO chip primitives: page neutral, component accent-tinted.
- Ghost slots use ONEMO neutral pill styling with accent-tinted hover.
- Selection grammar preserves solid frame-select and dashed child deep-select.
- Wires use ONEMO accent stroke, straight geometry, target arrowhead, and DS token width/marker.
- Type, spacing, rows, labels, and panel density use DS tokens.
- Every Framer affordance has exactly one ONEMO-styled semantic equivalent.

Behavior measurements:

- Selection ladder: frame select, child deep-select, Escape up one level, label click selects frame, empty canvas deselects.
- Overlay visibility: wires, ghost slots, labels, and badges render only when a variant frame is selected.
- Inspector structure matches variant-selected and instance-selected section order.
- Interaction row anatomy matches trigger/action/reset/delete fields.
- Context menus expose required create/component/instance actions and disabled delete guard.
- Wire geometry is measured against frame rects, not eyeballed.
- Preview runs the actual compiled component and Back restores selection/scroll/zoom.
- Variant lifecycle supports arbitrary positions, inline rename, Primary tag, and persistence.
- Delete guard is verified in UI and engine refusal.

Meta evidence required before Dan review:

- Execution-backed probes only: geometry, computed style, DOM asserts, latency, a11y tree.
- Screenshot plus zoom pairs archived in `__qa-dispatch/`.
- UI action -> engine write -> re-read model -> byte-level diff for each authoring surface.
- Both-state probing for every visibility/state rule.
- Visible/auditable QA ledger. Hidden sub-agent output does not count.
- Two-repo cleanliness after every probe, including untracked files.
- Unverified items closed before their phase.

## 8. Transaction, Durability, Undo, and Recovery

Every authoring command carries `commandId`, expected revision vector, and expected file hashes.

Transaction sequence:

1. Acquire canonical cross-process store/root locks.
2. Load sidecars and exact source bytes once.
3. Verify schema, revision vector, and all source hashes.
4. Validate identities, references, primary ownership, folder cycles, delete guards, and compatibility.
5. Build compile plan from immutable graph/projection snapshots.
6. Materialize proposed sidecar, TSX, CSS, barrel, and consumer outputs in a staged filesystem.
7. Parse every staged TSX/CSS file.
8. Run type-aware semantic assertions where source behavior can compile but still be wrong.
9. Rebuild SourceProjection and prove intended graph delta plus untouched semantics.
10. Persist prepared journal with command, hashes, preimages, after-images, graph patches, and inverse.
11. Install files only through `DurableFileInstaller`.
12. Verify after-hashes, publish durable commit decision, finish participant markers, release locks.

Durable installer requirements:

- unique sibling temp file
- exclusive/no-follow semantics
- same-filesystem staging
- temp file fsync
- temp byte/hash verification
- atomic rename
- containing directory fsync
- installed byte/hash verification
- tombstone rename for deletes
- same sequence for sidecars, participant records, and coordinator decisions

Supported guarantee:

- Process crash/kill and host/power loss only on local filesystems that truthfully support probed atomic rename and fsync semantics.
- Unsupported filesystems refuse `DURABILITY_UNSUPPORTED`.
- Tests may cover injected process/subprocess failure and platform fsync capability. They must not claim synthetic physical power-loss proof.

Undo/redo:

- Rollback is automatic failure recovery inside one transaction.
- Undo is a new revisioned transaction applying recorded inverse against exact current revision/hashes.
- Redo reapplies the original command only while the undo lineage remains current.
- Manual source drift invalidates undo with a named conflict.

## 9. Migration Contract

- No sidecar means strict SourceProjection classification first.
- Single clean union axis may import losslessly as `legacy-single-axis`.
- Multi-axis source remains `legacy-multi-axis`; no automatic Cartesian flattening.
- Hand-edited or ambiguous source becomes `unsupported` with read-only inspection until reconciled.
- Existing `@fc-transition` and `@fc-connector` comments import only the semantics they actually encode.
- Conversion previews variant count, interaction mapping, structural differences, and unsupported cases.
- Conversion refuses if SourceProjection -> graph -> source -> SourceProjection equivalence cannot be proved.
- Refusal leaves all source bytes unchanged.

## 10. Exact Implementation and Test Map

Backend file map:

- Existing `src/app/api/dev/editor/lib.ts`: keep jails/parsers/guards/low-level transforms; facade as SourceProjection; refactor component primitives away from direct writes.
- Existing `editor-write/route.ts`: retain for non-component low-level writes only.
- Existing `editor-component-model/route.ts`: return named SourceProjection, not authoring identity.
- Existing `editor-components/route.ts`: expose projection errors explicitly and join stable IDs/folders.
- New authoring files: types, schema, store, migrations, source projection, commands, compiler, transaction, durable installer, history, and `editor-authoring/route.ts`.

Frontend file map:

- Existing `react-figma/page.tsx`: remove component authoring domain state, direct component writes, auto-promote-on-entry, fixed target chips, and keyed board swap.
- Existing `components-canvas/page.tsx`: retire after one-canvas vertical slice.
- Existing `engine.ts`: keep read bridge/staging; add graph ID messaging only after model proof.
- New component-authoring files: `useAuthoringGraph`, `ComponentCanvas`, `ComponentInspector`, `AssetsTree`, `PreviewSurface`.

Required tests:

- Model identity, SourcePropertyRef ownership/lineage, override tombstones, folders, instances, delete guards.
- Store schema, no absolute paths, runtime root registry/jails, relocation, duplicate-store refusal, hashes, revisions, reload.
- Migration single-axis import, multi-axis hold, unsupported refusal.
- SourceAnchor determinism, formatting/line drift, keyed identity, missing/collision/ambiguity refusal.
- Compiler staged outputs, source-owned values, Spring forms, Set Variant, reset/suppression, unsupported cases.
- Transaction stale hash/revision, locks, coordinator/participants, failure at every boundary, recovery, undo/redo conflict.
- Durable installer exclusive temps, fsync ordering, same-device refusal, tombstones, subprocess-kill recovery.
- Route validation and error/status contracts.
- E2E create/edit/reload/undo, interactions/preview/Back, folders/instances after evidence closure.

## 11. Phase Gates

### G0 - Evidence Closure

Goal:

- Close or explicitly defer the remaining unverified Framer operations before affected phases.

Closed before G2/G3:

- Hover/Pressed created-frame result and auto-wire behavior are observed: named state frame plus implicit straight state wire.
- Connector drag-pickup UX is observed: canvas handle drag creates interaction and opens trigger/Delay popover.

Required before G4:

- Asset-to-canvas insert end to end: menu and drag remain unverified because the synthetic harness cannot fire the panel-to-iframe HTML5 DnD boundary.
- Drag insert only if Dan requires parity rather than treating it as an enhancement.

Deferred from v1:

- New Event action model.

### G1 - Foundation

Allowed scope:

- Graph/types/schema with SourcePropertyRef membership.
- Project-root sidecar store first.
- Logical store identity and runtime root registry.
- Exact source hashes and revisions.
- Durable sidecar install.
- SourceProjection facade.
- Strict read-only classification/import.
- Single-root transaction prepare/commit/rollback using the participant/coordinator shape.
- Persistent history.
- Legacy single-axis classification/import and multi-axis hold/refusal.
- Full model/store/migration/installer/transaction tests.

Forbidden in G1:

- Production authoring UI.
- Semantic create/rename/duplicate/delete variant commands.
- Runtime interaction compiler.
- Folder/instance UX.

### G2 - Variant Compiler and One Canvas Slice

Required:

- Selection -> named component -> same canvas -> create/move/rename variant -> Home -> reload -> undo.
- Semantic variant commands only with staged TSX/CSS output, strict SourceProjection reparse, type-aware assertions, and round-trip fixtures.
- `ComponentDefinition` carries a required, formatting-insensitive `projectionFingerprint`: a hash of the canonical SourceProjection fields (SourceAnchor fingerprints retained, but `lastKnownLine`/`lastKnownCol` excluded from the hash since they are non-semantic). It is set on strict import and on every CompilerAdapter command result. `revalidate-source` and `environment-rebase` both require the current fingerprint to equal the prior accepted one before proceeding; structural, prop, rule, or connector drift refuses `SOURCE_PROJECTION_DRIFT` with zero writes, while formatting/line-only drift (fingerprint unchanged) remains revalidatable. This is guard metadata analogous to `sourceHashes`, not a duplicate of source content, and is the closing mechanism for P0-1's structural-drift gap (typecheck + `projectVariantRegistry()` alone do not prove the projection is untouched). `AuthoringGraphV1` bumps to `schemaVersion: 2` for this addition. Existing on-disk sidecars/history graph preimages at `schemaVersion: 1` are not silently refused and no fingerprint or later authority is fabricated. Migration distinguishes V1 written after the authored/environment split (exact authored hash set and environment fingerprint must still match) from accepted earlier V1 that had only the then-known `sourceHashes`: every legacy authored hash is verified as an unchanged subset; only inputs proven to be generated compiler environment are partitioned out; authorities introduced after that historical schema are admitted only from one jailed exact snapshot after staged TypeScript semantics plus SourceProjection/registry equivalence. Current sidecar fingerprints derive from those verified current bytes. Historical graph preimages instead reconstruct the source state for that revision from durable history preimages and committed undo-transaction blobs, verify the legacy hashes against those reconstructed bytes, and derive the historical fingerprint from those bytes — never from current source. Missing, stale, unparseable, ambiguous, or insufficient historical evidence refuses by name with zero migration writes. The sidecar, migrated history preimages, and schema bump persist in one root-aware transaction under the same §4/§8 authority; this is the established migration mechanism, not a new write path.
- No fixed board remount.
- ONEMO selection/ghost/breadcrumb semantics measured.
- Persistent one-canvas context permits exactly one bounded exception: the first-ever import of a not-yet-tracked component may trigger one full-document reload (Next's App Router route-tree rescan when import-source writes a new tracked sidecar file). No authoring action may issue a second bootstrap marker, or resume/consume an already-live or already-consumed marker from a document other than the legitimate resuming one — any such attempt is a named refusal, not a retry. Mechanism: Architecture §6.5.
- The resume marker that survives this one reload is a versioned, schema'd, TTL-bound record naming the exact target file and expected content hash and the issuing transaction/command ID. The originating document never clears its own marker. Only a different document that resolves the exact named component+graph may clear it. Any invalid, expired, mismatched, or already-consumed marker refuses the resume and cleans up rather than silently proceeding.
- Scope of the restriction above: it binds only the resume-marker lifecycle — a live-or-consumed marker existing that a second issuance/resume attempt would violate. It does not bind ordinary reloads occurring after the marker has already been consumed (tombstoned) and normal editing has resumed; once consumed, no marker is present to violate, and a subsequent reload is a plain page load against current on-disk source-of-truth state, not a bootstrap-reload event. The `Home -> reload -> undo` step above is exactly this ordinary, post-consumption reload — it must succeed and preserve state/undo normally.
- The committed E2E evidence must assert the exact permitted reload phase/count (exactly one bootstrap reload, with proof of before/after document identity) — never a blanket "zero reload" claim and never a test that merely tolerates either path.

### G3 - Interactions and Preview

Required:

- Observed triggers, Delay, Once/Cycle once verified, Reset Override, transitions, straight wires, compiled preview, Back.
- Preview must run generated component output, not a canvas simulation.
- Wire and overlay visibility must be geometry/DOM measured.

### G4 - Assets, Folders, Instances

Required:

- Menu insert first.
- Drag insert only after evidence and Dan decision.
- Folder create/nest/sort/move without import churn.
- Delete guard in UI and engine refusal.
- Detach removes instance identity.
- Replace With and Replace All scopes verified on multiple instances.

### G5 - Fidelity and Resilience

Required:

- V1-V10 full design sweep.
- Accessibility floor for icon controls, handles, menus, popovers, focus, and Escape dismissal.
- Malformed source, drift, concurrency, recovery, reload, undo, and preview-failure evidence.
- Source diff cleanliness in both repositories.

Each phase follows Builder -> QA -> Meta, continuously, with no interim Dan pause between phases. No bulk multi-phase build. Dan reviews once, at the finished final product.

Quality gates for every build phase:

- Builder self-review before handoff.
- Independent QA pass before Meta.
- Meta/design-fidelity pass before Dan.
- `/o-deslop` milestone sweep/review at phase boundaries: find dead, duplicate, dormant, stale, speculative, or over-abstracted code outside the active diff. No destructive cleanup without a Dan-approved kill list.
- Chrome visual/clickthrough proof for any shipped UI behavior. Screenshots, DOM/geometry/computed-style evidence, console/network checks, and source/code parity are required; eyeballing is not enough.

## 12. Quota-Safe Execution and Handoff

Operational rule:

- Continue in small, independently verified snapshots; quota or context pressure never justifies a partial completion claim.
- Do not begin a phase's Builder work while its predecessor's own QA/Meta re-gate remains open. Once a phase's combined QA/Meta pass lands, its successor phase begins immediately — no interim Dan gate between phases.
- Checkpoint after every accepted phase with clean isolated worktree, commit SHA, changed files, source diff, tests run/skipped/failed, browser/console/network evidence, contract rows satisfied/open, next exact command, and durable ledger.
- Never leave uncommitted cross-phase partial work.

## 13. Actor Contract

- `@s58-engineer`: source architecture owner and active Builder. Current state: G1 built and combined-QA-PASSED (`9e9adf4` + library `0af96bd`); G2 build active under Dan's continuous-build directive.
- `@s58-expert`: Framer behavior/domain authority. Current state: final input delivered; second G0 pass closed Hover/Pressed creation+implicit wire and connector drag-pickup; C5 corrected by moving semantic variant/compiler acceptance from G1 to G2; asset-to-canvas insert still needs manual evidence or Dan product decision.
- `@s58-qa`: independent architecture/code/runtime QA and combined G1 gate owner.
- `@s58-designer`: Meta behavior/visual/accessibility fidelity. Current state: acceptance layer and final Meta reconciliation passed; M1-M4 were recommended folds; C5 was identified by Meta and is now corrected.
- `@s58-lead`: final blueprint consolidation and active gate orchestration.
- Dan: architecture/product sign-off and final authorization.

No actor closes its own gate.

## 14. Open Dan Decisions

1. Whether to authorize a short manual Framer pass to close asset-to-canvas insert, or defer/spec it as an explicit product decision.
2. Drag-insert parity: mandatory v1 parity, later enhancement, or ONEMO-specific product choice.
3. RESOLVED — Dan's continuous-build directive: phase progression is not gated on a per-phase Dan acceptance. G2 build begins immediately once G1's own Builder->QA->Meta pass lands.
4. Legacy multi-axis conversion UX: confirm surface, variant count preview, unsupported-case wording.
5. Performance budgets for component edit entry, preview startup, transaction latency, and large-component inventory.

No decision above is treated as approved until Dan explicitly signs it.

## 15. Current Verdict

Architecture direction is strong and no longer blocked by QA. The existing component module is not a strong Framer-authoring foundation by itself: its low-level parser/source primitives are valuable, but the component authoring model must be replaced with the graph/projection/compiler/transaction architecture above.

Dan authorized G1-Foundation implementation, which is built and combined-QA-PASSED (`9e9adf4` + library `0af96bd`). Per Dan's explicit direction, phase progression does not pause for interim sign-off: G2 is authorized and active immediately following G1's QA/Meta pass. Later phases retain their Builder -> QA -> Meta gates continuously, with no interim Dan pause between them; no final Done claim exists until Dan reviews and signs the complete, finished product.
