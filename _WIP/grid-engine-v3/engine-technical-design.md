# Grid Engine Technical Design

Status: draft implementation design mapped to [`engine-contract.md`](./engine-contract.md)  
Rule: no code begins until Contract QA and Meta accept this design against every EC checkpoint.

## 1. Minimal design

The smallest complete mechanism is one deterministic candidate pipeline:

1. Prepare the immutable traced outline once.
2. Compute each experimental centre once.
3. Build the parity-registered band lattice for bands 2, 3 and 4.
4. Generate the finite magnet arrangements permitted by the pair/fold laws.
5. Derive the scale intervals where every disc in each arrangement is supported.
6. Measure each candidate without choosing a winner.
7. Cache the complete answer.
8. Apply a selected candidate directly to the canvas from its returned coordinates.

No second solver, arbitrary subset enumeration, shape classifier, free lattice translation, continuous render-loop calculation or mandatory worker is required.

Necessity: no unnecessary elements.  
Sufficiency: the design covers every contract feature; unresolved product definitions remain reported measures, never invented rejection rules.

## 2. Feature ownership

| Feature | Contract | Production owner | Test owner |
|---|---|---|---|
| F1 · Inputs and laws | EC-2.*, EC-3.*, EC-4.*, EC-8.1–8.3 | `spec.ts`, engine public types, `bridge.ts` | separation + mutation tests |
| F2 · Candidate enumeration | EC-1.*, EC-5.*, EC-11.1–11.4 | pure engine candidate pipeline | independent dense oracle |
| F3 · Measurements and answers | EC-6.*, EC-11.5, EC-12.*, EC-13.* | pure engine geometry/metrics | analytic fixtures + oracle |
| F4 · Applied comparison | EC-7.*, EC-11.6–11.8 | bridge plus admin shell | browser geometry probe |
| F5 · Responsive execution | EC-8.4–8.14 | cached solver runner | interaction trace + mobile profile |
| F6 · Proof corpus | EC-9.*, EC-10.*, EC-11.9–11.10 | test fixtures only | QA and Meta |
| F7 · Scope and closure | EC-0.*, EC-14.*, EC-15.* | delivery artifacts | QA and Meta matrices |

## 3. Data contract

### 3.1 Request

`SolveRequest` contains:

- immutable outline points in outline coordinates;
- guarded grid specification;
- centre methods to compare;
- bands `[2, 3, 4]`;
- population pitches `[48, 96]` for the admin proof run.

It contains no requested shape size, target answer, shape identity, free translation or ranking weights.

### 3.2 Candidate identity

`CandidateId` is a stable encoding of:

- outline fingerprint;
- grid-spec fingerprint;
- centre method;
- population pitch;
- band;
- published even size;
- law-generated magnet coordinates.

The magnet set is never chosen from arbitrary subsets. It comes from the finite pair grammar in §4.3 and is then tested against material. This keeps pairs, rectangles and L populations available without `2^81` combinations or a maximum-magnet objective.

### 3.3 Candidate answer

`GridCandidate` contains all EC-6 fields:

- band, size, width, height and uniform scale;
- centre method and centre;
- pitch and registration;
- exact magnet coordinates, count and extents;
- minimum clearance and binding magnet/edge;
- per-cell/per-side coverage;
- measured top support;
- measured uncovered area/flap;
- one per-cell symmetry-balance record;
- rejection facts that reference EC IDs.

`topSupport` and `flap` are evidence fields only. Until EC-13.5 and EC-13.6 are ruled, they cannot set `lawful=false`.

### 3.4 Result

`SolveResult` contains:

- all candidates grouped by pitch → band → centre method;
- rejected band/scale states with exact invariant failures;
- solve provenance and timing;
- no preferred candidate.

## 4. Pure candidate pipeline

### 4.0 Establish and expose the starting-band policy

`BandStartPolicy` is a test-instrument option, not a hidden engine default. Each registered policy is a small pure mapping from bbox measurements and derived band spans to band 2, 3 or 4. Every policy must carry provenance; the build cannot invent an unnamed threshold.

For a selected policy the engine:

1. computes the bbox facts once;
2. selects the starting band;
3. solves that band;
4. advances only when the current band has no lawful candidate;
5. stops at a found-and-applied match or proof that none exists within the 9×9 ceiling.

The admin instrument runs every registered policy on the real corpus. No policy becomes a product default in this iteration.

### 4.1 Prepare outline once

Create immutable edge records from consecutive outline points:

- endpoints;
- vector and squared length;
- bounding box;
- winding contribution.

This moves repeated edge preparation out of every size and magnet check. It does not simplify or alter the outline.

### 4.2 Compute centres once

Run the six existing centre methods once per outline/spec input:

- box;
- oriented box, without rotating the outline;
- area;
- perimeter;
- vertices;
- maximum clearance.

Replace the authorless `/2/2/2/2` maximum-clearance resolution with adaptive refinement:

1. refine the centre estimate;
2. solve the candidate table;
3. refine again;
4. stop only when another refinement produces the identical published candidate IDs and binding results;
5. report failure to converge instead of accepting an unstable answer.

The stopping condition is the published engine answer, not a new millimetre tolerance. The independent dense oracle attacks the result at a finer refinement to confirm stability.

### 4.3 Construct one unmoved lattice and finite arrangement grammar

For each pitch and band:

1. derive point/gap registration from band parity;
2. generate the band's `n × n` window from the one base lattice;
3. thin that fixed population for 96mm;
4. generate arrangements from law 11.2: pairs about the fold, optional centre for odd bands, Cartesian products for rectangles, and unions of a horizontal and vertical run for L/triangle-like support;
5. include every permitted extent inside the band rather than only the largest one;
6. never translate the lattice to improve an answer.

The grammar produces 1×2, 2×1, 2×2, L-shaped and larger arrangements without classifying the cutout. It is finite because bands stop at four positions per axis in this iteration. No arrangement is preferred because it contains more magnets.

### 4.4 Derive lawful scale intervals

Use the already proven non-monotonic event-scale method rather than rescanning geometry during every interaction:

1. For each magnet in every law-generated arrangement, solve all scale intervals where signed distance to the locked outline is at least `paddingMM`.
2. Preserve multiple disjoint intervals; concave legality may enter and later leave.
3. Merge all interval endpoints into one ordered event stream.
4. Intersect the member intervals for each arrangement. Every surviving interval is a scale range where the whole arrangement is lawful.
5. Intersect each interval with lawful even-millimetre publication steps.
6. Emit every even size inside the interval, not only the first.

The proof harness remains the oracle seed, not production code. Production and oracle implementations must remain independent.

### 4.5 Determine whether an arrangement is offered

For every published size:

1. take one arrangement produced by the pair grammar;
2. require every member disc to be supported throughout the exact interval;
3. require at least one non-pivoting horizontal or vertical pair;
4. reject only settled hard laws: full-disc support, pair floor, field ceiling and fixed registration;
5. measure tightness, coverage, top support, flap and per-cell symmetry balance without applying unruled thresholds;
6. retain smaller and partial arrangements beside larger ones—magnet count is never the optimisation objective.

This avoids arbitrary subset enumeration and maximality. The iteration's bands stop at four positions per axis, so the finite grammar remains small and independently enumerable by the oracle.

### 4.6 Deduplicate without deleting variations

Candidates with identical `CandidateId` collapse to one record. Different even sizes remain separate even when their magnet set is unchanged, because Dan required every size step. No cross-method or cross-band deduplication hides an option.

## 5. Measurements

### 5.1 Full-disc support

For a lattice point `q` and uniform scale `s`, transform `q` into immutable outline coordinates and evaluate signed distance against prepared edges. The disc is supported exactly when the scaled distance is at least `paddingMM`.

The applied canvas probe independently measures the drawn disc against the drawn polygon. It cannot call the production support function.

### 5.2 Binding explanation

For every candidate, retain the magnet and outline edge producing minimum clearance. This is the answer to EC-6.10 and explains what set the size. For each arrangement, identify the first lawful published value inside its exact interval and report its publication overshoot from the binding contact. This is the tight-fit candidate; larger values with the same arrangement remain browsable but cannot be called optimal.

### 5.3 Coverage

Measure and report, without thresholding:

- supported-cell count per left/right/top/bottom side of the selected centre lines;
- material area or sampled contour reach assigned to each cell;
- maximum material-to-nearest-magnet distance;
- uncovered area by side/quadrant.

The exact coverage implementation must be independently checked against synthetic polygons with analytic area before it can pass EC-6.11.

### 5.4 Per-cell symmetry balance

Report one symmetry-balance record, judged per cell about the horizontal and vertical centre lines:

- left/right and top/bottom coverage differences;
- magnet-population centre relative to each experimental shape centre;
- population spread/covariance relative to the shape;
- support-clearance spread.

Coverage remains a separate raw measure. No aggregate score or precedence exists in this iteration.

### 5.5 Top support and flap

Record observable raw facts only:

- supported magnets and covered material above/below the selected horizontal centre line;
- uncovered material extent and area per side/quadrant.

The comparison instrument exposes these results so Dan can define EC-13.5 and EC-13.6 from real cutouts.

## 6. Execution and cache

### 6.1 Trigger

The runner starts only when the outline fingerprint or complete guarded grid-spec fingerprint changes. Centre browsing, candidate selection, pinch, resize, pan, drag and camera movement never trigger it.

### 6.2 Cache

Use one bounded in-memory cache keyed by the request fingerprint. Cache the immutable `SolveResult`. Loading the same saved cutout/spec reuses it.

No database, persistence layer or general cache abstraction is required for the admin proof.

### 6.3 Responsiveness decision

First implement the decoupled cached runner and measure EC-8.13. If calculation still blocks input or animation, a later reviewed implementation may move the same pure request/result boundary to one Web Worker. The worker is not part of this baseline design and would add no second solver or alternate data model.

This is a measured escalation, not a mandatory architecture.

## 7. Applied comparison instrument

### 7.1 Browse, do not recompute

The admin shell receives `SolveResult` through the bridge and renders selectors for pitch, band, centre method and candidate step. Changing a selector reads a cached candidate only.

### 7.2 Apply exact answer

Applying a candidate sets presentation state from one immutable answer:

- shape box from candidate size/aspect;
- centre method and centre;
- registration;
- visible candidate magnet coordinates;
- metrics and binding explanation.

Manual pan is disabled or reset while an engine candidate is applied because free translation is not part of the candidate. Leaving comparison mode restores manual scaffold interaction.

### 7.3 Visual proof

The canvas draws:

- locked outline;
- faint complete lattice;
- candidate magnets as full 24mm discs;
- optional measurement overlays outside the neutral drawing layer;
- candidate facts outside the canvas.

The browser proof reads actual SVG coordinates and independently recomputes disc containment. Screenshots accompany the numeric probe; neither substitutes for the other.

## 8. Verification design

### 8.1 Independent oracle

Keep a deliberately slower dense oracle in tests. It:

- scans every even size;
- evaluates signed distance independently;
- independently enumerates only the fixed band, lawful pair grammar, lawful parity registration, selected centre method and one unmoved lattice;
- applies no magnet-count maximality objective;
- compares the complete candidate-ID set with production output.

The oracle shares types and fixtures only—no production geometry helpers.

### 8.2 Synthetic fixtures

Each EC-10 fixture declares why it exists and the exact invariant it can falsify. Analytic fixtures prove arithmetic; free-shape and concave fixtures attack the mission. Winding and transparent-margin pairs must yield identical candidate sets.

### 8.3 Real-cutout corpus

All seven saved PNGs remain immutable fixtures. Each run records source image hash, traced-outline hash, pitch, band, centre method, candidate count and applied screenshot/probe artifact.

### 8.4 Performance evidence

Instrument solver invocation count and duration. During a scripted pinch/pan/resize sequence the required solver invocation count is zero. Record browser long tasks, memory and input latency on mobile Safari with the largest traced outline.

### 8.5 Guard evidence

The structural separation suite enumerates every law key from the spec and mutation-tests direct object writes, sibling-key writes, computed property writes, aliases and equivalent numeric spellings. Every accepted runtime change is observed through the single guard; every bypass fails before merge.

### 8.6 Verdict evidence

The final keeper verdict compares candidates only through coverage and per-cell symmetry balance. Sizes and millimetres remain candidate facts and manufacturing outputs, never the reason one algorithm is accepted.

## 9. Minimal code shape

### 9.1 Keep and move

- Keep `spec.ts` as values and guard only.
- Keep `bridge.ts` as the public wiring door; add no geometry.
- Keep exact field/lattice primitives in `engine.ts`.
- Move existing outline centre and distance code unchanged into `engine/outline.ts` before modifying it.
- Add `engine/candidates.ts` for interval enumeration and candidate assembly.
- Add `engine/metrics.ts` only for the independently testable coverage/balance measurements.
- Add `runner.ts` only for request fingerprinting, cache and optional async boundary.
- Keep browser tracing in `ui/trace-cutout.ts`.
- Extend the existing page and canvas; create no second admin route.

### 9.2 Delete or replace

- Replace the current first-fit `compareCentres` path; do not retain it beside the candidate pipeline.
- Delete the chained `/2/2/2/2` precision when adaptive stability lands.
- Replace stale first-fit matrix evidence and numbers.
- Do not retain a hidden legacy solver behind a flag.

### 9.3 Do not add

- no shape classifier;
- no arbitrary subset generator;
- no free-offset placement search;
- no ranking framework;
- no mask or pattern engine;
- no persistence/database;
- no general job system;
- no mandatory worker before measurement;
- no production Cutout Lab integration.

## 10. Contract coverage

| Design section | Positively answers |
|---|---|
| §3 request/answer types | EC-1.*, EC-2.*, EC-6.* |
| §4 candidate pipeline | EC-3.*, EC-4.*, EC-5.*, EC-11.1–11.4 |
| §5 measurements | EC-6.9–6.17, EC-11.3–11.5, EC-12.*, EC-13.* |
| §6 execution/cache | EC-8.4–8.14 |
| §7 applied instrument | EC-7.*, EC-11.5–11.8 |
| §8 verification | EC-0.*, EC-9.*, EC-10.*, EC-11.*, EC-15.2–15.13 |
| §9 code shape and exclusions | EC-8.1–8.3, EC-14.*, EC-15.1 |

## 11. Deslop review

| Candidate | Disposition | Evidence |
|---|---|---|
| Current first-fit `compareCentres` | REPLACE | partial mission; retaining it creates parallel truth |
| Existing centre/distance geometry | MOVE + KEEP | proven by oracle and Meta; one source only |
| Arbitrary magnet-subset enumeration | DO NOT BUILD | combinatorial, violates the pair grammar and reintroduces maximality |
| Shape classification | DO NOT BUILD | forbidden by blindness law |
| Worker | DO NOT BUILD YET | measurement may justify a later reviewed escalation |
| Separate comparison route | DO NOT BUILD | existing admin shell already owns the testing surface |
| Ranking/default system | DO NOT BUILD | product precedence unresolved |
| Old first-fit report/evidence | REPLACE | two live mismatches and wrong deliverable shape |

No deletion occurs during design. Any material deletion is reviewed against actual import traces when implementation reaches that step.

## 12. Build order and gates

1. Freeze contract and technical design after Lead QA and Meta review.
2. Characterize current geometry helpers before moving them.
3. Introduce request/result types and independent oracle.
4. Build interval enumeration until the complete candidate set matches the dense oracle.
5. Add measurements as separate raw outputs.
6. Replace first-fit integration; remove the old path in the same snapshot.
7. Add cached runner and prove zero solver calls during interaction.
8. Add applied candidate browsing and independent SVG probe.
9. Run every synthetic fixture and all seven real cutouts.
10. Measure mobile Safari; add the worker only if evidence requires it.
11. Builder completes the EC matrix.
12. QA and Meta independently complete their matrices on one frozen snapshot.

No build-ahead crosses a failed gate.
