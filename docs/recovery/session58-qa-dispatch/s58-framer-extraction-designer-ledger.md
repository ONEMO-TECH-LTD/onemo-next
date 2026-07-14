# Framer components module — INDEPENDENT extraction by @s58-designer (2026-07-10)

**Auditor:** @s58-designer (Kai-Claude) · **Mandate (Dan, via /goal + expert dispatch):** adversarial independent extraction — visual AND code — full user-position click-through of Framer's components module in Chrome; extract code/console/DOM to see logic + UX-UI behaviour; collate gaps vs our engine/model; separate gap+features-to-build report. THEN review expert blueprint (NOT read before my pass — independence preserved).

**Environment:** my own fresh throwaway project "Average Book" (created this session, Dan's workspace, NOT Dandy Researchers, NOT the expert's "Powerful Autonomy" scratch). Every fact below SEEN/OPERATED live unless marked otherwise.

---

## Extraction dimensions (checklist)

- [x] D1 — Canvas model: infinite canvas, free placement, zoom/pan, breadcrumb chrome
- [x] D2 — Create component: from element (menu/shortcut), naming dialog, what changes on creation
- [x] D3 — Edit model: scoped component canvas, breadcrumb chips, Edit Component button, exit via breadcrumb
- [x] D4 — Variant model: free named variants, +Variant ghost, inline rename; state slot (Hover/Pressed menu seen; creation-product not reproduced — see caveats)
- [x] D5 — Connectors/interactions: FULL trigger vocab, Set Variant popover (Delay/Once|Cycle/target), wire render+visibility rules, remove semantics
- [x] D6 — Play/preview mode: entry, live component run, viewport fields, Back
- [x] D7 — Assets panel: folder tree, folder + component context menus, nesting
- [x] D8 — Insert/instances: menu-insert (drag = harness limit), variant picker, Trigger Add…, Edit Component, Detach, Replace With
- [x] D9 — Inspector: per-variant sections incl. Transition ⚡ Spring, Interactions, Code Overrides
- [x] D10 — Layers panel: component-scoped variant listing, badge column
- [x] D11 — Code/DOM dig: testids, iframe architecture, generated ESM module fetched + decoded (compile target)
- [x] D12 — Visual language: chrome layout, chips, labels, ▶ badge (semantics partially open), ghost pills, wire geometry, selection visuals

## Findings

### D11 — Architecture (extracted via JS, parent DOM)
- Editor shell = parent app; **canvas = cross-origin sandbox iframe** (`canvas-iframe`, host `project-*.framercanvas.com`, path `/s/app.<hash>/canvas-sandb…`); **separate `preview-iframe`** (same host, `/preview-modu…`) — play mode is its own iframe, pre-mounted.
- Top-chrome testids: `preview-play-button`, `projectbar-menu-button`, `projectbar-preview-button`, left tabs `pages-tab`/`layers-tab`/`assets-tab`, right tabs `chat-tab`(Agent)/`properties-tab`(Style), `content-panel-search-bar-input`, `page-row`.
- Right-panel popovers/menus/inspector = parent DOM (regular React, real `<select>` comboboxes readable/settable). Canvas menus (state-ghost Hover/Pressed) render in parent DOM too but resist plain synthetic clicks; **Framer menus use press-drag-release (macOS menu idiom)** — left_click_drag from opener to item fires them.

### D1 — Canvas model (operated)
- ONE infinite canvas; page frame ("Desktop · Primary") + free elements. **Component edit = separate scoped view on the same canvas surface** — entering a component hides page content, shows ONLY that component's variants as free frames; breadcrumb `[📄 Home] › [◈ BuyButton]` as CHIPS in a canvas TOP BAR (grey page chip, purple component chip with ◈ diamond icon).
- Canvas toolbar (bottom center, floating): pointer / hand / comment / moon(dark-preview) / zoom `100% ▾`.
- Zoom persists; deep-link node id in URL per selection (`?node=…`).

### D2 — Create component from element (operated)
- Right-click element → context menu (SEARCHABLE — has a "Type to search…" field!): **Create Component ⌥⌘K** top item (with Add To Agent above it, Create Layout Template below). Menu also: Fit Content ⇧A, Select›, Align›, Copy›, Paste›, Move›, Duplicate ⌘D, Delete ⌫, Rename ⌘R, Auto Rename ⌥R, Lock ⌘L, Hide ⌘;, Overflow›, Add Frame ⌘↵, Add Stack ⌥⌘↵, Remove Frame ⌘⌫.
- Create Component → **naming dialog**: "New Component" + name input + copy: *"Components can be edited in their own canvas. Double-click on any instance to add visual variants and interactions."* Cancel/Create.
- On Create: auto-ENTERS the component canvas; element becomes "Variant 1 · Primary".

### D4 — Variant model (operated)
- Variants are FREE FRAMES, freely positioned/named. Layers panel scoped to component: `Variant 1 · Primary`, `Variant 2 · Variant` (+ badge column right).
- **Ghost slots render ONLY while a variant frame is selected**: "+ Variant" pill RIGHT of the last variant, state pill BELOW ("Add Hover or Pressed Variant" a11y label). Ghosts = grey pills, lavender tint on hover, no text label until interaction.
- Click +Variant ghost → instant "Variant 2" (auto-name, full copy of Variant 1, own free frame, no dialog).
- State ghost click → menu **Hover / Pressed** (the interaction-state vocabulary).
- **Rename = double-click the variant LABEL → inline edit** — renamed "Variant 2"→"Hover State" (any string). ⌘A select-all works inside.
- Label anatomy: purple text; SELECTED variant's label gains a **purple rounded-square ▶ badge** (also = has-interactions marker; hidden when deselected on plain variants… observed: badge shows on selected variant regardless, need play-badge disambiguation — see caveats).
- Selection visuals: variant frame = thin purple border + 2 round corner dots (top-left, bottom-right = resize); child deep-select = DASHED purple border; Escape pops selection up the hierarchy.

### D5 — Interactions / connectors (operated — the rules Dan asked for)
- Select variant → inspector **Interactions** section `+` → menu **New Transition / New Event**.
- **New Transition creates an interaction row: `[trigger] → [action chip ⚡ Set Variant] ✕`** and opens the **Set Variant popover**: `On` (trigger dropdown) / `Delay` (sec stepper) / `Transition: Once | Cycle` (segmented) / `Variant` (target dropdown).
- **FULL trigger vocabulary (extracted from the real `<select>`): Click, Click Start, Appear, Mouse Enter, Mouse Leave.** Target = any named variant. (Row labels shorten: Mouse Enter → "Enter".)
- **Once vs Cycle** = fire once vs cycle through targets on repeat trigger.
- Multiple interaction rows per variant allowed (had Click→Variant 1 + Mouse Enter→…).
- Removing the action chip (✕) leaves the row as `[trigger] → Reset…` — "Reset" = empty/reset-to-base action state; row ✕ removes the whole interaction.
- **WIRE: the moment an interaction has a target, a STRAIGHT purple wire with an ARROWHEAD at the TARGET end draws from the interaction-owning variant's edge to the target variant's edge** (measured: V2 left-edge → V1 right side, horizontal, edge-to-edge at frame mid).
- **Wire visibility rules (measured): wires + ghosts + ▶ badge render only while a VARIANT FRAME is selected.** Deep-select of a child (dashed) or deselect hides the whole overlay.
- Corner dots are RESIZE handles, not connect handles (drag from dot did not author a wire).
- Sizing vocab (selects): W: Fixed/Relative/Fill/Fit Content; H: + Viewport. Overflow: Clip/Visible/Hidden/Scroll.
- Per-variant **Transition: ⚡ Spring** = first-class Styles property on every variant (the animation the wire uses).
- Full per-variant inspector sections: Interactions / Link / Position & Size / Layout / Effects / Overlays / Cursor / Styles (Transition, Opacity, Visible, Fill, Overflow, Radius, Rotate, Border, Shadows) / Selection Colors / Accessibility / **Code Overrides**.

### D6 — Play / preview mode (operated)
- ▶ (top-right, testid `preview-play-button`) → **full-screen live preview, URL gains `view=preview`** — pressed inside component edit, it previews THE COMPONENT (live, interactive). Top bar swaps to: `‹ Back` · reload · pop-out (left) / **viewport size fields `W × H`** (center) / avatar · ▶ · Invite · Publish (right).
- `‹ Back` restores the exact edit context (selection, scroll, rename all intact). Preview is a SEPARATE pre-mounted `preview-iframe` — instant swap, not a rebuild.

### D7 — Assets & folders (operated)
- Assets tab: **Templates / Components / Styles / Vectors / Code** sections, each with `+`.
- Components → folder tree ("Project" folder → BuyButton ◈). **Folder right-click: New Component / New Folder / Sort Alphabetically** — nested folders confirmed first-hand.
- Component right-click: **Insert / Edit / Find / Rename / Duplicate / Delete (disabled while instances exist) / Library › / Copy Import / Copy URL**.

### D8 — Instances (operated)
- On Create Component, the source element on the page becomes an INSTANCE in place.
- Instance inspector: Position/Size/Effects/Overlays/Cursor/Styles/Transforms + **`BuyButton · Component` section: Variant picker (select, options = the named variants) · Trigger: ⊕ Add… · [Edit Component] button** + Scroll Section + Code Overrides.
- Instance right-click: **Edit / Set Default Size / Detach Instance / Replace With › / Replace All Instances With ›** + standard ops (Duplicate/Delete/Rename/etc).
- Insert paths: drag from Assets AND context-menu Insert. Position type vocab: Absolute/Relative/Fixed/Sticky.

### D11b — GENERATED CODE (fetched the real module — the compile target)
- `Copy Import` → `import BuyButton from "https://framer.com/m/BuyButton-<hash>.js@<version>"` (toast: "Copied import statement"). That URL re-exports a module on `framerusercontent.com` — **components ARE versioned ESM modules on Framer's CDN**.
- Full module fetched + read (7.4KB, saved `scratchpad/framer-buybutton-module.js`). The model in code:
  - `cycleOrder = [variantId…]`; `variantClassNames = {id: cssClass}`; `humanReadableVariantMap = {"Hover State": id, "Variant 1": id}` → **variants = FLAT set of generated IDs; display names are aliases** (multi-dim would be property-controls, confirming our CODE-model finding).
  - Runtime: `useVariantState({cycleOrder, defaultVariant, variant, variantClassNames})` from `"framer"`; gestures via `gestureHandlers` + `setGestureState`.
  - **My Click→Variant-1 interaction compiled to**: `const onTapXXX = activeVariantCallback(async () => { setGestureState({isPressed:false}); setVariant("vOk2N5oYc"); })` attached through `addPropertyOverrides({<HoverStateId>: {onTap: onTapXXX, "data-highlight": true}})` — **interactions = per-variant prop overrides mapping trigger→setVariant**.
  - Transition: `{bounce:.2, delay:0, duration:.4, type:"spring"}` injected via a `MotionConfigContext` wrapper (default Spring; per-variant transitions would add more).
  - Styling: CSS strings scoped by hash class (`withCSS(Component, css, "framer-7IaV3")`); variant-specific CSS rows (`.framer-v-<class> … {cursor: pointer}`); `@framerCanvasComponentVariantDetails` JSDoc metadata; `addPropertyControls(… variant: ControlType.Enum {options: ids, optionTitles: names})`; `addFonts(…)`.
  - **Imports from `"framer"` + `"framer-motion"` — proprietary runtime, NOT standalone clean React+CSS.** (Our engine's clean-output divergence is a real, deliberate advantage — confirmed at code level.)

### Honest caveats (what I could NOT fully operate)
- **Connect-handle drag-to-wire gesture**: not reproduced — the harness's synthetic pointer stream doesn't produce Framer's hover-reveal + drag pickup (same limit the expert hit on drag-insert). Wire mechanics were instead proven via the inspector path (New Transition → wire draws). The handle exists (a11y/state ghost "Add Hover or Pressed Variant"; corner dots are resize, not connect).
- **Drag-insert from Assets**: not reproduced (HTML5 drag pickup, harness limit) — Insert-via-menu confirmed instead.
- **▶ label badge semantics**: observed on the SELECTED variant's label in both states (before AND after interactions existed). I could not isolate "badge = has-interactions" vs "badge = selected affordance" — flagging as open question rather than asserting.
- State-ghost menu (Hover/Pressed) items resisted every synthetic click pattern; menu content itself captured 3×. The state-VARIANT creation product (auto-wire from base to state) therefore not directly reproduced this session.
- These caveats are automation-tooling limits, not Framer ambiguities — flag for whoever needs pixel-exact gesture specs to verify by hand.
