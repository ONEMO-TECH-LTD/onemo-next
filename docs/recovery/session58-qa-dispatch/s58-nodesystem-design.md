# Node-system (⚡ visual connector layer) — DESIGN by @s58-expert (2026-07-09)
Grounds: s58-framer-nodesystem-extraction.md (live Framer) + shipped model (connectors[], set-connector I4,
board I5). Principle: a VISUAL layer over already-shipped ops + ONE new op. No new engine model. HEAD ed597a4.

## Where it lives
The wires connect FRAME EDGES → the overlay must live in the SAME document as the frames:
`components-canvas/page.tsx` (the board iframe). It already has editFile + the frames with stable data-attrs
(`data-component-variant="axis=value"`, `data-component-state="<state>"`, `data-axis-group`). It will ALSO
fetch the component MODEL for editFile (editor-component-model → connectors[] + variantAxes) — today it only
fetches editor-components (inventory). Add that fetch; re-run on fc-board-refresh.

## A. Wire rendering (SVG overlay, visible when editing)
Absolutely-positioned `<svg>` over the board grid. For each `model.connectors[]`:
- resolve SOURCE frame = the base/default frame of the component (the connector's `from`; v1 = base).
- resolve TARGET frame: mode:'state' → `[data-component-state="<to.state>"]`; mode:'switch' →
  `[data-component-variant="<axis>=<to.value>"]`.
- getBoundingClientRect (iframe-local) of both → draw a DIRECTIONAL path from source edge → target edge
  (purple #9747FF, 1.5px), small arrowhead at target, a ⚡/spring glyph mid-wire for state-mode (shows the
  transition exists). Straight or gentle orthogonal elbow (Framer uses straight edge-to-edge).
- Wires render only when editFile set (editing that component), matching Framer (visible on selection).

## B. Connect handle → drag-to-wire (fires set-connector)
Each variant/state frame gets a DIAMOND handle on its mid-right edge (Framer parity). Pointer-down on a
handle → rubber-band line follows cursor → pointer-up over a target frame:
- target is a state ghost → `set-connector {mode:'state', trigger:<state>, to:{state:<state>}, transition:
  {kind:'spring', 260,20,1}}` (the shipped default).
- target is an axis-value frame → `set-connector {mode:'switch', trigger:'tap', to:{axis,value}, cycle:true}`.
- invalid target (self, non-frame, base) → honest refuse (no write, drop the rubber-band).
- live drop-target highlight while dragging (a blind drop is toy UI — my own gate criterion).
The write is fired by the PARENT (owns editor-write + reloadEditModel + toast) via postMessage
`{type:'fc-connector-create', payload}`; parent writes → reloadEditModel → fc-board-refresh → wires redraw.

## C. Wire select → transition editor
Click a wire → a small popover (in the parent shell, positioned at the wire midpoint via postMessage coords):
Spring stiffness / damping / mass (defaults 260/20/1, prefilled from the connector's transition). Apply →
parent fires `set-connector {mode:'state', …, transition:{spring …}}` (idempotent re-write, proven I4) →
refresh. This is the connector-EDITING surface — it also gives the re-point/edit path F-M10 lacked.

## D. remove-connector — the ONE new server op (both modes)
`{ kind:'remove-connector', file, mode:'state'|'switch', to:{state?|axis?,value?} }`:
- state mode → remove the `@fc-transition` side-channel comment + reset the base `transition` decl to the
  default (or drop it if no other state needs it — v1: reset to `all .15s ease`, the idempotent default).
- switch mode → remove the `@fc-connector` comment + the injected `useState`/derived-const + the onClick
  guard (if it was the only guard, drop the whole onClick; if merged, remove just this axis's guard — mirror
  the F-M8 merge logic in reverse) + revert the `axis: axisProp` rename back to `axis` destructure if no
  other consumer. assertValidTsx before write (refuse-not-corrupt). READ then reflects zero connector.
This closes F-M10 (delete-then-re-add = re-point; the popover edits in place).

## E. Parent shell message handlers
`fc-connector-create` / `fc-connector-transition` / `fc-connector-remove` → engineWrite (the batch-1 helper,
r.ok + toast) → reloadEditModel → postMessage fc-board-refresh. Wires always redraw from the FRESH model
(no optimistic wire state — same re-read-reflects-truth discipline as the rest of the engine).

## Gate criteria (my own, pre-declared for the 3-way audit)
1. wire renders source→target for a real connector, correct direction, only in edit mode.
2. drag handle→state ghost creates a state connector (disk: @fc-transition + base transition); →axis frame
   creates a switch connector (disk: @fc-connector + useState). Live drop-highlight; invalid drop refuses.
3. wire-select popover edits the spring → set-connector idempotent re-write, wire's glyph reflects it.
4. remove-connector deletes BOTH modes cleanly, tsc 0, READ shows zero, file not corrupt; refuse-not-corrupt.
5. round-trip: create→read→board redraw shows the wire from the model (no optimistic state).
6. no regression: the I4 connector BUTTONS still work (or are replaced by the visual layer — decide: keep
   buttons as fallback, wires as primary); tsc 0; both repos clean; mother-v2 + a real component proven.
