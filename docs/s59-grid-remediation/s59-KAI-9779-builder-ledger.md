# KAI-9779 builder ledger

## Authority and constraint

- Brain OS task `KAI-9779`, read in full on 2026-07-28.
- Analysis plus one small verification script.
- Engine source is read-only. If readiness cannot be proved from current
  outputs, the result is `NOT READY` with named gaps.
- Starting commit: `4f701394bbf899550ffbde8a7093e75039cce0bf`.

## Gate inventory

1. Identify the manufactured contour from source.
2. For standard, diamond, and quincunx, project every delivered anchor into
   origin + basis + whole-number indices, including the quincunx half-step
   rule.
3. Round-trip every projected anchor to engine mm coordinates using
   `MANUFACTURING_TOLERANCE_MM` imported from source.
4. Emit the manufacturing field map or withhold it if any required field is
   unprovable.
5. Report all gaps, including report-only deferred findings, without modifying
   the engine.

## Full-read notes

- `src/lib/effect/grid-core.ts` — the input contour remains
  `designContourMM`; margin adaptation produces `effectContourMM`; the selected
  grid is resolved against that margin-adjusted contour. Holes are copied
  unchanged. `ResolvedGridPlan` exposes the selected pattern, pitch, anchors,
  diameters, and base/resolved/grown margins.
- `src/lib/effect/geometry-truth.ts` +
  `geometry-truth.test.ts` — the source manufacturing tolerance is
  `MANUFACTURING_TOLERANCE_MM`; the test pins it to 0.05mm. The current
  VShape-to-contour producer warns and drops secondary paths, so that producer
  is not hole-ready.
- `src/app/(dev)/effect-creator/grid-lab/page.tsx` +
  `GridWorkbenchRenderer.tsx` — the bench renders `effectContourMM` as the
  total physical outside and calls its edge the manufactured border;
  `designContourMM` is the inner artwork/design boundary.
- `src/lib/export/svg-mm.ts` + export barrel,
  `v5.3.1/core/primitives.ts`, both Creator flows, and
  `v5.3.1/ARCHITECTURE.md` — the only live manufacturing output is still the
  vector-shape SVG cutline. It does not consume a resolved grid plan. The
  payload/save/order track is dormant.
- `payload.ts`, `persistence.ts`, and `types.ts` — the dormant payload is built
  from `EffectSpecDraft.geometryMM`, not from `ResolvedGridPlan`; there is no
  live persistence/order consumer to silently treat as proof.
- `grid.ts`, `grid-client.ts`, `grid-s0-corpus.ts`,
  `t1-contract.ts`, `t2-lattice.ts`, and grid tests — current transport and
  evidence surfaces expose the canonical plan unchanged. Existing lattice
  scripts use scalar pitch/half-indices; T4 needs an explicit per-pattern basis
  whose coordinates are whole integers.
- Source conclusion: for a resolved grid plan, the manufactured contour is
  `effectContourMM`. It is the physical material boundary against which the
  anchors were accepted. `designContourMM` is retained in the artifact as the
  artwork boundary, not substituted for the manufactured cut contour.
- Integration caveat: this conclusion makes the projection/spec artifact
  derivable; it does not mean the live SVG export or dormant order payload
  already consumes it.

## Executed evidence

### Projection

Command:

```text
npx vite-node --config vitest.config.ts \
  scripts/grid-remediation/t4-manufacturing-readiness.ts \
  --verify
```

Result:

- `READY`
- 47 fixtures: square, rectangle, circle, triangle, diamond shape, a dense
  real-AI final contour, and a holed final contour.
- 1,880 grid-bearing plans across both attachments, both densities, both
  centering modes, standard/diamond at 48mm and 96mm, and quincunx at its legal
  96mm pitch.
- 1,188 multi-anchor plans projected; 8,818 delivered anchors round-tripped.
- Standard: 532 plans / 4,334 anchors.
- Diamond: 396 plans / 2,428 anchors.
- Quincunx: 260 plans / 2,056 anchors.
- Maximum round-trip error:
  `5.684341886080802e-14mm`, below the imported source tolerance of `0.05mm`.
- Classified boundaries: 692 single-anchor plans, 47 Velcro/no-grid plans,
  zero zero-anchor cases in the bounded grid-bearing matrix.
- Corpus SHA-256:
  `2a92b36419e1f605a2142608a2ad35c2176e0da2b2603d0867cb49e5eeff507a`.
- The script projects every multi-anchor result, including engine-rejected
  plans, so off-lattice placement cannot hide behind `grid.ok`. It emits
  specimens only for accepted `grid.ok` plans.

### Integer representation

- Standard basis: `(pitch, 0)`, `(0, pitch)`.
- Diamond basis: `(pitch, pitch)`, `(pitch, -pitch)`; this exactly represents
  one checkerboard parity with whole-number coefficients.
- Quincunx basis: `(pitch, 0)`, `(pitch/2, pitch/2)`; the legal half-step is in
  the basis itself, so every stored anchor index remains a whole-number pair.
- Origin: the lexicographically smallest delivered anchor, retained in engine
  millimetres. Reconstructing `origin + i·basis1 + j·basis2` reproduces each
  engine position.

### Falsification

- The verifier moves one non-origin anchor by
  `2 × MANUFACTURING_TOLERANCE_MM`; the lattice projection rejects it.
- Artifact mismatch run:

```text
npx vite-node --config vitest.config.ts \
  scripts/grid-remediation/t4-manufacturing-readiness.ts \
  --verify package.json
```

Exited `1` with
`FAIL · Tracked artifact does not match current engine output: package.json`.
Restoring the real artifact path returned `READY` and exit `0`.

### Repository gates

- `npm run typecheck` — exit `0`.
- ESLint on the verifier — exit `0`.
- Full Vitest suite — 45 files passed, 1 skipped; 408 tests passed, 10 skipped.
- `git diff --exit-code` over `grid-core.ts`, `grid.ts`, `grid-client.ts`, and
  `grid.worker.ts` — exit `0`; engine and transport are untouched.
- Full read-back completed for the 356-line verifier, 276-line artifact, and
  this ledger after implementation.

### Runner issue

`vite-node --script` ignored the alias configuration needed by the direct
`geometry-truth.ts` import. Normal `vite-node` mode with the existing
`vitest.config.ts` resolves the repo alias. The failed attempts and working form are
recorded here because `ERRORS.md` is a pre-existing dirty file owned outside
this slice and was left untouched.

## Verdict

**READY — bounded precisely to `ResolvedGridPlan` → manufacturing-spec
projection.**

The engine already exposes enough mm truth to emit a deterministic spec for an
accepted multi-anchor plan:

1. manufactured `effectContourMM`, including supplied holes;
2. attachment and Twin-fix counterpart requirement;
3. pattern, pitch, deterministic origin, and exact per-pattern basis;
4. signed whole-number anchor indices plus the engine's mm positions and
   diameters;
5. base, resolved, and grown margin values;
6. engine cache version and policy signature.

Tracked artifact:
`docs/s59-grid-remediation/s59-KAI-9779-manufacturing-readiness.json`.

This verdict does **not** claim production integration is finished:

- The live mm-SVG exporter still consumes the vector shape, not
  `ResolvedGridPlan`; save/order payload wiring remains dormant.
- The grid engine preserves holes supplied in a final contour, but
  `contourFromShape` currently drops secondary VShape paths before they can
  reach it. Multi-ring Creator output therefore remains blocked until that
  producer gap is addressed.
- The size-list/product-solver mismatch remains report-only.
- Non-monotonic anchor counts remain the signed density/selection behaviour;
  this task does not rewrite that law.
- The catalog hold metric defect remains a separate task; no catalog was
  regenerated.

Those are named integration/product gaps, not failures of the proved
grid-plan-to-spec projection.
