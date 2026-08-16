# GPT Pro v3.3 engine — execution-backed repair audit

## Verdict

**FAIL — substantial implementation, not a completed v3.3 engine. Repair this build in place. Do not restart, assemble another engine, or reopen the architecture.**

The delivered Compute → Logic → Next separation is the right boundary. The canonical polygon and aligned-quantum containment paths are useful implemented work. The delivery also has valid package archives, a reproducible file manifest, runnable tests, a CLI demonstration, and a working standalone Logic browser smoke.

The completion claim fails because direct probes found false exactness, false profile identity, incorrect compound optimisation, incomplete continuous search, missing parity/permission semantics, and a ManufacturingSpec verifier that accepts source/decision tampering. The Next package is illustrative scaffolding rather than a tested Effects Studio integration. These are implementation defects in the current design, not evidence that a different design is needed.

The unresolved production profile inputs are separate. Dan can supply those values after the code can faithfully encode and enforce them; their absence does not explain the engineering failures below.

## Scope and evidence

Audited in full:

- the final GPT Pro transcript segment and its claimed delivery;
- every hand-written source, test, profile, script, manifest, example, package document, and report in the delivery;
- all three attached approved specifications carried in the delivery;
- the built runtime through independent tests, CLI execution, adversarial Node probes, archive checks, clean-build attempt, benchmark, and browser observation.

Independent execution:

- `artifact-manifest.sha256`: **322/322 entries valid**;
- three package ZIPs: SHA-256 checks and `unzip -t` pass;
- shipped suite: **25/25 pass**;
- fresh `npm run build`: **fails** because `tsc` is undeclared and unavailable;
- browser smoke: passed from an isolated copy of the delivery;
- preview benchmark, Apple arm64 / Node 26: median **37.38 ms**, p95 **39.74 ms**, above the locked 16 ms target;
- selected-size exact B1 certification median: **0.97 ms**.

The browser observation proves the standalone Logic smoke page runs. It does not prove Effects Studio integration: the smoke imports Logic directly and never exercises the Next adapter.

## Blocking findings

### 1. Safety and authority are not fail-closed

#### 1.1 Verification radius can round down

`packages/geometry-compute/src/containment.ts:10` nearest-rounds `radiusMm` before exact containment.

Probe: 24 × 24 mm square, centre `(0,0)`, requested radius `12.004`, quantum `0.01`.

Observed: `legal:true`, `exactAtQuantum:true`, clearance `12`, margin `-0.004`.

A negative-margin placement is declared legal. Require a quantum-aligned radius or conservatively quantize the safety radius upward.

#### 1.2 A caller can forge the registered profile identity

`packages/magnetic-logic/src/solver.ts:129` trusts any input carrying a non-empty `profileHash`; it skips validation, hash recomputation, freezing, and registry resolution.

Probe: clone the registered reference profile, retain its hash, change `cellMm` from 24 to 20, and solve both.

Observed: both results claim the same profile hash but produce different result hashes and B3 centres.

Every solve must resolve a registered immutable profile or re-register and verify its hash. The supplied hash must never be treated as proof.

#### 1.3 Profile validation permits non-executable policy

`packages/magnetic-logic/src/profile-schema.ts` does not enforce positive finite step/domain/period values, ordered clearance levels, pattern/population/parity consistency, complete mechanics descriptors and tolerances, provenance/fixture requirements, or all unresolved production inputs.

Probe: a profile with `sizeDomain.stepMm = 0` registers successfully; size enumeration would not terminate. The shipped suite also creates a nominal production profile by cloning the unresolved reference and toggling `productionReady`.

### 2. Certified optimisation is not correct

#### 2.1 Compound global-anchor construction violates the approved earlier-component rule

`computeGlobalAnchor` lets candidates uncertain on an earlier component influence the anchor on a later component.

Probe, compound min/min, `tau=(1,1)`:

- A: `([0,0], [100,100])`
- B: `([0.5,1.5], [0,0])`

B is uncertain on component 1, so component 2 may not decide. Both must remain or refine.

Observed: anchor `([0,0],[0,0])`; A is rejected as not equivalent and B survives. This is the approved compound-uncertainty regression class.

#### 2.2 Final registration tie-break samples five points, not the representable optimum set

`packages/geometry-compute/src/final-tiebreak.ts:17-27` checks only canonical clamp, box centre, and four corners.

Probe: a 24 × 24 mm square centred at x=`0.25`, radius `12`, quantum `0.01`, optimum box `[-1,1]²`. The representable legal centre `(0.25,0)` exists.

Observed: `FEASIBLE_BELOW_OUTPUT_QUANTUM` after five unique attempts.

The status is mathematically false. Enumerate/certify the relevant quantum points in the certified optimum set; do not infer absence from five samples.

#### 2.3 The normal band solver marks incomplete heuristic witnesses `EXACT`

`packages/magnetic-logic/src/solver.ts` considers at most 64 heuristic critical translations, falls back to an adaptive witness, then fabricates a `FeasibleTranslationSet` with `exactness:'EXACT'`.

It returns normal `OFFERED` and smallest-size decisions from that incomplete set. Selected-size certification cannot recover a true smallest size or pattern that preview omitted before selection.

The existing solver must either prove its critical set complete, use certified continuous search for the band decision, or return an explicit non-authoritative preview state that cannot drive a production offer.

### 3. Structural and product-policy evidence is incomplete

#### 3.1 Sampled components become false exact regions

`packages/geometry-compute/src/components.ts` classifies cell centres, assigns whole-cell area/bounds, and emits an error envelope. `componentToRegionEvidence` drops that envelope. `criteria.ts` then treats arbitrary membership in an occupied cell as `ALL`/`EXACT`.

Two probes:

- a 24 × 24 square at radius 12 has one exactly legal centre, but the hierarchy returns no cells/components;
- in a 34 × 34 square, the hierarchy says `(6,0)` has exact region coverage although a radius-12 disc there is exactly illegal.

The hierarchy also lacks the specified certified perimeter, appearance/disappearance level, persistence interval, and touch-only-below facts. Preserve bounds/error through every mechanics criterion and return indeterminate when they cannot certify the comparison.

#### 3.2 Population-origin parity is declared but never enumerated

The profile exposes `originParities`, but hypothesis construction loops patterns only and frames contain no population-origin parity. A probe with two configured parities returns the same parity-free frames. ManufacturingSpec has no parity identity either.

Enumerate each permitted discrete parity as a distinct frame hypothesis and persist it in the decision/manufacturing identity.

#### 3.3 Pattern permission law is neither enforced nor fully expressible

`marginalNodesAllowed:false` is present in the reference permissions but unused. The schema cannot encode required major-region coverage or primary/fallback permission. Therefore the approved PD-19 policy cannot be supplied without changing code.

#### 3.4 M02 ignores the registered top direction

`packages/magnetic-logic/src/mechanics.ts:12` defines “upper” with `bounds.maxY` instead of projection on `mechanics.topDirection`.

Probe with top direction `(1,0)`: expected the right-hand region; the implementation selected the high-Y region.

#### 3.5 Ordering is locale-dependent

Production paths use `localeCompare` for candidate, pattern, and component identity ordering. That is not canonical byte/code-unit ordering across runtimes, and IDs are not constrained to make it safe. Replace it with the specified deterministic comparator and add browser/Node byte-identity coverage.

### 4. Manufacturing evidence is not bound to what was solved

#### 4.1 The verifier accepts tampered source and decision evidence

`packages/magnetic-logic/src/verifier.ts` checks current compiled artifact constants and legal centres, but does not use/recompute `sourceGeometryHash`, source-to-final scaling, mechanics optimum, or the supplied decision trace. It trusts `decisionProof` as a string.

Probe: take a production-marked certified B1 spec, replace `sourceGeometryHash` with 64 zeros, erase `decisionTrace`, recompute the public canonical hash.

Observed: `verifyEngineManufacturingSpec` returns `valid:true`.

The spec also omits or does not verify canonical origin, axis convention, pattern version, integer centre coordinates, approximation envelope, frame/population/parity identity, width/height/scale/band derivation, and centre-to-registration mapping.

#### 4.2 Selection certification accepts a different outline from preview

`certifyAndBindSelectedBand` receives a preview and a separate outline but never checks that outline against `preview.sourceGeometryHash`.

Probe: preview a four-vertex square, certify a geometrically equivalent five-vertex outline with a collinear extra vertex. Their geometry hashes differ. The produced spec records the preview source hash and the other final ring; the verifier accepts it.

Use one canonical source identity through preview, certification, persistence, and verification. Remove or demote the parallel preview-only `bindSelectedBand` production-facing path.

#### 4.3 Historical verification is absent

The verifier recognizes only the artifacts compiled into the current runtime. Stored ManufacturingSpecs cannot be resolved against their pinned historical engine/profile artifacts as the blueprint requires.

### 5. Product integration and delivery are incomplete

- `packages/magnetic-next/src/ShapeSolutionOverlay.tsx:7` draws a bounding rectangle while claiming to render the final ring; it never reads `finalRingInt`.
- The example page is excluded from TypeScript compilation.
- A permissive React shim substitutes for real framework types.
- Tests do not import the hook, overlay, loader, certification adapter, server verifier, or example.
- No Effects Studio route was changed or launched.
- Root build relies on a global `tsc`; TypeScript is not declared and no lockfile is delivered.
- The supplied folder lacks the claimed master ZIP; only its orphan checksum is present.
- Physical component validation permits invalid dimensions/tolerances and never validates diameter/thickness.

The mandatory regression surface is also incomplete: no full §13.3 counterexamples, compound uncertainty/dominance, component-representative trap, 96/parity, profile drift, geometry drift, artifact-unresolvable, or browser/Node byte-identity suite. Batwoman input remains unavailable, but its ingestion/oracle gate is still required before claiming production completion.

## Claim adjudication

GPT Pro's compliance matrix over-credits the build. The code contains modules named for exact legality, certified hierarchy, compound restriction, ManufacturingSpec, and Next integration; executable probes show that the promised contracts do not hold end to end.

## Smallest in-place repair sequence

This is the whole repair scope. It changes the delivered implementation; it does not add a fourth package, alternate engine, donor lane, or new architecture.

1. **Close safety and identity:** conservative/aligned radius handling; mandatory registered-profile resolution; full executable profile invariants.
2. **Correct certification:** repair compound anchor semantics and final representable tie-break; prohibit heuristic `EXACT` offers.
3. **Make structural evidence certified:** retain bounds/error envelopes, add the required hierarchy facts, and propagate indeterminate comparisons.
4. **Finish governed mechanics:** enumerate/persist parity; encode and enforce all permission dimensions; honor top direction; canonicalize ordering.
5. **Bind manufacturing evidence:** one source identity, complete canonical fields, full decision recomputation, historical artifact/profile resolution, and physical-component validation.
6. **Make the shipped Next package real:** compile it against the actual app/types, render the ring, exercise selection/certification/verification through the Effects Studio route.
7. **Make delivery reproducible and fast:** declare/lock the build toolchain; meet the 16 ms preview target without weakening certification; restore the master archive.
8. **Add the blueprint's mandatory regressions:** every probe above plus the missing §13.3, parity, drift, historical-artifact, cross-runtime, and eventual Batwoman fixtures.

The current 25 tests are retained. Each confirmed probe becomes a named failing regression before its corresponding repair.

## Necessity and sufficiency

**Necessity: shrink.** The three-package Compute → Logic → Next boundary is justified and should remain. Remove/demote the parallel preview-only selection path, false `EXACT` witness construction, bounding-box “ring” rendering, and any completion/compliance claim without executable evidence. No new engine, package, donor extraction, or assembly process is necessary.

**Sufficiency: partial.** The delivery implements a meaningful portion of the approved blueprint, but it does not yet deliver certified continuous placement, authoritative product-policy enforcement, tamper-resistant manufacturing verification, reproducible build/performance, or real Next integration in full.

**Disposition: REWORK this build, then rerun this exact audit.**
