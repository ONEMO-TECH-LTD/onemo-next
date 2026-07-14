# Framer-clone editor — BUILD SPEC (for Dan sign-off, NO code until signed)
@s58-expert · 2026-07-10 · extracted live from Framer with my own hands (project "Powerful Autonomy", my
throwaway — Dan's real project untouched). Every fact below was SEEN in Framer's real editor this session.

## THE RESET (why this doc exists)
"Clone Framer — UI AND behaviour, pull from its console/code and match" was mis-built as "an engine that
emits clean React+CSS." The codegen ENGINE is real and stays (the write ops + clean output — the hard part).
But the EDITOR EXPERIENCE — the thing Dan judges — was our OLD react-figma board bolted on, and it is the
WRONG surface. This spec throws that surface away and rebuilds the editor to BE Framer, engine underneath.

## FRAMER'S REAL MODEL (extracted, cited by what I saw)

### 1. Canvas & component editing — INFINITE canvas, edit IN PLACE
- One INFINITE canvas. Frames/components sit freely at arbitrary positions (not a grid/board/sheet).
- A component INSTANCE on the canvas: selecting it shows in the inspector `<Name> · Component` + an
  **"Edit Component"** button. Double-click the instance OR "Edit Component" → enters component-edit.
- **Component-edit is the SAME infinite canvas** (URL `?node=<componentNode>`), now showing the component's
  VARIANTS as free frames. Breadcrumb **`Home › <Name>`** as a chip in the TOP CANVAS BAR (not attached to a
  sheet). Left panel switches to **Layers** listing the variants. Click **Home** (breadcrumb) → back to page.
- Zoom/pan is the normal canvas (100% control bottom-center).

### 2. Variants — FREE, named (NOT hardcoded states/axes)
- Config variants are FREE frames: "Variant 1" (labelled **Primary** = the default), "Variant 2", … plus a
  dashed **"+ Variant"** ghost slot. Click +Variant → a new free variant frame appears, editable + renamable,
  listed in Layers as "Variant". YOU create as many as you want and name them.
- STATE variants are a SEPARATE dashed slot BELOW the config row: **"Hover / Pressed"** with a ⊕. Click ⊕ →
  a menu offering **Hover / Pressed** → creates that state variant (e.g. "Variant 1 · Hover") with a ▶ badge.
- So the model is: N free config variants (Primary + others) + auto-suggested interaction-state variants,
  ALL free frames on the canvas, all renamable, all listed in Layers. **No fixed 6-state list. No forced CVA
  axes.** (Our engine's multi-axis is a code-shape detail — the AUTHORING is free variants.)

### 3. Connectors (the ⚡ nodes) — edge-handle → wire → transition
- A selected variant shows a **⚡ connect handle (circle) on its edge**. Drag it to another variant → a
  directional **wire**. Creating a Hover state auto-draws Primary→Hover.
- The wire encodes: a TRIGGER (from the Interactions "+" → **New Transition / New Event**; events carry the
  trigger vocab hover/press/… + appear/scroll/… ) → the TARGET variant, animated by a **Transition** which is
  a first-class per-variant Style property, default **Spring** (⚡ icon; stiffness/damping/mass).
- Delete/re-point: select the wire/handle. (Our engine already compiles all of this: set-connector state/
  switch + remove-connector; spring→linear(); the side-channels. That part MAPS.)

### 4. Play / Preview — the ▶ button (Dan: "how do you test?")
- Top-right **▶** → full-screen **preview** (`?view=preview`): the component runs LIVE, real interactions
  fire (hover/tap → the transitions play). Top bar: **‹ Back** (exit), reload, open-in-new, dimensions.
- We have NONE of this. It's the single biggest missing capability — you can't test a component today.

### 5. Assets & folders
- Assets tab tree: **Templates · Components · Styles · Vectors · Code**, each with a `+`. Components contains
  **folders** (a "Project" folder). Right-click a folder → **New Component · New Folder · Sort Alphabetically**.
  Nested folders + drag to organize. We have a flat-ish list, no real folder ops.

### 6. Create / Insert / Instances
- Create-from-element: select a frame → **⌘⌥K** (or right-click → Create Component) → names it → it becomes a
  component; the frame on canvas becomes an instance. Create-from-scratch: Components `+` / New Component.
- Insert: DRAG a component from the Assets panel onto the canvas → a new instance (Dan: drag is broken in ours).
- Instance ops (Figma/Framer parity, Dan's screenshots): **detach instance**, go-to-main, replace.

## GAP MAP — what exists vs what the clone needs
| Framer capability | Ours today | Verdict |
|---|---|---|
| Infinite canvas, edit in place | fixed board-sheet showing ALL components | REBUILD (wrong surface) |
| Breadcrumb top-bar chip | micro-attached to sheet | REBUILD |
| Free named variants | hardcoded 6 states + CVA axis inputs | REBUILD authoring UX (engine ops reusable) |
| ⚡ connectors + transition | wires+popover exist (bolted on board) | PORT onto the new canvas |
| ▶ Play/preview live test | NONE | BUILD new |
| Assets folders + org | flat list, weak | BUILD folder ops |
| Create-from-element / edit | muddled 2-icon, crash-on-select | REBUILD flow (engine create-component op reusable) |
| Drag-to-insert | BROKEN | FIX/REBUILD |
| Instance detach/replace | partial | BUILD |
| Codegen → clean React+CSS | WORKS (I0–I6 engine) | KEEP (the salvaged backbone) |

## THE BUILD PLAN (phased, each mapped to a Framer behaviour + the engine op that backs it)
No code until Dan signs. Then the lead orchestrates; I build/gate per the pipeline.

- **P0 — Triage the shipped bugs (if Dan wants a usable interim):** crash-on-select (iframe remount), slow
  component load, broken drag-insert. Small, makes today's thing non-embarrassing while P1+ builds.
- **P1 — The infinite-canvas shell + in-place component edit.** Replace the board-sheet: components live free
  on the canvas; double-click / "Edit Component" → in-place variant canvas; breadcrumb top-bar chip; Layers
  lists variants; Home exits. (New shell; engine READ/model unchanged.)
- **P2 — Free variants.** +Variant makes a free named variant frame; rename; the Hover/Pressed state slot;
  drop the hardcoded-6-states + CVA-input UI. Back it with the shipped variant ops (add-variant-axis/value
  become "add variant" mechanics; the code shape stays multi-axis under the hood, authoring is free).
- **P3 — Connectors on the new canvas.** Port the ⚡ wire layer + drag-to-connect + transition popover +
  remove onto the infinite canvas (already built + audited — just re-homed). Add the real trigger menu
  (New Transition / New Event) matching Framer's vocab.
- **P4 — Play / Preview mode.** ▶ → full-screen live render of the component/page where interactions run;
  Back to exit. (New; renders the real generated component.)
- **P5 — Assets folders + create + insert + instances.** Folder tree ops (New Component/Folder/Sort, nested,
  drag-org); create-from-element flow; fix drag-to-insert; detach/replace instance.
- **P6 — Visual parity pass.** Match Framer's chrome, hover-reveal handles, curved wires, ▶ badge, spacing —
  the pixel/motion polish so it reads as Framer, not just behaves like it.

## What I am NOT doing
- Not touching the codegen engine (it's the correct backbone; keep).
- Not writing a line of shell code until this spec is signed.
- Not assuming any Framer detail I haven't seen — anything uncertain, I go back into Framer and confirm.

## The one honest scope caveat
This is a real editor build (P1–P6), not a patch — weeks-class, not a slice. The engine saved us the hardest
half (turning edits into clean shippable code). The half that's left is the half Dan actually sees.
