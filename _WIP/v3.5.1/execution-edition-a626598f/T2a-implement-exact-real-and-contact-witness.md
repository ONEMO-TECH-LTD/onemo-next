# Magnetic Grid v3.5.1 — portable three-rule engine proposal and execution contract

Status: DRAFT FOR DAN REVIEW
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: architecture, code contract, proof contract, and deletion-complete cut-over plan. No implementation is authorized by this document alone.

## 10. Clone → compare → delete execution plan

Every task is one commit, compiles alone, and receives focused tests plus a real surface gate. No push/merge/publication is implied.

### T2a — Implement exact-real and contact-witness kernel

- Add rational/algebraic representation, canonical serialization, exact comparison, root isolation, and sign determination for the admitted exact supplied-segment domain.
- Add segment contact/event equations and `ContactWitness`. No float, epsilon, `guardMM`, analytic shortcut or sampled size can certify contact.

Gate: curved supplied contours produce certified non-integer roots through their segments; tangential double root certifies; arbitrarily close near-miss is excluded; Node/browser bytes match.

## 1. Product goal

The engine is one portable three-rule driver:

1. **CENTRE** — at each candidate physical scale, derive one governed centre from that scaled shape alone, before magnets exist. Place the lattice rigidly on that centre: odd line count puts a node on it; even line count puts the gap/centering line on it. The centre may change with physical scale because the safe core/masses change; it may never change because magnets landed somewhere.
2. **WRAP** — every perimeter-belt disc touches the outline within the configured flap allowance. `0` means exact spot-edge tangency on the ruled source geometry; neither outline-source uncertainty nor size-walk quantum becomes hidden wrap tolerance. Auto flap returns the smallest allowance that makes the layout lawful.
3. **MAGNET-QUANTITY SCALING** — within each band, expose every new magnet count at its first exact contact-event scale where that count is simultaneously centred and wrapped. Scale is solved from the contact equation, never searched on a millimetre grid. Counts are unique and strictly increasing. A count first lawful in a lower band never reappears above worn loose.

There is no score, weight, blended preference, silent fallback, or “best attempt” in the production driver. When no lawful layout exists, the engine returns a typed refusal. Fixed-size/manual inspection returns measured concessions; it does not invent a product winner.

Dan's separate gravity ruling is a mechanical invariant, not a hidden fourth driver: among candidates identical on centre, wrap, count, and required allowance, vertical eliminates horizontal. If multiple candidates remain equal after gravity, the engine returns all of them; it never manufactures a winner from coordinate order.

## 2. Governing directive set

The contract must deliver all of these together:

- Build v3.5.1 as a separately selectable comparison path first.
- Treat Voting/scoring as untrusted visual comparator evidence only. Treat accepted Centre-rules centering outputs as the trusted behavioral baseline while its shared door/worker and named 2mm-ruler defects remain untrusted infrastructure. Do not modify either current path during proof.
- Use the proved centering-tab enforcement as the behavioral base: preserve/re-room its accepted centre-rule/governor/parity canon, replace only its documented corrupt measurements/shared infrastructure, prove centre equivalence first, then add Wrap and Magnet-quantity scaling.
- Enforce the three laws as code invariants, not UI descriptions.
- Make every exposed control true to its label.
- Make every concession explicit.
- Split the implementation into portable `spec → compute → logic → engine API`; UI reaches it only through a bridge.
- Prove the new path before removing v3.5.
- Once proved, remove every superseded mode, score, helper, control, cache field, result field, and stale document claim. No permanent parallel engines.

## 3. Necessity baseline — the smallest complete rebuild

### Required additions

One canonical portable package, one product/bench bridge, two executable proof suites:

```text
src/lib/magnetic-grid/
  spec.ts
  compute.ts
  compute/
    exact-real.ts
    seat.ts
    centre-evidence.ts
    regimes.ts
    contact-root.ts
    identity.ts
  logic.ts
  engine.ts
  __tests__/
    separation.test.ts
    law.test.ts

src/lib/effect/magnetic-grid-bridge.ts
src/lib/effect/__tests__/magnetic-grid-worker-service.test.ts
src/app/(dev)/effect-creator/grid-origin/law.worker.ts
src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx
```

The existing `grid-origin` page is the shared comparison shell. It already shows three positioning slots. T4 rewires the existing third **Law** slot to `LawPanel.tsx`; it does not add a fourth tab. Voting and Centre-rules plus their current worker remain untouched. The old in-place `positioning===2` branch becomes dormant evidence until Dan-approved deletion; `law.worker.ts` serves the isolated Law slot. No second page is required.

### Required reuse

**Baseline rule:** the isolated Law package starts from the T0-characterized dependency closure of the current Centre-rules (`positioning===1`) branch. No body reachable only from Voting (`positioning===0`), `registrationScore`, scoring weights/orders, phase sweep or `centeringRef` may be moved or adapted into Law. Voting is visual comparison and later deletion evidence only. Independently proven Wrap/scaling behavior from the old in-place Law branch may be adapted under the table below, but that branch is not the structural baseline.

**Clone-then-re-room order:** first clone the Centre-rules behavioral slice and prove it still produces the accepted centre outputs. Then re-room those same bodies into spec/compute/logic/engine under the dispositions below. Only after the re-roomed centre gate passes may the faulty centre ruler be adapted, then Wrap added, then Magnet-quantity scaling added. This is not bottom-up replacement followed by an equivalence test; the preserved implementation is the starting material.

**What centering is preserved versus repaired:** preserve `governMass` branch semantics, the governor set, centre-rule branch meanings, node/gap parity canon and all four centred placements. T1 clones the current governor body verbatim for the numeric compatibility gate; final Logic adapts only its representation so `ExactReal` values use `compareExact`. Adapt the ruler beneath the rules: current `safeSegments` samples clearance on a fixed 2mm mesh anchored to each scaled bbox, so its argmax jumps between samples as scale changes. Measured result: mesh centre left ~0.069mm contact residue; an exactly computed centre reduced it to ~0.000055mm reporting noise. Because erosion/mass depth is a fixed physical millimetre value while the shape scales, the mass map genuinely changes per scale; computing one normalized centre and scaling it is not equivalent. §7.1b replaces this ruler per scale while §9.2.13 proves the centering rules/accepted answers survived.

Clone a current function body only after T0 proves it neutral, exact for the Law representation, and free of policy/constants; do not alter its current consumers. The clone is explicitly temporary and its donor dies only at Dan-approved cut-over. Initial donor candidates are the exact segment-seat kernel, pure bbox traversal and contour scaling. The current mesh-derived centre evidence, `splitPerimeter`, float tangency/gap helpers, scoring helpers and shape adapters are characterization evidence—not pre-approved reuse.

Every current body receives exactly one T0 disposition before T1: `MOVE-VERBATIM` (function-text hash equal in donor and Law copy), `ADAPT` (reason stated plus equivalence fixture against the donor over the characterized domain), or `DELETE` (violated law or zero-consumer evidence). “Where possible”, silent rewrite and unclassified code are forbidden.

### Elements explicitly preserved

- Perimeter-belt coverage: native product behavior, not slop.
- Magnet plan/diameters: product output configuration, not a ranking force.
- Shape-source and cutout-library bench adapters.
- Legal-area/mass visualization needed to verify centre selection.
- Full-grid visualization as diagnostics; wrap is always belt-scoped.

### Canonical-root decision

`src/lib/magnetic-grid/` is the final magnetic-grid root. `src/lib/grid-engine/` is neither a destination nor an allowed dependency of the final package. T0 must classify every tracked artifact and resolve the active-lane precedence gate before any deletion is authorized. Reuse is **kernel reuse only**: proven function bodies move inward. The old spec values, bridge contract, candidate/offer result shapes, registration doctrine, and package manifests are not inherited merely because they exist.

## 4. Non-goals

- No template catalogue driving search.
- No semantic shape names inside compute.
- No scoring or configurable weights.
- No continuous placement sweep.
- No unruled default layout recommendation inside a band.
- No non-semantic geometry-key winner. Co-lawful layouts are returned with stable identities; deterministic ordering is not product selection.
- No fulfilment, manufacturing-order, or cutout-engine migration in this increment.
- No production publication or deletion before the proof and Dan gates.

## 5. Final architecture

```text
UI (React / admin bench)
  ↓ display actions only
magnetic-grid-bridge.ts
  - contour adapters
  - worker request service + cache identity
  - maps engine results to drawable view models
  ↓ one public engine API
magnetic-grid/engine.ts
  - orchestrates centre → parity candidates → laws → band ladder
  ↓                 ↓
logic.ts          compute.ts
  policy only       geometry only
  ↑                 ↑
          spec.ts
          values + data contracts only
```

### Import law

| File | May import |
|---|---|
| `spec.ts` | nothing |
| `compute.ts` | `spec.ts` and `compute/*` public barrels only; no implementation |
| `compute/exact-real.ts` | `spec.ts` only |
| `compute/seat.ts` | `spec.ts`, `compute/exact-real.ts` |
| `compute/centre-evidence.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts` |
| `compute/regimes.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts`, `compute/centre-evidence.ts` |
| `compute/contact-root.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts`, `compute/centre-evidence.ts`, `compute/regimes.ts` |
| `compute/identity.ts` | `spec.ts`, `compute/exact-real.ts` |
| `logic.ts` | `spec.ts` types/measured records plus only `compareExact` from `compute.ts`; no geometry functions or other compute import |
| `engine.ts` | `spec.ts`, `compute.ts`, `logic.ts` |
| `magnetic-grid-bridge.ts` | public `engine.ts`, shape/vector adapters |
| `law.worker.ts` | Law bridge service only; current worker is outside the new package and unchanged during proof |
| `LawPanel.tsx` | Law bridge view model, actions and control metadata only; never spec/compute/logic/engine |
| existing page | existing comparator imports plus `LawPanel`; owns only the top-level tab selection, never Law state/config/policy |

The separation guard parses imports and ASTs. A convention comment is not enforcement.

## 6. Module contracts

### 6.1 `spec.ts` — values and contracts only

No functions and no arithmetic.

```ts
export type BandId = 1 | 2 | 3 | 4
export type CoverageMode = 'perimeter' | 'full'
export type MagnetPlan = 'all6' | 'all8' | 'corners8'
export type CentrePolicy =
  | { mode: 'box' }
  | { mode: 'core' }
  | { mode: 'weight' }
  | { mode: 'deep' }
  | { mode: 'top' }
  | { mode: 'masses'; governor: 'smallest' | 'deepest' | 'top' | 'top-small' }
export type PointMM = readonly [number, number]
/** Exact values serialize with decimal-string integers so Node/browser/worker/cache bytes agree. */
export type ExactInteger = string
export interface Rational { numerator: ExactInteger; denominator: ExactInteger }
export interface AlgebraicReal {
  polynomial: readonly ExactInteger[]
  isolating: readonly [Rational, Rational]
  rootIndex: number
}
export interface CertifiedExpressionReal {
  expressionHash: string
  expression: readonly (ExactInteger | string)[]
  isolating: readonly [Rational, Rational]
  proofId: string
}
export type ExactReal = Rational | AlgebraicReal | CertifiedExpressionReal
export interface ExactScale {
  exact: ExactReal
  approximateMM: number // report/render only; never gates law
}
export interface ExactPoint {
  x: ExactReal
  y: ExactReal
  approximateMM: PointMM // report/render only
}
export interface Contour { outer: { pts: readonly PointMM[] }; holes: readonly { pts: readonly PointMM[] }[] }
export interface BoundaryElement { kind: 'segment'; id: string; a: readonly [Rational, Rational]; b: readonly [Rational, Rational] }
export interface BoundaryTruth {
  rule: 'supplied-final-contour'
  contourIdentity: string
}
export interface NormalizedBoundary {
  boundary: readonly BoundaryElement[]
  truth: BoundaryTruth
  normalizedLongestSideMM: 1
  displayContour: Contour
}
export interface RegionEvidence { id: string; centres: readonly ExactPoint[]; area: ExactReal; peakClear: ExactReal; rings: readonly (readonly PointMM[])[] }
export type MassEvidence = RegionEvidence
export interface Anchor { centre: ExactPoint; diameterMM: 6 | 8 }
export interface PreparedContour { source: Contour; boundary: readonly BoundaryElement[]; truth: BoundaryTruth; identity: string }
export interface LatticeCandidate { phase: ExactPoint; xParity: 'node' | 'gap'; yParity: 'node' | 'gap'; nodes: readonly ExactPoint[] }
export interface SeatedCandidate extends LatticeCandidate { seated: readonly ExactPoint[] }
export interface BeltResult { belt: readonly ExactPoint[]; interior: readonly ExactPoint[] }
export interface ParityEvidence {
  x: { lineCount: number; centreRelation: 'node' | 'gap' }
  y: { lineCount: number; centreRelation: 'node' | 'gap' }
}
export interface CandidateGeometry {
  band: BandId
  scale: ExactScale
  phase: ExactPoint
  xParity: 'node' | 'gap'
  yParity: 'node' | 'gap'
  parityEvidence: ParityEvidence
  centre: CentreDecision
  centreEvidence: CentreEvidence
  seated: readonly ExactPoint[]
  belt: readonly ExactPoint[]
  seatedCount: number
  beltCount: number
  requiredFlap: ExactReal
  orientation: 'vertical' | 'horizontal' | 'two-dimensional' | 'single'
}
export interface RootedCandidateGeometry extends CandidateGeometry {
  measuredId: string
  geometryLayoutId: string
  regimeId: string
  contacts: readonly [ContactWitness, ...ContactWitness[]]
}
export interface LawfulCandidateMeasurement extends RootedCandidateGeometry {
  anchors: readonly Anchor[]
  coverage: CoverageMode
  magnetCount: number
  parityTrue: true
  wrapTrue: true
  appliedFlap: ExactReal
  policyIdentity: string
}
export interface CentreEvidence {
  id: string
  box: ExactPoint
  core: ExactPoint | null
  weight: ExactPoint
  deepest: readonly ExactPoint[]
  islands: readonly RegionEvidence[]
  masses: readonly MassEvidence[]
}
export interface CentreDecision { target: ExactPoint; policy: CentrePolicy; evidenceId: string }
export interface CentreTie { status: 'tie'; decisions: readonly CentreDecision[] }
export interface RefusalEvidence { readonly [key: string]: string | number | boolean | null }
export interface Refusal { status: 'refused'; code: RefusalCode; evidence: RefusalEvidence }
export interface EvaluationContext { band: BandId; scale: ExactScale; regimeId: string; siteId: string }
export interface CentreBranchMeasurement { context: EvaluationContext; evidence: CentreEvidence }
export interface CentreLawEvaluation { context: EvaluationContext; evidenceId: string; decisions: readonly CentreDecision[]; refusal: Refusal | null }
export type CandidateLawEvaluation =
  | { status: 'lawful'; candidate: LawfulCandidateMeasurement }
  | { status: 'refused'; refusal: Refusal; measured: RootedCandidateGeometry; policyIdentity: string }
export interface LawfulRungDecision { band: BandId; scale: ExactScale; magnetCount: number; firstLawful: FirstLawfulCertificate; candidates: readonly LawfulCandidateMeasurement[] }
export interface BandLawDecision { band: BandId; rungs: readonly LawfulRungDecision[]; refusal: Refusal | null }
export interface LawReduction { bands: readonly BandLawDecision[]; globalRefusal: Refusal | null }
export interface ContactWitness {
  scale: ExactScale
  boundaryTruth: BoundaryTruth
  beltAnchorId: string
  outlineElementId: string
  outlineElementKind: 'segment'
  allowance: ExactReal
  equation:
    | { kind: 'polynomial'; polynomial: readonly ExactInteger[]; rootIndex: number }
    | { kind: 'certified-scalar-root'; expressionHash: string; isolating: readonly [Rational, Rational]; proofId: string }
  tangency: { x: ExactReal; y: ExactReal }
  regimeId: string
  certificateId: string
}
export type RegimeEventKind = 'SEAT_COUNT' | 'PARITY_CLASS' | 'SAFE_TOPOLOGY' | 'CENTRE_IDENTITY' | 'BINDING_ELEMENT' | 'CONTACT_MULTIPLICITY'
export interface RegimeEvent { id: string; kind: RegimeEventKind; scale: ExactScale; evidenceId: string }
export interface Regime { id: string; lo: ExactScale; hi: ExactScale; events: readonly RegimeEvent[] }
export interface FirstLawfulCertificate { regimeId: string; priorEvidenceIds: readonly string[]; contact: ContactWitness }

export const GRID_PITCH_MM = 48
export const SPOT_RADIUS_MM = 12
export const MASS_DEPTH_MM = 16 // calibrated at T6 before production cut-over
export const BANDS = [
  { id: 1, minMM: 24, maxMM: 71 },
  { id: 2, minMM: 72, maxMM: 119 },
  { id: 3, minMM: 120, maxMM: 167 },
  { id: 4, minMM: 168, maxMM: 215 },
] as const

export type FixedFlap = { mode: 'fixed'; allowance: Rational }
export type AutoFlap = { mode: 'auto'; maxAllowance: Rational }
export type FlapLaw = FixedFlap | AutoFlap

export interface EngineConfig {
  flap: FlapLaw
  coverage: CoverageMode
  magnetPlan: MagnetPlan
}
/** Comparison-only ruled input. The enum crosses the bridge; the selection function never does. */
export interface ComparisonEngineConfig extends EngineConfig { centrePolicy: CentrePolicy }
/** Engine-derived internal record; callers cannot supply policyIdentity. */
export interface EvaluationPolicy extends ComparisonEngineConfig { readonly policyIdentity: string }
/** Neutral geometry inputs assembled by engine from spec; contains no policy selector. */
export interface ComputeInputs { pitchMM: Rational; spotRadiusMM: Rational; massDepthMM: Rational }

export type RefusalCode =
  | 'NO_SAFE_CORE'
  | 'NO_CENTRE'
  | 'CENTRE_EVIDENCE_UNRESOLVED'
  | 'CENTRE_TIE_UNRESOLVED'
  | 'NO_PARITY_LAWFUL_PLACEMENT'
  | 'WRAP_EXCEEDS_ALLOWANCE'
  | 'NO_WRAPPED_LAYOUT_IN_BAND'
  | 'AUTO_FLAP_CAP_EXCEEDED'
  | 'RUNG_CONFLICT'
  | 'REGIME_UNRESOLVED'
```

`SPOT_RADIUS_MM` defaults the public API. Slider floors/ceilings belong to the bench UI, not the engine spec.

### 6.2 `compute.ts` — one geometry surface, focused internals

Every export returns a measurement or certificate; it never selects a product answer. `compute.ts` is the public barrel only. Implementation is split under `compute/`: `exact-real.ts` owns rational/algebraic values and comparisons; `seat.ts` owns legality; `centre-evidence.ts` owns safe regions and centre branches; `regimes.ts` owns event enumeration; `contact-root.ts` owns contact equations/witnesses; `identity.ts` owns canonical serialization. This is a layer split inside compute, not six new public abstractions.

The ruled supplied boundary is never decimated, capped or replaced by a mesh inside compute for centre, seat, contact, parity, regime or rung decisions. No internal `MAXV`, sampling step, guard or distance multiplier may exist in a law path. If a later display-only approximation is measured necessary, its parameter lives in spec, its output is typed `DisplayEvidence`, and the separation guard proves it cannot reach any law result.

```ts
export function prepareContour(input: NormalizedBoundary): PreparedContour
export function scaleBoundary(base: NormalizedBoundary, scale: ExactScale): PreparedContour
export function measureCentreEvidence(
  prepared: PreparedContour,
  scale: ExactScale,
  spotRadius: Rational,
  massDepth: Rational,
): CentreEvidence
export function enumerateRegimeEvents(
  prepared: PreparedContour,
  band: BandId,
  inputs: ComputeInputs,
): readonly RegimeEvent[]
export function partitionRegimes(events: readonly RegimeEvent[], band: BandId): readonly Regime[]
/** Enumerates geometry for every centre branch; it never receives or filters by CentrePolicy. */
export function measureCentreBranches(prepared: PreparedContour, site: Regime, inputs: ComputeInputs): readonly CentreBranchMeasurement[]
export function measureFourParityCandidates(
  prepared: PreparedContour,
  centre: CentreDecision,
  site: Regime,
  inputs: ComputeInputs,
): readonly CandidateGeometry[]
export function measureContactRoots(
  prepared: PreparedContour,
  regime: Regime,
  measured: CandidateGeometry,
  inputs: ComputeInputs,
): readonly RootedCandidateGeometry[]
/** Neutral exact ordering only; no policy, geometry lookup or acceptance semantics. */
export function compareExact(a: ExactReal, b: ExactReal): -1 | 0 | 1
/** Neutral post-policy serialization; called by engine assembly, never by Logic. */
export function finalizeResultIdentity(candidate: LawfulCandidateMeasurement): string
export function latticeAtCentre(
  prepared: PreparedContour,
  target: ExactPoint,
  xParity: 'node' | 'gap',
  yParity: 'node' | 'gap',
  pitchMM: number,
): LatticeCandidate
export function seatCandidate(
  prepared: PreparedContour,
  candidate: LatticeCandidate,
  spotRadiusMM: number,
): SeatedCandidate
export function perimeterBelt(points: readonly ExactPoint[], pitchMM: number): BeltResult
export function contactWitnesses(
  prepared: PreparedContour,
  regime: Regime,
  candidate: SeatedCandidate,
  spotRadius: Rational,
): readonly ContactWitness[]
export function beltWithinAllowance(
  witness: ContactWitness,
  allowance: ExactReal,
): boolean // exact algebraic comparison; no epsilon or guard
export function tangencyPoint(witness: ContactWitness): ContactWitness['tangency']
```

For fixed-size inspection only, compute also reports the exact worst-belt required allowance and a report-only decimal approximation. The current v3.5 `impliedFlapMM` already uses worst-disc semantics; it is a donor measurement to certify and relocate, not an incorrect minimum-gap implementation. Truth dots come only from `ContactWitness`; there is no `guardMM` parameter anywhere in the law or drawing API.

## 7. Exact algorithms

### 7.1 The supplied final contour is the Law engine boundary

Dan's WYSIWYG law is settled: the final user-edited shape must be the shape displayed, measured, printed and cut. This engine build does not wire ONEMO Studio; the comparison bench already loads premade exported cutouts. Law accepts the same normalized final contour the shell supplies to the existing modes and does not retrace, decimate, smooth or reinterpret it.

Every finite supplied coordinate is converted to its exact IEEE-754 binary rational, preserving the actual input bit pattern with no rounding or policy quantum. `contourIdentity` hashes the ordered coordinate bits. `BoundaryTruth` is carried into every prepared contour, witness, layout identity, worker envelope and cache key. Display and truth dots use the same supplied contour returned with the Law result.

The admitted Law domain is exactly one primitive: line segments from the supplied contour. There is no separate analytic circle, arc or cubic path. Irrational event/contact scales still arise from segment-distance equations and are represented as real algebraic numbers: a square-free integer polynomial, a rational isolating interval containing exactly one root, and its root index. Exact comparison refines isolating intervals or uses sign determination; a displayed `number` never decides a law.

### 7.2 Complete regime decomposition

A candidate's count, governed centre, parity class, safe topology, and binding outline element can all change with scale. Therefore no size walk or monotonicity assumption may define the ladder.

For each band, enumerate and exactly isolate every verdict-changing event root:

1. `SEAT_COUNT`: a disc reaches/leaves exact legality;
2. `PARITY_CLASS`: a scaled bbox side crosses its parity boundary;
3. `SAFE_TOPOLOGY`: erosion component or depth-mass birth/death/split/merge;
4. `CENTRE_IDENTITY`: area/depth ties, upper-half membership crossings, or clearance-maximum branch swaps;
5. `BINDING_ELEMENT`: two outline elements become equally binding for a belt disc;
6. `CONTACT_MULTIPLICITY`: simple/tangential contact roots and coincident branches.

Sort exact event scales. The regimes are the open intervals between them plus every boundary point as its own evaluation site. No regime is discovered by stepping, and a boundary cannot silently belong to two bands. Within a regime, centre branch, topology, parity and binding identities are stable; `contactWitnesses()` derives every contact root for every parity candidate and belt-disc/outline-element pair. Multiple/equal-end-sign roots are isolated algebraically, not inferred from endpoint signs. A tangential root is a rung only when the exact polynomial/sign certificate proves equality; an arbitrarily close near-miss is excluded.

### 7.3 Work bound, certified pruning, and instrumentation

The solver is output-sensitive, but its worst case is stated rather than hidden. Per band define:

- `E`: boundary elements;
- `P ≤ 4`: parity candidates per centre branch;
- `D`: maximum belt discs on a candidate;
- `M`: event polynomials produced by all six event families;
- `S`: open regimes plus boundary evaluation sites after event roots are sorted;
- `K ≤ E`: maximum elements per disc whose certified distance bounds still allow them to bind inside one regime.
- `J ≤ S`: distinct centre-evidence sites after identity-keyed cross-regime reuse;
- `A`: total exact offset-arrangement primitives/intersections processed per centre site across legal-island and depth-mass thresholds;
- `V`: generalized Voronoi/medial-axis maximum candidates evaluated per centre site;
- `H`: hierarchical branch-and-bound cells explored per centre site.

The number of isolated roots is bounded by:

```text
I_band ≤ roots(M event polynomials) + S × P × D × K contact roots
C_centre ≤ J × (A log A + V + H)
```

Exact ordering/sign comparisons are bounded by `O(I_band log I_band + S × P × D × K + C_centre)`. Event generation is output-sensitive; its honest unpruned ceiling is `M = O(E² + P × D × E)` because topology/binding swaps may be pairwise. With no useful pruning, `K = E`, so the contract makes no false linear-time claim. The benchmark records `E, P, D, M, S, K, I_band, J, A, V, H, C_centre`, contact-vs-centre exact-comparison counts, peak worker memory, and wall time for every band. A timing without every counter is not feasibility evidence.

Three certified reductions keep normal work below that ceiling without changing answers:

1. **Binding-element pruning:** an element is discarded for a disc/regime only when its interval lower distance bound is strictly above another element's certified upper bound throughout that regime. The surviving co-nearest set defines `K`; no heuristic nearest-edge cutoff exists.
2. **Regime stability:** after `BINDING_ELEMENT` events partition the scale axis, only the certified binding/co-binding elements in that regime receive contact equations. A change of binder is itself an enumerated boundary, so pruning cannot step over it.
3. **Cross-regime reuse:** canonical event polynomials, isolated roots, exact centre branches, offset arrangements, certified integrals, maximizer candidates, seat results and distance bounds are memoized by contour identity + exact scale/event/branch identity. `J` counts cache misses only; every site still references a certificate. Reuse changes cost only; certificates and results are byte-identical with caches disabled.

The exact-real representation is provisional until the T1b feasibility gate passes. Failure causes representation/pruning redesign—such as certified interval filtering followed by exact algebraic work only on the surviving binders—never a tolerance, sampled size, missed regime, or weakened law.

## 9. Proof contract

### 9.1 Module separation

AST/import guard asserts:

- spec has no functions/arithmetic;
- compute imports spec only through the declared internal DAG and has no policy selection, ranking or UI imports;
- logic imports spec/measured records only and has no geometry arithmetic or geometry functions;
- engine is the only compute+logic orchestrator and contains no law predicate, ranking, geometry arithmetic or view mapping;
- bridge is the only adapter/caching surface;
- `law.worker.ts` imports the Law bridge service only; the current worker is outside the Law module file set and must remain hash-identical during comparison;
- `LawPanel.tsx` imports bridge/view types/actions only, carries no Law numeric literal, and cannot read current `grid-origin.*` state;
- the existing page adds only the top-level Law tab selector/mount; the pre-existing comparator source regions and every old module/worker hash remain equal to T0;
- every Law control label, option, bound and default in the rendered model traces to spec through engine API and bridge; no UI hardcode can pass by falling below a numeric threshold.
- compute APIs reject policy-bearing configs at compile time; for identical boundary/geometry inputs, event sets and centre-branch measurements are byte-identical across every `CentrePolicy` combination because logic filters only after measurement.
- engine AST contains no `parityTrue`/`wrapTrue` read, flap comparison, refusal-code switch, first-lawful/count ownership or conflict reducer; those symbols/functions are logic-owned and engine only calls `reduceBandLadders` then assembles its returned decision.
- the Law package contains no Voting-only symbol/body/import (`registrationScore`, orders/weights, phase sweep, `centeringRef`, voting config); T0's Centre-rules donor allowlist is the only initial reuse surface.
- Logic's only compute import is `compareExact`; the guard rejects every geometry/identity/root import and any native numeric comparison of `ExactReal` law values.

### 9.2 Three-law fixtures

1. **Centre:** odd single sits exactly on governed centre; even pair midpoint/centering line equals it; off-centre manual phase returns `parityTrue=false` and an explicit concession.
2. **Wrap:** flap 0 rungs carry a certified spot-edge `ContactWitness`; integer size scans find no circle/ellipse rungs while solve-not-search finds and certifies them; adapter source variation cannot widen the gate.
3. **Scaling:** across B1-B4, counts are unique and increasing; each rung is first lawful size for that count; no lower-band count repeats.
4. **Auto:** first lawful 1mm requirement returns 1mm; cap refusal is typed; Free and band use identical worst-belt measurement.
5. **Defaults:** public empty config uses 12mm spot radius; 24/72/120 standards are tangent.
6. **Gravity:** equal lawful pair chooses vertical; non-equal candidates are not relabeled a gravity tie.
7. **Truth dots:** rendered only from stored `ContactWitness` points; allowance-ring contact earns no spot dot; deleting any witness deletes its dot.
8. **Centre ties:** equal-evidence centres return a typed tie set in comparison; production centre law is proved total before cut-over.
9. **Identity:** Node and browser recomputation produce byte-identical `layoutId`/`candidateId`; anchor order and float formatting mutations cannot change identity.
10. **Regime completeness:** a sub-1mm narrow regime, equal-end-sign two-root case, unchanged-topology centre branch swap, mass birth/death, parity flip, binding-element swap, exact tangential double root, arbitrarily close near-miss, and band-boundary root are each asserted. Disabling any event family must delete or mis-own a known lawful rung and fail its fixture.
11. **One supplied contour:** Voting, Centre-rules and Law receive the same premade normalized contour during comparison; Law returns that contour unchanged for display/truth dots. Mutating the Law adapter to retrace, decimate, smooth or substitute a separate circle/curve primitive must fail the fixture.
12. **Certified centre evidence:** prior mesh-residue and sliver-hijack fixtures, near-equal maxima with a proved winner, exact-equal maxima preserved as a tie, and an unresolved enclosure returning `CENTRE_EVIDENCE_UNRESOLVED`; segment/traversal reorder mutations cannot change the result.
13. **Proven centering base:** for every §9.4 matrix shape, every B1-B4 comparison scale and every `CentrePolicy` combination, isolated Law selects the same governing mass/evidence branch and the same node/gap parity placement as the accepted Centre-rules tab. Differences require a named defect-allowlist entry identifying the old mesh/sliver/seat-derived/tie failure, old/new evidence side by side, and Dan review before T5; an unlisted difference fails.
14. **Typed law/refusal flow:** parity failure, fixed-flap failure, Auto-cap exceeded, no-safe-core/no-centre, centre tie/refusal, no wrapped layout and rung conflict each produce the declared discriminated verdict and survive engine assembly. Centre verdicts preserve band/scale/regime/site `EvaluationContext`; candidate refusals preserve the full rooted record. None may become an uncontextualized empty band or disappear. Mutations that drop context, filter `parityTrue`, compare flap, choose first-lawful count or switch refusal codes in engine must fail the separation guard.
15. **Self-contained rooted measurement and identity:** before Logic, every rooted candidate carries x/y parity evidence, exact scale/band/regime context, both seated/belt populations and counts, non-empty contact witnesses and canonical neutral `measuredId`/`geometryLayoutId`. Lawful and refused verdicts preserve that record byte-for-byte. After Logic, result identity includes engine-derived complete `policyIdentity`, final anchors and applied flap. Every config mutation changes result/cache id while neutral geometry ids remain stable. Removing any field, moving neutral identity after Logic, accepting caller-forged policy identity, reusing a result id across distinct configs, importing identity/geometry into Logic, or replacing `compareExact` with native number comparison must fail.
16. **Coverage truth:** the same rooted record exposes both `seatedCount` and `beltCount`. Full versus Perimeter changes final count, anchors, policy/result identity and ladder ownership where populations differ, while preserving the same neutral geometry ids and belt contact witnesses. Compute outputs remain byte-identical across Coverage values; mutations that freeze one pre-policy `magnetCount` fail.

### 9.4 Visual comparison matrix

Square, circle, pill, tall rectangle, wide rectangle, duck, bot, and batwoman; B1-B4; Voting and Centre-rules comparators beside isolated Law. The old in-place Law result may appear only as labeled historical evidence, never as a fourth live tab. Every frame shows centre target, belt, spot tangencies, required/applied flap, count, size, and refusal/concession state.

Dan’s “proven” gate requires all four user-selectable bands, B1-B4.

### 9.5 Exact-engine feasibility — early blocking gate

Before T2 locks the exact-real representation, run an instrumented vertical slice of the intended production kernel through the real worker call shape on the actual premade cutout contours already used by the comparison bench: cutout(4), cutout(9), and the highest-segment supplied fixture. Record the supplied segment count; reconstructed source complexity is not evidence. For each, execute the complete cold B1-B4 exact solve with caches disabled, then enabled, recording every §7.3 work counter and peak worker memory.

These limits are **provisional engineering gates**, not attributed to a Dan ruling. T0 records their owner, declared desktop, declared production-floor phone, and measured pre-spike baseline; Dan may ratify or replace the product envelope before T1b starts. The exact numbers used by T1b are frozen with that provenance before measurement, never adjusted after seeing a result.

Pass requires, for each shape:

- cold full B1-B4 solve ≤ **1.0s on the declared development desktop**;
- cold full B1-B4 solve ≤ **2.0s on one declared physical production-floor phone** through its real browser/worker runtime—not emulation or desktop throttling;
- no main-thread task > **50ms** while the worker solves;
- peak worker memory ≤ **128MB**;
- cache-off and cache-on results/certificates byte-identical.

The evidence records device model, CPU/OS/browser, build commit, contour identity, segment count, per-band counters, timings, memory, and raw result hash. A deployed preview is not required: the physical phone may load the local immutable build over the development network. If either real shape fails any limit, T2 is blocked and the representation/pruning design is revisited. The law, exact witness, full regime set, and raw-result contract may not be relaxed to pass performance.

## 11. Acceptance criteria

### Product

- [ ] Exactly one production engine exists.
- [ ] Centre is derived from shape evidence before seats.
- [ ] Production centre law is total: one centre or typed refusal, never an iteration-order tie-break.
- [ ] Flap 0 rungs carry a certified spot-edge contact witness at a solved exact scale; no policy tolerance or size scan is added.
- [ ] Auto returns the minimum exact required allowance; Free and band agree.
- [ ] Every B1-B4 rung is the first lawful size for a unique increasing count.
- [ ] No silent fallback or concession exists.
- [ ] No score/weight/preference exists in production engine code.
- [ ] Co-lawful comparison ties remain explicit until a ruled production law resolves them.

### Architecture

- [ ] Portable package imports no React, Next, app, browser, or filesystem code.
- [ ] UI imports only bridge/view contracts.
- [ ] Worker is transport only; bridge service owns tested orchestration.
- [ ] Spec/compute/logic/engine import law passes.
- [ ] Public default is the released 12mm spot radius.
- [ ] Candidate identity is exact-canonical and byte-equal across Node/browser replay.
- [ ] Exact scale/contact certificates are byte-equal across Node, browser, worker transport, and cache replay.
- [ ] Law admits supplied contour segments only and returns the same contour for display/truth dots; no analytic or retraced alternative exists.
- [ ] The three actual supplied-contour full B1-B4 exact solves pass the T1b desktop/physical-phone time, main-thread, and memory limits before T2a locks the representation.

### Cut-over

- [ ] Old magnetic-grid authorities and comparison UI are deleted after proof, consumer migration, and Dan's active-lane precedence ruling.
- [ ] Re-export-aware search finds no old public consumer.
- [ ] No old persisted key can configure the new engine.
- [ ] No `panMM`, weights, phase sweep, or `seatMarginMM` residue remains.
- [ ] Documentation describes only current code.

## 12. Risks and gates

| Risk | Required gate |
|---|---|
| Temporary comparison becomes permanent | T5 Dan “proven” immediately releases T6-T8; no open-ended dual runtime |
| Centre rule remains undecided | T6 is a blocking product gate before cut-over |
| Numeric scale or source accuracy hides flap | Exact rational/algebraic witness; adapter uncertainty is evidence, never added allowance |
| Adapter changes the boundary being solved | Law adapter is pass-through; same supplied contour identity feeds solve, display and truth dots |
| Exact solver misses a narrow/branch-changing regime | Exact event enumeration plus mutation fixtures for every event family |
| Exact solver is correct but unusable on mobile | T1b measures the actual supplied contour fixtures on desktop and a physical production-floor phone before T2a; fail redesigns representation, never law |
| Worker serves stale/wrong rung | Request-sequence suite before UI proof |
| Temporary neutral-body clone diverges | Byte-equality fixture against donor during comparison; old provider deleted only at Dan-approved cut-over |
| Over-deletion removes product behavior | Belt and magnet-plan explicitly preserved; kill evidence bar required |
| Cut-over destroys the active v3.2 grid-engine lane | T0 records ownership; Dan's lane-precedence ruling gates every modification/deletion |

## 13. Open decisions — Dan only

1. Final governed-centre rule after comparison evidence.
2. Which bench diagnostics remain visible after cut-over (they do not enter the engine API).
3. Whether any commercial default rung is selected outside the engine; the engine itself returns all lawful rungs.
4. Production handling of co-lawful layout ties; centre ties must be eliminated by the selected total centre law.
5. Lane precedence for the active `src/lib/grid-engine/**` v3.2 rebuild versus v3.5.1 cut-over. Until ruled, v3.5.1 may inventory and design migration only; it may not modify or delete that lane.

Decisions 1-4 do not block T0-T5; they block T6 and final cut-over. Decision 5 does not block read-only T0 or isolated `src/lib/magnetic-grid/` construction, but it blocks any modification, migration, or deletion of the active v3.2 lane.

## 14. Necessity and sufficiency verdict

**Necessity — no unnecessary elements.** The temporary third Law path is explicitly authorized and bounded by Dan's proof/delete gate. Existing Voting/Centre-rules code and worker remain untouched; Law adds only its portable package, pass-through bridge, separate worker and one shell tab. Segment-only exact solving is the smallest complete domain for the supplied contours. Exact offset/centre certification is required because centre is one of the three laws and the current mesh is a measured corruption source; it replaces rather than layers over that mesh. The focused compute internals each own a distinct proof domain behind one public surface; they prevent a replacement monolith rather than add public layers. T1b is the smallest gate that can falsify the exact-real representation before product construction; it adds no product surface. No Studio integration, scoring, template catalogue, migration framework or speculative product feature is added.

**Sufficiency — delivers the directive in full.** The contract builds a separate third Law tab enforcing Centre, Wrap and Magnet-quantity scaling over B1-B4; keeps both untrusted comparators untouched through proof; enforces spec/compute/logic/engine/bridge/UI boundaries; constructs centre evidence with exact topology and certified optimality/tie/refusal results; solves the supplied final contour exactly; carries raw lawful ties/refusals; proves worker/cache/runtime fidelity and mobile feasibility; and defers every replacement/deletion until Dan's final live tests. Completion is impossible while a layer leaks, a centre is sampled rather than certified, a law is unproved, a regime can be missed, the exact representation misses its mobile envelope, or the final Dan-approved cut leaves a superseded magnetic-grid authority behind.

**Deslop — deletion remains complete but no longer speculative.** T0 inventories both old families and active ownership before T1 moves code. T7 consumes that manifest in consumer-before-provider order after the lane-precedence ruling. The final state still permits one magnetic-grid authority only; unrelated reusable primitives must move to their true owner rather than preserve a misleading `grid-engine` shell.
