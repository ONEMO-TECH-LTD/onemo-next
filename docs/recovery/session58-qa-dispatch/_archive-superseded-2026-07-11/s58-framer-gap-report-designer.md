# Framer parity — GAP & FEATURES-TO-BUILD report (designer lane, independent)

**Author:** @s58-designer (Kai-Claude) · 2026-07-10
**Basis:** my OWN live Framer extraction this session (`s58-framer-extraction-designer-ledger.md` — user-position click-through in Chrome + DOM/code dig, incl. fetching and decoding the component's real generated ESM module). Compared against our shipped editor+engine, which I know at audit depth (E11.2 audit lane). Written BEFORE reading the expert's blueprint — independent per Dan's directive.

---

## 1 · The verdict in one paragraph

The gap is not a list of missing widgets — it's a **model inversion**. Framer's component editor is: one infinite canvas, components edited in place as **free, named variant frames**, one generalized interaction primitive (**trigger → Set Variant**, animated by a per-variant Spring), a **live play mode**, and a **folder-tree asset system with instances**. Our editor is: a fixed board ("sheet") with **hardcoded axes + 6 hardcoded states**, two narrow connector modes, no preview, a flat component list, and a create flow with competing affordances. The engine underneath (model → clean React+CSS on disk) is the one piece Framer does NOT have — Framer compiles to a **proprietary runtime module** (proven at code level, §4) — and it stands. Everything user-visible needs rebuilding to Framer's model, rendered in OUR ONEMO/Figma styling.

## 2 · The deepest gap — the variant/interaction MODEL

| Framer (extracted live + from generated code) | Ours today | Gap class |
|---|---|---|
| Variants = **flat set of free frames**, auto-named "Variant N", **renamed to any string inline** (double-click label). Code: `cycleOrder[ids]`, `humanReadableVariantMap{name→id}` | Variants = CVA **axes with values**, frames grouped by axis on a fixed sheet; 6 **hardcoded** state ghosts (hover/pressed/focus/disabled/loading/error) | **Model inversion** — ours must become free-first; axes are an optional organizational layer, not the primary model |
| States = just variants created from a **Hover/Pressed ghost slot** (2-item vocabulary), same canvas | States = separate hardcoded kind, 6 fixed slots | Ours over-committed; Framer's state slot is a *shortcut for two gesture-bound variants*, not a taxonomy |
| Interaction = **trigger → Set Variant** with: triggers `Click / Click Start / Appear / Mouse Enter / Mouse Leave`, `Delay` (s), `Once｜Cycle`, target = any variant; **multiple interactions per variant**; empty action = `Reset…` (back to base). Compiles to per-variant `onTap`-class overrides calling `setVariant(id)` | Two modes: `state` (pseudo-class transition) + `switch` (tap-cycle) | Ours is a 2-case special of Framer's general primitive. `Cycle` maps to our switch-cycle; the other 4 triggers + Delay + Reset have no home |
| Per-variant **Transition: ⚡ Spring** = first-class Styles property (code: `MotionConfigContext` + `{type:"spring", bounce, duration, delay}`) | Spring per connector (@fc-transition side-channel) — close! | Small: re-home to per-variant property; add bounce/duration form (we have stiffness/damping/mass — different spring parametrization, needs mapping) |

## 3 · Feature gaps (each = extraction-evidenced, each missing or wrong in ours)

**Canvas & chrome**
- G1 — One **infinite canvas**; component edit = scoped view on the same surface (page content hidden), NOT a separate sheet/grid. Free frame placement, zoom/pan persists.
- G2 — **Breadcrumb chips in a canvas top bar** (`📄 Home › ◈ Component`, component chip tinted), not micro-attached to a frame. Exit = click the page chip.
- G3 — Canvas toolbar (floating, bottom-center): pointer / hand / comment / dark-preview / zoom%.

**Component lifecycle**
- G4 — **Create Component from element**: context menu top item + ⌥⌘K → **naming dialog** → auto-enter component edit; source element becomes an **instance in place**.
- G5 — **Searchable context menu** (menu has a type-to-search field — Framer's menus are a command palette).
- G6 — **Edit in place**: double-click instance or inspector **[Edit Component]** button. No whole-board detour.

**Variants**
- G7 — **+Variant ghost** (right of last variant): one click → new free frame, auto-named, full copy. No dialog.
- G8 — **State ghost** (below): Hover/Pressed menu.
- G9 — **Inline label rename** (any string), label = variant identity everywhere (Layers, instance picker, code alias map).
- G10 — **Ghost slots + wires + badges render only while a variant frame is selected** — the overlay is selection-scoped, canvas stays clean otherwise. (Our NodeLayer draws always-on.)

**Interactions**
- G11 — Full **trigger vocabulary** (5 triggers), Delay, Once|Cycle, Reset, multiple interactions per variant (§2).
- G12 — **Wire** = straight purple line, **arrowhead at TARGET**, edge-to-edge, drawn the instant an interaction gets a target; same selection-scoped visibility. (Ours: orthogonal elbows, always-on, ⚡ mid-glyph.)
- G13 — Interaction row UI: `[trigger] → [action chip] ✕` in an **Interactions** inspector section + **Set Variant popover** (On/Delay/Transition/Variant). Remove = row ✕. Wire popover can stay as a bonus, but the inspector is the canonical surface.

**Play / preview**
- G14 — **▶ play button** → full-screen live preview (separate pre-mounted iframe in Framer; for us: render the ACTUAL compiled component), viewport size fields, reload, pop-out, `‹ Back` restoring exact edit state. *We have literally no way to test a component today.*

**Assets / folders / instances**
- G15 — Assets = sectioned tree (**Components with real nested folders**: New Component/New Folder/Sort Alphabetically on right-click).
- G16 — Component context menu: **Insert / Edit / Find / Rename / Duplicate / Delete (guarded while instances exist!) / Copy Import / Copy URL**. Note the guard — Framer refuses to delete a component with live instances; we need the same referential integrity.
- G17 — **Insert = drag from panel AND menu action** (both).
- G18 — Instance inspector: **Variant picker + Trigger: Add… + [Edit Component]**; instance context menu: **Detach Instance / Replace With / Replace All Instances With**.

**Bugs (ours, confirmed by Dan's live test — not Framer features but blockers)**
- G19 — crash-on-select (iframe/board remount), slow component load, broken drag-insert, whole-board-on-select. Any rebuild must kill these by architecture, not patches.

## 4 · What STANDS — and where we beat Framer (code-level proof)

I fetched the real generated module for my test component (`framer-buybutton-module.js`, saved to scratchpad):
- Framer's output imports `"framer"` + `"framer-motion"`, uses `useVariantState`, `withCSS(css-strings)`, `RichText`, `addPropertyControls` — a **proprietary runtime, hosted as versioned ESM on their CDN** (`Copy Import` hands you a URL, not source).
- Our engine emits **clean, dependency-light React+CSS source on disk**. That is a *deliberate, real advantage* — the one thing to protect through the rebuild.
- Direct mapping evidence that our engine ops are the right compile targets: Framer's interaction = `setVariant()` override per variant (≈ our set-connector), its Enum variant prop = our variant prop surface, its spring config = our @fc-transition. **The engine survives the model inversion**: `rules[]` must learn *free named variants* as the primary key (axes optional), and connectors must generalize trigger vocabulary — extensions, not rewrites.

## 5 · Styling constraint (Dan's explicit rule)

Clone the **behavior/model exactly**; render **in OUR design language** — ONEMO/Figma styling, not Framer's chrome and not a mixed bag. Framer-purple `#9747FF`, their chips, their pills = *reference semantics* (what an element must communicate), not colors/shapes to copy. Every G-item above specifies BEHAVIOR; the visual skin comes from our DS (our accent for selection+wires, our chip/pill primitives, our type). One rule: **semantic parity per element** — selected-variant label, ghost slot affordance, wire directionality, badge meaning must each have exactly one clear our-styled equivalent.

## 6 · Recommended build order (my view, for the spec review)

1. **P0 kill-bugs**: crash-on-select, load latency, insert (G19) — nothing is judgeable while these stand.
2. **Infinite canvas + edit-in-place + breadcrumb chrome** (G1-G3, G6) — the architectural inversion everything else sits on.
3. **Free variant model** (G7-G10) + engine model extension (free names primary).
4. **Generalized interactions + wires + inspector** (G11-G13) — re-home E11's proven wire tech onto the new surface with selection-scoped visibility.
5. **Play mode** (G14) — highest Dan-visible value after canvas; renders our REAL compiled output (better than Framer's preview honesty-wise).
6. **Assets/folders/instances/insert** (G15-G18).

## Open questions (flagged, not asserted)

- ▶ label-badge semantics (selected-affordance vs has-interactions) — needs a hand check.
- Connect-handle hover-reveal drag gesture: exists, not reproducible under synthetic pointers — hand-verify the exact pickup zone before speccing ours.
- Spring parametrization mapping (Framer `bounce/duration` ↔ our `stiffness/damping/mass`) — needs a decided conversion.
