# Framer LIVE PROBE — for @s58-designer's b9d72f1 comparison
**Provenance: expert-live-probed · 2026-07-12 · authenticated Framer, scratch project "Powerful Autonomy" (component NodeCard, `?node=EHvLPHLQz`).**
Fresh live observation per Dan's directive — measured from live UI + screenshots, NOT §B recall. Requested by @s58-designer (its lane blocked: Chrome MCP 2FA wall). This is (a) REAL FRAMER behaviour — the designer does the (b) ONEMO-vs-this parity/deviation split against b9d72f1.
**Honest harness note:** my automation drives inspector/menus/keyboard/selection reliably but CANNOT fire pointer-drag or some create gestures. Items so affected are labelled **[FRAMER-STANDARD, not harness-verified this pass]** vs **[OBSERVED live]**.

## D1 — SAME-CANVAS CONTEXT — [OBSERVED live] (screenshot ss_3580503t7)
- Entering component-edit (Edit Component / double-click instance) opens the **SAME infinite canvas** at `?node=<componentNode>` — same zoom control, same bottom toolbar, same top bar. Not a modal, not a separate board route.
- Canvas shows **ONLY that component's variants** as free frames (here: Variant 1·Primary, Variant 2, Variant 3, Variant 1·Hover). **The whole page (the Desktop 1200 frame + all its content) is FULLY HIDDEN** — nothing of the page remains on the canvas.
- **What remains of page context:** on the CANVAS, nothing. In the LEFT PANEL, the **Pages tab still lists the page tree (Home)** — but that's the global page navigator (always present), not page content. The component's own variants live under the **Layers tab**. Breadcrumb (D5) shows you're scoped inside `Home › NodeCard`.

## D2 — PRIMARY / DEFAULT + FRAME BORDER — [OBSERVED live]
- **Primary tag = a NAME-LABEL SUFFIX `· Primary`** (middle-dot separator) appended to the default variant's on-canvas label, in the **same accent-purple** as the variant name. NOT a separate chip/pill/color-swap. Other variants read just `Variant 2`, `Variant 3` (no suffix). (All variant name-labels are accent-purple — Framer colours component/variant labels purple.)
- **In the LAYERS panel:** the default variant row shows a right-aligned **`Primary`** tag; every other variant shows a right-aligned **`Variant`** tag. (Variant 2 also shows a small **⚡/▶** interaction-badge icon because it has an interaction.)
- **Unselected frame border: NONE.** An unselected variant frame shows **no border/outline at all** (no dashed, no stroke) — just its fill meeting the grey canvas.
- **Selected frame:** solid **accent-purple outline** + **4 purple corner resize-handles** + the **⚡ connect-handle on the right-edge midpoint** + a small pivot/anchor dot top-left inside.

## D3 — FREE-FRAME PLACEMENT (+Variant / state ghost) — [OBSERVED live] (ss_9690zqh5d + ghost zooms)
- Config variants sit in **one ROW**: measured positions x=0 (Primary), x=495 (Variant 2), x=990 (Variant 3); each frame **395 wide** → **~100px gap** between frames (495−395=100); y=0 for all. Frames are freely positionable (inspector Position x/y is editable — free placement, not a locked grid).
- **+Variant ghost:** to the **RIGHT of the last config variant, SAME row, next slot** (~100px gap right of Variant 3, x≈1485). A grey **rounded-corner** placeholder frame, same size, centered **⊕ + "Variant"** label. A NEW config variant spawns **at the ghost slot** (ghost then shifts to the next slot right).
- **State ghost (Hover/Pressed):** directly **BELOW the selected config variant, same column, one row down**. Grey frame, centered **⊕ + "Hover / Pressed"** label.
- **Ghosts are SELECTION-SCOPED:** with nothing selected, **NO ghost is visible**; the +Variant ghost AND the state ghost appear **only while a variant frame is selected** (verified: deselect → both gone; select Variant 3 → both appear). Same selection-scoped rule as wires/badges.

## D4 — CREATE / RENAME / MOVE interaction model
- **CREATE — config variant:** single-click the **+Variant ghost** → creates a new variant directly, **auto-named `Variant N`** (next ordinal). **[OBSERVED — this + prior extraction: +Variant → "Variant 2"]**
- **CREATE — state variant:** single-click the **state ghost ⊕** → opens a **`Hover / Pressed` choice menu** → pick one → creates a `<Variant> · Hover` (or Pressed) state frame below. **[OBSERVED live]**
- **RENAME:** the affordance is **inline name-label editing**. **EXACT TRIGGER NOT harness-verifiable this pass** — canvas-label double-click registered as select/deep-select; Layers-row double-click registered as select; **⌘R** (Framer's documented rename shortcut, in the ctx menu) was **intercepted by the browser as page-reload**; Return-when-selected did nothing. **[FRAMER-STANDARD expectation: double-click the name label (or Layers-row rename) → inline text edit → Enter commits / Esc cancels — but click-count + Esc-cancel could NOT be confirmed here; designer should self-verify if critical.]**
- **MOVE:** frames are freely positioned (inspector Position editable; free-placement model). The **drag GESTURE to move a frame was NOT harness-reproducible** — a synthetic body-drag registered as a *select* (Position stayed x=495, unchanged). **[FRAMER-STANDARD: drag the frame BODY (anywhere on the frame) to move; snaps to alignment guides with sibling frames — same synthetic-drag limit as drag-insert; not harness-confirmed this pass.]**
- **Note:** the breadcrumb component-chip menu (D5) has its own **"Rename"** = rename the COMPONENT asset (NodeCard), distinct from renaming a variant.

## D5 — HOME / BREADCRUMB — [OBSERVED live] (breadcrumb zoom + ss_31730yqpb)
- **Location:** the **canvas TOP BAR** (top-left, fixed chrome) — NOT a floating element.
- **Anatomy:** `[📄 Home]` — a **neutral GREY rounded chip** with a page/document icon + grey "Home" text → `›` **bare chevron separator** (between chips, not inside one) → `[◈ NodeCard]` — an **accent-tinted (light-purple) rounded chip** with a **purple diamond ◈ component icon** + **purple "NodeCard"** text. Two visually distinct chip styles: neutral page chip vs accent component chip.
- **Clicking `Home`** = navigates OUT of component-edit **back to the page canvas** (exit). **[OBSERVED prior]**
- **Clicking the component chip `NodeCard`** = opens the **component context menu** (`Rename · Duplicate · Find · Delete[disabled while instances exist] · Library › · Copy Import · Copy URL`) — component-level actions, **NOT navigation**. **[OBSERVED live this pass]**

---
## Summary for your comparison matrix (real Framer, expert-live-probed 2026-07-12)
| Dim | Real-Framer answer | Confidence |
|---|---|---|
| 1 same-canvas | same infinite canvas `?node=`, ONLY that component's variants, page fully hidden; page-tree stays in left Pages tab only | OBSERVED |
| 2 Primary + border | Primary = `· Primary` name-suffix (accent) + Layers "Primary" tag; unselected frame = NO border; selected = accent outline + corner handles + right-edge ⚡ | OBSERVED |
| 3 free-frame placement | config variants one row, 395w + ~100px gap (x=0/495/990); +Variant ghost right-same-row next slot; state ghost below; **ghosts selection-scoped** | OBSERVED |
| 4 create/rename/move | create = single-click ghost (config→direct "Variant N"; state→Hover/Pressed menu) OBSERVED; rename = inline-label edit, exact trigger + Esc NOT harness-verified; move = drag frame body (free), gesture NOT harness-verified | mixed |
| 5 Home/breadcrumb | top-bar; Home=grey page chip, component=accent chip w/ diamond; Home click exits; component-chip click opens component ctx menu | OBSERVED |

Two items need your own confirm if critical (both are drag/keyboard gestures my harness can't fire, not Framer unknowns): exact RENAME trigger + Esc-cancel, and the MOVE drag gesture/snap. Everything else is measured live.
