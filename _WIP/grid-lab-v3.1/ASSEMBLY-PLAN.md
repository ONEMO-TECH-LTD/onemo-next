# Assembly plan — the three GPT modules into the scaffold

**For Dan's confirmation before any code moves.** Written after reading, in full: the scaffold
(`spec.ts` 210, `engine.ts` 227, `bridge.ts` 116, `ui/camera.ts` 73, `ui/trace-cutout.ts` 46,
`GridCanvas.tsx` 175, `page.tsx` 654) and all three deliveries (kernel src 1,927 + contract 590;
enumerator src 1,229 + contract; product logic src + contract + tests, read earlier).

**Rules this plan is bound by:** clone the delivered modules **verbatim** — rebuilding or
approximating what GPT already delivered is forbidden; keep the scaffold's separation of compute /
logic / shell; the **shell holds nothing but shell**; no module's code leaks into another.

---

## 1. What the scaffold already is

| module | file | owns | may never |
|---|---|---|---|
| **Sub 2 — spec** | `spec.ts` | law VALUES + the one write guard. Zero arithmetic. | compute anything |
| **Sub 1 — engine** | `engine.ts` | pure mm compute: the lattice, spans, registration offset, scaling | know about a screen, hold a value |
| **Bridge** | `bridge.ts` | the ONLY door shell→engine; drives the unit | hold values, do geometry |
| **Shell** | `page.tsx`, `GridCanvas.tsx` | presentation state and drawing | compute, decide policy, import the engine |
| **Shell's own logic, by necessity** | `ui/camera.ts`, `ui/trace-cutout.ts` | screen maths; browser IO + tracing | touch mm law, hand anything to the unit |

Verified by reading: the shell imports **only** `spec`, `bridge`, `ui/*`. `GridCanvas` draws the
rule, one circle per magnet from `layout.magnets`, then `children`. It computes nothing.

## 2. Where the three modules go — and why the layout is not a choice

`enumerator/dist/types.d.ts:1` reads:

```ts
import type { … } from "../../magnetic-grid-measurement-kernel/dist/index.js";
```

The enumerator resolves the kernel **by relative sibling path**, with the delivered directory names
and the `dist/` level intact. Runtime JS is unaffected (a type-only import is erased — the vendored
copy imports and runs), but TypeScript needs that exact shape. **So renaming the folders, or
flattening `dist/`, would force an edit to delivered code — which is forbidden.** The layout below
is therefore dictated by the delivery, not by preference:

```
src/lib/grid-engine/
  spec.ts                                  UNCHANGED
  engine.ts                                UNCHANGED
  bridge.ts                                + ONE new door (§3)
  compute/                                 ← the measurement + candidate modules
    magnetic-grid-measurement-kernel/dist/   VERBATIM, byte-identical
    enumerator/dist/                         VERBATIM (carries our single-family patch)
    candidates.ts                            OURS — the seam (§3), the only file we write here
  (no logic/ in this build — product logic is deferred, §6)
  ui/                                      UNCHANGED — camera, trace-cutout
```

From `compute/enumerator/dist/types.d.ts`, `../../` resolves to `compute/` → finds
`compute/magnetic-grid-measurement-kernel/dist/index.js`. Exact.

The current `src/lib/grid-engine/vendor/{kernel,enumerator}` is **wrong and gets replaced**: it
flattened `dist/` and renamed the kernel, which breaks that import. Byte-identity is proven by
`diff -r` against `_WIP/grid-lab-v3.1/engine/`, re-runnable at any time.

## 3. The seam — one file, one door

`compute/candidates.ts` is the only code we write in the compute module. It drives the two delivered
packages and converts units. It re-implements nothing.

```ts
enumerateCandidatesForField(spec, layout, outlineMM, opts) → RawCandidate[]
```

**Every lattice value is READ, never written:**

| kernel input | source |
|---|---|
| `lattice.pitch` | `spec.grid.basePitchMM` |
| `lattice.origin` | `layout.anchorMM` — the scaffold's own anchor (registration + pan) |
| `lattice.fieldExtent` | integer bounds from `spec.grid.positionsPerAxis` (see below) |
| `discDiameter` | `layout.cellMM` |
| population `indexStep` | `spec.grid.pitchMM / spec.grid.basePitchMM` |

**A literal 48, 24, 12 or 9 anywhere in this file is a defect** — that duplication is exactly what
produced the impossible 24mm-spaced discs, and it is the one failure this seam exists to prevent.

**Field extent — integer bounds, and my first formula was wrong.** `±(positionsPerAxis − 1)/2`
produces **half-integer indices whenever the count is even**, and the guard allows any count from 1
to 99, so an even count is reachable and the kernel takes integers only. Correct construction:

    minIndex = −floor(N / 2)        maxIndex = minIndex + N − 1

N=9 → [−4, 4] (the released case) · N=8 → [−4, 3] · N=1 → [0, 0]. Exactly N positions per axis, for
every value the guard permits.

**Transform model — ONE model, stated exactly.** The first draft carried two incompatible ones
("requested size is 1000" *and* "one call with the whole sizes array"). The kernel is used as
designed: **a canonical unscaled polygon plus real requested sizes**, so one `preparePolygon` serves
every size.

| kernel input | value |
|---|---|
| `polygon.vertices` | the traced ring in its own space, quantised: `round(u × 1e6)`, `round(v × 1e6)` |
| `sizeTransform.sourceSize` | the longest bbox span of that quantised ring, in the same units |
| `sizeTransform.sourceAnchor` | that ring's bbox centre, same units |
| `sizeTransform.targetAnchor` | the millimetre point where that centre currently sits on the field |
| `sizes` | the millimetre sizes wanted — the displayed size, or a ladder, in one call |

`sourceAnchor` and `targetAnchor` are what pin the shape where the shell has already drawn it; the
first draft left both unassigned, which would have let the kernel translate the shape out from under
the picture. Both must be supplied, and the seam's test asserts the returned centres coincide with
the drawn outline.

**The quantised polygon is the authoritative input**, not the float outline it came from. At 1e6 per
unit the step is far below a micrometre on any real shape, but it is a quantisation and can in
principle flip a fit that is tangent to within it — so the plan claims fidelity to the quantised
ring, never equivalence to the float one.

**Input normalisation is required and belongs here.** `preparePolygon` rejects — never repairs —
duplicate vertices, zero-length edges, a repeated closing vertex, zero area and self-touching edges.
A raw traced ring contains duplicates. So this file dedupes consecutive points and drops a repeated
closing vertex **after quantisation and before calling** — rounding itself can create duplicates, so
cleaning before it would miss them. That prepares input; it re-implements no kernel behaviour.

**Cost and the solve contract — the first draft contradicted itself.** `preparePolygon` runs on every
`measureLattice` call and its `validateNonAdjacentEdges` is O(n²) over edges; per-position queries
are cheap (the kernel builds an AABB tree). So the seam calls **once per outline, carrying every size
it needs**.

But the draft also keyed the cache on `layout.anchorMM` — **which contains the pan**. Every pan
therefore changes every physical lattice site, so that cache misses on each new pan and solves during
a drag, breaking the scaffold's own zero-solve-on-interaction contract. Both could not hold. The
resolution follows the scaffold and the law rather than inventing a third thing:

- **Candidates are solved for the lawful registrations, not for the live pan.** L6 rules registration
  by parity and O-1 makes the centre construction a switch, so the origins the seam measures are
  those — a small, fixed, law-derived set, computed from `spec` via `registrationOffsetMM`.
- **Pan does not re-solve.** During this raw-set build it is presentation only; selecting a candidate
  realigns the drawn grid to that candidate's registration, which is the behaviour the scaffold
  already describes.
- **The cache key is everything the result depends on**: outline identity, `basePitchMM`, `pitchMM`
  (population stride), `paddingMM` (disc), `positionsPerAxis` (extent), registration, the requested
  sizes, and the grammar. Anything outside that key must clear the cache rather than be assumed
  irrelevant.

**Grammar** — the two ambiguities the enumerator makes mandatory are supplied here, as already
settled in QA: `run.stepDomain = any-positive-whole-population-step`, `full-window.oneByOne =
include`. Populations: base (`indexStep 1`) and sparse (`indexStep 2`) sharing origin `0,0`.

**Return shape** — positions already in mm on the scaffold's lattice, plus family, population, steps
and the kernel fact references. No ranking, no preference, no filtering.

## 4. The bridge gains one function, and nothing else changes

```ts
export function candidatesForField(spec, layout, outlineMM, opts): RawCandidate[]
```
It reads values off `spec`, calls `compute/candidates.ts`, returns. It does no geometry itself — the
same discipline `layoutField` already follows.

## 5. What the shell is allowed to gain

Presentation only:
- an index of which candidate is being viewed, and controls to step it;
- the outline in mm, which it **already computes** to draw the silhouette
  (`box.x + u·box.w`, `box.y + v·box.h`) — handed to the bridge, not recomputed;
- highlight elements passed as `children` to `GridCanvas`, drawn from coordinates the bridge
  returned on this render.

The shell must not import `compute/`, must hold no lattice number, and must not decide which
candidate is better — there is no "better" in this build.

## 6. Product logic is deliberately not wired yet

It cannot run without a gravity boolean, a wrap value and a regional value **per candidate**, and
those three are ruled but not yet implemented (`judgements.ts`). Wiring the ranker before Dan has
accepted the raw candidate set is what killed the previous attempts. It lands after §7 passes.

## 7. Order of work, each step verifiable

1. Replace `vendor/` with `compute/` in the delivered layout; prove byte-identity by `diff -r`;
   `tsc` resolves the enumerator's kernel import.
2. Write `compute/candidates.ts` + a unit test against a real trace: assert the returned positions
   sit exactly on `layout.magnets`, and that no literal law value appears in the file.
3. Bridge door + the shell's stepping control and highlight.
4. Chrome check on the running page: candidates visible, no solve fires on pan, screenshot captured.
5. Dan tests it. Only then: judgements + product logic.

## 8. What this plan explicitly does not do

No rewrite or re-implementation of any delivered algorithm. No second lattice. No geometry in the
shell. No ranking anywhere. No new module beyond the one seam file and, later, `judgements.ts`.
