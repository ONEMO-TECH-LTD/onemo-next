# T8 independent QA verdict — s62-grok-qa

## WITHDRAWN — dirty-tree contamination

Lead: the worktree was not at `7ab17b83`. Uncommitted probe at `judgement.ts:1090` (`if (true)` instead of `if (first.violations.length)`) fires exact-witness refinement for every candidate. That probe produces hash `01d79a1aa97a5cdf` and BAT B2 `tri-48-sw@98`. HEAD is `bde4be2b6bd57b1e` / `pair-diag@98`.

The BAT/hash divergence is therefore **not a T8 defect**. "Deletion is not behaviour-preserving" does **not** follow from that sweep.

My error: I named `7ab17b83` without `git status --short` + `git rev-parse HEAD` before the first measurement. Four modified files were sitting there.

Held, not re-run, until lead says the tree is at a known commit.

Still live after the withdrawal (lead accepts, or two gates already named it):
- 175/175, tsc, eslint, diff-check, construction-door throw
- `candidates` dies in the same bounded follow-up
- `t8-sweep.txt` vs `t7f-sweep.txt` identity, and `perimeterOnly` drop, still need proof on a clean tree — not dismissed, not re-asserted

---

Worktree: onemo-next/.claude/worktrees/s62-kai-lead-v3.2-39064dc3
HEAD named: 7ab17b83 — **not proven clean; do not cite this sweep as HEAD**
No product/test edit. Server 3072 left untouched.

## Verdict

**HELD — do not treat as NOT CLEAR**

Previous NOT CLEAR rested on the contaminated sweep. Re-open only after a clean-tree re-sweep.

- Necessity: `candidates` still dead schema (lead: dies in the same follow-up).
- Sufficiency: not judged on the dirty measurement.

## 1. No second selector in grid-engine — PASS

Grep of `src/lib/grid-engine` for latticeAt, thinBySpacing, autoGrid, balancedFit, resolveGridPlan, semanticLadder, resolveRectangleRungs, perimeterOnly, sparseThin, gridPlanCacheKey, LadderRecipe, DEFAULT_LAW, computeGrid(, phaseCandidates, deepestPoint, autoPreparedGrid, balancedPreparedFit, finalize, DEFAULT_PITCH_MM, TARGET_ANCHORS: **zero hits**.

The only remaining "auto" is `MagnetPlan = 'auto'` — size-driven magnet *diameter*, not a search.

`deepestPointSampled` lives in `compute/structure.ts` as a T5 descriptor helper. Not the deleted fallback.

`src/lib/effect/grid-core.ts` still 1916 lines (the twin). Grep for `grid-engine/compute/grid-core` under `src/`: **zero** outside grid-engine. Confirmed.

grid-engine copy is 473 lines (header + 7ab17b83 comments; not the 446 claimed at faac108b).

## 2. Behaviour unchanged — FAIL (finding)

Independent `npx vitest run src/lib/grid-engine/__tests__/`:

```
Test Files  10 passed (10)
     Tests  175 passed (175)
Duration  4.04s
VITEST_EXIT:0
```

Independent public-door seven-contour sweep (`npx vite-node .scratch/t7-sweep.ts`) twice in one process:

```
released band-answers=14  CERTIFIED_WINNER=4  CERTIFIED_SET=0  UNRESOLVED_SET=0  NONE=10
DETERMINISM: run1=01d79a1aa97a5cdf run2=01d79a1aa97a5cdf identical=true
T7 GATE: PASS
```

Builder hash `bde4be2b6bd57b1e` does **not** match.

Current BAT B2 winner: **tri-48-sw@98**.
Builder's T7/T8 scratch sweeps: **pair-diag@98**.

`cmp` of `.scratch/t7f-sweep.txt` (09:27, post-retry) and `.scratch/t8-sweep.txt` (11:53, claimed post-deletion): **byte-identical**. The T8 "same hash" claim reused the T7 artifact. It is not a post-deletion measurement.

T8 did change a live call: `judgement.ts` dropped `perimeterOnly: true` at both construction-door sites (`9a0fddcb..faac108b`). On current committed bytes the public-door answer is not the T7-retry answer.

Released 4/0 still holds. The T7 *count* gate survives; the identity of BAT B2 does not.

## 3. Refusal is real — PASS

```
{"threw":true,"name":"RangeError","message":"A magnetic grid requires an explicit construction; this engine never selects one."}
```

`computePreparedGrid(prepareExactContour(100mm square), { attachment: "magnetic" })` — no construction.

## 4. Keep / delete — PASS on the named keep set

Live:
- `computePreparedGrid` — called from `continuous-feasibility.ts`
- `exactPerimeterCoverage`, `splitPopulationBoundary`, `assignSizes`, `gridConstructionUnit` — used inside `grid-core.ts` measurement/delivery
- `scaleContour`, `nearestAnchorPair` — used from `judgement.ts`

Deleted symbols have no remaining `src/lib/grid-engine` callers.

## 5. `GridResult.candidates` — dead schema; shrink

Interface comment now says "Always empty." Both return sites set `candidates: []`. `judgement.ts` still copies `grid.candidates` onto `SizeVariant`. No grid-engine consumer reads it as a live offer set.

Ruling: it died with the thinning. Leaving the field is dead schema. One-field deletion, not a new architecture. Authorized T8 keep-the-shape is why it is still there; it should not stay.

## 6. Static — PASS

```
tsc --noEmit          TSC_EXIT:0
eslint (four files)   ESLINT_EXIT:0
git diff --check      DIFFCHECK_EXIT:0
```

## What I need from you

1. Smallest fix for the BAT B2 identity drift (likely the `perimeterOnly` fallout at the construction door), then I re-sweep. I will not edit.
2. Delete `candidates` in the same bounded follow-up, or tell me it stays as a documented empty field through T9.
