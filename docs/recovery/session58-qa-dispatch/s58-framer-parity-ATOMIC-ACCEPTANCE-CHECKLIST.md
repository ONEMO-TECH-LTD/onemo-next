# S58 Framer Components — atomic acceptance authority

**Binding acceptance revision AC-3 · 2026-07-13 · 335 stable rows.** Base AC-2 is the immutable 264-row artifact at SHA-256 `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`; AC-1 remains the immutable 159-row artifact at SHA-256 `6c4554c186d7c8ba272186a00305a990544620308716af52580b401b55e30b3e`. AC-3 appends census-reconciliation rows only; no AC-1/AC-2 ID or acceptance text changed. IDs map to Linear E12: A KAI-9438 · B 9439 · C 9440 · D 9441 · E 9442 · F 9443 · G 9444 · H 9445 · I 9446 · K 9447 · J 9448 · L 9449 · X KAI-9450. `SPEC-PENDING` rows cannot dispatch until measured Framer evidence freezes their AC.

## J · Contract and traceability law
- [ ] **AC-J-001** Every independently fail-able operation has its own stable row.
- [ ] **AC-J-002** Every row names source-exact acceptance criteria.
- [ ] **AC-J-003** Every row maps to one Linear evidence record.
- [ ] **AC-J-004** Every row names its builder owner.
- [ ] **AC-J-005** Every row records named-commit source proof.
- [ ] **AC-J-006** Every row records Dan-openable human-browser proof.
- [ ] **AC-J-007** Every row records independent QA verdict.
- [ ] **AC-J-008** Every row records Meta/design-fidelity verdict.
- [ ] **AC-J-009** Every row records Dan sign-off; only Dan may mark Done.
- [ ] **AC-J-010** No LIVE/DONE status without all required proof stamps.
- [ ] **AC-J-011** V1–V10 and S1–S9 map explicitly to affected rows.
- [ ] **AC-J-012** Sequencing labels never remove a final full-product requirement.

## A · Canvas, entry, and navigation
- [ ] **AC-A-001** Component authoring canvas pans and zooms with measured Framer behavior.
- [ ] **AC-A-002** Variants place freely on an unbounded authoring surface, not a clipped finite host.
- [ ] **AC-A-003** Project-component double-click enters that component's authoring context.
- [ ] **AC-A-004** Project-component context-menu Edit enters the same authoring context.
- [ ] **AC-A-005** Global/library component entry follows measured Framer behavior and never dead-ends.
- [ ] **AC-A-006** Shipped inventory always exposes at least one valid, reachable authoring path.
- [ ] **AC-A-007** Component mode retains and hides the page; only the edited component is shown.
- [ ] **AC-A-008** Home › Component navigation matches measured Framer semantics in Figma/ONEMO chrome.

## K · Component-content editing foundation
- [ ] **AC-K-001** Inner component nodes/layers are selectable with stable source identity.
- [ ] **AC-K-002** Selection exposes source-exact editable content operations; variant-frame movement is not counted.
- [ ] **AC-K-003** Content edits compile through typed staged plans, never raw unvalidated patches.
- [ ] **AC-K-004** Content edits persist through reload with untouched regions preserved.
- [ ] **AC-K-005** Undo restores exact content and source/identity lineage.
- [ ] **AC-K-006** Unsafe or stale content edits refuse specifically with zero writes.

## L · Component Style inspector
- [ ] **AC-L-001** Inspector follows selected inner component content.
- [ ] **AC-L-002** Link / Link To edits source and round-trips.
- [ ] **AC-L-003** Position X edits source and round-trips.
- [ ] **AC-L-004** Position Y edits source and round-trips.
- [ ] **AC-L-005** Width value and Fixed/Relative mode edit source and round-trip.
- [ ] **AC-L-006** Height value and mode edit source and round-trip.
- [ ] **AC-L-007** Min/max constraints edit source and round-trip.
- [ ] **AC-L-008** Layout type Stack/Grid edits source and round-trips.
- [ ] **AC-L-009** Layout direction edits source and round-trips.
- [ ] **AC-L-010** Distribute edits source and round-trips.
- [ ] **AC-L-011** Align edits source and round-trips.
- [ ] **AC-L-012** Wrap edits source and round-trips.
- [ ] **AC-L-013** Gap edits source and round-trips.
- [ ] **AC-L-014** Padding and linked/independent sides edit source and round-trip.
- [ ] **AC-L-015** Effects behavior is frozen from Framer evidence, then edits source and round-trips.
- [ ] **AC-L-016** Overlays behavior is frozen from Framer evidence, then edits source and round-trips.
- [ ] **AC-L-017** Cursor behavior is frozen from Framer evidence, then edits source and round-trips.
- [ ] **AC-L-018** Style Transition edits source and round-trips.
- [ ] **AC-L-019** Opacity edits source and round-trips.
- [ ] **AC-L-020** Visible edits source and round-trips.
- [ ] **AC-L-021** Fill edits source and round-trips.
- [ ] **AC-L-022** Overflow edits source and round-trips.
- [ ] **AC-L-023** Radius edits source and round-trips.

## B · Component lifecycle and manage menu
- [ ] **AC-B-001** Create-from-selection names the component and previews the exact selected source.
- [ ] **AC-B-002** Create-from-selection atomically replaces source with an instance and enters edit context.
- [ ] **AC-B-003** Blank create accepts name, Project/Global scope, and category.
- [ ] **AC-B-004** Blank create writes the real file/barrel and appears in inventory without reload hacks.
- [ ] **AC-B-005** Rename updates file, export, barrels, imports, JSX consumers, graph, and history atomically.
- [ ] **AC-B-006** Duplicate uses a collision-safe identity and regenerates required barrels.
- [ ] **AC-B-007** Delete unused removes component and required barrel entries cleanly.
- [ ] **AC-B-008** Delete used refuses or presents exact consumers without writes.
- [ ] **AC-B-009** Find locates and selects the component with measured Framer behavior.
- [ ] **AC-B-010** Copy Import copies the correct source-exact import.
- [ ] **AC-B-011** Copy URL matches measured Framer semantics.
- [ ] **AC-B-012** Library action matches measured Framer scope behavior.
- [ ] **AC-B-013** Insert from the manage menu places a real instance.

## C · Variants and Primary overrides
- [ ] **AC-C-001** Create free variant uses measured auto-naming and stable identity.
- [ ] **AC-C-002** Rename variant persists source, graph, reload, and undo.
- [ ] **AC-C-003** Move/free-place variant persists source/sidecar geometry, reload, and undo.
- [ ] **AC-C-004** Delete unused variant follows measured Framer behavior.
- [ ] **AC-C-005** Delete used variant refuses or lists exact consumers without writes.
- [ ] **AC-C-006** Exactly one Primary/default exists and is labelled correctly.
- [ ] **AC-C-007** Show Primary navigates to the linked primary.
- [ ] **AC-C-008** Detach From Primary preserves effective values and lineage correctly.
- [ ] **AC-C-009** Update Primary applies measured override propagation correctly.
- [ ] **AC-C-010** Reset Overrides restores inherited values and lineage correctly.

## D · Hover and Pressed states
- [ ] **AC-D-001** Hover ghost creates the measured Hover state frame.
- [ ] **AC-D-002** Hover state renders its measured implicit connection without inventing a phantom edge.
- [ ] **AC-D-003** Pressed ghost creates the measured Pressed state frame.
- [ ] **AC-D-004** Pressed state renders its measured implicit connection without inventing a phantom edge.
- [ ] **AC-D-005** State creation persists through reload and exact undo.
- [ ] **AC-D-006** State deletion remains SPEC-PENDING until destructive behavior is measured.

## E · Props and property controls
- [ ] **AC-E-001** Expose selected text as a typed prop with a default; existing instances retain rendering.
- [ ] **AC-E-002** Text control is authorable and source-backed.
- [ ] **AC-E-003** Boolean control is authorable and source-backed.
- [ ] **AC-E-004** Enum/variant control is authorable and source-backed.
- [ ] **AC-E-005** Color control is authorable and source-backed.
- [ ] **AC-E-006** Number control is authorable and source-backed.
- [ ] **AC-E-007** Image control is retained as required if measured Framer evidence supports it.
- [ ] **AC-E-008** Link control is retained as required if measured Framer evidence supports it.
- [ ] **AC-E-009** Instance Properties panel shows exact definitions, defaults, and current overrides.
- [ ] **AC-E-010** Editing an instance property writes a real typed JSX attribute.
- [ ] **AC-E-011** Reset-to-default removes the override and restores the definition default.
- [ ] **AC-E-012** Unsafe lifts refuse specifically with zero writes.
- [ ] **AC-E-013** Every prop mutation reparses and typechecks the exact staged snapshot.

## F · Nodes, connectors, interactions, and transitions
- [ ] **AC-F-001** New Transition creates the measured transition model and UI.
- [ ] **AC-F-002** New Event model/action/runtime is frozen from live and compiled Framer evidence before dispatch.
- [ ] **AC-F-003** Trigger Click works.
- [ ] **AC-F-004** Trigger Click Start works.
- [ ] **AC-F-005** Trigger Appear works.
- [ ] **AC-F-006** Trigger Mouse Enter works.
- [ ] **AC-F-007** Trigger Mouse Leave works.
- [ ] **AC-F-008** Set Variant target works.
- [ ] **AC-F-009** Delay works.
- [ ] **AC-F-010** Once works.
- [ ] **AC-F-011** Cycle works.
- [ ] **AC-F-012** Connector drag from source handle to target creates the intended transition.
- [ ] **AC-F-013** Wire is straight with arrowhead at the target using measured geometry.
- [ ] **AC-F-014** Nodes, wires, popovers, and overlays are selection-scoped.
- [ ] **AC-F-015** Instant transition compiles and plays.
- [ ] **AC-F-016** Ease transition compiles and plays.
- [ ] **AC-F-017** Spring-Time transition compiles and plays.
- [ ] **AC-F-018** Spring-Physics transition compiles and plays.
- [ ] **AC-F-019** Transition ownership is frozen from Framer evidence before schema change.
- [ ] **AC-F-020** Play badge reflects the effective interaction.
- [ ] **AC-F-021** Reset inherited interaction override restores measured inheritance behavior.
- [ ] **AC-F-022** Undo restores the exact interaction edge/override lineage.

## G · Preview execution
- [ ] **AC-G-001** Play opens a separate isolated preview iframe from one committed snapshot.
- [ ] **AC-G-002** Compiled interactions execute honestly in preview.
- [ ] **AC-G-003** Back restores the preserved authoring canvas, selection, and history cursor.
- [ ] **AC-G-004** Preview never mutates durable authoring state or history.

## H · Dedicated Components page and organization
- [ ] **AC-H-001** Dedicated Components page/rail is self-sufficient.
- [ ] **AC-H-002** Assets remains images/icons/upload only; no duplicate Components surface.
- [ ] **AC-H-003** Search filters real inventory by measured fields.
- [ ] **AC-H-004** Library shows real rendered previews, not name-only placeholders.
- [ ] **AC-H-005** Each component shows an exact instance count.
- [ ] **AC-H-006** Project and Global scope are visibly distinct.
- [ ] **AC-H-007** Categories are visible and source-backed.
- [ ] **AC-H-008** Move category persists without identity/import drift.
- [ ] **AC-H-009** Move Project↔Global atomically moves file/source identity.
- [ ] **AC-H-010** Project↔Global move regenerates the correct barrel.
- [ ] **AC-H-011** Project↔Global move rewrites every affected consumer import.
- [ ] **AC-H-012** New Component is available from the owning Components tree/page.
- [ ] **AC-H-013** New Folder works.
- [ ] **AC-H-014** Folder nesting and component-to-folder move work.
- [ ] **AC-H-015** Folder rename works.
- [ ] **AC-H-016** Folder delete follows measured guard/reparent behavior.
- [ ] **AC-H-017** Folder/component sort persists deterministically.

## I · Instance lifecycle
- [ ] **AC-I-001** Insert from menu places a graph/source-backed instance.
- [ ] **AC-I-002** Drag-to-insert places the same lawful instance.
- [ ] **AC-I-003** Instance variant picker rewrites the selected variant safely.
- [ ] **AC-I-004** Instance Trigger follows measured Framer transition behavior.
- [ ] **AC-I-005** Edit Component enters in-place component authoring.
- [ ] **AC-I-006** Go to main component reveals/selects the definition and remains distinct from Edit Component.
- [ ] **AC-I-007** Detach substitutes effective props and removes instance identity safely.
- [ ] **AC-I-008** Replace one instance rewrites only the selected consumer.
- [ ] **AC-I-009** Replace All rewrites all intended consumers atomically.
- [ ] **AC-I-010** Initial source→instance creation remains covered and cannot regress.

## J · Cross-cutting product and QA gates
- [ ] **AC-J-013** Every surface uses Figma/ONEMO styling; Framer purple/chrome is never copied.
- [ ] **AC-J-014** DS tokens, Chillax, brand oklch, and Phosphor-light icons follow established law.
- [ ] **AC-J-015** Every mutation is jailed and exact-hash/revision preconditioned.
- [ ] **AC-J-016** Every mutation stages, reparses, validates, and typechecks before install.
- [ ] **AC-J-017** Every mutation is atomic across graph, source, sidecar, metadata, and history.
- [ ] **AC-J-018** Refusal is specific and produces zero writes.
- [ ] **AC-J-019** Every applicable row proves persistence and reload.
- [ ] **AC-J-020** Every applicable row proves undo and lineage restoration.
- [ ] **AC-J-021** Every applicable row proves dead-end/error behavior.
- [ ] **AC-J-022** Relevant typecheck, lint, runtime, conformance, and behavior suites cover intent—not proxies.
- [ ] **AC-J-023** Both repo baselines are captured before every probe and restored exactly afterward.
- [ ] **AC-J-024** Pre-existing user changes are preserved; absolute clean is required only from a clean baseline.
- [ ] **AC-J-025** Untracked-file deletion requires Dan's in-session confirmation; otherwise cleanup uses reversible quarantine.
- [ ] **AC-J-026** Human-browser proof is archived per row; automation is supporting only.
- [ ] **AC-J-027** Independent QA and Meta must both pass before Dan review.

---

## AC-2 post-freeze annex

The rows below were appended after the AC-1 ID freeze. AC-1 remains byte-accounted by the base hash above. No annex row may retroactively green an AC-1 row; live status and all five proof stamps remain in Linear.

### X · Real-user-path and editor-stability P0 — KAI-9450
- [ ] **AC-X-001** Create-from-selection succeeds end to end on an existing real ONEMO page element that imports a CSS module; a dependency-free laboratory fixture does not satisfy this row.
- [ ] **AC-X-002** Create-from-selection canonicalizes every relative module-CSS dependency before root containment, jail, and exact-hash authority checks; raw `..` traversal is never treated as an escape when the canonical target is lawful.
- [ ] **AC-X-003** The committed browser acceptance fixture includes at least one existing real-page dependency graph; synthetic dependency-free coverage remains supporting evidence only.
- [ ] **AC-X-004** A click or micro-drag on empty canvas cannot dereference a cleared pan gesture; pointer-up during a queued view update remains crash-free.
- [ ] **AC-X-005** After any recoverable create-from-selection refusal, pressing Create again dispatches a fresh request and the dialog remains usable without Cancel/reopen.
- [ ] **AC-X-006** Create-from-selection refusals render human product language and never expose raw internal error codes as the primary user message.

### B · Create-from-selection source-truth correction — KAI-9439
- [ ] **AC-B-014** Create-from-selection on a real non-root page selection replaces that selection with a graph/source-backed instance.
- [ ] **AC-B-015** After successful create-from-selection, the editor remains on the page with the new instance selected, matching measured Framer behavior; it does not auto-enter component authoring.

`AC-B-015` supersedes only the "enters edit context" clause in frozen `AC-B-002`. `AC-B-002` remains preserved for ID history and cannot be marked complete independently of this correction.

### C · Post-freeze interaction decisions — KAI-9440
- [ ] **AC-C-011** `SPEC-PENDING`: rename click-away behavior is re-measured in Framer and frozen before implementation or a LIVE status; conflicting commit/discard observations are not averaged.
- [ ] **AC-C-012** Redo has an explicit Dan disposition before build dispatch; if retained, its source-exact command, persistence, reload, and conflict acceptance are atomized before implementation.

### H · Inventory projection truth — KAI-9445
- [ ] **AC-H-018** Inventory parse failure returns a named corrupt/unsupported result and never silently collapses to `variantAxes: []` or a false no-axis success.

### K · Inner-content operation atomization — KAI-9447
- [ ] **AC-K-007** Add an inner component element through a typed staged command.
- [ ] **AC-K-008** Move or reorder an inner component element through a typed staged command.
- [ ] **AC-K-009** Edit inner component text through a typed staged command.
- [ ] **AC-K-010** Restyle an inner component element through a typed staged command.
- [ ] **AC-K-011** Delete an inner component element through a typed staged command.
- [ ] **AC-K-012** Every accepted inner-content mutation updates all affected variants without identity drift.
- [ ] **AC-K-013** Every accepted inner-content mutation updates all affected instances without identity drift.

### L · Explicit Style-inspector rows previously hidden by ellipsis — KAI-9449
- [ ] **AC-L-024** Rotate edits source and round-trips.
- [ ] **AC-L-025** Border edits source and round-trips.
- [ ] **AC-L-026** Shadows edit source and round-trip.
- [ ] **AC-L-027** Accessibility fields edit source and round-trip.
- [ ] **AC-L-028** Code Overrides follow measured Framer behavior and round-trip without bypassing the canonical compiler.

### J · Isolated proof and reviewed deslop — KAI-9448
- [ ] **AC-J-028** Every independent auditor uses a dedicated throwaway worktree rather than an authoritative build worktree.
- [ ] **AC-J-029** Every independent auditor uses a dedicated server port and authoring store; one lane cannot restore or wipe another lane's runtime evidence.
- [ ] **AC-J-030** Legacy semantic WriteOps in `src/app/api/dev/editor/lib.ts` receive a reference-traced kill list before removal.
- [ ] **AC-J-031** Live low-level writer dependencies are extracted from the legacy semantic block before any deletion.
- [ ] **AC-J-032** Route-refused component/state/connector/instance writer implementations are removed from production after extraction, with refusal coverage retained.
- [ ] **AC-J-033** `src/app/(dev)/react-figma/ENGINE-PLAN.md` is archived as superseded evidence, not left as active source truth.
- [ ] **AC-J-034** `src/app/(dev)/react-figma/ENGINE-PLAN-E2.4.md` is archived as superseded evidence, not left as active source truth.
- [ ] **AC-J-035** `src/app/(dev)/react-figma/FIGMA-SPEC-text.md` is archived as superseded evidence, not left as active source truth.
- [ ] **AC-J-036** `src/app/(dev)/react-figma/FIGMA-SPEC-variable-pill.md` is archived as superseded evidence, not left as active source truth.
- [ ] **AC-J-037** `src/app/(dev)/react-figma/INSPECTOR_STOCKTAKE.md` is archived as superseded evidence, not left as active source truth.
- [ ] **AC-J-038** `editor-write/route.ts` no longer cites an archived pre-reset plan as current authority.

### E · Measured unified Variables model — KAI-9442
- [ ] **AC-E-014** Props and events share one component Variables model and one `<Component> Variables` authoring sheet.
- [ ] **AC-E-015** The add-variable palette exposes exactly the 15 measured kinds; no smaller assumed type set is accepted.
- [ ] **AC-E-016** Formatted Text is authorable and source-backed.
- [ ] **AC-E-017** Date is authorable and source-backed.
- [ ] **AC-E-018** Event is authorable as a typed event variable and source-backed.
- [ ] **AC-E-019** File is authorable and source-backed.
- [ ] **AC-E-020** Transition is authorable and source-backed.
- [ ] **AC-E-021** Border is authorable and source-backed.
- [ ] **AC-E-022** Cursor is authorable and source-backed.
- [ ] **AC-E-023** Shadow is authorable and source-backed.
- [ ] **AC-E-024** The Variables sheet title is `<ComponentName> Variables` and identifies the edited component.
- [ ] **AC-E-025** The Variables sheet exposes an add-variable control in its measured location.
- [ ] **AC-E-026** The Variables sheet lists defined variables with their measured kind icon.
- [ ] **AC-E-027** Selecting a variable exposes its source-backed form and Name field.
- [ ] **AC-E-028** Creating a variable supplies the measured default name for its kind.
- [ ] **AC-E-029** Renaming a variable persists its source identity safely.
- [ ] **AC-E-030** An instance Style panel exposes a component section headed by the component name.
- [ ] **AC-E-031** The instance component section exposes a variant dropdown backed by real variants.
- [ ] **AC-E-032** The instance component section exposes an Edit Component action.
- [ ] **AC-E-033** Value variables render as kind-appropriate controls in the instance component section.
- [ ] **AC-E-034** The instance Style panel exposes the measured collapsed Scroll Section group separately from component variables.
- [ ] **AC-E-035** The instance Style panel exposes the measured collapsed Code Overrides group separately from component variables.
- [ ] **AC-E-036** `SPEC-PENDING`: instance value editing and reset-to-default affordances are manually measured with Text and Color variables before their UI acceptance dispatches.
- [ ] **AC-E-037** `SPEC-PENDING`: the instance-side Event handler row is manually measured after an inner layer fires the event; absence in the current extraction is not guessed into the model.
- [ ] **AC-E-038** `SPEC-PENDING`: one fresh Copy Import ESM module is captured to freeze the exact `addPropertyControls`/compiled variable shape before compiler implementation.
- [ ] **AC-E-039** The add-variable palette supports the measured `Type to search…` interaction.
- [ ] **AC-E-040** Renaming a variable updates every affected consumer safely.
- [ ] **AC-E-041** The instance component-section header exposes the measured `Component` tag.
- [ ] **AC-E-042** `SPEC-PENDING`: binding a Variable to a selected inner layer/property is manually measured before any expose/lift command dispatches.

Frozen mappings are corrected without rewriting AC-1 IDs: `AC-E-002` means measured **Plain Text**, `AC-E-003` means **Toggle**, and `AC-E-004` means **Option**. Live evidence makes `AC-E-007` Image and `AC-E-008` Link unconditional final requirements, not conditional guesses. Frozen `AC-E-001` cannot dispatch as an assumed selected-text lift until `AC-E-042` freezes the actual binding interaction.

### F · Measured New Event semantics — KAI-9443
- [ ] **AC-F-023** The Interactions add menu exposes exactly New Transition and New Event in the measured context.
- [ ] **AC-F-024** New Event opens the component Variables sheet instead of adding a transition or interaction row.
- [ ] **AC-F-025** New Event creates an Event variable with the measured default name and explicit Add commit.
- [ ] **AC-F-026** An Event variable compiles as a named component event prop/EventHandler.
- [ ] **AC-F-027** Event variables are not represented as variant transitions or Set Variant wires.
- [ ] **AC-F-028** `SPEC-PENDING`: the inner-layer action that fires a named Event variable is manually measured before command/schema dispatch.
- [ ] **AC-F-029** `SPEC-PENDING`: consumer/instance event-handler attachment is manually measured before its UI/runtime dispatch.

### I · Paid Trigger control correction — KAI-9446
- [ ] **AC-I-011** The measured instance `Trigger` row remains a paid Convert add-on boundary and is never implemented or counted as component Event-variable UI.

`AC-I-011` supersedes frozen `AC-I-004`; `AC-I-004` cannot be marked complete as a Framer component-event capability.

### B · Measured component-menu and blank-create grammar — KAI-9439
- [ ] **AC-B-016** Assets and breadcrumb component menus expose the same measured item grammar.
- [ ] **AC-B-017** The measured item order is Insert, Edit, Find, Rename, Duplicate, Delete, Library, Copy Import, Copy URL with the observed separators.
- [ ] **AC-B-018** Delete is disabled when the component has at least one live instance.
- [ ] **AC-B-019** `SPEC-PENDING`: Delete behavior for a zero-instance component is manually measured before destructive-command dispatch.
- [ ] **AC-B-020** `SPEC-PENDING`: Library submenu contents and effects are manually measured before Library-command dispatch.
- [ ] **AC-B-021** Blank create opens the measured New Component dialog with a Title field.
- [ ] **AC-B-022** `SPEC-PENDING`: executing blank Create is manually verified for the resulting frame/default/edit context before compiler dispatch.
- [ ] **AC-B-023** Blank-create acceptance does not invent Project/Global or category fields absent from the measured dialog.
- [ ] **AC-B-024** Blank Create remains disabled while the Title field is empty.
- [ ] **AC-B-025** The New Component dialog renders the measured component-canvas explainer.
- [ ] **AC-B-026** Cancel closes the New Component dialog with zero writes.
- [ ] **AC-B-027** Create submits the validated non-empty Title through the canonical blank-create command.

`AC-B-018` supersedes frozen `AC-B-008` for the measured live-instance guard. `AC-B-021` and `AC-B-023` supersede the unmeasured scope/category clause in frozen `AC-B-003`. The final creation effects remain governed by `AC-B-004` and `AC-B-022`.

### H · Measured Assets/Components organization — KAI-9445
- [ ] **AC-H-019** The Assets tab exposes a Search field above its measured sections.
- [ ] **AC-H-020** Assets exposes a Templates section with its own add control.
- [ ] **AC-H-021** Assets exposes a Components section with its own add control.
- [ ] **AC-H-022** Assets exposes a Styles section with its own add control.
- [ ] **AC-H-023** Assets exposes a Vectors section with its own add control.
- [ ] **AC-H-024** Assets exposes a Code section with its own add control.
- [ ] **AC-H-025** The Components section renders a collapsible folder tree.
- [ ] **AC-H-026** Components in the measured Assets view render as name-plus-diamond list rows, not invented thumbnails.
- [ ] **AC-H-027** `SPEC-PENDING`: preview-thumbnail behavior in any separate Insert/panel mode is measured before a preview requirement dispatches.
- [ ] **AC-H-028** Folder rows expose the measured hover actions affordance.
- [ ] **AC-H-029** The Components add menu exposes exactly New Component, New Folder, and Sort Alphabetically.
- [ ] **AC-H-030** New Component opens the same measured blank-create flow governed by `AC-B-021` and `AC-B-022`.
- [ ] **AC-H-031** New Folder dispatches only after its measured folder-creation acceptance is frozen.
- [ ] **AC-H-032** Sort Alphabetically produces deterministic measured ordering.
- [ ] **AC-H-033** `SPEC-PENDING`: folder actions-menu contents, including rename/delete behavior, are manually measured before CRUD dispatch.
- [ ] **AC-H-034** `SPEC-PENDING`: drag-component-into-folder behavior is manually measured before move dispatch.
- [ ] **AC-H-035** Current evidence distinguishes the measured Project folder from an unproven category model; folder and category semantics are not conflated.
- [ ] **AC-H-036** `SPEC-PENDING`: category creation/move semantics are measured before frozen `AC-H-007` or `AC-H-008` may dispatch.
- [ ] **AC-H-037** `SPEC-PENDING`: Project/Global move semantics are measured before frozen `AC-H-009` through `AC-H-011` may dispatch.
- [ ] **AC-H-038** The measured Framer ownership surface is the Components section inside Assets; a separate dedicated Components page is not required without contrary measured evidence or a Dan decision.
- [ ] **AC-H-039** `SPEC-PENDING`: instance-count visibility and semantics are manually measured before frozen `AC-H-005` may dispatch.
- [ ] **AC-H-040** `SPEC-PENDING`: search fields, result scope, and matching behavior are manually measured before frozen `AC-H-003` may dispatch.

`AC-H-019` through `AC-H-025` plus `AC-H-038` supersede frozen `AC-H-001` and `AC-H-002`: Framer's measured Assets tab is a multi-section owner, not an images/icons/upload-only surface beside a required separate Components page. `AC-H-026` supersedes the thumbnail requirement in frozen `AC-H-004` for the measured Assets view. Any preview requirement survives only for a separately measured surface under `AC-H-027`.

---

## AC-3 parity-census reconciliation annex

The rows below reconcile the complete free-tier, own-hands census in `s58-framer-components-CENSUS-expert-2026-07-13.md` (SHA-256 `96c78a8312caa484ccdb21c641394c10c06a55fce1d6aa90caf866d53a160e82`). AC-2 remains byte-accounted by its base hash above. Observed entries with unmeasured effects are retained as `SPEC-PENDING`; access limitations never silently waive final parity.

### A · Library/global entry evidence — KAI-9438
- [ ] **AC-A-009** `SPEC-PENDING`: global/library component entry, read, and edit behavior is measured in Dan's library-enabled workspace before `AC-A-005`, `AC-B-012`, or `AC-H-037` dispatches.
- [ ] **AC-A-010** `SPEC-PENDING`: the component-mode zoom submenu's exact options and effects are measured before component-canvas zoom-menu dispatch.

### B · Third creation path and duplicate semantics — KAI-9439
- [ ] **AC-B-028** The main Component menu exposes **Create From Code…** with shortcut `⇧⌘K` as a third creation path distinct from create-from-selection and blank create.
- [ ] **AC-B-029** `SPEC-PENDING`: the Create From Code flow, generated source, inventory result, edit context, persistence, and undo are measured before compiler or UI dispatch.
- [ ] **AC-B-030** `SPEC-PENDING`: component Duplicate deep-copy behavior for variants, interactions, variables, identity, source, and live instances is measured before `AC-B-006` dispatches.

### C · Variant context additions — KAI-9440
- [ ] **AC-C-013** The linked-variant context menu preserves the measured order and states of Add To Agent, Show Primary, Detach From Primary, Update Primary, Reset Overrides, Fit Content, Select, Align, Copy, Paste, Move, Duplicate, Delete, Rename, Auto Rename, Lock, Hide, Overflow, Add Frame, Add Stack, Remove Frame, and Set as Default Fill.
- [ ] **AC-C-014** The variant context menu exposes **Auto Rename** with shortcut `⌥R`.
- [ ] **AC-C-015** `SPEC-PENDING`: variant Auto Rename naming, collision, identity, source, history, and undo behavior is measured before command dispatch.
- [ ] **AC-C-016** The variant context menu exposes **Set as Default Fill**.
- [ ] **AC-C-017** `SPEC-PENDING`: Set as Default Fill source, rendering, inheritance, instance, reload, and undo effects are measured before command dispatch.
- [ ] **AC-C-018** Fit Content is present but disabled in the measured linked-variant context.
- [ ] **AC-C-019** Align is present but disabled in the measured linked-variant context.
- [ ] **AC-C-020** Remove Frame is present but disabled in the measured linked-variant context.
- [ ] **AC-C-021** The main Component menu labels the propagation action **Update Primary From Instance**, while the linked-variant menu uses **Update Primary**.
- [ ] **AC-C-022** An unselected variant frame has no border; selection adds the measured accent outline and four corner handles.
- [ ] **AC-C-023** The selected variant frame exposes a right-edge interaction handle and pivot dot only in the measured selection context.
- [ ] **AC-C-024** Component Layers rows expose the measured Primary/Variant tag and an effective-interaction badge when applicable.

### E · Remaining Variable lifecycle — KAI-9442
- [ ] **AC-E-043** `SPEC-PENDING`: each Variable kind's default and configuration form is measured before its authoring acceptance dispatches.
- [ ] **AC-E-044** `SPEC-PENDING`: Variable deletion, consumer guards, source effects, reload, and undo are measured before command dispatch.
- [ ] **AC-E-045** `SPEC-PENDING`: Variable type-change compatibility, coercion/refusal, source effects, reload, and undo are measured before command dispatch.
- [ ] **AC-E-046** `SPEC-PENDING`: Variable reorder behavior, source ordering, identity, reload, and undo are measured before command dispatch.
- [ ] **AC-E-047** The Insert menu exposes the measured **Variables** tab as an entry to the unified component Variables model.
- [ ] **AC-E-048** `SPEC-PENDING`: Scroll Section contents, source/runtime effects, instance behavior, persistence, and reset semantics are measured before its panel dispatch.

### F · Interaction update/delete and target law — KAI-9443
- [ ] **AC-F-030** Reopening an existing Set Variant row edits trigger, delay, repeat, transition, and target without replacing the interaction's stable identity.
- [ ] **AC-F-031** State variants such as Hover and Pressed are excluded from explicit Set Variant targets; only configuration variants are valid targets.
- [ ] **AC-F-032** Deleting an explicit interaction row removes the exact edge and is fully reload/undo reversible.
- [ ] **AC-F-033** A variant supports multiple ordered interaction rows without overwriting existing edges.
- [ ] **AC-F-034** `SPEC-PENDING`: the Set Variant popover Back action and parent action-picker contents are manually measured before picker dispatch.
- [ ] **AC-F-035** `SPEC-PENDING`: deletion/reset behavior for a per-variant Styles Transition is measured before transition-delete dispatch.
- [ ] **AC-F-036** The Set Variant popover exposes a Delay textbox with measured decrement and increment controls.
- [ ] **AC-F-037** The Set Variant popover exposes the measured Once and Cycle repeat choices.

### G · Preview chrome and viewport — KAI-9444
- [ ] **AC-G-005** Preview chrome exposes the measured Restart control.
- [ ] **AC-G-006** `SPEC-PENDING`: Restart snapshot selection, runtime reset, authoring-state isolation, and history behavior are manually measured before restart dispatch.
- [ ] **AC-G-007** Preview chrome exposes the measured Open in New Tab control.
- [ ] **AC-G-008** `SPEC-PENDING`: Open in New Tab snapshot identity, URL, authoring-session preservation, and close behavior are manually measured before dispatch.
- [ ] **AC-G-009** Preview chrome exposes a viewport-width field.
- [ ] **AC-G-010** `SPEC-PENDING`: width-field units, limits, commit behavior, and persistence are manually measured before dispatch.
- [ ] **AC-G-011** Preview chrome exposes a viewport-height field.
- [ ] **AC-G-012** `SPEC-PENDING`: height-field units, limits, commit behavior, and persistence are manually measured before dispatch.
- [ ] **AC-G-013** Dragging a preview side rail resizes viewport width without mutating authored component state.
- [ ] **AC-G-014** Dragging the preview bottom handle resizes viewport height without mutating authored component state.
- [ ] **AC-G-015** Preview mode is URL-scoped and Back restores the corresponding component authoring context.
- [ ] **AC-G-016** `SPEC-PENDING`: whether preview starts from Primary, the selected variant, or another entry rule is manually measured with visually distinct variants before runtime dispatch.

### I · Instance context additions — KAI-9446
- [ ] **AC-I-012** The instance context menu preserves the measured order and states of Add To Agent, Edit, Set Default Size, Detach Instance, Create Layout Template, Fit Content, Select, Align, Replace With, Replace All Instances With, Copy, Paste, Move, Duplicate, Delete, Rename, Auto Rename, Lock, Hide, Overflow, Add Frame, Add Stack, and Remove Frame.
- [ ] **AC-I-013** Set Default Size is present but disabled in the measured instance context.
- [ ] **AC-I-014** `SPEC-PENDING`: Set Default Size enablement, source/sidecar effect, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-015** The instance context menu exposes **Create Layout Template**.
- [ ] **AC-I-016** `SPEC-PENDING`: Create Layout Template output, source ownership, inventory behavior, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-017** The instance context menu exposes **Fit Content** with shortcut `⇧A`.
- [ ] **AC-I-018** `SPEC-PENDING`: instance Fit Content geometry, source/sidecar ownership, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-019** The instance context menu exposes **Auto Rename** with shortcut `⌥R`.
- [ ] **AC-I-020** `SPEC-PENDING`: instance Auto Rename naming, source identity, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-021** `SPEC-PENDING`: instance Duplicate identity, source placement, override retention, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-022** `SPEC-PENDING`: instance Delete source removal, component consumer accounting, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-023** `SPEC-PENDING`: instance Rename label/source semantics, persistence, and undo are measured before command dispatch.
- [ ] **AC-I-024** `SPEC-PENDING`: Replace With and Replace All Instances With submenu contents, targeting, source effects, persistence, and undo are manually measured before `AC-I-008` or `AC-I-009` dispatches.
- [ ] **AC-I-025** Overflow is present but disabled in the measured instance context.
- [ ] **AC-I-026** Remove Frame is present but disabled in the measured instance context.

### J · Census-wide product law — KAI-9448
- [ ] **AC-J-039** Every measured Components command menu or palette that exposes `Type to search…` filters the exact action set without hiding valid commands or inventing entries.
- [ ] **AC-J-040** `SPEC-PENDING` / **DAN DECISION**: Add To Agent entries on variant and instance menus receive an explicit clone/defer/not-applicable disposition before implementation or final sign-off.
- [ ] **AC-J-041** `SPEC-PENDING`: variant-frame Lock behavior and shortcut `⌘L` are measured before component-context dispatch.
- [ ] **AC-J-042** `SPEC-PENDING`: instance Lock behavior and shortcut `⌘L` are measured before component-context dispatch.
- [ ] **AC-J-043** `SPEC-PENDING`: variant-frame Hide behavior and shortcut `⌘;` are measured before component-context dispatch.
- [ ] **AC-J-044** `SPEC-PENDING`: instance Hide behavior and shortcut `⌘;` are measured before component-context dispatch.
- [ ] **AC-J-045** Every census-flagged paid-gated or harness-limited Components capability has live evidence or an explicit Dan disposition before final sign-off; access limitations never grant an implicit parity waiver.

### L · Accessibility add-menu atomization — KAI-9449
- [ ] **AC-L-029** The Accessibility add menu exposes **Tag**; its source-backed edit remains governed by `AC-L-027`.
- [ ] **AC-L-030** The Accessibility add menu exposes **Aria Label**; its source-backed edit remains governed by `AC-L-027`.
- [ ] **AC-L-031** The Accessibility add menu exposes **Tab Index**; its source-backed edit remains governed by `AC-L-027`.
- [ ] **AC-L-032** The Accessibility add menu exposes **Google Bot**; its source-backed edit remains governed by `AC-L-027`.
- [ ] **AC-L-033** `SPEC-PENDING`: Code Overrides section contents, attachment model, source/runtime effects, persistence, and removal are measured before `AC-L-028` dispatches.
- [ ] **AC-L-034** `SPEC-PENDING`: reopening an existing Styles Transition exposes the exact editor fields and update semantics before `AC-L-018` dispatches.
