# Engine holistic audit + deslop sweep — @s58-expert (2026-07-09, post-I6, Dan-ordered)

Dan's three questions answered with evidence. Editor :3025, HEAD 5099f12, both repos clean after, tsc CLEAN.

## 1. NODE SYSTEM — honest status: engine YES, visual node-graph NO
Built + gated: the full engine (variants/states/props/connectors/structural, clean code out) and the
axis-grouped BOARD (frames per value, 6 state ghosts, +Axis/+Value authoring). NOT built: Framer's visual
connector layer — the ⚡ wires DRAWN between frames, drag-frame-to-frame to wire, connector visible on the
variant's edge (which I saw live in Framer). Connectors author via right-panel BUTTONS. Gap classification:
the I4 dispatch explicitly scoped "minimal client trigger… I5's board replaces this with the polished
⚡-between-frames UI" — but I5 shipped the board layout + authoring WITHOUT the ⚡ layer and no one re-flagged
the deferral. SCOPE TO CLOSE (bounded, no new engine ops needed — pure UI over shipped ops): SVG overlay on
the board drawing connector edges from model.connectors[]; drag from a frame's edge → drop on a state
ghost/axis frame → fires set-connector; click an edge → transition editor (spring params → the existing op).
The re-point path (F-M10) lands naturally here.

## 2. HOLISTIC ZOOMED-OUT AUDIT (was missing — now done)
ONE component (AuditCard) through EVERY capability in sequence, then verified in code + model + live board:
promote → multi-axis → variant delta → state+delta → expose-as-prop (bridge) → tap-connector → structural add.
- Generated code: export-quality (typed union prop + optional bridge prop + D3 controllable connector +
  @fc side-channels + flat structural guard); tsc CLEAN.
- Model round-trip: ALL capabilities read back exactly (axis default via side-channel, connector, rules,
  structural condVariant tree: `small @emphasis=bold`).
- LIVE BOARD (DOM-measured): 10 frames; structural divergence VISIBLE (bold frame shows "premium", subtle
  doesn't); bold delta border rgb(17,17,17) rendering; hover ghost shows the box-shadow statically; axis
  chips + "Tap-cycles emphasis" connector state reflected.
### F-A1 — NEW FINDING (MED, production UX): I1–I5 client write paths never check response.ok
Proven live mid-journey: a set-connector call during a dev-server recompile window returned an HTML 404 —
op never ran — and the UI would show NOTHING (board write() at page.tsx:4003, add-state at :2400, the
redirect `void fetch` at :2939, auto-promote `.catch(()=>{})` at :2377 all fire-and-forget). Older E-epic
paths DO capture `const r = await fetch` + toast. FIX (bounded): one shared `engineWrite()` helper — check
r.ok, toast the server's named 422/error messages (they're good — users never see them today), retry-once
on HTML-404 recompile responses. This also makes every named refusal (the 12 Meta findings' 422s) actually
VISIBLE to the author.

## 3. DESLOP SWEEP (kill-list — Dan signs before removal per o-deslop; all pre-merge cheap)
- D-1 KILL+FIX · lib.ts:1135 dead 409 ("already a switch connector") — unreachable (F-M10 proof: the lookup
  can't match renamed bindings); the correct propertyName-aware check replaces it. Evidence: live probe
  returned the wrong 422 twice across I4/I6 gates.
- D-2 KILL · client EditTarget `{kind:'variant';name}` + its redirect branch (page.tsx:2338, 2931) — ZOMBIE:
  nothing sets it since I2's axis chips ({kind:'axis'}); grep = zero constructors. Server ScopedTarget
  'variant' kind + scopedSelector branch same (no sender; READ-side legacy classes use decomposeRule's
  legacyName, unaffected).
- D-3 COLLAPSE-flagged (post-merge) · `add-state-rule` op (lib.ts:273/2255 + page.tsx:2634) — LIVE parallel
  impl: the pre-engine E8 hover/tap path for PAGE elements duplicates write-scoped-declaration's pseudo
  scope. Route it through the engine op; kill the old op after.
- D-4 EXTRACT-flagged (post-merge) · the 3 prop-add walkers (addBooleanPropToComponent :606, mintUnionProp
  :733, addStringParam :871) share ~80% param-surgery logic and the F-I5-1 fix was cloned 3× — one
  `addParam(core)` with 3 thin fronts. addBooleanPropToComponent also inlines its own fn-finder predating
  findComponentFn (:705) — trivially dedupe now.
- D-5 LOW · `DecomposedRule` exported but zero external refs — drop `export`.
- Verified NOT slop: fallbackGroups (reachable: empty-inventory + unmatched frames), legacyName read path
  (real legacy modules), the regex cycle-sync (machine-owned shape).

## Recommendation
Before Dan's merge: fix F-A1 + land D-1/D-2/D-5 + the D-4 finder-dedupe (small, re-gate is one QA round);
build the ⚡ visual connector layer as the next slice (it's the FACE of the node system Dan asked for);
D-3/D-4-full as a post-merge cleanup ticket. Nothing Done — Dan's gate.
