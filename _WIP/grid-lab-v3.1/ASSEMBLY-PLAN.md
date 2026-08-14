# Assembly plan — current state

Rewritten to current state. Thirteen QA rounds; superseded models are deleted, not annotated.

## 1. DONE — placement, verbatim

All three delivered packages cloned complete and byte-identical, nothing edited, committed:

```
src/lib/grid-engine/
  spec.ts / engine.ts / ui/            UNCHANGED (values · mm compute · screen)
  bridge.ts                            the only door; ONE function to be added
  compute/
    magnetic-grid-measurement-kernel/  VERBATIM   (Part 1)
    enumerator/                        VERBATIM   (Part 2)
    candidates.ts                      the seam — not yet written
  logic/
    magnetic-grid-product-logic/       VERBATIM   (Part 3)
    registration-law.ts                L6 owner — not yet written
```

Folder names are forced: `enumerator/dist/types.d.ts` imports
`"../../magnetic-grid-measurement-kernel/dist/index.js"`. Each package's `src/test/scripts` are
excluded from the app's TS project (removing that exclusion = 101 TS2737 errors, measured); the app
target is unchanged; the seam imports only `dist/`. `tsc --noEmit` clean; suites 18/18 · 13/13 · 15/15.

## 2. BLOCKED — the delivered modules cannot satisfy L8 as delivered

**The pipeline is circular under grid-first.** L8: *"No size inputs may exist; shape + grid = final
proportion and dimensions."* But:

- Part 2 exposes only `enumerateCandidates({ measurement, grammar })` and builds every family from
  the **held points of a measurement**, which already required a size.
- Deriving an arrangement's lawful size needs **that arrangement first**.

So the only order the delivered code supports is **size → held facts → arrangements**, which is
size-led. Grid-first needs **placements → per-placement closure → verification**. Fabricating an
all-held measurement, generating placements in the seam, or copying Part 2's family loops would each
duplicate or bypass a verbatim package — forbidden.

**This traces back to my own Part-1 prompt, which asked for "a list of sizes".** The size-led
direction was built in at the first instruction.

### The minimal additive delivery — to the original author, both packages verbatim-preserving

1. **Part 2** — a deterministic, geometry-blind `enumeratePatternPlacements(grammar, fieldExtent)`:
   every family/population/steps/position-set placement, without held facts.
2. **Part 1** — consuming those requested site sets: exact scale/legality intervals (or a
   first-lawful-even-size witness) for arbitrary simple **concave** polygons under uniform scaling,
   with limiting witness; plus **authoritative maximum-clearance anchors** with deterministic ties.
3. **Part 2's existing `enumerateCandidates`** then verifies at the returned lawful size occurrences.
   Candidate `id` already excludes size by contract, so cross-size identity is that id plus the
   construction and registration tags — no new identity law needed.

Why not hand-build the closure: `grid-spec` §4's formula is valid **only for convex** outlines by its
own words, and §4a defers concave shapes to a decomposition it never defines. Our domain is concave.

## 3. What is settled and stands

- **Canonical polygon**: `traceContourRaw`'s native integer pixel ring. UV derived from it for
  drawing only, so shell and kernel measure one shape. No invented quantisation (1e6-per-UV and
  whole-mm contour rounding were both wrong and are struck).
- **Placement domain**: O-1's centre constructions set `sourceAnchor` (which point of the shape is
  anchored); L6's per-axis parity sets the lattice origin — four origins, not one scalar.
- **Fixed shape, moving grid**: `delta = s(A − B) + C − P` is constant; kernel results translate into
  the drawn frame below the bridge and ride on each candidate.
- **Field extent**: `minIndex = −floor(N/2)`, `maxIndex = minIndex + N − 1`.
- **Populations**: base and sparse always enumerated (L7); `pitchMM` selects what the shell draws.
- **Publication**: first **lawful whole-even** size after exact closure, re-checked (concave windows),
  every lawful size record preserved with the published minimum marked.
- **Canon goldens** (square 72 · circle 92 · square 120 · circle 160 · a concave odd-first-fit case)
  belong to the **additive Part-1 acceptance gate**, not the seam.
- **Shell**: candidate index, stepping controls, highlights from bridge coordinates. Lattice-pan
  disabled for this build. No compute, no policy.

## 4. Part 3 — placed; activation in scope; two of its three inputs undefined

| judgement | state |
|---|---|
| tight wrap | **has a formula** — grid bbox = magnet extent + padding; flap = per-side overhang, clamped at 0 (L14/L14a) |
| gravity | **explicit input** — L11/L20 give intent and precedence, never a rule for which way is up on an arbitrary trace or how several magnets resolve to one boolean |
| region / mass | **explicit input** — named in words only. "Corridor-connected components" was this lane's invented proxy, withdrawn; the kernel says a straight corridor is evidence for that corridor alone |

## 5. The one decision that is Dan's

**Maximum-clearance anchoring has no accepted implementation**, and the band-1 duck at 60mm was found
only under it. **Default: HOLD** for the full brief until the additive delivery lands. A
two-construction diagnostic surface is a scope cut Dan may authorise; this lane does not take it.

## 6. Order of work

1. ✅ Placement, isolation, typecheck.
2. Draft the additive request (Parts 1 + 2), QA it, Dan sends it.
3. On delivery: verify verbatim, then write `compute/candidates.ts`, `logic/registration-law.ts`,
   the bridge door, the shell controls.
4. Chrome check, screenshot, Dan tests the assembled three.
