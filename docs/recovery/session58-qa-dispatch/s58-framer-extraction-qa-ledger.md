# Framer components module: independent QA extraction

**Auditor:** s58-qa
**Date:** 2026-07-10
**Project:** Powerful Autonomy scratch project
**Method:** Playwright user-position operation plus DOM, console, network, and URL evidence. Expert and designer claims are excluded unless independently reproduced here.

## Evidence labels

- **OBSERVED:** directly visible or operated in this pass.
- **INFERRED:** derived from observed UI but not operated end to end.
- **UNVERIFIED:** attempted but not proven.

## Coverage

- [x] D1 Canvas model and navigation
- [x] D2 Component creation
- [x] D3 Component edit entry/exit
- [x] D4 Variants and state variants
- [x] D5 Interactions/connectors
- [x] D6 Preview/play
- [x] D7 Assets/folders
- [x] D8 Insert and instance operations
- [x] D9 Inspector behavior and conditional sections
- [x] D10 Layers hierarchy
- [x] D11 DOM/console/network architecture
- [x] D12 Visual-language interpretation for ONEMO/Figma styling

`[x]` means the dimension was independently inspected. It does not convert the explicitly listed `UNVERIFIED` operations into facts.

## Findings

### D1. Canvas model and navigation

- **OBSERVED:** Project `Powerful Autonomy`, component-edit node `EHvLPHLQz`, and Home node `augiA20Il` stayed in one editor shell. Home and component editing are URL/node state changes, not separate browser pages.
- **OBSERVED:** Component editing displays freely placed frames on one canvas. Before QA mutations the frames were `Variant 1 · Primary`, `Variant 1 · Hover`, and `Variant 2`; adding a variant created `Variant 3` at X=990 while Primary was X=0 and Variant 2 was X=495.
- **OBSERVED:** `Home` and the current component name are buttons in the canvas top bar. They are not attached to a component sheet.
- **OBSERVED:** The bottom toolbar exposes Select, Pan, Comment, Theme, zoom percentage, and Upgrade. The 100% menu contains Zoom (`Z`), Zoom In (`Cmd +`), Zoom Out (`Cmd -`), Zoom to 100% (`Cmd 0`), Zoom to Fit (`Cmd 1`), Zoom to Selection (`Cmd 2`), Fast Zoom, and Nudge Amount.
- **OBSERVED:** The top creation menu exposes Frame (`F`), Stack (`S`), Grid (`Shift G`), Masonry (`Shift M`), Image (`Shift I`), and Video (`Shift V`).

### D2. Component creation

- **OBSERVED:** With a 200 x 150 Frame selected, `Cmd Option K` opens a modal titled `New Component`.
- **OBSERVED:** The modal contains a required `Title`, Cancel, and disabled Create button. Help text says components are edited on their own canvas and that double-clicking an instance adds visual variants and interactions.
- **OBSERVED:** Entering `QAFrame` enabled Create. Create changed the URL to node `vyBJMNHdZ`, opened a dedicated `Home > QAFrame` component canvas, created `Variant 1 · Primary`, and exposed `Add Variant` plus `Add Hover or Pressed Variant` ghost slots.
- **OBSERVED:** Returning Home showed `QAFrame` as the layer replacing the source Frame and as an asset under `Components > Project` beside `NodeCard`.
- **OBSERVED:** The first pointer attempt dragged the existing NodeCard instead of drawing a Frame; undo restored its exact T=140/L=240/R=565/B=619 position. Pressing `F` first and drawing on empty canvas produced the intended 200 x 150 Frame. This was a harness/focus issue, not a Framer defect.
- **UNVERIFIED:** Blank creation from the Assets `Add Component` control, invalid/duplicate names, Cancel, and undoing component creation were not operated.

### D3. Component edit entry and exit

- **OBSERVED:** Selecting a NodeCard instance shows a right-inspector `Edit Component` button. Activating it changes the URL from Home node `augiA20Il` to component node `EHvLPHLQz`.
- **OBSERVED:** The component canvas top bar provides `Home > NodeCard`; Home returns to `augiA20Il`.
- **OBSERVED:** A context-menu `Edit` action on the instance did not change the URL and is not equivalent to `Edit Component`.
- **INFERRED:** Framer distinguishes in-place instance editing from entering the main component canvas. The clone must preserve that distinction rather than mapping both labels to one route.

### D4. Variants and state variants

- **OBSERVED:** `Add Variant` created a freely positioned `Variant 3` frame and a matching Layers row.
- **OBSERVED:** The Primary state slot exposed `Hover` and `Pressed`; after Hover already existed, the remaining slot became `Add Pressed Variant`.
- **OBSERVED:** Right-clicking Variant 3 exposed Add To Agent, Show Primary, Detach From Primary, Update Primary, Reset Overrides, Duplicate, Delete, Rename, Auto Rename, Lock, Hide, Overflow, and default-style actions.
- **OBSERVED:** The presence of Show/Detach/Update Primary proves a newly added variant has a primary-linked override relationship, not just an independent rectangular frame.
- **UNVERIFIED:** Selecting Pressed did not visibly create a state frame. Rename typing was intercepted by Agent chat. Variant delete, reorder, default reassignment, and their undo behavior were not operated.

### D5. Interactions and connectors

- **OBSERVED:** The Interactions add menu exposes two different commands: `New Transition` and `New Event`.
- **OBSERVED:** Variant 2 displayed the interaction row `Click -> Set Variant` and a `Has Interactions` Layers marker.
- **OBSERVED:** Opening the Set Variant dialog exposed `On`, Delay, Transition, and Variant target controls.
- **OBSERVED:** The exact Set Variant triggers are `Click`, `Click Start`, `Appear`, `Mouse Enter`, and `Mouse Leave`. The expert blueprint's `Click/Hover/Press/Appear/Scroll` vocabulary is false for this dialog.
- **OBSERVED:** Transition behavior offers `Once` and `Cycle`. Variant targets were Variant 1, Variant 2, and Variant 3.
- **OBSERVED:** Removing Variant 2's inherited interaction replaced `Set Variant` with `Reset Override` and removed the Layers marker. Undo restored `Set Variant` and the marker. Removal is therefore override-aware, not merely edge deletion.
- **UNVERIFIED:** New Event did not expose a stable readable dialog/row. Connector drag creation, edge retargeting, event action choices, conflicting interactions, and deleted-target cleanup remain unproven.

### D6. Preview/play

- **OBSERVED:** Preview adds `view=preview` to the project URL and provides Back, Reload, Fullscreen, width and height controls, and Close Preview.
- **OBSERVED:** Preview runs in a separate iframe with test id `preview-iframe`; the authoring canvas remains a distinct iframe.
- **OBSERVED:** Previewing while Variant 3 was selected rendered a root with `data-framer-name="Variant 3"`. Previewing Primary and moving the pointer over the component added a `hover` class; moving away removed it.
- **OBSERVED:** Back removed preview state and returned to authoring.
- **UNVERIFIED:** A click produced no visible difference because the test variants shared styling. Reset/reload semantics, runtime errors, and interaction failure UI were not proved.

### D7. Assets and folders

- **OBSERVED:** Assets contains Templates, Components, Styles, Vectors, and Code. Project components appeared under `Components > Project`.
- **OBSERVED:** The Project folder context menu contains `New Component`, `New Folder`, and `Sort Alphabetically`.
- **OBSERVED:** A component asset context menu contains Insert, Edit, Find, Rename, Duplicate, Delete, Library, Copy Import, and Copy URL. Delete was disabled for NodeCard in this state.
- **UNVERIFIED:** New Folder did not expose a stable accessible name editor; typing was intercepted by Agent chat. Folder naming, nesting, moving, sorting result, deletion, persistence, and empty/error states remain unproven.

### D8. Insert and instance operations

- **OBSERVED:** The existing NodeCard instance is a single Layers child under Desktop and is independently selectable.
- **OBSERVED:** Its inspector exposes component identity, Variant selection (`Variant 1`, `Variant 2`, `Variant 3`), Trigger Add, and Edit Component.
- **OBSERVED:** The instance context menu, not the inspector, exposes `Detach Instance`, `Replace With`, and `Replace All Instances With`, plus Edit, Duplicate, Delete, Rename, Lock, and Hide.
- **UNVERIFIED:** Asset `Insert` did not visibly add a second layer. Playwright drag from the asset into the sandboxed canvas timed out because an overlay intercepted pointer events. Click insert, drag insert, detach, replace, replace-all, and go-to-main must not be claimed end to end.

### D9. Inspector behavior and conditional sections

- **OBSERVED:** A selected free variant exposes, in order: Interactions, Link, Position & Size, Layout, Effects, Overlays, Cursor, Styles, Accessibility, Code Overrides.
- **OBSERVED:** Variant Styles includes Transition, Opacity, Visible, Fill, Overflow, Radius, Rotate, Border, and Shadows. Position & Size includes X/Y, width/height sizing, and Min Max.
- **OBSERVED:** A selected instance instead exposes Position, Size, Effects, Overlays, Cursor, Styles, Transforms, a component-specific section, Scroll Section, and Code Overrides.
- **OBSERVED:** The instance Position type was Absolute; Fixed was available while Relative and Sticky were disabled in this container state.
- **OBSERVED:** Spring Transition has Instant, Ease, and Spring modes. Spring supports `Based On: Time` with Time 0.4s, Bounce 0.2, Delay 0, and `Based On: Physics` with Stiffness 400, Damping 30, Mass 1, Delay 0.
- **INFERRED:** Inspector composition is selection- and context-dependent. A single static rail cannot represent Framer behavior.

### D10. Layers hierarchy

- **OBSERVED:** Home Layers showed Desktop with component-instance children. After component creation it showed QAFrame and NodeCard as separate children.
- **OBSERVED:** NodeCard component-edit Layers showed Variant 1 Primary, Variant 1 Hover, Variant 2, and Variant 3, with interaction status attached to Variant 2.
- **OBSERVED:** Layer selection was a more reliable automation entry point than canvas-label clicks, which sometimes shifted focus to Agent.

### D11. DOM, console, and network architecture

- **OBSERVED:** Authoring runs in `iframe[data-testid="canvas-iframe"]` with `allow-scripts allow-same-origin` and a project-specific `framercanvas.com` canvas sandbox.
- **OBSERVED:** Preview uses a different `preview-iframe`. The correct model is persistent authoring canvas plus separate runtime preview, not "avoid iframes."
- **OBSERVED:** Console had 0 errors and 2 browser warnings. Framer reported production version `ba29d66`, `Framer Sandbox Starting`, `CanvasReady 2275ms (new renderer)`, and canvas reveal after 1715ms. One later HighlightTool frame took 360ms.
- **OBSERVED:** Network included project tree sync `GET /multiplayer/projects/.../tree/sync?version=0 -> 200`, generated module loads for Home and NodeCard, and repeated `POST /modules/v1/modules/batch/saves/?copyOnWrite=... -> 200` after authoring mutations.
- **OBSERVED:** Trace: `/var/folders/v6/y7h8bmld1hs0j4v3rw9yg_z00000gn/T/.playwright-cli/traces/trace-1783683394909.trace`; network log: sibling `.network` file.
- **INFERRED:** The clone needs explicit authoring persistence and preview compilation seams; UI-only state is insufficient.

### D12. ONEMO/Figma visual-language interpretation

- **OBSERVED:** Framer behavior relies on canvas-space labels and ghost slots, top-bar breadcrumb/navigation, selection-conditional inspectors, compact context menus, Layers status markers, and a separate preview mode.
- **INFERRED:** ONEMO should reproduce those information/interaction contracts using its existing Figma-derived tokens and chrome. It should not copy Framer's fonts, colors, brand controls, Agent UI, Publish UI, or upgrade affordances.
- **INFERRED:** Destructive and secondary instance actions belong in context menus, matching both the observed Framer behavior and Dan's Figma-behavior direction; they should not become always-visible inspector buttons.

## QA mutations and limits

- Scratch-only changes created during evidence collection: `Variant 3`, component `QAFrame`, and two accidental Agent prompts (`iant`, `Evidence`). The rejected product repository was not edited.
- The initial NodeCard movement was undone and its original position verified.
- No destructive cleanup was performed because deletion would exceed the non-destructive QA brief without explicit confirmation.
- Framer observations above are independent of the expert ledger. Remaining `UNVERIFIED` items must remain out of exact build requirements until operated or explicitly treated as product decisions rather than Framer facts.

## Independent verdict

**REWORK.** The browser evidence confirms Dan's architectural complaint and invalidates several exact claims in the expert blueprint. A build-safe revision must use a first-class free-variant/interaction model, preserve one authoring canvas plus separate preview, distinguish main-component entry from instance editing, model primary-linked overrides, and replace inferred trigger/instance/folder claims with observed or explicitly scoped behavior.
