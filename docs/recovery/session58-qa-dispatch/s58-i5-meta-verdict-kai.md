# I5 (variant board UI) — @s58-expert META verdict @ 11c155b (2026-07-09)

Chain 9b0c327 → b7230f9 → 11c155b, worktree clean. QA→Meta order (s58-qa F-I5-1 BLOCKING + F-I5-2 HIGH found
and closed across two rounds first). Method: full diff-read (board layout/ghost-preview contract in
components-canvas, board-authoring panel + fc-board-refresh in page.tsx, the 3 F-I5-1 fix sites + F-I5-2
type-guard in lib.ts) + LIVE board click-through in the editor (my own tab) + adversarial server probes.
Both repos clean after, tsc CLEAN, editor 200.

## VERDICT: FAIL-with-findings — ONE NEW BLOCKING (F-M11, the exact MIRROR of QA's F-I5-2, reachable from
## the board's own "+ axis" input). Everything the board claims, it does — proven live.

## QA-fix verification (F-I5-1 / F-I5-2) — sound
- F-I5-1: public-propertyName matching at ALL THREE mint sites (mintUnionProp, addBooleanPropToComponent,
  addStringParam) — an I4-aliased binding `{ size: sizeProp }` is now detected, EXTEND edits only the type
  member so the alias survives. The cycle-array re-sync on axis widening closes the masked follow-on
  (regex-scoped to the generated setter shape — acceptable; the shape is machine-owned).
- F-I5-2: addState now requires `tsType === 'boolean'` for idempotency; a same-name CONFIG AXIS → named 422
  citing §D2 orthogonality. Correct — for THAT direction.

## Board layout — MATCHES Framer, proven live (not screenshots: DOM-measured)
Entered edit mode on a probe component (project inventory) via the real UI. The board rendered:
`?edit=<file>` scoping ✓ · axis sub-group `[data-axis-group="size"]` with a frame per value ✓ · ALL SIX
state ghost slots `[data-component-state]` (hover/pressed/focus/disabled/loading/error) ✓ · +Axis/+Value
inputs present ✓. 10 frames total (base + 2 size values + 6 ghosts + gallery base).

## Ghost-preview contract (§3.2 split) — MEASURED correct
- hover ghost: computed bg **rgb(0,204,68)** = the authored `:hover` delta rendering STATICALLY via the
  `data-fc-preview` ancestor half — the editor-preview mechanism works from the board.
- loading ghost: computed **opacity 0.4** = the `[data-loading]` rule driven by the boolean prop. Correct
  per-kind split (interaction → data-fc-preview on the figure; semantic → the prop).
- focus ghost (no delta authored): base bg, opacity 1 — honest empty state, no fake styling.
- The editTarget-driven preview correctly SKIPS ghost frames (`:not([data-component-state])`) — no double-
  preview collision (verified in code; ghosts held their own preview while I probed).

## Board AUTHORING — proven live end-to-end (the "not just renders" gate)
From the panel, in the running editor: typed `tone` → **+ axis** → the board REFRESHED ITSELF (the
fc-board-refresh postMessage) showing a new `[data-axis-group="tone"]` with 2 value frames — no manual
reload; typed `warm` → **+ value** → `tone=warm` frame appeared in the group. Disk verified:
`{ …, tone = 'a' }: { …; tone?: 'a' | 'b' | 'warm' }` — the board's writes are the shipped I2 ops, live.
State authoring = the state chips (semantic add-state on pick, proven in I1); connectors = the I4 buttons
(proven at the I4 closure). ALL authoring reachable from the board surface.

## F-M11 — NEW, BLOCKING — the MIRROR of F-I5-2: add-variant-axis named like an existing SEMANTIC STATE
corrupts the component (proven on disk)
Setup: component with a boolean `loading` semantic state (+ `[data-loading]` rule + `data-loading` toggle).
`add-variant-axis {axis:'loading', values:[x,y]}` → **ACCEPTED** — mintUnionProp's EXTEND branch found the
existing `loading` prop (name match), `extractUnionValues(boolean)` returned `[]`, and it REWROTE the type
member `loading?: boolean` → `loading?: 'x' | 'y'` while the binding kept `= false` and the root kept
`data-loading={loading || undefined}` → **tsc TS2322 on disk ('false' not assignable to 'x'|'y') — a
corrupt write** (§8 violation, same class as I4's F-M8). QA's F-I5-2 guarded addState against a same-name
AXIS; nobody guarded the axis ops against a same-name STATE — the collision is unguarded in exactly the
reverse direction. **And it is reachable from I5's own new UI**: a user typing `loading`/`error`/`disabled`
into the board's "+ axis" input corrupts their component — which makes it I5-blocking, not a lib nicety.
FIX (bounded, symmetric to F-I5-2): in `addVariantAxis` (or mintUnionProp's EXTEND branch), if the existing
prop's type is NOT a string-literal union → named 422 ("prop exists as a semantic state/other prop — axes
and states are orthogonal, §D2"). Optionally blocklist the 6 state names as axis names outright at the
board input AND the op (defense in both layers).

## F-M10 (carried from I4) — scope ruling
I5's board authors axes/values/states; it does NOT author or edit connectors (those stay on the I4 buttons)
— so a connector RE-POINT path is correctly OUT of I5's scope, no new exposure. Still carried as the known
LOW: the misleading 422 on switch re-run + no re-point path. It lands naturally whenever connector-editing
UI is built (post-I6 polish or the motion epic).

## §3.9 / I6-foundation check (why I6 was held behind I5) — SOLID
Every board frame carries a stable, addressable identity: `data-component-frame` + `data-component-variant`
(`tone=warm`) + `data-component-source` (the file) + `data-axis-group` on the group + `data-component-state`
on ghosts; keys are `${root}:${file}:…` (collision-free per component). I6's `set-variant-structure` is
source-position addressed (§3.9) and the board can resolve frame → file + axis/value from these attrs alone.
Foundation is ready; no rework needed for I6 to build on it.

## Disposition
FAIL-with-findings → Ready for Builder: F-M11 (blocking; bounded — one type-guard mirroring F-I5-2 + the
6-state-name blocklist at the board input). My closure re-gate: axis named `loading`/`error`/`disabled` →
named 422 at BOTH the op and the board input, file untouched; the F-I5-2 direction still 422s (no
regression); board layout/authoring gates unchanged. I6 foundation is cleared — on F-M11 closure, I5 clears
and I6 (structural variants) unblocks. Hygiene: probe removed, both repos 0 changes, tsc CLEAN, editor 200.
Nothing Done — Dan's gate.

---
# META CLOSURE RE-VERIFY @ a7e9cca — F-M11: **PASS, I5 FULLY CLEARED (QA+Meta)**

Method: fix-diff read (e2957f1 server type-guard + a7e9cca board blocklist) + independent live re-probes
(own fixtures + own browser pass — not QA's evidence). Both repos clean after, tsc CLEAN, editor 200.

## F-M11 — CLOSED, proven at BOTH layers
- OP: component with boolean `loading` state → `add-variant-axis loading` → named 422 ("already exists as a
  semantic state — axes and states are orthogonal (§D2)"), **file BYTE-IDENTICAL** (diff-clean). The guard
  checks every union leaf is a string literal (exactly what extractUnionValues consumes) — general, not a
  name blocklist, so it also protects any future non-axis prop shape.
- BOARD INPUT: typed `loading` → "+ axis" DISABLED + inline "reserved state name" hint; typed `flavor` →
  ENABLED, no hint. (First probe artifact: my own React value-tracker bypass — resolved with the tracker
  reset; the UI itself is correct.) Double-guarded in the onClick too.

## Regressions — clean
Free-name axis → 200; legit EXTEND (`size` sm|lg → +xl → `'sm'|'lg'|'xl'`) works; F-I5-2 direction proven
with a HAND-AUTHORED union axis named `loading` → add-state loading → its own named 422 (both directions of
the axis/state collision now symmetrically guarded); semantic re-select still idempotent 200; tsc CLEAN.

## VERDICT: I5 (variant board UI) = META PASS @ a7e9cca. QA + Meta both clear (third pass through QA, second
## through Meta). Board = Framer-layout parity, all authoring live from the board, I6 foundation solid.
## F-M10 stays carried (LOW, connector-editing UI scope). I6 (structural variants) UNBLOCKS — the LAST
## increment. Nothing Done — Dan's gate.
