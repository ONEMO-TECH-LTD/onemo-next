# Components page — expert steer (@s58-expert → @s58-designer, 2026-07-08)

Dan asked me to make sure the MINIMUM feature set for FULLY creating components is in your scope,
and to steer. Grounding: today I read the editor end-to-end — all 4,219 lines of page.tsx, engine.ts,
lib.ts (every write op), all 11 dev API routes, tagging-loader, both canvas hosts, editor-sandbox.
So this is an exact exists/relocate/new map, not opinion. Use it to frame the engineer's Framer
stock-take: every Framer feature it finds should land in one of these four buckets.

## Bucket 1 — EXISTS, just lives in the wrong place (relocation, no new ops)
- **Create blank component** — `create-component` op + the "New component" form (name, Project/Global
  destination, category) — currently in Assets→Components tab (page.tsx:3724). MOVE into Components page.
- **Insertable library grid** (click → `insert-component`, import auto-wired) — same Assets tab. MOVE.
- **Create from selection** — `make-component` (extract subtree → file + instance) — currently a
  right-panel icon button. Surface it in the Components page too (Framer: "Create component" from selection).
- **Gallery canvas** — /react-figma/components-canvas already renders BOTH roots grouped by category,
  **variants (named exports) as labeled frames**, error-boundaried, fully selectable/editable (tagging
  works on library source). This IS Framer's component-edit view — don't rebuild it.
- **True rename** — `rename-component` (file + export + all consumers, AST-exact).
- **Search** — the Assets search stub moves with the grid (it's currently a dead placeholder — wire it or drop it).

## Bucket 2 — MISSING ops the page NEEDS to be "full creation" (the real build)
Priority order — this is the line between a stamp-library and a component system:
1. **Props/controls (the biggest gap).** Everything today is zero-prop: extraction inlines verbatim,
   instances are bare `<Name />`. Framer's power = Properties controls on instances. Minimum viable:
   - `expose-as-prop` op: select a text node (or style value) inside a component → lift to a prop with
     default (AST work, same class as rename-component; text prop first, color/boolean later).
   - `set-instance-prop` op: write/update a JSX attribute on an instance (the union has NO attr-write
     op today — style/text/link/name only).
   - Instance-selected inspector section reading the component's signature (props + defaults parse
     server-side, same way editor-components already parses exports).
2. **Variant authoring.** The variants MODEL is done (named exports = variants; gallery + rail render
   them). Missing: `add-variant` op (duplicate an export within the file under a new name — trivial
   next to make-component) + a variant SWITCHER on instances (rewrite the tag name, AST-guarded).
3. **Delete component.** There is NO delete-component op (checked the whole WriteOp union). Full
   lifecycle needs it, with a consumer check: refuse (or list consumers) when instances exist —
   rename-component's bounded consumer walk is the exact pattern to reuse. Global deletes must also
   regenerate the library barrel.
4. **Duplicate component** (Framer has it; cheap: copy file, collision-safe name, barrel regen if global).

## Bucket 3 — EXISTS, don't let the stock-take double-count it
- Hover/press states → real CSS pseudo-rules (`add-state-rule`, Interactions section).
- Undo (⌘Z staged edits) + version history + sandbox forking.
- Variables/token binding on any field; token value edits fan through the DS pipeline.
- Draw-to-place, image upload+insert, text editing, layer rename, links.

## Bucket 4 — Framer features to explicitly SKIP v1 (name them in the plan so it's a decision, not a miss)
- Code-component editor pane (we have Code view read-only; full in-editor code editing is a later slice).
- Variant TRANSITIONS (animated state machines) — hover/press CSS is our v1 analog.
- Component insert via drag-from-panel (click-to-insert into selected container is our v1; drag is polish).

## Two structural warnings (from the code, not taste)
1. **Assets page after the split** = images/icons only (both already live-scanned from the canvas) +
   image upload. Kill the components tab there completely — Dan's rule: restructure removes the old
   surface, same batch.
2. **The Components rail vs page**: today rail=components swaps the canvas to the gallery and shows a
   nav list. The self-sufficient page should keep that canvas (it's your isolation editor) and add the
   creation/library column — you are ADDING creation to an existing working surface, not building a page
   from zero. Cheapest correct shape: left panel = library (create form + grid + search), canvas = the
   existing gallery, right panel = the existing inspector (which already edits library source).

## Steer for the engineer's Framer stock-take
Ask it to return the feature list AS the four buckets above (exists/relocate/new-op/skip), not a flat
inventory — otherwise you'll get a wall of Framer features with no build plan. And have it capture
Framer's **Properties panel anatomy** (control types, defaults UI, per-variant overrides) in detail —
that's the one area where we're building genuinely new surface and the cloning reference matters most.

Ping me for design review of the props op-shape before you implement — the AST contract (what can be
lifted, how defaults serialize) is the part worth getting right first time. — @s58-expert
