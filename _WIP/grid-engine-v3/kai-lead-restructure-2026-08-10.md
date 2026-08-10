# Grid engine v3 — unit/bridge/shell restructure + zoom decoupling

**From:** s62-kai-lead · 2026-08-10
**For:** QA — adversarial, in your own checkout
**Tree:** `onemo-next/.claude/worktrees/s62-grid-canvas`, branch `session62-task/KAI-10261-grid-canvas`
**Nothing committed, nothing merged.** Dev server on 4200 (`/grid-engine`), phone `192.168.4.67:4200/grid-engine`.

---

## 1. Your finding — accepted in full

Your root cause was right and it was mine: `registration = registrationOffsetMM(spec.grid, positions)` where
`positions` was the camera stop. Zoom flipped the parity, the lattice moved half a populated pitch under
the shape, and the field count changed with it. A view concern was in charge of the geometry.

Two corrections of yours also taken:

- `MIN_LATTICE_POSITIONS_PER_AXIS` back to **9**. It now lives in the spec as `field.minPositions`.
- My comment claiming the offset "is still a whole base step" was **false at 48mm** (24mm is half a base
  step). Reworded: what moves is where the SHAPE sits on the lattice, not the lattice — one spacing, one
  lattice (law 1.1). Please check that wording is now true rather than merely less wrong.

Where I did not follow you: you wrote "9x9 holds at every stop". Under gap registration the run is even, so
the 9-position field carries **8 magnets**, never 9. I did not add a 10th row to make the number look right
(that was the symptom-absorbing move you called out). Flagged to Dan explicitly.

---

## 2. What changed structurally — Dan's brief, verbatim, implemented

```
UNIT (portable, no screens)
  engine.ts   Sub 1 — pure computing. Holds NO values.
  spec.ts     Sub 2 — every value math input + the write guard. Holds NO maths.
  bridge.ts   wires Sub 2 into Sub 1 and drives it. The only door.
SHELL
  page.tsx    layout, controls, presentation state
  camera.ts   the shell's own logic file, by necessity only — zoom, aspect, pixels
  GridCanvas  draws the rule, the field, and what the unit handed it. Computes nothing.
```

Moves made:

- `cellDiameterMM`, `populationStride` — were **maths in the spec** → engine.
- 9-position floor, registration — were **values in the engine** → spec (`field.minPositions`,
  `field.registration: 'gap'`).
- `lattice.ts` — **deleted**. Camera ladder (`clampVisiblePositions`, `viewForPositions`,
  `framedSpanForPositions`, `latticePositionsAcross`, `STOP_STEP`, `MIN_VISIBLE_POSITIONS`,
  `positionsParity`) deleted with it — it was grid logic wearing a UI hat.
- Zoom is now a plain factor (`ZOOM_FIT` 1 → `ZOOM_MAX` 12, step 1.5), centre-preserving.

---

## 3. Dan's four invariants, as tests that fail the build

`src/lib/grid-engine/__tests__/separation.test.ts` — **11 checks, all green**:

1. unit imports nothing from React/Next/a stylesheet · unit names no screen concern
   (`zoom|pixel|px|viewBox|camera|screen`)
2. UI never multiplies/divides by a law value · never calls `populationStride` or
   `registrationOffsetMM`
3. shell never assigns into the spec outside the guard
4. **one-way traffic** — shell may import only `bridge` or `spec`; anything reaching past the bridge
   fails. Unit never imports from `@/app/`
5. two-sub split: spec does no arithmetic on its own values; engine declares no numeric law constants
6. canvas has no `<button`/`onClick`/`<text`/readout

**Please attack test 5 in particular** — both halves are regex heuristics over source lines and I am not
confident they cannot be trivially evaded (e.g. a value declared as `export const X = someCall()`, or spec
arithmetic split across two lines). If they can, they are theatre and should be replaced or removed.

---

## 4. Measured — zoom now moves nothing

Same 162mm shape, four zoom levels, read off the live DOM:

```
viewBox            460mm → 306.67 → 136.30     shrinks about its own centre
circle centre − canvas centre   0.00, 0.00 px  every level
circle width − height           0.000 px       every level
circle ÷ magnet cell            8.100          every level   (162 ÷ 20)
magnets in field                64 → 64 → 64   unchanged by zoom
```

Registration ladder verified at both spacings before the restructure (gap registration, centred):

```
48mm  ±24 ±72 ±120 ±168            8 magnets, centred
96mm  ±48 ±144                     4 magnets, centred
```

Typecheck clean.

---

## 5. Known open, not hidden

- **No engine yet.** `engine.ts` computes the FIELD (where magnets are) — it does not yet choose which
  population a shape takes or what size that forces. The zoom control has been standing in for that, which
  is precisely the confusion that produced this defect.
- **Registration is a released constant (`gap`).** Correct per the balance rule for four-point layouts, but
  odd populations (3×3, 5×5 — real rungs in Dan's canon) are unreachable until the engine owns the choice.
- **`toleranceMM = 0.05` still has no author.** Traced to a literal in `geometry-truth.ts`, read back into
  the law book as fact F11; Dan's briefs never mention it. Still sealed in the panel as though canon. I
  proposed stripping it and have no ruling.
- **Dead first tap.** Controls do nothing until the page hydrates — reproduced on desktop (5 clicks after
  load moved nothing; 2 clicks a moment later moved two steps). This is what "the 48/96 switch doesn't
  work" is on the phone. Unfixed; a production bundle on 4200 would resolve it.
