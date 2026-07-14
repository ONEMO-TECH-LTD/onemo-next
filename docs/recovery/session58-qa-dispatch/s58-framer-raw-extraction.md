# RAW Framer extraction — Components + Assets (observed live, no fabrication)

**Extracted by:** @s58-designer (Kai) from the live `Dandy Researchers – Framer` tab via Chrome console + click-through, 2026-07-08. Read-only — Dan's project NOT mutated (right-click menus opened + Escaped, no create/edit committed). **For @s58-engineer** to turn into the gap doc `s58-framer-components-gap.md`, structured in @s58-expert's 4 buckets (exists / relocate / new-op / skip-v1).

## 1. Framer's panel topology (observed)
- Left panel has **3 tabs: `Pages` · `Layers` · `Assets`** (top row, y≈61).
- Under the **Assets** tab, collapsible sections TOP→BOTTOM, **each with a `+` create button**:
  1. **Templates** `+`
  2. **Components** `+`  ← the component surface
  3. **Styles** `+`  (color/text styles)
  4. **Vectors** `+`
  5. **Code** `+`  (code components/overrides)
- A top search field ("Search…") spans the panel above the sections.

**KEY (Dan's "wrong move"):** In Framer, Components is a *section nested inside the Assets tab* alongside Styles/Vectors/Code. Dan rejects that — he wants OUR **Components** to be its **own dedicated rail page**, self-sufficient, and OUR **Assets = images/icons/other only** (no components tab).

## 2. Components section internals (observed)
- Structure: **`Components` → `Project` (folder) → `test` (a component)**. Folder grouping ("Project") = a component library/group; components nest under it.
- The `test` component has **variants**, shown on the canvas as the component-edit view:
  - `Variant 1 · Primary` (the base variant, selected)
  - a ghost **`+ Variant`** tile (add-variant affordance)
  - a `Hover / Pressed` variant tile (a named state variant)
- So a Framer component = a **variant set** (multiple named variants/states), edited on a dedicated canvas.

## 3. Create flow (observed)
- **`+` on the `Components` section header** creates a component. (Not triggered — would mutate Dan's project. Pattern matches Framer's Pages `+`.)
- Components can also be created by selecting canvas layers → "Create Component" (Framer's standard, not re-verified this pass).

## 4. Component right-click / manage menu (observed verbatim)
Right-clicking the `test` component in the Assets tree opens:
```
Insert
Edit
Find
Rename
Duplicate
Delete
──────────
Library ›      (submenu — move to/from library scope)
Copy Import
Copy URL
```
That is Framer's full component **manage** set: Insert (into canvas), Edit (open component), Find, Rename, Duplicate, Delete, Library-scope move, Copy Import (code import), Copy URL.

## 5. Right-side Properties panel anatomy (observed — the expert's key clone reference)
Top tabs: **`Agent` · `Style`**. With a variant/frame selected, the **Style** tab sections + controls TOP→BOTTOM:
- **Interactions** (+)
- **Link** → `Link To` (Page or URL…)
- **Position & Size** → `Position` X/Y · `Width` (value + Fixed/Relative dropdown) · `Height` (value + Fixed) · `Min Max` (Add…)
- **Layout** → `Type` (Stack | Grid toggle) · `Direction` (horiz/vert) · `Distribute` (Center…) · `Align` · `Wrap` (Yes|No) · `Gap` (value) · `Padding` (value + linked/independent toggle)
- **Effects** (+)
- **Overlays** (+)
- **Cursor** (+)
- **Styles** → `Transition` (Spring…) · `Opacity` · `Visible` (Yes|No) · `Fill` (swatch + hex) · `Overflow` (Visible…) · `Radius`

**NOT captured (deliberately):** the **expose-as-prop / component-variable authoring** interaction (select a layer → expose its property as a component control/prop, define default). Triggering it mutates Dan's project, and @s58-expert wants this surface **designed (AST contract: what's liftable, how defaults serialize) BEFORE any UI clone** — so it's a design pass, not a screenshot clone. Flag for the expert's props-op design.

## 6. Handoff to engineer — bucket it
Per @s58-expert's steer (`s58-components-page-steer.md`), return the gap doc as:
- **A. Exists (keep):** our gallery canvas already IS Framer's component-edit view — keep as the Components page canvas, add a library column.
- **B. Relocate (Assets → Components):** the `New component` create form + the insertable `dsComponents` tile grid + search — move out of Assets' Components tab into the Components page. Then DELETE Assets' Components tab entirely (Assets = images/icons only).
- **C. New ops (the real build):** props/controls (expose-as-prop + set-instance-prop — no attr-write op in the WriteOp union today = THE gap) · add-variant authoring + instance variant-switcher · delete-component (needs consumer check + barrel regen) · duplicate-component.
- **D. Skip v1:** Templates/Vectors/Code sections, Library-scope submenu depth, Copy URL.

Map each Framer capability above to `exists | relocate | new-op | skip` + our file location (`page.tsx` ComponentsRail ~L2211, Assets components tab ~L3734, WriteOp union in `api/dev/editor/lib.ts`).
