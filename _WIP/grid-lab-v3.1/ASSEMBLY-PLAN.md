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
  logic/                                   ← NOT YET WIRED (§6)
    magnetic-grid-product-logic/dist/        VERBATIM, when it is wired
    judgements.ts                            OURS — gravity / wrap / mass from the law's formulas
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
| `lattice.fieldExtent` | `±(spec.grid.positionsPerAxis − 1)/2` |
| `discDiameter` | `layout.cellMM` |
| population `indexStep` | `spec.grid.pitchMM / spec.grid.basePitchMM` |

**A literal 48, 24, 12 or 9 anywhere in this file is a defect** — that duplication is exactly what
produced the impossible 24mm-spaced discs, and it is the one failure this seam exists to prevent.

**Units — integer micrometres, scale = 1.** The shell has already sized the shape through
`resizeShape`, so the kernel must not scale it again: polygon vertices, pitch, disc and origin all go
in as `round(mm × 1000)`, `sourceSize = 1000` and the requested size is `1000`, so `scale = 1`.
Returned centres divide by 1000 back to mm. The 1000 is a unit, not a law value.

**Input normalisation is required and belongs here.** `preparePolygon` rejects — never repairs —
duplicate vertices, zero-length edges, a repeated closing vertex, zero area and self-touching edges.
A raw traced ring contains duplicates. So this file dedupes consecutive points and drops a repeated
closing vertex **before** calling. That prepares input; it re-implements no kernel behaviour.

**Cost, measured from the source, decides the call shape.** `preparePolygon` runs on *every*
`measureLattice` call and its `validateNonAdjacentEdges` is O(n²) over edges; per-position distance
queries are cheap (the kernel builds an AABB tree). Therefore: **one call carrying the whole `sizes`
array**, and the result cached per (outline, anchor). Pan and stepping never re-validate — which is
also the scaffold's own "zero solve on interaction" contract.

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
