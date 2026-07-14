# Node system (I7) — @s58-expert SELF-AUDIT + /o-deslop @ 264d8a3 (2026-07-09)
My lane of the Dan-ordered 3-way audit (me + QA E11.2 + designer E11.2) + deslop (E11.3). Measured on :3025,
live disk + browser probes. QA and designer run SEPARATE audits — this is mine, not a substitute for theirs.

## BUILD SCOPE (what shipped @ 264d8a3, on the branch)
Visual ⚡ node layer over the shipped ops + 1 new op. Live-extracted from Framer first (own hands, throwaway
project; Dan's project untouched): variant-set canvas, config row + state ghost slot, ⚡ wire auto-drawn
source→target on state-variant creation, per-variant Spring transition (⚡ icon), connect-handle on frame edge.
- NodeLayer (components-canvas): SVG wires base→target (state ghost / axis-value frame), directional +
  arrowhead + ⚡ glyph; diamond drag-handle per frame → drag-to-target fires set-connector (mode inferred);
  live drop-highlight; wire-select popover edits spring / removes. No optimistic state (board re-reads model).
- remove-connector server op (both modes) — reverse of set-connector; closes the F-M10 re-point gap.
- parent shell fc-model-changed → reload inspector model.

## PASS — measured (my lane)
- Wire renders source→target, directional, only in edit mode; state + switch wires both draw. ✓ (DOM-measured)
- Drag-to-wire: handle→state ghost writes `@fc-transition` + base transition; handle→axis frame writes
  `@fc-connector: tap size→lg` ON DISK. ✓ (live pointer-drag, disk-verified)
- Popover spring-edit: 260→320 wrote `@fc-transition: … spring 320 20 1` on disk (idempotent re-write). ✓
- Popover remove: cleared the switch connector (0 @fc-connector, 0 onClick on disk; model empty). ✓
- remove-connector reverse, ALL cases: merged-switch removal keeps the OTHER axis (removed tone, size intact);
  last-switch removal drops the whole onClick + reverts binding + drops the now-unused useState import; state
  removal resets base transition + drops @fc-transition; adversarial remove-nonexistent → refuse, file
  byte-unchanged. ✓ tsc 0 throughout.
- state + switch connectors COEXIST in the model (2 wires drawn). ✓
- tsc 0, eslint 0-added (the ref-during-render lint I hit was a real correctness fix — refs now read in
  handlers/effects, not render), both repos clean.

## MY FINDING — F-N1 (MED): axis components have NO base source frame → wire source is arbitrary
For a MULTI-AXIS component the board renders no standalone base frame (all frames sit in axis sub-groups), so
`baseFrame()` falls back to the FIRST frame (`size=sm`). Consequence: every wire sources from `size=sm` (not a
true "Primary/base"), and a switch connector whose target IS the first value draws a near-SELF-LOOP. NOT
corrupting — the connectors on disk are correct; this is purely the wire's visual ANCHOR — but it's not a
faithful Framer clone (Framer sources from the Primary base config variant). FIX (bounded, I5-board): render a
dedicated base frame (the default `<Comp/>`) for axis components too, and source wires from it; or anchor wires
to a component-level source. Single-axis / no-axis components (a real base frame exists) are unaffected —
verified DemoButton has its base frame.

## /o-deslop (E11.3) — kill-list (material items = Dan signs per o-deslop)
- **D-5 · COLLAPSE (Dan signs) — the I4 connector BUTTONS are now a redundant PARALLEL authoring surface.**
  page.tsx:4076-4096 renders "Add spring transition" / "Tap-cycle <axis>" buttons that author the SAME
  connectors the visual wires now author — the button even shows "Spring 260/20/1", duplicating the wire
  popover. Two ways to do one thing = the confusion o-deslop kills. Framer-parity answer: the wires ARE the
  connector UI. Disposition: COLLAPSE (remove the buttons; wires primary) — but it's a visible UI deletion, so
  Dan signs the kill. (Alternative: keep buttons as a no-board fallback — Dan's call.)
- **D-1 · EXTRACT (low)** — `cap`/`propLocal`/`internal`/`setter` switch-name derivation is duplicated in
  setConnector (:1138) and removeConnector (:1222). One `switchNames(axis)` helper. Bounded, non-blocking.
- Verified NOT slop: `escapeReg` (used 6× in removeConnector), all NodeLayer helpers (referenced), the
  boardRef reads (all in effects/handlers, none during render).

## Disposition (my lane)
Node system WORKS end-to-end, Framer-cloned, measured — the ⚡ visual layer Dan asked for. One MED finding
(F-N1, base-source frame) + the D-5 collapse (Dan-signs) + D-1 (low). Not clean until F-N1 lands + Dan rules
on D-5. Awaiting QA's + designer's SEPARATE audits (E11.2) to converge before the combined report to Dan.
Nothing Done — Dan's gate.
