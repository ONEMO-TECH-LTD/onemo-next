# v3.3.1 — independent read

Read-only. Tree `onemo-next/.codex/worktrees/s62-grid-engine-v331-repair` at `dbf31370` plus the 12-file uncommitted diff. I did not read `audit/meta-v331-audit.md`. I did not run tests.

## Verdict

**Donor, not the board to continue on.**

It can do the one thing our current 3.2 judge cannot: offer a vertical pair inside a square-ish mid-band box. That is real. It does not prove it picked the *right* pair, or the walkthrough family. The official gate only asks “did any certified offer appear?”

Keep v3.2. Take named pieces. Do not switch engines.

## The six questions

### 1. Can it offer a 1×2 vertical pair inside a square-ish B2 box?

**Yes.** This is a ceiling, not our lock.

- `pair.vertical` is `frameId: '1x2'`, permission minimum `(1,2)`, bands B2–B5 (`reference-profile.ts:6,25`).
- `permission()` fills every `(x,y)` from that minimum up to `(5,5)` (`reference-profile.ts:18-21`). Square-ish B2 is `(2,2)` — included.
- `frameFits` is `nx <= classX && ny <= classY` (`frames-registration.ts:23`). `1<=2 && 2<=2`.
- `permittedPatterns` then `frameFits` is the admission loop (`certified-solver.ts:129-131`).

A 2×2 box may try 1×1, 1×2, 2×1, 2×2. That is contract step 3.

### 2. Does anything check which family it returns?

**No.** The host gate is existence-only.

`authority-boundaries.test.ts:53-61`: for each of seven fixtures, find `status === 'OFFERED'`, `centres.length > 0`, manufacturing spec verifies. No `patternId`, no vertical/horizontal/skip-mid, no leftover ~0.

`7/7 produce a certified offer` means seven shapes got *something* certified. It does not mean bat is a vertical pair or duck skips the waist.

Their library also cannot name several families our exams need: no diagonal pair, no skip-middle four, no 96 population (explicitly disabled, `reference-profile.ts:69`). Pill’s ruled family is not in the pattern list.

### 3. Are M09 / M10 real or decoration?

**Real, but they are not the product pick.**

`certified-solver.ts:319-337` runs M01–M08 as the product chain, then:

- **M09** is `selectDiscreteIdentity` (`selection.ts:17-19`) — lexicographic sort on `(population, parity, frame, pattern, variant)`. The M09 descriptor is a placeholder interval `{0,0}` (`criteria.ts:154-156`). The actual pick is the sort.
- **M10** is `finalRegistrationTieBreak` (`final-tiebreak.ts:15-40`) — among remaining feasible boxes, the quantum point nearest the origin `(0,0)`, then smaller x, then smaller y.

M09 decides *which leftover seating* after M01–M08 tied. M10 decides *where that seating sits*. Both run. Neither is “which family Dan ruled.”

### 4. Is `forceLargestComponentMajor` a guarded rule or a thumb?

**Thumb.**

`reference-profile.ts:49` sets `forceLargestComponentMajor: true`.  
`region-policy.ts:28` (working tree, including the uncommitted patch): if that flag is on and the component is the certified-largest id, class is `MAJOR` *before* the interval tests.

A blob that would be marginal on area/persistence still becomes a required mass. That is the same class of substitution our P2/P7 collapse was: a tractable stand-in for “major support.”

The uncommitted `region-policy.ts` patch *widens* when largest-id can be assigned (it no longer requires `topologyCertified`). More thumb, not less.

### 5. Does region classification carry interval uncertainty to a decision?

**It tries. Then it either refuses to decide, or the thumb decides.**

Intervals are real: `areaBoundsMm2.lower/upper`, `persistenceLevelInterval.lower/upper`. `definitelyMajor` uses lowers; `definitelyMarginal` uses uppers. Overlap → `UNCLASSIFIED_NEAR_TOLERANCE` → `INDETERMINATE` → solver returns `DECISION_INDETERMINATE` and **emits no candidates** (`certified-solver.ts:122,312-313`).

That is better than our P2/P7 (both pointed at one blob, always “1”). It is not yet the mass map: persistence here is **erosion depth**, not persistence across sizes (PB §7.3 / §8). And `forceLargestComponentMajor` punches a hole through the interval rule.

`compareCertifiedScores` (`optimization.ts:53-73`) is the honest piece: overlapping intervals return `null` (undecided), and the solver treats that as `INDETERMINATE`, not a winner. That is the behaviour our leftover-as-score / “unsettled does not decide” rule wants.

### 6. Uncommitted diff — load-bearing vs abandoned

HEAD `dbf31370` plus `+287/−134` across 12 files.

**Load-bearing (the in-flight repair):**

- `engine-boundary.ts` — replaces RDP+fixed inward offset with `engineOutline` plus a searched inward offset that is an exact subset of the raw trace. This is how 3,796–10,836 vertex contours get under the 4,096 cap. Dan has since said the raster seam is already solved on v1; treat this as *their* host seam, not a product invention to copy.
- `adaptive.ts` — stop collecting every witness; first exact legal point is enough. This is the PILL 20.62s → 1.47s class of change (rectangular path already short-circuits axis-aligned boxes at `adaptive.ts:108-117`).
- `components.ts` — rewrite of certified round erosion / area bounds / kernel witness. `topologyCertified` is no longer “convex ⇒ certified”; it is a kernel-disc witness. Bigger, still erosion-depth anatomy.
- `region-policy.ts` — wired to the new hierarchy signature; loosens largest-id (see Q4).
- `authority-boundaries.test.ts` — more existence/offset/tamper checks; still no family assertion.
- `artifact-manifest.ts` ×2 — hash bumps that follow the source edits.
- `page.tsx` — one-line pass-through of numeric into the new host seam.

**Not a new engine hiding in the diff.** No new pattern, no family gate, no 96 population, no removal of M07.

I did not re-run the seven shapes on this dirty tree. The 7/7 claim is on `dbf31370`, not on the perf patch. That gap is still open.

## What M07 is (and why it cannot come with us)

`M07_BALANCE` → `ANCHOR_CENTROID_BALANCE_V1` (`mechanics.ts:30`, `criteria.ts:141-151`): minimise lateral offset and squared distance from the magnet-block centroid to the **material centroid**.

That is the formula Dan parked this afternoon and that stole the bat tee on 3.2. It is **active** here, in the first eight product criteria (`certified-solver.ts:319`). Grafting their solver as a package re-imports it.

## What this engine is, in product language

Fixed board, shape scales, certified continuous search for “where can this named seating sit,” then a ten-step pick.

It is a **named-template filter with a ceiling**, plus an interval optimiser. It is not “read the fabric and recognise the pattern.” The T (`t.top1-bottom3`) is in the library as a four-point drawing, not discovered from occupancy. Empty middle of a duck waist is not a pattern they have.

`primaryOffer: 'SMALLEST_ACCEPTED_PER_BAND'` (`reference-profile.ts:47`) plus `buildCertifiedBandOffers` (`solver.ts:20-32`): one chip per band, the smallest accepted size. Contract wants every *different* layout the band unlocks, one marked as the eye pick. They return one.

Size step 12, bands 24–264 including B5 as a live evaluated band — matches our numbers. 96 is off. Library is eleven drawings, closed.

## Donor parts — file, and what they close in our contract

| Take | File | Closes |
|---|---|---|
| Ceiling admission | `frames-registration.ts:23` `frameFits`; `reference-profile.ts:18-21` min-to-5 fill; `patterns-permissions.ts:4-18`; the loop at `certified-solver.ts:129-131` | Spectrum step 3. This is the whole reason to look here. Copy the *rule* (admit iff `nx<=hyp.across && ny<=hyp.down`). Do not copy their closed eleven-pattern matrix as law. |
| Interval comparison | `optimization.ts:53-73` `compareCertifiedScores` | Leftover as a score; unsettled does not pick; “undecided” stays first-class. |
| Axis-aligned fast path | `adaptive.ts:108-117` `rectangularFeasibleTranslations` | Phase 1 squares/rects: exact feasible rectangle in one shot, not an adaptive flood. |
| Feasible-set boxes | `adaptive.ts:119-175` `adaptiveFeasibleTranslations` | “Where may this seating sit?” as certified inside/boundary/outside. **Only if** we replace 3.2’s `computeContinuousFeasibleSet` — do not run both. Theirs is more interval-honest; ours is already in the tree and faster on the public door. Measure before swapping. |
| Interval region class, minus the thumb | `region-policy.ts` definite-major / definite-marginal on bounds | A starting shape for Phase 4 mass map. Persistence here is erosion depth, not PB §8 “across nearby sizes.” Do not take `forceLargestComponentMajor`. |

## Do not take

- The engine as the new board. Dan already rejected a rewrite of the chooser.
- `M07` / `ANCHOR_CENTROID_BALANCE_V1`.
- `forceLargestComponentMajor`.
- Their eleven-pattern list as the library (no diagonal, no skip-mid, no 96; Phase 2 library *grows*).
- `authority-boundaries.test.ts` as the Phase 1 gate (existence ≠ family + registration).
- `primaryOffer: SMALLEST_ACCEPTED_PER_BAND` as the band answer (one chip, not every different layout).
- The host inward-offset search as product logic (Dan: raster already solved on v1).
- M05 `patternRank` as a substitute for the nine-rule order (pair is rank 0, square.4 is rank 2 — a rank that can prefer the pair after leftover ties, which is not “fewest magnets if support is equal”).

## Against a “graft six named parts, canon gate first” proposal

If that proposal is: keep v3.2, steal ceiling + interval compare + (maybe) adaptive feasible-set, and put the square/rect family+registration exam on the real door **before** any graft — I agree.

If it is: graft their certified-solver / mechanics registry / reference profile as a block — I disagree. That block carries M07, the thumb, the closed library, and one-chip-per-band.

Canon gate first is mandatory. Their 7/7 would go green on a wrong family.

## Provenance

- HEAD `dbf31370` (`fix: make saved cutouts certifiably selectable`).
- Working tree dirty: the 12 files in `git status`. Analysis includes that diff.
- Timed 7/7 and the 20.62→1.47 PILL number are from the dispatch, not re-measured here.
