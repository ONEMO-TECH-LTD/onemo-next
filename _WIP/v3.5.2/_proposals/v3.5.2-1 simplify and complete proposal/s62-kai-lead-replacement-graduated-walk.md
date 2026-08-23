# Replacement body for the team final proposal — graduate `bandWalk`, no exact-root machinery

Author: s62-kai-lead · 2026-08-22 · paste-ready replacement for §1–§7 and the proof list of `s62-team-final-necessary-sufficient-proposal.md` (SHA aa071236…). Keeps its Deliverable, stop conditions and cadence.

## Why the replacement

The team proposal is correct but not minimal. It carries ~300 lines the product cannot see: the parametric adapter (§3), the exact local root solve (§4 step 4), and algebraic allowance transport (§5). They exist to make a rung size an exact irrational number at flap 0. Under the ruling "supplied bits are the law, no tolerance" the reference squircle is already refused at flap 0 (2e-14 mm), so on real curves flap 0 is unreachable regardless and they rung under Auto. A walk refined to 1 µm shows Auto "0.000 mm" for a diamond; an exact root shows the same decimal. Same tab, 250 fewer lines. Config resolution (§1) is also unnecessary: the live `GridConfig` already carries pitch/padding/massDepth to `computeGrid`.

What is actually wrong with the current `bandWalk` (engine.ts:169-206 at `2c043257`), measured: (1) band ownership by seating, not acceptance — squircle's 8 lost in B4; (2) only the winner of four placements is observed — the 2-magnet square pair is invisible and a Wrap-failed max-seat placement hides a lawful smaller one; (3) exact Wrap at every millimetre — 53–86 s per band; (4) seat legality (1 µm quantum) and Wrap (raw bits) disagree at tangency — square 25 @ pitch 24 refused by −1e-16. Its gate is already law: `grid.wrap.status === 'lawful'`.

## 1. Configuration — unchanged

Keep `GridConfig` as it is. No `resolveComparisonConfig`, no `ComputeInputs`. `policyIdentity` for the worker cache = JSON of the complete `GridConfig` + contour identity (already the worker's `cfgSig` + `shapeSig`).

## 2. Seat and Wrap judge the same geometry — `compute/seat.ts`, `compute/contact-root.ts` (~10 lines)

`computeGrid` keeps `makeSeatPredicate` as the float prescreen only; every node the prescreen cannot reject outright is decided by the existing exact predicate `exactSeatIsLegal(contour, point, nearestSquared, radiusSquared)` on the same IEEE rationals `measureWrap` uses. One predicate, one geometry, no quantum anywhere. (Replaces the `holds()` 1 µm decision for near-boundary nodes.)

## 3. Discovery sees all four placements — `engine.ts computeGrid` (~20 lines)

`measureCentrePlacements` already returns the four. `computeGrid` evaluates coverage + exact Wrap for **each** seated placement and returns them all as `candidates: CandidateResult[]` (placement, canon, seated, belt, anchors, wrap); `chooseCentrePlacement` remains the Free-mode display pick only. No law decision moves into compute.

## 4. `bandWalk` graduates — `engine.ts` (~30 lines changed)

```ts
function bandWalk(sized, cfg, band, stepMM): { rungs: Rung[] } {
  const [lo, hi] = [band.minMM, band.maxExclusiveMM]
  const rungs: Rung[] = []
  const seenLawful = new Set<number>()            // counts ACCEPTED in this or a lower band — passed in by the caller
  for (let mm = lo; mm < hi; mm += stepMM) {
    const grid = computeGrid(sized(mm), walkCfg)  // float seat count only; walkCfg.wrap = 'skip'
    for (const c of grid.candidates) {
      if (c.count < 1 || seenLawful.has(c.count)) continue
      // refine THIS placement's seat transition to 1 µm (was 0.05 mm)
      const s = bisectSeat(sized, walkCfg, c, Math.max(lo, mm - stepMM), mm, 0.001)
      const judged = computeGrid(sized(s), cfg)   // exact Wrap here only
      const hit = judged.candidates.find(x => samePlacement(x, c) && x.count === c.count)
      if (hit && hit.wrap.status === 'lawful') { seenLawful.add(c.count); rungs.push({ sizeMM: s, count: c.count, placement: c.placement, wrap: hit.wrap }) }
    }
  }
  return { rungs }
}
```

Deleted: the `below` pre-marking (ownership by seating). `seenLawful` is threaded across B1→B4 by the caller so a count is owned by the band that first accepts it. Exact Wrap runs only at refined candidates → per-band cost falls from 53–86 s to the float walk (< 2 s on the squircle).

## 5. Logic — `logic.ts` (~25 lines)

- Ownership: earliest accepted size per count; strictly increasing counts; a count accepted in a lower band is suppressed above.
- Ties: every placement lawful at the same count and size is returned; **vertical eliminates horizontal** only among candidates equal on centre, wrap, count and required allowance; the rest stay plural in stable identity order.
- Auto: the rung for count N is its refined seat size; required = exact worst-belt gap there (already computed by `measureWrap`); lawful if ≤ cap; applied = required. No scan.

## 6. Cut-over — `spec.ts`, `law.worker.ts`, `LawPanel.tsx` (~40 lines)

- `BANDS` → four, half-open `{ minMM, maxExclusiveMM }`.
- Worker: `bandFit` returns the full rung list; rung chips select from it (no re-solve); prefetch per band stays (it is the walk). Snap-step control removed (step is the walk's private constant).
- Honesty note → three laws when rungs render.

Total ≈ 125 lines across existing files. Nothing new is declared in `spec.ts` except `Rung` and `CandidateResult`.

## Required proof — nothing broader

1. Centre/Wrap zero- and positive-flap frozen replays unchanged.
2. Square 25 @ pitch 24: seat and Wrap agree (lawful, gap exactly 0); restoring the 1 µm seat decision fails.
3. Weight squircle 72: consistent exact refusal.
4. Square rungs: 1@24; 2 and 4@72; 8@120; 12@168. Squircle 8 in B4. No cross-band repeat. Lower count survives a higher count's refusal.
5. Diamond: no fixed flap-0 rung (irrational contact); Auto rung at the 1 µm-refined seat size with required < 0.001 mm reported exactly.
6. Holed cutout: hole-overlap seat refusal; hole segment as binding witness.
7. Denser-step (0.1 mm) walk on square, circle, pill, rectangles, diamond, heart, duck, bot, batwoman, holed cutout finds no count the 1 mm walk missed.
8. Per-band squircle solve < 2 s.
9. Real `v3.5.2` tab shows B1–B4 rungs/refusals, zero console errors, serving-worktree provenance.

## Product consequence (Dan's, stated once)

Fixed flap 0 publishes rungs only for shapes whose bits are exactly tangent (rectilinear). Curves show "requires < 0.001 mm" and rung under Auto. This is already true under bit-exact law; the graduated walk neither adds nor removes it.

## Necessity and sufficiency

Necessity — no unnecessary elements: four measured defects fixed in place, ownership/tie logic, B1–B4, cut-over. Removed from the team proposal: config resolution, numeric-selection emission, parametric adapter, local root solve, FieldSqrtReal transport.
Sufficiency — delivers the directive in full: Centre kept, Wrap kept, next-count scaling across B1–B4 with ownership, ties and gravity, on the live tab, at walk speed.
