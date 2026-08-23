# Grid-Meta review — contract-silent decisions

Target trace: `fidelity-trace-W1-W2-S1.md` at plan commit `da424d0f`.
Authority: v3.5.3 master SHA `19183807…`; execution plan SHA `e0194ac…`.

Every decision below is judged separately for contract fidelity, necessity, no-rocket-science,
and sufficiency. Approval is not permission to build ahead of the linear QA → Meta gate.

## W1

- **W1-a — APPROVE.** The four consumer/dead-body edits are required by the replaced public
  Wrap union and field names. A compatibility shim would add temporary duplicate truth.
- **W1-b — APPROVE.** Preserve the measured population on `empty-belt`; use `[]` when the
  boundary itself is invalid and therefore no population was measured.
- **W1-c — APPROVE.** The direct finite node × segment pass is the smallest complete way to
  return distance plus all co-nearest projections. No index/certificate/adapter is justified;
  the existing F1 performance gate remains authoritative.
- **W1-d — APPROVE.** Spot-radius-only prescreen is the frozen `seatMarginMM: 0` Centre behavior.
  Margin may not return through the Centre phase path.

### W1 correction requiring QA + Lead agreement

`invalid-boundary` must cover every supplied ring, not only the outer ring. Before any membership
or distance pass, reject when the outer or any hole has fewer than three finite points. Add the
0/1/2-point-hole mutation fixture. Do not add area, self-intersection, winding-normalisation or
topology validation; those are neither required by the contract nor needed by the live adapters.

Contract fixture number correction only: replace `diamond 34 seats with clearance 0.06` with
`diamond 34 seats with raw clearance 17 / sqrt(2) - 12 = 0.020815...; the ruler reads 0`.

## W2

- **W2-a — APPROVE.** A 12-line test-only copy of the deleted analytic predicate is the minimum
  durable before/after oracle. It must remain test-only and must not be exported or imported by runtime.
- **W2-b — APPROVE.** Ordered `hole:<i>` labels are necessary structural identity; raw coordinate
  bytes remain untouched and no hash/canonicalisation platform returns.
- **W2-c — APPROVE.** `circle: false` belongs only to the legacy comparator invocation; the Law
  config remains free of the deleted field.

## S1

- **S1-a — REPLACE.** The S1 row explicitly deletes `CONTACT_TOLERANCE_MM`; deferral violates the
  locked order and leaves sub-mm bisection alive. Delete the constant/import now and replace the
  refinement block with the already-computed even-size result:

  ```ts
  if (count >= 1 && !seen.has(count) && grid.wrap.status === 'lawful') {
    seen.add(count)
    points.push({ sizeMM: mm, count })
  }
  ```

  This deletes the bisection and redundant re-solve; S3 still replaces the remaining sampled walk.
- **S1-b — APPROVE.** The legacy request may carry fixed `SIZE_STEP_MM` until S5 deletes the field;
  no user-controlled snap step survives.
- **S1-c — APPROVE.** `Math.round(mm / SIZE_STEP_MM) * SIZE_STEP_MM` is the smallest UI adapter for
  drag/pinch values. Clamp to the already-declared even band/slider bounds; no engine-side quantum.

## S2 pre-approval

- **S2-a — APPROVE WITH BOUNDS.** Re-home the deleted body once as `seat.ts measureParity`, called
  immediately by S2. It may return only `parityTrue` plus the measured centre miss; no generic evidence
  types, alternative parity system, policy scoring or new module. The body must preserve the frozen
  odd-line/node and even-line/gap rule and have a mutation test. Compute measures; Logic only consumes
  the boolean during ladder reduction.
- **S2-b — REPLACE CONTRACT WORDING, THEN IMPLEMENT.** Whole-mm `centreErrorMM` is required, but the
  current sentence saying `measureWrap` is the only law conversion contradicts it. Use this bounded
  clarification in master §1/§5.2 before code:

  > Wrap clearance is converted exactly once per anchor in `measureWrap`. S2 converts the measured
  > Centre miss exactly once, at `measureParity`, with the same `Math.floor(raw + 0.5)` whole-mm ruler;
  > it reports `centreErrorMM` and never changes the frozen Centre target or phase. No other law
  > conversion exists.

  Inline the conversion in `measureParity`; do not create/export a general rounding utility.
- **S2-c — APPROVE WITH A PINNING FIXTURE.** The existing `centrePhaseCandidates` order is the donor
  authority: canonical, x-shifted, y-shifted, both. Map it once to `{xHalf,yHalf}` and mutation-pin all
  four; do not infer placement later from rounded coordinates.

## Verdict axes

Necessity: clean only with the W1 bounded boundary check, literal S1-a deletion, and bounded S2 rules
above; no exactness platform, topology validator, generic measurement framework or additional module.

Sufficiency: W1 is pending the QA/Lead disposition and patch verification; W2 is approved in principle;
S1 requires the S1-a rework; S2 is not released until QA and Lead cross-approve S2-a..c.
