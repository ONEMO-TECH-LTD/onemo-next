# Framer DEEP extraction ledger — user-position click-through + console/code dig
@s58-expert · 2026-07-10 · scratch project "Powerful Autonomy" (Dan's real project untouched)
Method: operate every feature as a USER, read the running app's DOM/console/code, record exact behaviour + UI.
Goal constraint: clone Framer BEHAVIOUR/model; render in OUR Figma/ONEMO styling — NOT Framer chrome.

## Extraction dimensions (must cover ALL before writing blueprint)
- [ ] D1 Canvas model — infinite canvas, free placement, zoom/pan, coordinate system, selection
- [ ] D2 Top bar / breadcrumb chrome — exact controls, what "buttons below breadcrumb" are
- [ ] D3 Create-component pipeline — from element (⌘⌥K), from scratch, the icons, the menu, naming
- [ ] D4 Edit component — Edit Component / double-click → in-place edit on infinite canvas; how you exit
- [ ] D5 Variants — free named variants, +Variant, state slot (Hover/Pressed), create/position/rename/delete
- [ ] D6 Connectors/nodes — ⚡ handle, drag-to-wire, trigger vocab (New Transition/New Event), transition types, edit, DELETE/remove
- [ ] D7 Play/Preview — ▶ button, full-screen preview, live interaction, Back/exit
- [ ] D8 Assets/folders — tree, folder ops (New Component/Folder/Sort), nesting, drag-org
- [ ] D9 Insert — drag from panel → canvas → instance; other insert paths
- [ ] D10 Instance ops — detach, go-to-main, replace, edit-from-instance
- [ ] D11 Inspector — property panels, Transition:Spring first-class property, layout controls
- [ ] D12 Console/code — DOM structure, class names, data attrs, any exposed model that reveals the mechanics

## Notes (append per dimension, cite what I SAW)

### D12 Console/code model (SEEN via DOM probe of framer.com editor shell)
- The CANVAS is a **cross-origin sandbox iframe**: `testid=canvas-iframe`, src `project-<id>.framercanvas.com/.../canvas-sandbox.html`. Node model lives inside it (not reachable from parent JS) → extract behaviourally.
- A SEPARATE **`preview-iframe`** exists with **`preview-play-button`** — play mode swaps the canvas for a live preview iframe (framer.app preview domain).
- Editor shell testids (Framer's own feature names → our component names):
  - Left panel tabs: `pages-tab`, `layers-tab`, `assets-tab`. Panel = `data-is-left-panel`, tree = `sortable-tree`, `layer-name-input`.
  - Right panel tabs: `chat-tab` (Agent AI), `properties-tab` (Style inspector). Panel = `data-is-right-panel`.
  - Project bar (top): `data-is-project-bar` → `projectbar-menu-button`, `projectbar-preview-button` (the ▶), plus "Canvas / <project> / main / Invite / Publish".
  - Selection: `selection-box-overlay`, 8 `resizehandle-{0|0.5|1}-{0|0.5|1}` handles, `rotationrow-input`.
  - Size panel: `sizepanel-width-input`/`-dropdown`, `sizepanel-height-input`/`-dropdown`, `stacklayoutpanel-enable-stack-button`.

### D11 Inspector (Style tab) — FULL frame inspector, top→bottom (SEEN)
`Interactions (+) · Link (Link To: Page or URL) · Position & Size (Position X/Y; Width [Fixed·Relative·Fill·Fit Content]; Height [Fixed·Relative·Fill·Fit Content·Viewport]; Min Max) · Layout (+) · Effects (+) · Overlays (+) · Cursor (+) · Styles [Transition:⚡Spring · Opacity · Visible Yes/No · Fill(hex) · Overflow Clip·Visible·Hidden·Scroll · Radius · Rotate · Border Add · Shadows Add] · Accessibility · Code Overrides`
- **Transition (Spring) is a first-class per-variant Style property** — the ⚡ next to it is the connector/transition marker. This is the model our engine already compiles (spring→physics).

### D6 Connectors / nodes — THE model (Dan's Q5) (SEEN, operated live)
- Live via **Interactions (+)** → menu: **New Transition · New Event**.
- **New Transition** creates an interaction row: **`Click` (trigger) → `Set Variant` (action)**. So a "node/wire" = **trigger → action(target variant)**, animated by the target's **Transition (Spring)**.
- Trigger vocab — **CORRECTED 2026-07-10 (was an assumption; re-read the live `<select>` value=`onTap`):** the real options are
  `Click · Click Start · Appear · Mouse Enter · Mouse Leave` — NO Hover/Press/Scroll (those are separate state-variant gestures).
  Target select = `Set Variant… · Variant 1/2/3`. Popover params (designer-measured): On · Delay · Transition Once|Cycle · Variant; clear→Reset; multi-row. (New Event vocab still unopened — pre-build item.) Action = Set Variant (+ Link To for navigation).
- **A ▶ play badge appears on the variant label once it has an interaction** (Variant 2 got the ▶).
- **Remove a connector = the ✕ at the right end of the interaction row** (also delete the whole interaction). This is the "changed my mind" delete path Dan asked for.
- On canvas, the connector is drawn as the ⚡ edge-handle → wire between variant frames; the inspector row is the same relationship in list form. Both edit the same interaction.

### D5 Variants — free, named (SEEN earlier + confirmed)
- `+Variant` ghost → new free frame "Variant 2" (renamable, listed in Layers as "Variant"). "Variant 1" carries the **Primary** (default) tag. Separate **Hover / Pressed** ghost slot below for state variants (⊕). NO fixed 6-state list, NO CVA axis inputs — free named frames only.

### D4 Edit-in-place (SEEN)
- Instance inspector shows `<Name> · Component` + **Edit Component** button; double-click also enters. Edit = SAME infinite canvas at `?node=<componentNode>`, variants as free frames, breadcrumb `Home › <Name>` chip in top bar, Layers lists variants, `Home` exits.

### D7 Play / Preview (SEEN)
- `projectbar-preview-button` (▶ top-right) → `preview-iframe` full-screen live preview (`view=preview`), interactions run live, `‹ Back` exits.

### D1 Canvas (SEEN)
- Infinite canvas, free placement, absolute coords (instance inspector shows Position X/Y = 140/240, Type: Absolute). A "Desktop 1200" frame lives on it; instances/frames placed freely. Zoom control `100% ▾` bottom-center; pan via Hand tool.

### D2 Top bar chrome — EXACT (zoomed, SEEN) — for OUR re-skin
- **Left cluster:** Framer logo · `Canvas ▾` (mode switch) · insert toolbar: `+` (add) · `⬚` frame · `T` text · `△` shape/vector · `⚙`(insert/assets).
- **Center:** breadcrumb chips `[📄 Home] › [◈ NodeCard]` — Home = doc icon in grey rounded chip, chevron, component = purple-diamond icon in light-purple chip. (Only shows the breadcrumb when inside component-edit; on page it shows the project title.)
- **Right cluster:** `DS` user avatar · `▶` play (preview) · `Invite` · `Publish`(purple).
- **Canvas toolbar (bottom-center):** pointer · hand(pan) · comment · moon(theme) · `100% ▾` zoom · divider · CTA.
- **Right panel tabs:** `Agent | Style` segmented control.
> RE-SKIN NOTE (Dan's constraint): we clone this LAYOUT/behaviour but render in ONEMO's design language — our type scale, our surface/elevation, our accent (not Framer purple), our iconography (Phosphor light per icon rule). NOT a Framer-purple mixed bag.

### D3 Create-component pipeline (SEEN)
- From element: select frame → ⌘⌥K / right-click → Create Component → name it → frame becomes an instance.
- From scratch: Components `+` / New Component. Folder right-click → New Component / New Folder / Sort Alphabetically.

### D8 Assets & folders (SEEN)
- Assets tree: `Templates (+) · Components (+) → Project(folder) → NodeCard · Styles (+) · Vectors (+) · Code (+)`. Nested folders. Folder ctx menu: New Component / New Folder / Sort Alphabetically.

### D9 Insert (SEEN — mechanic; live drag not reproducible via synthetic harness, real users drag fine)
- Component ctx menu (right-click asset): **Insert · Edit · Find · Rename · Duplicate · Delete · Library › · Copy Import · Copy URL**. So insert has TWO paths: **drag from Assets → drop on canvas**, OR **right-click → Insert** (places an instance). Dan's "dragging is broken" = OUR editor bug; Framer offers both.

### D10 Instance ops (SEEN in instance inspector)
- Selected instance inspector: `NodeCard · Component` section with **Variant picker (Variant 1 ▾)** (switch shown variant) + **Trigger: Add…** (attach interaction) + **Edit Component** button. Plus standard detach/replace (Figma-parity, per Dan's screenshots). Position Type: Absolute.

## COVERAGE: all D1–D12 covered (live-operated or directly observed). Ready to write blueprint.
> NOTE: "COVERAGE all D12" overstated exhaustiveness (per QA) — corrected: OBSERVED where operated; drag/create gestures UNVERIFIED (see G0 pass below).

## G0 LIVE-CLOSURE PASS (2026-07-10, authenticated Framer, hard-contract input)
- **Override-aware removal:** ✕ on inherited `Click→Set Variant` → **`Click → Reset…`** (Reset Override, NOT hard delete). OBSERVED (me).
- **Undo:** ⌘Z restored the interaction + badge. OBSERVED (me).
- **▶ badge:** present with active interaction; gone on reset; back on undo → tracks an *effective* interaction. OBSERVED (me).
- **Delete-guard:** component ctx **Delete DISABLED (greyed)** while an instance exists. OBSERVED (me).
- **State ghost:** ⊕ → **Hover / Pressed** choice menu. OBSERVED (menu); created-frame+auto-wire UNVERIFIED.
- **New Event:** separate path in Interactions + menu; action model NOT produced under harness → UNVERIFIED (excluded from v1).
- **Insert:** menu item exists; menu-Insert + placement click yielded NO instance under harness → UNVERIFIED end-to-end (corroborates QA).
- **Harness limit:** automation drives inspector/menus/keyboard/selection; FAILS pointer drag + some create gestures → drag-insert, connector drag-pickup, Hover/Pressed frame, New Event action need a MANUAL pass. Full doc: `s58-framer-hard-contract-input-expert.md`.

