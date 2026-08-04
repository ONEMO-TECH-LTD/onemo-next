# Grid Lab v2 — Self-audit vs LAW BOOK + BRIEFS (law clause → observed evidence)

> Triggered by Dan's 4-screenshot review + meta gate-fail on P6. Rebuilt engine Light + pattern,
> and the bench FRESH per Dan's ruling. Evidence = observed on the live bench (localhost:3995,
> grid-lab-v2 worktree) + measured tests. **Status: fixed — awaiting meta clause-by-clause re-gate.**

## The 7 defects Dan + meta caught — all fixed, evidence

| # | Defect | Fix | Observed evidence |
|---|---|---|---|
| 1 | **Light kept interior magnets** (lattice-adjacency band) | geometric perimeter (`onBoundary`/`outerShell`) | MEASURED: triangle base-5 Light was 11 (interior=3) → now 8 (interior=0). Bench: triangle Light = 4 (apex+base, no centre). Regression test locks interior=0 for square/triangle/diamond/circle |
| 2 | Population straight-only → no dice | pattern-aware `seatLattice` (straight/diamond/dice) | Bench: **Standard·96·dice = 13 magnets** (9 grid + 4 cell-centres visible); dice test in suite |
| 3 | Boot default Light·48·straight | boot = **Light·96·dice·magnetic** | Bench header + boot screenshot = garment canon |
| 4 | No pattern control | pattern selector straight/diamond/dice | Bench: selector present; **dice greyed at 48** with "cell centres would land at 24mm (law §4.3a)" |
| 5 | No attachment / 5.1a filter | attachment selector + live filter | Bench: magnetic → "holds on: 48-straight · 96-dice"; **96-straight shows ✗ incompatible (law §5.1a)** in red |
| 6 | AI Magic absent (Brief 62.1) | image → v5.3.1 `prepareShaped` outline → freeform | Bench: uploaded real image → **"outline: 55 pts"** → freeform 94×54mm solved, no spinner, console clean |
| 7 | "· offset" debug caption + cornerRadius leak | clean captions; per-family radius `Record` | Bench caption: "square · light · dice · 96mm · 212×212mm · 8 magnets · attach magnetic" (no debug); radius shown only for roundable families, stored per-family |

## Per-behaviour visual verification (observed, commit-cited)

- **mode × density × pattern:** Light·96·dice=8 (rim), Standard·96·dice=13 (rim+centres), Standard·48·straight=9, Light·48·straight triangle=4. ✓
- **dice legality on the bench:** dice enabled only at 96; greyed + law reason at 48. ✓
- **Light perimeter-only every family:** square 8/12, triangle 4/8, diamond rim, circle rim — zero interior (measured + eyes). ✓
- **per-family ladder vs catalogue:** square straight 68/116/164/212/260/308; dice 116/212/308; circle 88/156/224/292; triangle odd-base 130/226. ✓
- **attachment 5.1a filter:** magnetic holds 48-straight/96-dice; flags 96-straight incompatible live. ✓
- **image → outline → engine:** real image → 55-pt v5.3.1 outline → freeform solve, ~8s, no spinner. ✓
- **config reach + save:** padding/frame/ceiling/focal/interior/margin/registration all editable + save/reload. ✓
- **console:** zero errors/exceptions across the full tour. ✓

## Engine law (unchanged parts still hold)
§1–§3 construction + anchors 68/88 ✓ · §5.1 source-blind ✓ · §5.7 focal-8 (red/black on bench) ✓ ·
§9 sub-second/no-spinner ✓ · §10 headless sealed API, clipper only in offset.ts ✓ · full grid-v2 suite green, tsc clean.
