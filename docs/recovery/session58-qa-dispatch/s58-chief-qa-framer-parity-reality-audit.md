# S58 Chief-QA reality audit — Framer Components parity

**Verdict: REWORK.** At exact `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f`, this is a durable transaction/compiler and free-variant foundation—not a clone of Framer's Components module. Do not dispatch another build until the completion contract measures the full product target.

## Target and proof law

- Worktree: `onemo-next/.codex/worktrees/s58-framer-architecture`
- Runtime: `http://localhost:3030/react-figma` — HTTP 200.
- Live inventory API: exactly one component, global `DemoButton`; zero project components.
- Focused authoring suite: 15 files, 187 tests passed, 0 skipped.
- Human-visible evidence: Dan and `@s58-designer` both reproduced the correct-port `:3030` dead-end: double-tapping `DemoButton` does not open authoring. My Chrome bridge was unavailable, so source/unit/API evidence below is **not** mislabelled as human-visible proof. Every row without human-visible proof remains visibly unaccepted.

## Exact implemented command surface

The user-semantic authoring commands are exactly:

1. `create-component-from-selection`
2. `create-variant`
3. `rename-variant`
4. `move-variant`

`import-source`, `revalidate-source`, `environment-rebase`, and `undo` are lifecycle/maintenance operations. They do not add states, interactions, properties, folders, instances, or preview. Source: `src/app/api/dev/editor/authoring-commands.ts:5-29` and the editor handler.

## Row-by-row truth

| Capability/claim | Classification | Exact reality at `8d64fd3` | Proof state |
|---|---|---|---|
| Create component from selection | **LIVE-WORKING** (scoped) | Naming/preview/resume/atomic compile path creates the component, primary variant, and source instance. | Source + transaction/compiler tests; human-visible acceptance owed. |
| Create free variant | **LIVE-WORKING** (scoped) | Selected variant exposes `+ Variant`; canonical command persists it. | Source + tests; human-visible acceptance owed. |
| Rename variant | **LIVE-WORKING** (scoped) | Selected label enters edit; Enter/blur commits, Escape cancels. | Source + tests; human-visible acceptance owed. |
| Move variant + persistence | **LIVE-WORKING** (scoped) | Drag commits `move-variant`; graph/source persistence covered. | Source + tests; human-visible acceptance owed. |
| Undo | **LIVE-WORKING** (scoped) | Transactional component-authoring undo exists. | Source + tests; human-visible acceptance owed. |
| Redo | **REMOVED** | No redo command or UI. | Full command/UI read. |
| Import/revalidate/environment rebase | **LIVE-WORKING** (scoped) | Project source lifecycle preview and confirmation paths exist. Global authoring is excluded. | Source + tests; human-visible acceptance owed. |
| One-canvas edit-in-place | **PARTIAL** | Same page shell is retained and hidden under a component overlay. The overlay edits variant frames/names only; component internals are not selectable/editable and the normal inspector is hidden. | Full `page.tsx` + `ComponentCanvas.tsx` read. |
| Home › Component breadcrumb | **PARTIAL** | Functional fixed overlay route exists, but it is a small pill—not Framer's top-bar navigation treatment. | Source; human-visible fidelity acceptance owed. |
| Figma/ONEMO DS skin | **LIVE-WORKING** | Authoring shell uses ONEMO semantic tokens. | Source; visual acceptance owed. |
| True infinite component canvas | **PARTIAL** | Outer editor pans/zooms, but component authoring lives inside a bounded host with 800×600 minimum and graph-derived expansion. | Source. |
| Blank component creation | **REMOVED** | UI explicitly says it is unavailable in this phase. Framer has it; product intent requires it. | `page.tsx:3919-3923`. |
| Existing component double-click/edit entry | **FALSELY-CLAIMED** | Code opens project components only. Live inventory contains only global `DemoButton`, which emits “Global library authoring is not available in this phase.” Default user path is a dead end. | Live API + Dan/designer correct-port visible reproduction + `page.tsx:3924-3931`. |
| State creation (Hover/Pressed) + state ghosts | **UNBUILT** | Kinds exist in schema only. No command, UI, compiler operation, or state ghost. | Full command/UI/compiler read. |
| Node/connector/interaction system | **UNBUILT** | Interaction records validate in schema only. No nodes, ports, wires, trigger/action editor, Reset Override, or edge command. | Full source read. |
| Transitions | **UNBUILT** | Transition structures validate in schema only. No editor, command, or preview execution. | Full source read. |
| Play/preview + Back | **UNBUILT** | No component preview surface or execution path. | Full UI source read. |
| Primary-linked override menu | **UNBUILT** | Primary/inheritance references exist in graph validation only. No override UI or command. | Full source read. |
| Folders / Assets tree | **UNBUILT** | Folder records validate in schema only. Components rail is a grouped text list, not Framer's folder tree. | Full source read. |
| Instances | **PARTIAL** | Create-from-selection writes the initial instance record/source replacement. No insert/drag, variant picker, Edit Component, Detach, Replace, or Replace All instance lifecycle. | Compiler + UI source/tests. |
| Play badge on instances | **UNBUILT** | No badge or instance interaction marker. | Full UI source read. |
| Component props/property controls | **UNBUILT** | `SourcePropertyRef` is schema foundation only. No property-control extraction, controls, editing, or persistence UI. | Full source read. |
| Full component lifecycle menu | **PARTIAL** | Project Edit and Copy Import work. Insert, Rename, Duplicate, Delete are visibly disabled; Find, Library, Copy URL are absent. | `page.tsx:3927-3937`. |
| Components-page previews/counts/search/scope | **PARTIAL** | Search, Project/Global/category grouping, and text counts exist. Rendered previews, instance counts, folders, and full scope behavior do not. | Full rail source + live API. |
| Drag component to insert | **UNBUILT** | No drag/insert instance command or UI. | Full command/UI read. |
| New Event flow | **UNBUILT** | No event creation command, UI, node, connector, or runtime. | Full command/UI/compiler read. |
| Component-content editing | **UNBUILT** | Component output is rendered inside draggable variant figures, but its internal elements cannot be selected or edited and no component inspector is mounted. | `ComponentCanvas.tsx:278-318`; `page.tsx:3992-4024`. |

The page editor's generic Hover/Tap CSS pseudo-rule section (`page.tsx:2587-2607`, `4391-4406`) is unrelated to the Framer component state/interaction graph and cannot be credited to these rows.

## Contract/tracking defects that would permit false closure

The current G1–G5 architecture contract can pass while Dan's product remains incomplete. Before build dispatch, the completion contract must add explicit, evidence-bearing rows for:

1. Component props/property controls.
2. Full component lifecycle/menu.
3. Existing-component double-click/edit acceptance from the shipped inventory.
4. Components-page previews, counts, scope, and folder behavior.
5. Drag-to-insert and complete instance lifecycle.
6. New Event, states, connectors, transitions, Reset Override, and Play execution.
7. Blank create.
8. Component-content editing—not merely moving variant frames.
9. Row → current Linear ID → owner → source proof → visible-browser proof.
10. A hard final gate requiring Dan-visible real-browser acceptance; headless/browser automation may support it but never substitute for it.

Tracking also contains incompatible/stale E7/E10/E11 generations. None is currently a single item-by-item full-parity metric.

## Corrections to `s58-framer-parity-TRUE-STATE-AND-SPRINT.md`

- The claim that the only human check used wrong `:3025` is stale: Dan and designer subsequently reproduced the failure on correct `:3030`.
- “One-canvas edit-in-place ✅” overstates reality; classify **PARTIAL**.
- “Instances ✗” undercounts the initial instance created by create-from-selection; classify **PARTIAL foundation**, while the user-facing instance lifecycle remains unbuilt.
- Rich schema entities are not live features. Count states/interactions/transitions/folders/property references as **UNBUILT** until command + UI + compiler/runtime + visible proof exist.

## Chief-QA gate

**REWORK before build dispatch.** Replace the phase-shaped definition of done with a Dan-approved full-Framer parity ledger. Then build in dependency order and require source tests plus human-visible acceptance for every user-facing row. Current build is not “nearly Framer”; it is the transaction-safe free-variant substrate beneath it.
