# Installation plan — GPT Pro's three modules into the scaffold

**Scope: installation only.** Install the accepted three-part stack into the scaffold's existing
modular structure without rewriting it, and run it on real traces. No new architecture, no solvers,
no product policy. Everything else waits until we have looked at real output.

**Baseline** (measured at HEAD `7b84a719`): the scaffold is byte-identical to untouched — `git diff`
against the pre-installation baseline is empty. Suite 31/31, `tsc --noEmit` 0 errors. Nothing is
installed.

## 1. The three packages and where each comes from

| package | provenance | source |
|---|---|---|
| Part 1 kernel | verbatim GPT delivery | `_WIP/grid-lab-v3.1/gpt-pro/part-1-geometry-kernel/` |
| Part 2 enumerator | GPT delivery + the Dan-authorised `single`-family patch | **git `52c91380`** — the accepted artifact is not on disk |
| Part 3 product logic | verbatim GPT delivery | `_WIP/grid-lab-v3.1/gpt-pro/part-3-product-logic/` |

Not one delivered byte is modified. Nothing is copied from part 2's wrapper except `enumerator/`
itself — the kernel beside it there is a shipping copy, and the accepted part-1 kernel already takes
that path.

## 2. Placement

```
src/lib/grid-engine/
  engine.ts                           UNCHANGED
  spec.ts                             + the released arrangement grammar
  ui/trace-cutout.ts                  + returns the ring it already produced
  bridge.ts                           + ONE door
  __tests__/separation.test.ts        + direction guards
  compute/
    magnetic-grid-measurement-kernel/  Part 1, verbatim
    enumerator/                        Part 2, verbatim accepted artifact
    candidates.ts                      the seam — the only NEW file
  logic/
    magnetic-grid-product-logic/       Part 3, verbatim
```

The two `compute/` folder names and the `dist/` level are **forced**: `enumerator/dist/types.d.ts:1`
imports `"../../magnetic-grid-measurement-kernel/dist/index.js"`. Part 3 has no cross-package import,
so it sits in `logic/`.

## 3. The seam — `compute/candidates.ts`

1. **Encode the ring ×2.** `traceContourRaw` emits marching-squares midpoints, so coordinates are
   half-integers (`contour.ts:34-37`); doubling makes them exact integers. It already dedups,
   including the wrap (`contour.ts:130,150`), so **no cleaning or repair happens here** — the ring is
   passed exactly and the kernel fails loudly if it rejects a real trace.
2. **`measureLattice(...)` once.** Polygon validation is O(n²) in edges and runs once per call, not
   per size. **Sizes = `[sizeMM]`, the one size currently on screen** — the scaffold has no guarded
   legal-size array, and `maxSizeMM` is a generator stop, not a ladder. Compute invents none.
   **Lattice inputs, all from the scaffold's own definitions:** pitch `spec.grid.basePitchMM` ·
   origin on both axes `registrationOffsetMM(spec.grid, spec.registration)`, **without pan** — live
   pan in the solve input would make the document depend on every pointer move, and the diagnostic
   freezes `panMM` at `[0,0]` instead (§8 step 4) so measured and drawn still coincide ·
   disc `cellDiameterMM(spec.grid)` · extent
   `min = -floor(N/2)`, `max = min + N - 1` for `N = positionsPerAxis`, which yields exactly `N`
   positions for all 99 values the guard permits, where `[-floor(N/2), floor(N/2)]` emits `N+1` for
   every even `N` (probe: `probes/field-extent-check.mjs`). It measures the currently selected
   registration, not a sweep.
3. **`enumerateCandidates(...)`** on that measurement with the grammar from `spec.ts`.
4. **Return both delivered documents verbatim**, plus an additive millimetre projection for drawing.

**Transform** — for an image `W × H` at `sizeMM`, in ×2 encoded source space:

| kernel input | value |
|---|---|
| polygon | ring × 2 |
| `sourceSize` | `2 · max(W, H)` |
| `sourceAnchor` | `(W, H)` |
| `targetAnchor` | `(0, 0)` |
| requested size | `sizeMM` |

Verified equivalent to the shell's current drawing expression — probe:
`_WIP/grid-lab-v3.1/probes/transform-check.mjs`. The pre-existing half-pixel bias in
`trace-cutout.ts` is inherited deliberately so measured and drawn agree; it is sub-millimetre (L19)
and out of scope here.

The seam owns the transform and field arithmetic. It owns no policy and carries no law literal: law
values are read from the spec, derived ones through the engine's helpers (`cellDiameterMM`,
`registrationOffsetMM`), released ones from `spec.grid` (`basePitchMM`, `positionsPerAxis`).

## 4. The grammar — copied exactly from `a9b1f793`, not re-authored

The enumerator ships no grammar and refuses to choose two ambiguities, so this object is copied
rather than written:

```ts
export const RELEASED_ARRANGEMENT_GRAMMAR = Object.freeze({
  schema: 'magnetic-grid-candidate-enumerator/grammar/v1',
  populations: Object.freeze([
    Object.freeze({ id: 'base',   origin: Object.freeze({ column: '0', row: '0' }), indexStep: '1' }),
    Object.freeze({ id: 'sparse', origin: Object.freeze({ column: '0', row: '0' }), indexStep: '2' }),
  ]),
  families: Object.freeze({
    single: Object.freeze({}),
    run: Object.freeze({ stepDomain: 'any-positive-whole-population-step' }),
    'rectangle-corners': Object.freeze({}),
    'corner-triangle': Object.freeze({}),
    'full-window': Object.freeze({ oneByOne: 'include' }),
  }),
})
```

## 5. Module directions — enforced on resolved specifiers

| module | may import | may not import |
|---|---|---|
| `bridge.ts` | spec · engine · `compute/*` · `logic/*` | `ui/*` · app · React/Next/CSS · browser globals |
| `compute/*` | spec · engine · its own delivered packages | `logic/*` · `ui/*` · app |
| `logic/*` | its own delivered package | `compute/*` · `ui/*` · app |
| `ui/*` | outward adapters only | `compute/*` · `logic/*` |
| shell | bridge · spec · `ui/*` | everything else in the unit |

The bridge orchestrates all three installed modules but travels with the portable unit, so it may
never reach outward. The guard must match **resolved specifiers**, not `@/…` and `../…` alone —
`./ui/trace-cutout` from the bridge is currently unguarded
(probe: `_WIP/grid-lab-v3.1/probes/guard-hole-check.mjs`).

Its "ui submodule" test also classifies every nested directory as `ui/` (`separation.test.ts:242`),
which the seam legitimately trips by reading law values; it must target `ui/` specifically.

`TracedRingInput` is declared in `compute/` with the seam that consumes it; `ui/` keeps its own
browser result type and the shell passes the ring through as data. No type crosses inward from `ui/`.

## 6. Part 3 — installed and callable, not faked

`applyProductLogic` requires exactly four inputs — `candidateDocument`, `measurementDocument`,
`rules`, `judgements` — with a complete judgement per candidate. There is **no partial mode**. Its
family set already accepts `single`, so the patched enumerator's output is valid input as delivered.

The scaffold supplies no judgements today, so **the bridge reports those inputs as unavailable by
name; part 3 is not called and we never claim it was.** The seam preserves both upstream documents
verbatim because they are two of part 3's four mandatory inputs.

## 7. Touched files

*Written or modified:* `compute/candidates.ts` (new) · `spec.ts` (grammar) · `ui/trace-cutout.ts`
(return `{ outlineUV, ring: { points, width, height } }` — kept, not computed) · `bridge.ts` (one
door) · `page.tsx` (state + control) · `__tests__/separation.test.ts` (direction guards) ·
`tsconfig.json` (exclude each package's `src`/`test`/`scripts`; they use BigInt literals and the app
targets ES2017).

*Added, never edited:* the three package trees.

## 8. Order of work

1. Copy the three packages in (part 2 from `52c91380`); add the tsconfig exclusions.
   **Gate:** three package suites green, `tsc` 0 errors.
2. Grammar into `spec.ts`; tracer keeps its ring; repair + extend the separation guard.
   **Gate:** separation guard green including the new direction checks.
3. The seam. **Gate:** runs on a real fixture trace end to end.
4. The one bridge door, then the shell control. While the candidate diagnostic is active the shell
   freezes `panMM` at `[0,0]` and disables the lattice drag; stepping candidates changes only the
   selected record and highlight, and never solves. **Gate:** `tsc` clean, guards green, plus two
   assertions — a pan or candidate-index change calls the seam zero times, and selected candidate
   centres coincide with drawn magnet centres.
5. Run on real traces in profiled Chrome; screenshot; Dan looks.

One bridge result carries measurement, raw candidates, and part 3's named missing inputs. The shell
draws it and computes nothing. This is a diagnostic of the delivered engine — size-first, because
that is how the modules were built.
