# FRAMER LIVE EXTRACTION — the 4 un-specced capabilities (for contract acceptance rows)
**Provenance: expert-live-probed · 2026-07-13 · authenticated Framer, own hands, scratch project "Powerful Autonomy" (NodeCard component; free plan).** Everything labelled MEASURED was operated/read live this pass (screenshots in session transcript: ss_ ids inline). Gaps are flagged needs-manual — nothing below is guessed.

---

## 1 · PROPS / PROPERTY CONTROLS ("Variables")

**Framer's canvas-component prop system is called VARIABLES, and events are a variable kind — one unified model.**

- **Where:** with a variant selected inside component edit, the right panel Interactions "+" → *New Event* opens the **"<Component> Variables" sheet** (ss_9858gqe3n); the same sheet is the property surface. (There is also a "Variables" tab in the left Insert menu, and a left-rail "Variables" section in bigger projects.)
- **Sheet anatomy (MEASURED, ss_9858gqe3n / ss_1133zbbe9):** title "<Name> Variables" · top-right **+** (add variable) · LEFT: list of defined variables with kind icon (e.g. "⚡ CardTapped") · RIGHT: the selected variable's form (Name field; for events an "Add" button on first create). Empty state: "Customize with variables — Create variables of values like colors and text. These become editable controls."
- **THE CONTROL-TYPE SET (MEASURED — the + menu, a searchable palette "Type to search…", ss_4063x69ek):**
  **Plain Text · Formatted Text · Date · Link · Image · Color · Toggle · Number · Option · Event · File · Transition · Border · Cursor · Shadow** — 15 kinds, complete (list does not scroll past Shadow).
  Mapping notes for the contract: Toggle=boolean, Option=enum, plus Framer-specific kinds our matrix must decide on (Transition/Border/Cursor/Shadow/File/Date/Formatted Text).
- **Create/rename (MEASURED):** pick kind → variable appears in left list with default name → Name field edits inline (renamed "Click"→"CardTapped" live, ss_1133zbbe9).
- **INSTANCE side (MEASURED, ss_11951uxcu + zoom):** selecting an instance on a page shows a **component section at the bottom of the Style panel**: header `<ComponentName>` + right-aligned grey tag `Component` · **Variant: [dropdown of variants]** · full-width **[Edit Component]** button · separate collapsed groups **Scroll Section +** and **Code Overrides +**. Value-variables appear as rows in this section (each control renders by its kind).
  - ⚠ **"Trigger" row = PAID Convert add-on** (A/B tests/funnels) — clicking it opens an upsell popup (MEASURED). Do NOT spec it as the event UI.
  - **needs-manual:** my CardTapped event row did NOT appear on the instance panel this pass (may need the event wired to a layer interaction inside the component first, or a plan gate). Also un-probed: editing a value-variable on an instance + **reset-to-default** affordance (my component had no value props yet). One manual pass with a Text+Color variable closes both.
- **Code mapping:** official spec for event variables: `https://www.framer.com/support/using-framer/event-variables/` (link shown inside the sheet itself — MEASURED). For code components the shape is `addPropertyControls(Component, { propName: { type: ControlType.String|Boolean|Enum|Color|Number|Image|Link|EventHandler, title, defaultValue, options… } })` — matches the designer's earlier live ESM fetch; **needs-manual:** one fresh module fetch (ctx-menu **Copy Import** gives the ESM import URL) to pin the canvas-component compiled shape verbatim. My harness couldn't read the clipboard this pass.

## 2 · NEW EVENT (Interactions → New Event)

- **Menu (MEASURED, ss_1165c8ox5):** Interactions section "+" → exactly two items: **New Transition · New Event**.
- **Model (MEASURED):** *New Event* does NOT add an interaction row — it opens the **Variables sheet** and creates an **Event variable** (default name "Click", editable, "Add" commits). Explainer verbatim: "**Events — Trigger custom interactions from any layer within your component.**"
- **Semantics for the contract:** an Event = a named event **prop** on the component (an EventHandler in code). Layers inside the component can fire it from their interactions; consumers (instances/code) attach handlers. It is NOT a variant transition — *New Transition* covers the variant wires (trigger vocab Click/Click Start/Appear/Mouse Enter/Mouse Leave, Set Variant action — previously live-verified).
- **needs-manual:** the layer-side "fire this event" action menu (select a layer INSIDE a variant → its Interactions + → expected action option referencing CardTapped) — not exercised this pass; and the instance-side handler row (see §1 note). Both are one manual session.

## 3 · COMPONENT CONTEXT MENU (Assets panel, right-click)

**MEASURED on NodeCard (which has 1 instance on Home), ss_7229rp57t + zoom:**

| Item | State | Notes |
|---|---|---|
| Insert | enabled | inserts an instance (into current page) |
| Edit | enabled | opens component edit-in-place |
| — | | |
| Find | enabled | locate usages |
| Rename | enabled | |
| Duplicate | enabled | |
| **Delete** | **DISABLED (greyed)** | **delete-guard while instances exist — measured with 1 live instance** |
| — | | |
| Library | enabled, submenu › | publish/move to library |
| Copy Import | enabled | copies the ESM import statement/URL |
| Copy URL | enabled | deep link to the component node |

- Matches the breadcrumb-chip menu observed earlier (same items) — one component menu grammar in both places.
- **needs-manual:** Delete state on a **zero-instance** component (my QAFrame control-read was caught mid-fade — inconclusive this pass); Library submenu contents.

## 4 · COMPONENTS / ASSETS PAGE

**MEASURED (ss_7665fzmsi, ss_6273mocin, ss_8414b177z, ss_02047dyjv):**
- **Assets tab** (left panel: Pages · Layers · Assets) with a **Search…** field on top.
- **Sections, each with its own "+":** **Templates · Components · Styles · Vectors · Code**.
- **Components section = FOLDER TREE:** collapsible folders (`▸ 📁 Project` → expanded shows `◈ NodeCard`, `◈ QAFrame`), rows are name+diamond-icon **list rows (no thumbnails in this view)**; folder rows expose a hover **"…"** actions affordance.
- **Components "+" menu (MEASURED):** **New Component · New Folder · Sort Alphabetically.** → **Framer HAS blank component creation** — this resolves the TRUE-STATE doc's "blank-create contradiction" row: the contract's claim is CORRECT, live-measured today.
- **New Component dialog (MEASURED):** Title field (Create disabled until non-empty) + explainer verbatim: "**Components can be edited in their own canvas. Double-click on any instance to add visual variants and interactions.**" → Cancel/Create. (Create not executed — scratch kept clean; the creation result — blank Desktop-size primary variant opening in edit mode — is FRAMER-STANDARD, flag if you want it hands-verified.)
- **needs-manual:** folder "…" menu contents (rename/delete folder), drag-component-into-folder gesture (drag = my known harness limit), whether instance PREVIEW thumbnails appear in other panel modes (Insert panel shows previews; Assets shows list rows in this project).

---
## Summary for your acceptance rows
1. Variables = one system for props AND events; 15 measured control kinds; sheet + instance-section anatomy measured; reset/default + instance-event rows need one manual pass.
2. New Event ≠ transition: it mints an Event variable (event prop); official doc link captured.
3. Ctx menu grammar identical in Assets and breadcrumb; delete-guard measured with instances.
4. Assets page: 5 sections, folder tree with CRUD (+/…/Sort), blank New Component EXISTS (contradiction resolved in the contract's favor).
No build, no contract edits from my lane — this is extraction input only.
