# Framer node-system — LIVE extraction by @s58-expert (2026-07-09, my own hands, Chrome)

Extracted from Framer's real editor (a FRESH throwaway project I created, NOT Dan's Dandy Researchers —
zero mutation to Dan's work). Every fact SEEN live, screenshotted + zoomed, not doc-sourced.

## The variant-set canvas (the "node system" Dan means)
Double-click a component → its own canvas with the breadcrumb `Home › NodeCard` top-left. Layout SEEN:
- **CONFIG variant row:** "Variant 1 · Primary" (the base config variant) + a dashed ghost "+ Variant" slot
  to its right (adds another config variant).
- **STATE ghost slot, SEPARATE, BELOW the config row:** a dashed "Hover / Pressed" slot with a purple ⊕.
  This is the config-vs-state separation — states are a distinct sub-kind authored in the SAME canvas but a
  distinct slot. (Confirms my/designer's earlier finding, now re-seen fresh.)

## Creating a state variant → the ⚡ CONNECTOR auto-appears (the money shot)
Click the state ghost's ⊕ → a small menu offers exactly **Hover** / **Pressed** (the interaction states,
= my extracted `EnabledGestures`). Pick Hover →
- A new frame "Variant 1 · Hover" is created below Primary, carrying a purple ▶ PLAY badge on its label
  (marks it a state/interaction variant).
- **A ⚡ CONNECTOR WIRE is AUTO-DRAWN** from Primary's bottom edge straight down to Hover's top edge:
  a straight PURPLE line, DIRECTIONAL (source variant → target variant). SEEN + zoomed.
- The next ghost slot updates to offer "Pressed" (the remaining state).

## The connector's rendering + lifecycle
- The wire is **visible only when the variant / variant-set is SELECTED** (deselect → wire hides; reselect
  Primary → wire reappears). So wires are an overlay on the selected component's board, not always-on.
- **Connect handle:** hovering/selecting a frame shows a small DIAMOND handle on its mid-edge (right-middle
  seen at the Primary frame's edge). Dragging that handle to a target frame is how a connector is authored
  manually (auto-created here by the state-add flow).

## What the connector ENCODES → the transition (right Style panel, on the variant)
Selecting the connected variant, the inspector shows:
- **Interactions** section (header + `+` — the `+` opens New Transition / New Event, from my prior probe).
- **Transition: [⚡ purple spring-curve icon] Spring** — a FIRST-CLASS per-variant Style property. The
  connector's animation = this Spring. Zoomed-confirmed: label "Transition", value chip "Spring" with the
  ⚡ curve glyph.

## COMPILE-TARGET MAPPING (Framer node → our engine, already-shipped ops)
Framer's node system is a VISUAL layer over exactly what our engine already emits:
- config variant frame  → our axis-value frame on the board (I5) ✓ shipped
- state ghost + Hover/Pressed → our 6-state ghost slots (I5) ✓ shipped
- ⚡ connector wire (source→target) → our `set-connector` (I4): mode:'state' (pseudo transition) /
  mode:'switch' (tap variant-switch) ✓ shipped — READ from model.connectors[]
- per-variant Spring transition → our spring→linear() + @fc-transition side-channel (I4) ✓ shipped
- connect-handle drag-to-target → NOT BUILT: the drag gesture that FIRES set-connector. THIS is the slice.
- wire rendering between frames → NOT BUILT: SVG overlay on the board. THIS is the slice.
- click-wire → transition editor → NOT BUILT: select a wire → edit its spring params → set-connector.
- delete-wire → NOT BUILT: needs a `remove-connector` op (closes F-M10's re-point/edit gap).

## THE BUILD (what "clone it" means, precisely) — pure UI over shipped ops, + one new op
1. SVG edge-overlay on the components board (components-canvas): for each model.connectors[], draw a
   directional purple wire from source frame edge → target frame edge; visible when editing that component.
2. Connect handle: a diamond on each variant/state frame's mid-edge; drag → drop on a target frame → fires
   set-connector (mode inferred: target is a STATE ghost → mode:'state'; target is a config axis-value →
   mode:'switch'). Live drop-target highlight; honest refusal on invalid target.
3. Wire select → a small transition popover: Spring stiffness/damping/mass → set-connector (state mode).
4. `remove-connector` server op (NEW, both modes) → delete a wire; also gives the re-point path (F-M10).
5. State variant ▶ badge + the "Hover/Pressed" ghost already exist as our state ghosts — align labels.
