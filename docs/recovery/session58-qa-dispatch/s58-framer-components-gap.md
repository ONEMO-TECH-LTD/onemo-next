# Framer Components + Assets stocktake vs react-figma

Date: 2026-07-08
Owner: @s58-engineer
Report to: @s58-designer only
Scope: research / gap analysis only. No code. No Linear writes.

## Sources and confidence

- Framer observation source: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-raw-extraction.md`, extracted live by @s58-designer from Dan's authenticated `Dandy Researchers - Framer` Chrome tab. I could not reach Chrome from this lane (`Browser is not available: extension` after the required retry), so I used that raw dump as the only Framer source.
- Our current source baseline: `onemo-next/.claude/worktrees/s58-figma-engine` on `session58-task/react-figma-engine` at `3f31aa8`.
- Our current source seams read:
  - `src/app/(dev)/react-figma/page.tsx:233-243`: `useDsComponents()` fetches `/api/dev/editor-components`.
  - `src/app/(dev)/react-figma/page.tsx:2208-2254`: `ComponentsRail` is a read-only navigator; empty state says "create one from the Assets panel."
  - `src/app/(dev)/react-figma/page.tsx:2319-2327`: `newComponent()` calls `create-component`.
  - `src/app/(dev)/react-figma/page.tsx:2966-2974`: `insertAsset()` calls `insert-component`.
  - `src/app/(dev)/react-figma/page.tsx:3711-3720`: Components rail renders only `ComponentsRail`.
  - `src/app/(dev)/react-figma/page.tsx:3722-3797`: Assets has tabs `Components`, `Images`, `Icons`; the Components tab contains search placeholder, create form, root/category controls, and insert grid.
  - `src/app/(dev)/react-figma/components-canvas/page.tsx:1-164`: component gallery canvas groups dual-root inventory variants and isolates frame errors.
  - `src/app/api/dev/editor-components/route.ts:1-81`: dual-root component inventory with exports metadata.
  - `src/app/api/dev/editor/lib.ts:257-278`: `WriteOp` union has create/insert/rename component, but no delete-component, duplicate-component, add-variant, set-instance-prop, or expose-as-prop.

## A. Framer observed

### Panel topology

Framer left panel has top-level tabs:

| Tab | Observed content |
|---|---|
| Pages | Page tree, not part of this component stocktake. |
| Layers | Layer tree, not part of this component stocktake. |
| Assets | Search field plus sections `Templates`, `Components`, `Styles`, `Vectors`, `Code`; each section has a `+` create button. |

Important product decision: Framer puts Components inside Assets. Dan rejects that model for us. Our Components surface must be its own dedicated rail page, self-sufficient for create/manage/insert. Our Assets page should be images/icons/other assets only, with no Components tab.

### Components section internals

Observed Framer structure:

| Level | Observed label / behavior |
|---|---|
| Section | `Components` with a `+` action. |
| Group | `Project` folder. |
| Component | `test`. |
| Variant set on canvas | `Variant 1 - Primary`, ghost `+ Variant`, and `Hover / Pressed` variant tile. |

Interpretation from observation: a Framer component is treated as an editable component set, with variants/states represented inside a dedicated component-edit canvas.

### Create flow

Observed:

| Entry point | Behavior |
|---|---|
| `+` on Components section header | Creates a component. Not triggered because it would mutate Dan's project. |
| Selected layers -> create component | Mentioned as Framer standard in the extraction, not re-verified in this pass. |

### Component manage menu

Right-clicking Framer component `test` opened this verbatim menu:

```text
Insert
Edit
Find
Rename
Duplicate
Delete
----------
Library >
Copy Import
Copy URL
```

This is the observed manage set: insert into canvas, open/edit component, find component usage/frame, rename, duplicate, delete, library-scope move, copy import string, copy URL.

### Right Properties panel anatomy

Observed with a variant/frame selected:

| Area | Observed sections / controls |
|---|---|
| Top tabs | `Agent`, `Style`. |
| Interactions | Section with `+`. |
| Link | `Link To`, placeholder `Page or URL...`. |
| Position & Size | `Position` X/Y, `Width` value + Fixed/Relative dropdown, `Height` value + Fixed, `Min Max` Add. |
| Layout | `Type` Stack/Grid, `Direction`, `Distribute`, `Align`, `Wrap`, `Gap`, `Padding` plus linked/independent toggle. |
| Effects | Section with `+`. |
| Overlays | Section with `+`. |
| Cursor | Section with `+`. |
| Styles | `Transition`, `Opacity`, `Visible`, `Fill`, `Overflow`, `Radius`. |

Deliberately not observed: expose-as-prop / component-variable authoring. Triggering it would mutate Dan's project. This must be designed as an AST/write contract before any UI clone.

## B. Gap table

| Bucket | Framer capability | We have it where | Missing / misplaced in ours |
|---|---|---|---|
| exists | Component edit canvas / component-set view | `components-canvas/page.tsx` renders the component gallery; variants are grouped via inventory exports; selection and inspector writes work through source attrs. | Keep this as the Components page canvas. Add self-sufficient library/create/manage column around it; do not move this back to Assets. |
| exists | Find / jump to component frame | `ComponentsRail` click scrolls to the gallery frame and selects the source-matching element. | Keep behavior, but expose it as a manage action (`Find`) in a component context menu and/or row action. |
| exists | Insert component instance | Backend op exists: `insert-component`; current UI is `insertAsset()` in Assets Components grid. | Function exists but is misplaced. It must move to Components page. |
| exists | Create blank component | Backend op exists: `create-component`; current UI is Assets Components form with name, root Project/Global, optional category. | Function exists but is misplaced. It must move to Components page create flow. |
| exists | Rename component | Backend op exists: `rename-component`; it renames file/export/import consumers for project components. | No observed Components-page manage UI for it. Also global-library rename support is not proven from the source read; verify before exposing for global components. |
| exists | Copy Import | Inventory entries expose `importPath`; Framer menu has `Copy Import`. | Data exists; no Components-page row/menu action. Add UI only if useful in v1, no new write op needed. |
| relocate | Search components | Framer has a top search field above Assets sections. Ours has `Search components...` inside Assets Components tab, but it is a visual placeholder in the read source. | Move search to Components page and make it filter components/variants/categories. Remove from Assets with the Components tab. |
| relocate | Component library tree/grid | Framer shows Components -> Project -> component. Ours has a read-only Components rail plus an insertable tile grid under Assets. | Components page needs both navigation and insertable library grid/list. Assets must lose its Components tab entirely. |
| relocate | Root/category create controls | Ours has Project/Global library dropdown and Category input under Assets. | Move to Components create flow. Keep root/category because our architecture has project + global roots, but do not leave it in Assets. |
| relocate | Component empty state | Framer create affordance is in Components section. Ours Components rail says "No components yet - create one from the Assets panel." | Replace with Components-local create CTA. Delete any copy that points to Assets for component creation. |
| new-op | Add variant | Framer component edit canvas has ghost `+ Variant`. Ours reads named exports as variants, but has no add-variant write op. | Add `add-component-variant` op that inserts a named export into the component file, validates TSX, regenerates global barrel when needed, and refreshes inventory. |
| new-op | Instance variant switcher | Framer variants/states imply choosing a variant for an inserted component instance. Ours can insert `<Name />`, but has no source-backed variant switcher for instances. | Add instance variant model: import named export or switch JSX tag/binding safely; define how root component vs variant export maps to inserted JSX. |
| new-op | Duplicate component | Framer manage menu has Duplicate. Ours has JSX duplicate and page duplicate, but no component duplicate op. | Add `duplicate-component`: copy component file/export(s), choose collision-safe name, update imports/barrel, preserve variants or duplicate the whole set. |
| new-op | Delete component | Framer manage menu has Delete. Ours has no `delete-component` op. | Add `delete-component`: consumer check before delete, clear or block if usages exist, remove file, regenerate global barrel, update inventory/history. |
| new-op | Props / controls / expose-as-prop | Framer has component property authoring, but it was deliberately not triggered. Ours has no set-instance-prop or expose-as-prop op in `WriteOp`. | Design AST contract first: what props can be lifted, default serialization, instance override write shape, and inspector UI. Then add `expose-component-prop` and `set-instance-prop`. |
| new-op | Component Edit action | Framer menu has Edit. Ours row click selects a frame/source element but does not open an explicit component-edit mode/menu action. | Add explicit `Edit` action that switches to Components canvas, scrolls/selects the component set, and focuses the right inspector on the component source. |
| new-op | Component Find action | Framer menu has Find. Ours has rail jump but no action from manage menu and no usage search. | V1 can map Find to gallery jump. Later usage-find should scan consumers and list instances. |
| skip-v1 | Library submenu | Framer has `Library >`. Ours already has Project vs Global roots during create, but no library move operation. | Skip submenu depth in v1. Later design `move-component-root/category` with consumer/barrel/history safety. |
| skip-v1 | Copy URL | Framer has Copy URL. Our dev editor has no stable public URL contract for component entries. | Skip v1. |
| skip-v1 | Templates | Framer Assets has Templates. | Out of scope for Components self-sufficiency. |
| skip-v1 | Vectors | Framer Assets has Vectors. | Out of scope. Our Assets currently surfaces icons/images from canvas. |
| skip-v1 | Code section | Framer Assets has Code section. | Out of scope. Do not copy into Components. |

## C. Target spec

### Components page must become self-sufficient

The dedicated Components rail/page should contain:

| Surface | Target |
|---|---|
| Header / toolbar | Components title, search field, `New component` action, optional create dropdown for Project vs Global library and category. |
| Library tree/list | Global library + Project sections, categories, components, variant children. Keep the 32px Figma component-row chrome already built. |
| Gallery canvas | Keep current `components-canvas` as the component-edit canvas. It already mirrors the Framer idea of a component-set editing surface. |
| Create flow | Move the existing name/root/category form out of Assets and into Components. New empty state must create in-place, not point to Assets. |
| Insert flow | Move the existing insertable component tile/list from Assets into Components. Clicking inserts into selected container with the existing `insert-component` op. |
| Manage menu | Add component row context menu: Insert, Edit, Find, Rename, Duplicate, Delete, Copy Import. Disable or hide unsupported actions until their ops exist. |
| Variant UI | Show variants under parent. Add a ghost `+ Variant` affordance only after the write op exists. |
| Props/controls | Do not fake it. Design the AST contract first, then expose as right-panel component controls. |

### Assets page must stop owning components

Assets target:

| Current Assets tab | Target |
|---|---|
| Components | Delete this tab. Move all component create/search/insert UI to Components. |
| Images | Keep. |
| Icons | Keep. |
| Future other assets | OK only if not components. Templates/Vectors/Code are not required for v1. |

### Right panel reuse

Framer's Style panel anatomy mostly maps to our existing inspector surfaces:

| Framer Style section | Our target |
|---|---|
| Link | Existing Link section stays. |
| Position & Size | Existing Position/Layout/Resizing controls stay. |
| Layout | Existing Auto layout controls stay, extended only where actual write support exists. |
| Styles / Fill / Opacity / Radius / Overflow | Existing inspector sections stay. |
| Interactions | Existing pseudo-state rule support exists for hover/active, but component props/interaction design is separate. |
| Props/controls | New design and ops required; do not clone from screenshot only. |

## D. Build order

1. Relocate without new backend risk.
   - Move Assets Components tab UI into Components page.
   - Components page gets search, `New component`, root/category, insert grid/list.
   - Remove Assets Components tab entirely; Assets becomes Images + Icons only.
   - Reuse existing `create-component`, `insert-component`, `useDsComponents`, and `ComponentsRail`.

2. Make the Components page navigable and usable.
   - Make search functional across component name, category, root, and exports.
   - Replace "create one from the Assets panel" empty state with Components-local create CTA.
   - Add row/menu actions backed by existing behavior: Insert, Edit, Find, Rename where supported, Copy Import.

3. Add component management ops.
   - `duplicate-component`: duplicate file/export set safely, collision-safe name, barrel regen for global.
   - `delete-component`: refuse when consumers exist, delete file, regen barrel, clean history surfaces.
   - Verify both project and global roots explicitly before exposing actions.

4. Add variant authoring.
   - `add-component-variant`: insert named export variant into existing component file.
   - Add ghost `+ Variant` tile in gallery only once op is available.
   - Add instance variant switcher after deciding named-export import/tag strategy.

5. Design props/controls before building.
   - Define expose-as-prop AST contract: liftable properties, prop names, defaults, serialization, consumer update shape.
   - Add `expose-component-prop` and `set-instance-prop` ops after design review.
   - Then add right-panel controls for component instances.

6. Skip v1 deliberately.
   - Do not build Templates, Vectors, Code, Copy URL, or Library submenu depth in this slice.
   - Do not put components back under Assets.

## Bottom line

Framer's useful lesson is not "put Components under Assets." That is the rejected model. The useful lesson is the capability set: create, search, insert, edit/find, rename, duplicate, delete, variant management, and eventually props/controls all live next to the component surface. Our current implementation has the data and several write ops already, but the user-facing UI is split incorrectly: creation and insertion are misplaced in Assets while Components is read-only. The first build should be a relocation and menu/action pass, followed by true component delete/duplicate/variant/prop ops.
