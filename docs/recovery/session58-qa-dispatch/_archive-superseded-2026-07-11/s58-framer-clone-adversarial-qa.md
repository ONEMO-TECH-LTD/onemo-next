# S58 QA: Framer Component Authoring Reset

**Status:** REWORK. Direct review of the replacement blueprint; not QA sign-off.

**Reviewed:** 2026-07-10, s58-qa. Current expert revision: 228 lines, 12:57 BST.

## 1. Dan's actual acceptance bar

The 11:31-11:45 live test rejected the implementation because it is a fixed component board, not Framer's component-authoring behavior. The reported failures are:

1. Components and variants are not freely placed on one infinite canvas.
2. The breadcrumb is attached to the sheet instead of living in the top canvas bar.
3. Opening Components crashes or reloads and component loading is slow/unreliable.
4. Create-from-element, create, insert, and edit flows are unclear or broken.
5. Connectors do not expose Framer's rules, targets, transitions, editing, and removal behavior.
6. There are no folders.
7. Selecting one component opens the whole component board instead of that component's editing context.
8. The fixed frame is not Framer's canvas.
9. There is no play/live behavior mode.
10. States and variants are hardcoded rather than freely created and edited.

Dan then superseded the expert's thin spec at transcript line 259. The binding directive is:

- Perform a full user-position Framer click-through, not a screenshot tour.
- Inspect console/code as well as visible UI.
- Produce a proper behavior blueprint and plan.
- Copy Framer's behavior/model, interpreted through the existing ONEMO/Figma styling.
- Do not mix Framer chrome into the Figma-styled editor.
- Obtain independent designer and QA Framer passes before accepting the blueprint or implementation.

The expert acknowledged at transcript lines 265-270 that the first extraction was a fast screenshot tour, not the required behavioral inspection. Therefore `s58-framer-clone-SPEC.md` is superseded evidence, not an approvable blueprint.

## 2. Evidence status

### Fully verified by QA

- Full expert day file through every line present at the latest review checkpoint; append-only monitoring continues for revisions and peer findings.
- Full 99-line expert thin spec.
- Full current component/editor implementation: 8,273 source lines across the main editor, component canvas, engine, editor write/model library, and API routes.
- Current worktree and Git state.
- Independent authenticated Playwright pass across D1-D12, including component creation, variant creation, interaction removal/undo, transition editing, preview behavior, instance menus, conditional inspectors, console, network, and URL state. Exact evidence is in `s58-framer-extraction-qa-ledger.md`.

### Secondary evidence only

Expert-only claims remain secondary unless reproduced in `s58-framer-extraction-qa-ledger.md`. QA independently confirmed same-canvas editing, free variants, component creation from selection, separate Transition/Event paths, Set Variant editing, preview, Assets menus, and the presence of instance context actions. Folder CRUD, drag/click insert, event actions, Pressed-state creation, and destructive operations remain unverified.

### Expert extraction quality finding

The original live ledger overstated one claim: its D6 section was labelled `SEEN, operated live`, then listed a hover/press/appear/scroll trigger family that the transcript showed was inferred. Designer and QA later captured the dropdown directly, and the expert independently re-probed it. The current ledger/blueprint now correctly use `Click`, `Click Start`, `Appear`, `Mouse Enter`, and `Mouse Leave`. This correction proves why observed/inferred labels remain mandatory.

The D11 heading similarly calls the inspector list `FULL` without yet demonstrating every conditional section, state, menu, or selected-node type. A visible frame-inspector snapshot is not a full component-authoring inspector model.

The later `COVERAGE: all D1-D12 covered` declaration is also contradicted by the ledger itself:

- Drag insert was not reproduced; the ledger substitutes “real users drag fine.”
- Detach/replace was originally attributed to Figma parity; later passes observed the menu commands but still did not operate their mutations end to end.
- `New Event` vocabulary and action behavior remain uncaptured.
- Variant rename/delete/reposition, folder CRUD/nesting/move, interaction retargeting, preview failure/reset/history, undo/redo, and resilience paths were not operated end to end.

These gaps do not invalidate the observations that were actually made. They invalidate the claim of exhaustive coverage and any blueprint requirement derived from uncaptured behavior.

### Independent Framer pass: complete through authenticated Playwright

- The Chrome extension bridge remained unavailable after existing-window, new-window, and reinstall recovery. That failed path is logged in `ERRORS.md`.
- Dan authenticated Framer in the Playwright-controlled Chrome window. QA then operated the `Powerful Autonomy` scratch project directly and captured a trace plus network log.
- The pass independently covered all D1-D12 dimensions. It separates observed facts from inference and keeps unsuccessful folder naming, insert/drag, event, Pressed-state, and destructive operations explicitly unverified.
- The pass created scratch-only `Variant 3` and `QAFrame`. It did not edit product source or perform destructive cleanup.

## 3. Current implementation findings

### Critical: the authoring domain model is wrong

The backend models authoring as string-union variant axes plus a fixed state vocabulary:

- `src/app/api/dev/editor/lib.ts:267-295` defines `add-variant-axis`, `add-variant-value`, fixed state names, and only four connector triggers.
- `src/app/api/dev/editor/lib.ts:276-280` makes axis/value operations and `state | switch` connectors the public write contract.
- `src/app/api/dev/editor/lib.ts:1081-1186` compiles connectors as base state transitions or tap-driven axis switching.
- `src/app/api/dev/editor/lib.ts:1530-1580` reconstructs component variants from union props and switch connectors from source annotations.

This cannot represent a Framer-like graph of freely named variants, arbitrary variant frames, authored positions, explicit interaction edges, or a broader trigger vocabulary without a first-class model change. Re-skinning the existing axis chips would preserve the rejected architecture.

### Critical: component editing is a remounted fixed board

- `src/app/(dev)/react-figma/page.tsx:2325-2338` switches into a separate component mode and defines Base, axis, and six fixed state targets.
- `src/app/(dev)/react-figma/page.tsx:3506` fixes component host dimensions at 1480 x 1040.
- `src/app/(dev)/react-figma/page.tsx:3999-4082` renders the breadcrumb and authoring controls inside the canvas content, then keys an iframe by component route/file.
- `src/app/(dev)/react-figma/components-canvas/page.tsx:210-250` groups inventory frames and injects six ghost states for the edited file.
- `src/app/(dev)/react-figma/components-canvas/page.tsx:336-362` renders all groups in a padded, fixed flex board.

This explains Dan's observed whole-board navigation, fixed frame, misplaced breadcrumb, and reload behavior. The iframe key guarantees remount on mode/file changes. Whether that alone causes the reported crash requires runtime tracing. Framer also uses a sandboxed canvas iframe, so the defect is not iframe use itself; it is swapping to a second fixed component-board route instead of preserving one canvas/editor context.

### High: assets, creation, insertion, and instance flows are incomplete

- `src/app/(dev)/react-figma/page.tsx:2216-2254` is a category-grouped list with click-to-jump and double-click-to-edit. It has no drag interaction or folder tree.
- `src/app/(dev)/react-figma/page.tsx:3914-3933` exposes a blank-component form plus a separate context-menu insert/edit flow.
- `src/app/api/dev/editor/lib.ts:294-295` exposes only `insert-component` and `create-component` for this area.
- `src/app/api/dev/editor/lib.ts:2080` creates a component in an optional category path; there is no folder entity or folder operation.
- `src/app/api/dev/editor/lib.ts:2253` inserts only into a selected JSX location.

There is no verified create-from-element end-to-end flow, drag insert, folder CRUD/reparent, detach instance, replace instance, or go-to-main-component operation.

### High: connectors are a narrow compiler feature, not a Framer interaction editor

- `src/app/(dev)/react-figma/components-canvas/page.tsx:52-124` draws a connector overlay whose target determines either fixed state or axis switch.
- `src/app/(dev)/react-figma/components-canvas/page.tsx:124` hardcodes axis targets to `tap`, `cycle: true`.
- `src/app/api/dev/editor/lib.ts:280-281` permits only `hover | pressed | focus | tap`, state/switch modes, and constrained targets.

Missing authoring contracts include trigger selection, edge retargeting, target deletion semantics, transition editing UI, event variants, interaction ordering/conflicts, and behavior when target variants are renamed or deleted.

### High: preview and resilience contracts do not exist

No component preview session or play route exists in the reviewed model. Loading, crash recovery, unsaved changes, error boundaries, latency budgets, and selection persistence across edits are also absent from the thin spec.

### Medium: the thin spec directly conflicts with Dan's style directive

`s58-framer-clone-SPEC.md:89` says P6 should "Match Framer's chrome." Dan's later line-259 directive says Framer behavior must be interpreted through ONEMO/Figma styling and must not become a mixed bag. The later, explicit directive wins. This conflict must be deleted from the new blueprint rather than averaged.

## 4. Adversarial review of the expert's P0-P6 plan

The current P0-P6 plan is not implementation-safe:

1. P2 proposes free authoring while preserving `add-axis`/`add-value` underneath. That risks disguising the rejected axis model instead of replacing it with a free variant graph.
2. Create, edit, insert, instances, and folders are delayed to P5 even though they define the editor's information architecture and the user's entry path.
3. Visual parity is delayed to P6 and targets Framer chrome. Styling constraints must be explicit acceptance criteria in every phase.
4. Crash, latency, and broken insert are labeled optional P0. These are release blockers. Diagnostic work may be isolated, but they cannot remain optional acceptance criteria.
5. There is no canonical state model, persistence format, migration plan, undo/redo contract, selection model, or compatibility adapter.
6. There is no exhaustive behavior inventory or negative-state matrix, despite the claim to clone all features.
7. There are no measurable gates for performance, console cleanliness, error recovery, or source integrity.
8. It assumes the engine is "the hardest half" and reusable without proving the new authoring model can compile to it losslessly.

## 5. Required blueprint before implementation

### R0. Independent behavior extraction

Create an interaction ledger from an authenticated Framer project. For every action record entry point, prerequisites, pointer/keyboard gesture, visible states, state mutation, URL/history effects, console/network evidence, undo behavior, error behavior, and exit path.

Minimum flows:

- Assets tree: create folder, nest, rename, reorder, move, sort, delete, empty/error states.
- Component creation: blank, from selected element, shortcut, context menu, cancellation, invalid names.
- Component editing: instance entry, Assets entry, breadcrumb, back/home, selection preservation, zoom/pan.
- Variants: create, rename, duplicate, delete, reorder/reposition, state slot behavior, default/main selection.
- Interactions: create, trigger menu, target, transition, retarget, edit, remove, conflicting edges, deleted targets.
- Preview: enter, interact, reset, viewport, errors, back, history state.
- Instances: insert by click/drag, detach, replace, go to main, overrides, missing source.
- Resilience: reload, slow load, malformed component, compile failure, concurrent change, undo/redo.

Deliver screenshots or recordings, console/network traces, and exact Framer observations. Separate observed fact from inference.

### R1. Canonical authoring model and compiler boundary

Define first-class entities before UI work:

- `ComponentDefinition`
- `VariantFrame`
- `InteractionEdge`
- `TransitionSpec`
- `ComponentInstance`
- `AssetFolder`
- `CanvasNode`
- `PreviewSession`

The authoring model must not expose CVA axes or fixed pseudo-state unions as its primary abstraction. Existing source transformations may remain behind a compiler adapter only after a lossless mapping proof and explicit unsupported-case behavior.

Acceptance gate: model tests cover create/rename/delete/reorder, edge integrity, instance references, folder moves, serialization, migration, undo, and compiler round trips.

### R2. One-canvas edit vertical slice

Implement one selected component end to end on the existing ONEMO/Figma canvas:

- Enter from an instance and Assets.
- Preserve the same canvas/pan/zoom system.
- Show only the active component's freely positioned variant frames.
- Put Home > Component in the canvas top bar.
- Exit without remounting the editor or losing selection/history.

Acceptance gate: no fixed component iframe board, no whole-inventory render, no crash, no console error, and measured entry latency.

### R3. Create, insert, and instance vertical slice

Unify blank creation and create-from-selection into one coherent model. Add click and drag insertion, edit main, detach, replace, and go-to-main. Folder placement must work at creation time.

Acceptance gate: every entry path reaches the same canonical component and produces a working instance with undo/redo.

### R4. Free variants and states

Build arbitrary variant CRUD, naming, positioning, duplication, deletion, and default selection. Only then adapt compatible variants to generated React/CSS/CVA code.

Acceptance gate: no authoring UI or persistence dependency on the current six states or axis/value chips.

### R5. Interaction graph

Build connector creation, trigger selection, target selection, transition editing, retargeting, deletion, and referential cleanup. Define arbitrary/event triggers from verified Framer evidence rather than inventing a vocabulary.

Acceptance gate: graph tests plus user flows for create/edit/repoint/delete and deleted/renamed targets.

### R6. Live preview

Add Play, full behavior execution, reset, Back, history semantics, and clear runtime errors.

Acceptance gate: authored interactions execute from generated source, not mocked UI state.

### R7. Asset folders and organization

Complete folder CRUD, nesting, sorting, moving, keyboard/context actions, and persistence.

Acceptance gate: tree survives reload and moves do not break imports or instances.

### R8. Fidelity, performance, and resilience

Validate each flow against independent Framer behavior evidence while preserving ONEMO/Figma styling tokens and interaction chrome. Set explicit budgets for edit entry, insert, preview start, and component load. Add error boundaries and recovery tests.

Acceptance gate: side-by-side behavioral matrix, designer styling review, QA console/code review, typecheck/tests, and Dan sign-off. Agents do not mark Done.

## 6. Review gates for the expert's revised blueprint

QA will reject the next blueprint unless it includes:

1. Full user-position click-through evidence, not feature labels.
2. Console/code/network evidence tied to each behavioral claim.
3. Observed-versus-inferred labels.
4. An exhaustive action/state/error inventory.
5. A first-class authoring model and migration/compiler boundary.
6. ONEMO/Figma visual-language constraints per phase.
7. Exact acceptance tests, performance budgets, and failure recovery.
8. Independent designer and QA findings, with conflicts resolved rather than blended.

## 7. Verdict

**REWORK.** The current implementation is structurally incapable of satisfying the brief without replacing the component authoring model and fixed component board. The expert's first spec is explicitly superseded. The replacement blueprint has now been independently checked against authenticated Framer behavior and still fails sign-off. Final QA remains open until the blueprint is revised, peer findings are folded in, and the resulting implementation passes the required gates.

## 8. Superseded review of the 161-line replacement blueprint

**Reviewed artifact:** `s58-framer-clone-BLUEPRINT.md`, 161-line version written 2026-07-10 12:23 BST. Retained as revision history; current 228-line review is section 11.

**Verdict:** REWORK. Do not sign and do not build from this version.

### Critical: it promises the exact Framer model while preserving the incompatible model

Blueprint lines 9-12 say the Framer behavior/model must be cloned exactly and that the engine stays. Lines 89, 118, and 141-144 then explicitly retain the current multi-axis variant mechanics and whole engine as the backing for free variants.

Current source contradicts that compatibility claim:

- `src/app/api/dev/editor/lib.ts:275-281` exposes six fixed state values, union-axis creation/value extension, and only `state | switch` connectors with four triggers.
- `src/app/api/dev/editor/lib.ts:1261-1276` defines `ComponentModel.variantAxes` as independent string-union props and connectors as state/switch targets.
- `src/app/api/dev/editor/lib.ts:1529-1583` derives the model directly from union props and source annotations.
- There is no free `VariantFrame`, authored frame position, arbitrary interaction edge, event action, variant rename/delete/reorder, or stable variant identity in the model.

The existing parser/writer/parse-guard infrastructure may be reusable. The current authoring model and operations cannot be declared reusable without a lossless mapping proof. Required correction: introduce a canonical free-variant graph, then treat compatible CVA/React/CSS transforms as a compiler adapter. Unsupported mappings must fail explicitly rather than force Framer behavior into axes.

### Critical: the blueprint promotes unobserved or incorrect behavior to requirements

- Lines 38-40 and P3 encode Click/Hover/Press/Appear/Scroll. Independent QA opened the Set Variant dialog and observed `Click`, `Click Start`, `Appear`, `Mouse Enter`, and `Mouse Leave`. The blueprint vocabulary is not Framer's displayed vocabulary for this interaction.
- Lines 51-54 claim drag insert and detach/replace together. Independent QA observed Detach Instance, Replace With, and Replace All Instances With in the instance context menu, but did not operate them end to end. Drag insert was not reproduced.
- Lines 56-58 label one visible frame inspector ordering as full without covering conditional component/instance/variant states.
- Nested folder behavior and CRUD lifecycle are asserted from a visible tree/menu, not operated end to end.

Required correction: label each requirement `observed`, `inferred`, or `unverified`; remove inferred vocabulary from build scope until directly captured. “Every feature” cannot be proven by a high-level menu inventory.

### Critical: the build map is not grounded in the actual operations

Blueprint B11 maps create-from-element to `create-component`. Current source uses a distinct `make-component` operation at `src/app/api/dev/editor/lib.ts:291` and `src/app/api/dev/editor/lib.ts:2107`; blank creation uses `create-component` at line 295/2080. This is not a naming nit: they have different inputs, mutations, and failure modes.

B13 says instance operations are partial/backed by “instance ops,” but the reviewed write contract has only `set-instance-prop` and insert. There are no detach, replace, or go-to-main operations. B10 likewise has no folder entity or CRUD contract; `editor-components/route.ts:45-47` reduces a path to its first category segment.

Required correction: give every blueprint behavior an exact current op, required new op, data mutation, persistence location, undo inverse, migration impact, and failure mode. Do not use generic labels such as “instance ops” or “folder ops.”

### High: phase order still preserves the wrong architecture

- P0 spends effort stabilizing the disposable fixed board without separating diagnostic fixes from throwaway UI work.
- P1 builds the shell before the canonical component/variant/interaction persistence model exists.
- P2 implements free authoring on axis mechanics.
- P5 delays create/insert/instance/folder entry paths even though they define identity, navigation, and persistence.
- P6 delays styling fidelity, allowing mixed Framer/ONEMO chrome to accumulate until the end.

Required correction: use the R0-R8 order in this QA document. Evidence first, canonical model/compiler boundary second, then thin end-to-end vertical slices. Apply ONEMO/Figma style contracts in every slice, not as final polish.

### High: acceptance criteria are not sufficient to prove fidelity

P1's “matches Framer behaviour,” P3's “triggers match Framer set,” and P6's designer sign-off are circular or subjective. The plan lacks:

- Exact interaction fixtures and state-transition assertions.
- Persistence/reload, undo/redo, rename/delete referential-integrity tests.
- Error, malformed source, compile failure, concurrency, and recovery behavior.
- Console/network cleanliness and measured browser performance, except an unexplained `<1s` P0 target.
- Source-generation round-trip fixtures proving the canonical model compiles without loss.
- A side-by-side evidence matrix linking each Framer observation to an ONEMO implementation test.

Required correction: each phase needs executable model tests, browser flows, console/network assertions, source diffs, reload/undo tests, and explicit measured budgets.

### High: architecture statement is misleading

Blueprint lines 20-24 imply the iframe split explains why the current board felt wrong. Framer's split is author canvas versus live preview. The current editor already uses an iframe, but swaps component editing into a second fixed `/react-figma/components-canvas` board keyed by file. The required change is one persistent authoring context plus a separate preview surface, not merely “use iframe split.”

### High: the expert closed its goal before its own verification gate

Blueprint lines 148-155 require independent designer and QA digs, findings folded into a revision, and only then Dan review. The expert transcript at 12:25 declares its goal satisfied immediately after dispatch, before either peer returned findings. Dispatch is not verification. The blueprint remains pre-gate and cannot be presented as complete.

### Required rework before peer sign-off

1. Complete the missing independent Framer operations and correct evidence labels.
2. Replace the “whole engine stays” premise with a seam-by-seam keep/modify/replace audit.
3. Define canonical entities, identities, persistence, undo inverses, migrations, and compiler adapters.
4. Rebuild the behavior map using exact existing/new operations rather than capability labels.
5. Reorder implementation into evidence/model-first vertical slices.
6. Add measurable acceptance matrices for behavior, ONEMO styling, generated source, performance, and recovery.
7. Return the revised blueprint to independent designer and QA passes before Dan review.

## 9. Requirement-by-requirement completion audit

| Objective requirement | Evidence | Status |
|---|---|---|
| Recover Dan's complaint/directive from expert pane | Expert day file fully read through the current checkpoint; directive captured in section 1 | **COMPLETE** |
| Ensure expert extracts full Framer component behavior/UI | Expert ledger and transcript reviewed; declared coverage contradicts uncaptured flows in section 2 | **NOT COMPLETE** |
| Independent QA Framer Chrome/Playwright console + UI pass | Authenticated Playwright pass completed across D1-D12; trace, network log, console, URL, DOM, screenshots, and operation evidence recorded in `s58-framer-extraction-qa-ledger.md` | **COMPLETE WITH EXPLICIT UNVERIFIED CASES** |
| Read current implementation fully | 8,273 source lines plus repo controls read; exact gaps in section 3 | **COMPLETE** |
| Read expert's delivered plan/blueprint fully | Thin spec, 161-line version, and current 228-line 12:57 revision read in full; reviews in sections 8 and 11 | **COMPLETE** |
| Identify current code and plan gaps | Source-backed critical/high findings in sections 3, 4, 8, 10, and 11 | **COMPLETE** |
| Maintain evidence ledger | `/tmp/s58-qa-framer-reset-ledger.md`, `s58-framer-extraction-qa-ledger.md`, plus this durable QA artifact | **COMPLETE TO CURRENT CHECKPOINT** |
| Compile independent adversarial plan/fix plan | R0-R8 plan and revised-blueprint gates in sections 5, 6, 10, and 11 | **COMPLETE** |
| Independent designer verification | Full 94-line live ledger, 54-line blueprint review, and 80-line gap report read; designer findings folded by expert | **COMPLETE WITH CAVEATS** |
| Peer findings folded into expert revision | Designer findings are folded into the 228-line revision; independent QA findings and source-model objections are not | **PARTIAL** |
| Implementation satisfies Dan's entire directive | No post-sign-off implementation exists; current code remains the rejected architecture | **NOT STARTED** |

**Audit result:** the independent QA browser gate is now complete. The overall objective still cannot pass because the expert blueprint contains contradicted and unverified behavior, QA findings have not been folded into a revision, and no replacement implementation has passed the four-stage pipeline.

## 10. Independent Playwright corrections to the blueprint

The authenticated QA pass changes the blueprint in ways that are architecture-relevant, not cosmetic:

1. **Creation is a model transition.** `Cmd Option K` on a selected Frame opens a titled `New Component` dialog. Create replaces the source layer with a named component instance, registers the component asset, changes the node URL, and enters `Home > Component` with a Primary variant. This needs one transactional operation and undo inverse, not disconnected create and navigation UI.
2. **Variants are primary-linked override frames.** A new free variant exposes Show Primary, Detach From Primary, Update Primary, and Reset Overrides. A canonical `VariantFrame` therefore needs stable identity plus primary/override lineage; position alone is insufficient.
3. **Interaction removal is override-aware.** Removing Variant 2's inherited `Set Variant` interaction produced `Reset Override`; undo restored the interaction and Layers marker. Edge deletion semantics must distinguish authored deletion from overriding inherited behavior.
4. **Trigger requirements must use observed vocabulary.** Set Variant exposed Click, Click Start, Appear, Mouse Enter, and Mouse Leave, with Once/Cycle and explicit target variants. `New Event` is a separate path whose action model remains unverified.
5. **TransitionSpec must support two Spring parameterizations.** Framer exposes time-based Spring (Time/Bounce/Delay) and physics-based Spring (Stiffness/Damping/Mass/Delay), plus Instant and Ease. The blueprint's single physics-like shape is incomplete.
6. **Instance operations are context-menu actions.** Detach and Replace are not persistent inspector controls. Main-component entry is the explicit inspector `Edit Component`; context-menu `Edit` did not enter the component node.
7. **Authoring and preview are separate sandboxes.** Framer uses a persistent authoring `canvas-iframe` and a distinct `preview-iframe`; the defect in ONEMO is the fixed remounted component-board model, not iframe use itself.
8. **Folders, insert, drag, event actions, and destructive operations remain evidence gaps.** The revised blueprint must either obtain direct evidence or define these as ONEMO product decisions, never label them exact Framer behavior.

## 11. Direct review of the current 228-line revision

**Reviewed artifact:** `s58-framer-clone-BLUEPRINT.md`, 228 lines, modified 2026-07-10 12:57 BST, plus the current expert ledger and all three designer artifacts.

**Verdict:** REWORK. The designer corrections improved behavioral accuracy, but the document is not architecture-safe and contradicts its own exact-evidence gate.

### Critical: “keep the whole engine” still conflates infrastructure with the incompatible authoring model

The revision keeps the same core premise in THE LAW, B4/B6/B11/B13/B15, P2, P3, and KEEP vs SCRAP: the whole codegen engine/model and multi-axis shape stay, while only the editor surface changes. P2 is explicit: free-form authoring remains multi-axis under the hood.

The current source cannot represent the independently observed behavior without a new canonical model:

- `ComponentModel.variantAxes` is a set of string-union props, not a flat set of stable variant IDs with display aliases.
- State/switch connectors have fixed modes and four triggers; they do not represent arbitrary per-variant interaction rows, Delay, Once/Cycle, Reset, New Event, or override lineage.
- There is no authored variant X/Y, primary/override link, inherited-interaction override, asset-folder entity, component preview session, detach operation, replace operation, or stable interaction-edge identity.
- QA proved that variants have Show/Detach/Update Primary and that removing inherited behavior produces Reset Override. Those are model semantics, not surface styling.

The designer's fetched Framer module strengthens this objection: Framer uses flat generated variant IDs plus a human-readable alias map. It proves the desired compile target, not that ONEMO's current union-axis authoring model already supports it. Correct verdict: keep parsers, writers, parse guards, and compatible transforms; modify or replace the authoring model and operations behind a compiler adapter with explicit lossless/unsupported cases.

### Critical: the behavior map still names operations that are wrong or do not exist

- B11 maps create-from-element to `create-component`; current source uses `make-component` for selection conversion and `create-component` for blank creation. They have different inputs, mutations, and failures.
- B13 says generic “instance ops,” but current writes do not include detach, Replace With, Replace All Instances With, or go-to-main.
- B10 says “folder ops,” but there is no folder entity, nesting persistence, move contract, or undo inverse.
- B6 says port/extend `set-connector`, but the observed primary-linked override and Reset Override semantics require a richer edge/override model, not only more trigger enum values.

Every build-map row needs current op, new op, canonical mutation, persistence location, undo inverse, migration effect, compiler mapping, and failure behavior. Capability labels are not an implementation plan.

### Critical: the blueprint calls itself sign-ready while exact behavior remains deliberately unknown

The LAW requires every feature to come from Framer's real mechanics, but the current revision leaves these as pre-build hand-checks:

- New Event vocabulary and action model.
- Exact selected-label/play-badge rule.
- Connect-handle pickup/drag behavior.
- Hover/Pressed state creation result and auto-interaction behavior.
- Drag insert, which all three automation passes failed to operate.

Open extraction items may be acceptable before their individual build phase, but then the blueprint is a staged research/build plan, not an exact sign-ready specification of every feature. It must say which gate Dan is signing and prohibit phase entry until that phase's evidence is closed.

### High: phase order still puts UI and bug patches before the canonical model

P0 patches crash/load/drag on the disposable fixed board. P1 builds the shell before entity identity, persistence, migration, and undo exist. P2 then presents free variants on the existing multi-axis model. P5 delays create/insert/instance/folder lifecycles even though those define component identity and references.

Required order remains R0-R8: close evidence, define canonical model/compiler boundary, then implement thin end-to-end slices. Diagnostic P0 work is valid; throwaway board stabilization is not unless explicitly isolated and time-boxed.

### High: acceptance criteria do not prove the promised fidelity

The revision still lacks executable fixtures for serialization, reload, undo/redo, rename/delete referential integrity, deleted interaction targets, inherited overrides, compiler round trips, malformed source, compile failure, concurrency, and recovery. The `<1s` target has no measurement protocol or baseline. “Matches Framer behaviour” and “designer-verified” are review labels, not tests.

Each phase needs model tests, browser flows, generated-source diffs, console/network assertions, persistence/reload checks, undo checks, and measured latency budgets tied to named operations.

### High: drag insertion is still promoted above its evidence level

The current blueprint states drag-from-Assets as observed Framer behavior and gives it a P0/P5 acceptance criterion. Expert, designer, and QA ledgers all state that synthetic drag was not reproduced. Menu Insert was visible, but QA did not observe a new layer after activating it. Drag insertion can remain an ONEMO product requirement, but it must be labelled `UNVERIFIED FRAMER / REQUIRED BY DAN`, not exact extracted behavior.

### Current gate

The designer lane is closed on visual/behavior direction, but its “keep engine” conclusion conflicts with source evidence and therefore does not close architecture QA. Independent QA browser evidence is complete. The next valid artifact is a Codex-owned architecture revision that folds sections 10-12, performs a seam-by-seam keep/modify/replace audit, and returns to QA before Dan sign-off. The expert supplies Framer evidence and challenges omissions but is not the sole revision authority. No build should start from the current revision.

## 12. QA solution proposal: canonical graph plus source compiler

This is the proposed implementation, not merely a list of objections. It is deliberately narrower than “rewrite the engine” and more honest than “keep the whole engine.”

### 12.1 Architecture decision

Use two explicit representations with one guarded compiler boundary:

1. **AuthoringGraphV1** is the editor model. It owns stable identity, canvas position, primary/override lineage, interactions, asset organization, and instance references.
2. **SourceProjection** is parsed from the real TSX/CSS. It owns component structure, declarations, props, imports, and generated runtime behavior.
3. **CompilerAdapter** applies an authoring transaction to staged TSX/CSS, reparses the result, and proves the resulting SourceProjection matches the intended graph before committing.

The current `ComponentModel` becomes SourceProjection rather than pretending union props are the authoring identity. TSX/CSS remain the shippable product source; a sidecar stores only editor metadata that clean source cannot represent without pollution.

### 12.2 Minimal canonical entities

```ts
type AuthoringGraphV1 = {
  schemaVersion: 1
  revision: number
  projectId: string
  components: ComponentDefinition[]
  variants: VariantFrame[]
  interactions: InteractionEdge[]
  instances: ComponentInstance[]
  folders: AssetFolder[]
}

type ComponentDefinition = {
  id: string
  displayName: string
  sourceFile: string
  sourceExport: string
  primaryVariantId: string
  folderId: string | null
  sourceHash: string
}

type VariantFrame = {
  id: string
  componentId: string
  displayName: string
  frame: { x: number; y: number; width: number; height: number }
  primaryId: string | null
  stateKind: "custom" | "hover" | "pressed"
  transition: TransitionSpec
}

type TransitionSpec =
  | { kind: "instant"; delayMs: number }
  | { kind: "ease"; durationMs: number; easing: string; delayMs: number }
  | { kind: "spring-time"; durationMs: number; bounce: number; delayMs: number }
  | { kind: "spring-physics"; stiffness: number; damping: number; mass: number; delayMs: number }

type InteractionEdge = {
  id: string
  componentId: string
  sourceVariantId: string
  trigger: "click" | "click-start" | "appear" | "mouse-enter" | "mouse-leave"
  action: { kind: "set-variant"; targetVariantId: string } | { kind: "reset-override" }
  repeat: "once" | "cycle"
  delayMs: number
  inheritedFromEdgeId: string | null
}

type ComponentInstance = {
  id: string
  componentId: string
  sourceFile: string
  sourceLocation: { line: number; col: number }
  variantId: string
  detached: boolean
}

type AssetFolder = {
  id: string
  name: string
  parentId: string | null
  sortKey: string
}
```

`New Event` is intentionally absent until its real action/trigger model is extracted. Do not add a generic event abstraction from imagination.

### 12.3 Persistence decision

Store the graph in a versioned editor-only sidecar under the project component root, for example:

`src/app/(dev)/react-figma-components/.onemo/authoring-v1.json`

Why a sidecar:

- Canvas X/Y, stable IDs, folder membership, selection lineage, and inherited overrides are editor metadata, not clean component source.
- It avoids adding proprietary annotations to emitted React/CSS.
- Folder organization stays independent of filesystem paths, so moving an asset folder does not churn imports or rename source files.
- `sourceHash` makes hand-edited source drift loud. A mismatch triggers reconcile-or-refuse; it never silently overwrites code.

The sidecar is not allowed to duplicate declaration values or JSX content. Those remain source-derived. This limits drift to the metadata that only the editor can own.

### 12.4 Command and transaction boundary

Add explicit `AuthoringCommand` operations rather than stretching the current enums:

- `create-component-from-selection`
- `create-blank-component`
- `create-variant`, `rename-variant`, `move-variant`, `set-primary-variant`
- `set-transition`
- `create-interaction`, `update-interaction`, `reset-interaction-override`, `delete-interaction`
- `insert-instance`, `detach-instance`, `replace-instance`, `replace-all-instances`
- `create-folder`, `rename-folder`, `move-folder`, `move-component-to-folder`, `sort-folder`

Every command carries `expectedRevision`. The server must:

1. Acquire the project write lock.
2. Load graph and touched source bytes.
3. Reject a stale revision or source-hash mismatch.
4. Validate names, references, primary ownership, cycles, delete guards, and target existence.
5. Compile into temporary graph/TSX/CSS outputs.
6. Parse-check TSX, parse-check CSS, re-read SourceProjection, and assert intended round-trip semantics.
7. Commit all touched files or restore byte-exact preimages on failure.
8. Return the new revision plus a bounded-session transaction ID for undo/redo.

The current global `writeQueue` is a useful primitive, but serialization alone is insufficient. The new transaction wraps graph plus source writes and prevents partial success.

### 12.5 Keep, modify, replace, build

**Keep:**

- Filesystem jailing and strict input validation.
- TypeScript/PostCSS parsing utilities.
- Byte-preserving edit helpers and output parse guards.
- Source inventory and component export discovery.
- `make-component`, `create-component`, and `insert-component` as low-level compiler primitives after transaction wrapping.
- Generated React/CSS as the shipping output.

**Modify:**

- Rename/reframe `ComponentModel` as SourceProjection.
- Wrap all writes in revisioned graph/source transactions.
- Extend compiler transforms for flat stable variant IDs, both Spring forms, observed triggers, and per-variant interaction overrides.
- Make inventory read nested AssetFolder metadata instead of first-directory-only categories.
- Split display identity from source export/path identity.

**Replace:**

- `variantAxes` as the primary authoring model.
- Fixed six-state authoring and state/switch-only connector identity.
- The fixed all-components board and keyed component-board remount.
- Generic “instance ops” labels with no implementation contract.

**Build new:**

- AuthoringGraph repository/schema/migration.
- Persistent one-canvas component edit state.
- Primary/override lineage and interaction inheritance semantics.
- Separate compiled preview surface.
- Folder and instance operations with referential guards.
- Transaction journal and user-visible recovery failures.

### 12.6 Legacy migration rule

Do not automatically flatten existing multi-axis components into a Cartesian explosion of free variants.

- Import a legacy component losslessly when one union axis maps cleanly to named variants.
- Preserve multi-axis components as `legacy-axis` SourceProjection until a user explicitly converts them.
- Before conversion, show the exact resulting variant count and unsupported connector/structure cases.
- Refuse conversion when the compiler cannot prove round-trip equivalence.

This protects existing source and avoids disguising a destructive migration as a visual redesign.

### 12.7 Build sequence and gates

**G0: close behavior evidence.** Hand-operate New Event, label badge, Hover/Pressed creation result, connector pickup, and drag insert. Output exact observed/inferred labels. No affected phase starts with an unknown contract.

**G1: model/compiler proof, no production UI.** Implement AuthoringGraphV1, sidecar repository, revision/hash checks, and compiler round trips for create/rename/move variant plus Set Variant. Gate: model tests, migration fixtures, byte-exact rollback, and reparse equality.

**G2: one complete authoring slice.** Convert selected frame -> named component -> enter same canvas -> create/move/rename variant -> Home -> reload -> undo. Gate: one transaction model, stable iframe, no fixed board, no source corruption, zero console errors.

**G3: interactions and preview.** Add observed triggers, Once/Cycle, Delay, Reset Override, both Spring forms, selection-scoped straight wires, and compiled preview. Gate: actual generated component changes state in preview; edge delete/reset/undo round-trip; Back restores edit context.

**G4: assets, folders, and instances.** Build menu insert first, then drag after G0 evidence; implement folder metadata, delete guard, detach, Replace With, Replace All. Gate: reload persistence, imports unchanged by folder moves, missing-target failures, and referential-integrity tests.

**G5: fidelity and resilience.** Apply ONEMO/Figma chrome in every slice, then run the final semantic-parity pass, malformed-source recovery, concurrent-revision conflicts, and performance measurement.

Provisional performance decisions, explicitly not claimed as Framer facts: measure 20 warm runs; warm component entry p95 <= 500ms, cold entry p95 <= 2s, preview start p95 <= 1s. Dan may adjust these before build sign-off.

### 12.8 Ownership recommendation

Use the fresh **`@s58-engineer` Codex lane as Architecture Owner + Builder** in an isolated worktree. It first produces the source-backed architecture revision without product edits. After QA, Meta, and Dan approve that gate, the same lane implements it. Keep `s58-expert` as a Framer/domain evidence contributor, not the revision or implementation authority. Keep `s58-qa` independent of code changes. Use `s58-designer` for Meta visual/behavior review, then Dan sign-off.

Why:

- The existing expert twice promoted inference to fact and declared completion before its own peer gate.
- The current blueprint still protects the wrong model despite source evidence.
- A fresh builder starts from the canonical contract rather than defending sunk work.
- Separating Builder from QA preserves the required four-stage pipeline.

If s58-qa becomes Builder instead, assign a different fresh Codex lane as QA. The same actor must not implement and issue the final QA verdict.

### 12.9 Solution defense

This proposal is the minimum structural change that can satisfy Dan's directive:

- It clones the observed Framer authoring model instead of reskinning axes.
- It preserves the valuable clean-source writer and parse-safety work.
- It makes free canvas geometry, variant lineage, folders, and interactions persistable.
- It makes hand-edited drift and unsupported mappings fail loudly.
- It gives undo, migration, preview, and instance integrity a testable boundary.
- It avoids a broad rewrite by retaining proven low-level source operations behind a new compiler adapter.

The main cost is a versioned sidecar plus transaction/compiler work. That cost already exists implicitly in the requested behavior; refusing to model it only moves the complexity into brittle UI state and recreates the rejected board.

### 12.10 Exact implementation impact map

This is the bounded starting map the Codex architecture owner must confirm or correct before editing.

**Existing backend files to modify:**

- `src/app/api/dev/editor/lib.ts`: keep low-level jailed source operations; separate SourceProjection parsing from authoring commands; remove the claim that `variantAxes` is the editor model.
- `src/app/api/dev/editor-write/route.ts`: keep for low-level non-component editor writes; do not overload it with graph transactions.
- `src/app/api/dev/editor-component-model/route.ts`: return SourceProjection explicitly, not a mixed authoring/source model.
- `src/app/api/dev/editor-components/route.ts`: return stable component IDs and nested folder metadata instead of first-directory-only categories.

**New backend seams:**

- `src/app/api/dev/editor/authoring-types.ts`: AuthoringGraphV1, commands, transitions, errors, schema version.
- `src/app/api/dev/editor/authoring-store.ts`: sidecar load/save, source hashes, schema migration, revision checks.
- `src/app/api/dev/editor/authoring-compiler.ts`: graph command -> staged source edits -> SourceProjection equality proof.
- `src/app/api/dev/editor/authoring-transaction.ts`: project lock, validation, byte preimages, commit/rollback, bounded undo journal.
- `src/app/api/dev/editor-authoring/route.ts`: GET graph; POST one revisioned AuthoringCommand; dev-only guard.

**Existing frontend files to modify or retire:**

- `src/app/(dev)/react-figma/page.tsx`: remove component-model state, fixed target chips, direct component write calls, hidden auto-promote-on-entry, and keyed component-board route swap. Retain the established shell/canvas viewport where compatible.
- `src/app/(dev)/react-figma/components-canvas/page.tsx`: retire after G2. Do not incrementally evolve the 401-line fixed flex board into the new model.
- `src/app/(dev)/react-figma/engine.ts`: keep source/selection extraction; add only the messaging needed for stable graph node/instance identity after the model proof.

**New frontend seams:**

- `src/app/(dev)/react-figma/component-authoring/useAuthoringGraph.ts`: graph load, command dispatch, revision conflict, undo/redo.
- `src/app/(dev)/react-figma/component-authoring/ComponentCanvas.tsx`: free variant frames, selection-scoped overlays, top-bar breadcrumb.
- `src/app/(dev)/react-figma/component-authoring/ComponentInspector.tsx`: selection-conditional variant/interaction/transition controls.
- `src/app/(dev)/react-figma/component-authoring/AssetsTree.tsx`: nested folders, create/insert, instance-safe component actions.
- `src/app/(dev)/react-figma/component-authoring/PreviewSurface.tsx`: separate compiled preview lifecycle and Back restoration.

The Codex owner may combine a pair of small files, but must not put the replacement back into the 4,532-line `page.tsx` or create another all-domain monolith.

**Required new tests:**

- `src/app/api/dev/editor/__tests__/authoring-model.test.ts`: identity, primary lineage, folder/instance references, delete guards.
- `src/app/api/dev/editor/__tests__/authoring-store.test.ts`: schema, revision conflicts, source-hash drift, reload persistence.
- `src/app/api/dev/editor/__tests__/authoring-compiler.test.ts`: flat variants, transitions, interactions, generated source, reparse equality, unsupported mappings.
- `src/app/api/dev/editor/__tests__/authoring-transaction.test.ts`: multi-file rollback, byte preimages, concurrent stale writes, undo/redo.
- `src/app/api/dev/editor/__tests__/authoring-migration.test.ts`: single-axis lossless import, multi-axis hold, refusal without corruption.
- `src/app/api/dev/editor-authoring/route.test.ts`: dev guard, validation status codes, transaction result contract.
- `tests/e2e/react-figma-authoring.spec.ts` plus Playwright configuration at G2: create -> edit -> variant -> reload -> undo; interaction -> preview -> Back; folders/instances at G4.

There are currently no dedicated tests for `react-figma`, `editor/lib.ts`, component authoring, or editor routes. G1 is not complete until the new model/compiler tests exist and fail against incorrect behavior.

## 13. As-built code and execution assessment

### Overall judgment

**Mixed foundation, failed component-authoring execution.** The code is not uniformly low-quality or disposable. The low-level source transformation work shows care and several strong invariants. But the architecture was optimized around a mistaken product model, the surface accumulated into a monolith, and there is no dedicated test suite proving the engine. “The whole engine is strong and should stay” is therefore not supported.

The core reviewed path is 7,924 lines:

- `page.tsx`: 4,532
- `components-canvas/page.tsx`: 401
- `engine.ts`: 485
- `editor/lib.ts`: 2,374
- inventory/write/model routes: 132

The broader full review, including adjacent editor routes, was 8,273 lines.

### Strong work worth preserving

1. **Source safety:** filesystem jailing, identifier/path validation, stale-declaration refusal, byte-preserving splices, and output TSX parse checks are real engineering value.
2. **Read-after-write discipline:** `parseComponentModel` re-reads source rather than trusting optimistic client state.
3. **Explicit source side channels:** connector/transition comments preserve semantics that CSS/JS shapes cannot be inverted reliably.
4. **Race awareness:** the global write queue was added after a reproduced lost-write race.
5. **Low-level lifecycle primitives:** `make-component`, `create-component`, and `insert-component` perform concrete source mutations with named refusal paths.
6. **Dual-root inventory:** project and global components are discovered from the filesystem rather than a fabricated static list.
7. **Clean shipping target:** generated React/CSS remains a meaningful product advantage over Framer's proprietary runtime output.

These are good compiler primitives. They are not proof that the current authoring domain model is correct.

### Execution weaknesses across react-figma

1. **God component:** `page.tsx` is 4,532 lines and contains roughly 182 state/setter declarations or usages. Canvas, panels, model shaping, write transport, folders/assets, component edit, inspector, and notifications are coupled in one file.
2. **No dedicated tests:** repository search found no test/spec for react-figma, `editor/lib.ts`, editor write/model routes, components canvas, or the component compiler. Parse guards are useful but do not test intent or round trips.
3. **Transport scattered through UI:** component and general editor operations call `/api/dev/editor-write` directly from many locations. The shared helper covers only some calls, so errors/retries/refresh rules are inconsistent.
4. **Silent failures:** multiple inventory/source requests terminate with `.catch(() => {})`, hiding missing data and load failures from the user and QA.
5. **Hidden mutation on navigation:** entering component edit can auto-run `promote-element`, so viewing a component may rewrite source before the user authors a change.
6. **Comment/behavior drift:** comments repeatedly claim an infinite/route-agnostic/Framer-locked architecture while the actual component path swaps to a keyed fixed route and fixed board.
7. **No transaction boundary:** the write queue serializes operations but cannot atomically protect graph metadata plus TSX/CSS or provide byte-exact multi-file rollback.
8. **Prototype styling as architecture:** large inline-style UI blocks and locally constructed controls make selection/state behavior hard to test and easy to diverge from the established design system.

### Component module: specifically good

1. It recognizes that components need a separate inventory and main-component model endpoint.
2. It can create blank components, convert selected JSX into a component, insert an instance, rename, expose props, promote inline styles, and target scoped CSS rules.
3. It attempts write/read round trips instead of keeping a purely visual mock state.
4. It has a connector overlay and can compile limited hover/tap behavior to real source.
5. It preserves the parent editor shell while switching component context, which is directionally closer than a separate standalone app.

### Component module: specifically bad

1. **Wrong identity model:** variants are union-axis values and states are six hardcoded targets, not stable free frames.
2. **Wrong canvas:** `components-canvas/page.tsx` renders inventory groups in a padded flex board; the host is fixed at 1480 x 1040.
3. **Wrong navigation lifecycle:** the iframe key and route change remount component editing instead of preserving one authoring canvas context.
4. **Wrong scope:** the board is inventory-oriented; selecting one component still enters a route built to render component groups rather than a canonical active-component graph.
5. **Wrong interaction model:** only state/switch connectors exist; tap-cycle is hardcoded for axes; no stable edge identity, Delay, Reset Override, arbitrary target cleanup, or New Event model.
6. **Nonexistent lifecycle contracts:** folders, detach, replace, replace-all, delete guards, preview sessions, and undo are labels or gaps, not implemented domain operations.
7. **Misleading completion:** the visible feature list made the module look broad while Dan's first real user-position pass exposed the main flows as broken or conceptually wrong.

### Can Codex deliver better fidelity?

**Yes, conditionally.** A fresh Codex architecture owner is the better next actor because this correction is source-heavy, contract-heavy, and test-heavy. Codex should be better at tracing the existing parser/writer seams, defining explicit types/transactions, and producing adversarial fixtures before UI work.

It will not be better automatically. It will reproduce the same failure if briefed with “keep the engine, make it look like Framer.” The required controls are:

- Full source hydration before edits.
- Architecture artifact and file/test map before code.
- Model/compiler tests before surface work.
- One vertical slice at a time in an isolated worktree.
- Independent Framer evidence for behavior, not memory.
- QA runtime/console/source review at every gate.
- Designer Meta review only after structural QA passes.
- No “complete/sign-ready” statement before named gates return.

With those controls, Codex is the stronger implementation choice. Without them, model choice matters less than the same weak process repeating.
