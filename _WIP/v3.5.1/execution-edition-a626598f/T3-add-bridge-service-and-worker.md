# Magnetic Grid v3.5.1 — portable three-rule engine proposal and execution contract

Status: DRAFT FOR DAN REVIEW
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: architecture, code contract, proof contract, and deletion-complete cut-over plan. No implementation is authorized by this document alone.

## 10. Clone → compare → delete execution plan

Every task is one commit, compiles alone, and receives focused tests plus a real surface gate. No push/merge/publication is implied.

### T3 — Add bridge service and worker contract

- Add `magnetic-grid-bridge.ts` and `createMagneticGridSolveService()`.
- Move/adapt shape normalization and field-view mapping.
- Add `law.worker.ts` with one versioned discriminated envelope and Law bridge-service dispatch; do not change the current worker during comparison.
- Law cache identity includes schema, Law version, centre policy, supplied contour and complete Law config. Comparator requests never enter this service.

Gate: request/cache/queue suite passes; direct and worker results are byte-equal.

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

### 6.4 `engine.ts` — one portable API

`engine.ts` sequences calls and assembles typed results only. It contains no parity predicate, ranking tuple, gravity rule, band-ownership rule, flap comparison, refusal policy, geometry arithmetic or UI mapping. Those belong to logic, compute or bridge respectively; the separation guard inspects the engine AST for them.

All result/refusal interfaces shown below are declared in `spec.ts` and re-exported by `engine.ts`; the engine file adds functions, not a second contract owner.

```ts
export interface MagneticGridEngine {
  solveBands(input: SolveBandsInput): AllBandsResult
  inspectFixedSize(input: InspectFixedSizeInput): FixedSizeInspection
  policyIdentityOf(config: ComparisonEngineConfig): string
}

/** Comparison-stage factory. Deleted at T6; final engine exports one locked instance. */
export function createComparisonEngine(): MagneticGridEngine

export interface SolveBandsInput {
  contour: NormalizedBoundary
  config: ComparisonEngineConfig
}

export interface InspectFixedSizeInput {
  contour: NormalizedBoundary
  sizeMM: number
  config: ComparisonEngineConfig
  forcedPhaseMM?: PointMM
}

export interface LawfulRung {
  band: BandId
  scale: ExactScale
  magnetCount: number
  firstLawful: FirstLawfulCertificate
  layouts: readonly LawfulLayout[]
}

export interface LawfulLayout {
  candidateId: string
  layoutId: string
  anchors: readonly Anchor[]
  belt: readonly ExactPoint[]
  centre: CentreDecision
  centreEvidenceId: string
  requiredFlap: ExactReal
  appliedFlap: ExactReal
  contacts: readonly ContactWitness[]
  phase: ExactPoint
  pitchMM: number
  spotRadiusMM: number
}

export interface BandResult {
  band: BandId
  rungs: readonly LawfulRung[]
  refusal?: { code: RefusalCode; evidence: RefusalEvidence }
}

export type AllBandsResult =
  | { status: 'evaluated'; bands: readonly BandResult[]; centreEvidenceById: Readonly<Record<string, CentreEvidence>> }
  | { status: 'refused'; refusal: Refusal; bands: readonly BandResult[]; centreEvidenceById: Readonly<Record<string, CentreEvidence>> }

export interface FixedSizeInspection {
  status: 'inspection'
  candidates: readonly CandidateInspection[]
  // No hidden winner. Each candidate carries centreErrorMM, exact requiredFlap,
  // magnetCount, orientation, and reason codes.
}

export interface CandidateInspection {
  anchors: readonly Anchor[]
  magnetCount: number
  parityTrue: boolean
  centreErrorMM: number
  requiredFlap: ExactReal
  requiredFlapApproxMM: number
  orientation: 'vertical' | 'horizontal' | 'two-dimensional' | 'single'
  concessions: readonly ('CENTRE' | 'WRAP')[]
}
```

The engine evaluates the full user-selectable B1-B4 horizon and returns all lawful rungs and every co-lawful layout at each rung. `candidateId` is a content identity for cache/replay, never a tie-break. The payload stores verdict-changing truth (deduplicated centre evidence by id, phase, belt, required flap); the bridge derives field spots and SVG projections without re-solving. It does not choose a commercial default until Dan rules that product policy. During T0-T5 the bridge passes the complete `CentrePolicy`; `logic.ts` alone owns `evaluateCentreLaw`. T6 deletes the comparison field and alternate logic branches; final `engine.ts` exports one instance wired to the selected centre law.

Identity is canonical exact content, not float/string accident:

```ts
geometryLayoutId = sha256(canonicalJson([
  'layout-v1', inputIdentity,
  canonicalExact(scale.exact), canonicalExactPoint(phase), xParity, yParity,
  sortLex(seated.map(canonicalExactPoint)),
  sortLex(belt.map(canonicalExactPoint)), centre.evidenceId, regimeId,
]))

measuredId = sha256(canonicalJson([
  'measured-v1', engineIdentity, centreDecision.evidenceId, geometryLayoutId,
]))

resultId = sha256(canonicalJson([
  'result-v1', measuredId, policyIdentity,
  sortLex(anchors.map(a => [canonicalExactPoint(a.centre), a.diameterMM])),
  canonicalExact(appliedFlap),
]))
```

`compute/identity.ts` assigns neutral `geometryLayoutId` and `measuredId` to the complete rooted record before Logic sees it. Engine derives `policyIdentity` from the complete config through `policyIdentityOf`; callers cannot supply it. Logic uses `measuredId` for stable ordering and carries the opaque identity; it never hashes or reconstructs geometry. After Logic returns `LawReduction`, engine assembly calls neutral `finalizeResultIdentity()` and exposes `layoutId = geometryLayoutId`, `candidateId = resultId`. Thus two configured outputs with different Coverage, MagnetPlan, flap or centre policy cannot share a content-complete result id, while their neutral geometry identity remains comparable. `canonicalExact` and `canonicalExactPoint` serialize polynomial coefficients, certified expressions, rational isolating bounds and root identity using decimal-string integers. Canonical JSON has fixed tuple order and no object-key ambiguity. A report-only decimal never enters identity. T6 invalidates comparison result caches rather than pretending their ids survive a policy change.

Each rung carries a `FirstLawfulCertificate`: the exact contact witness plus the ordered evidence proving every earlier regime/root candidate for that count absent or unlawful. No sampled predecessor is used as proof.

### 6.5 `magnetic-grid-bridge.ts` — adapters and worker service

Responsibilities:

- accept the same normalized final contour already loaded by the comparison shell; this build does not add ONEMO Studio runtime wiring, re-tracing or a new cutout format;
- convert supplied contour coordinates to exact segment rationals without changing them, attach `BoundaryTruth`, and include ordered contour coordinate bits in contour/cache identity;
- carry adapter provenance and any certified source-error bound as diagnostic evidence only; never add it to flap/contact allowance;
- fixed-size scaling and optional admin outline offset;
- full-content contour identity;
- call public engine `policyIdentityOf(config)` for cache identity; callers cannot supply the id. It derives from schema/Law version plus every comparison config field (centre mode and Masses governor where applicable, flap mode/value/cap, coverage, magnet plan and ruled spec version), and every field mutation changes it;
- cache the all-band result by schema version + engine id + centre-policy id + contour bytes + complete config; derive a selected-band view without re-solving;
- invalidate when any engine input changes;
- ensure clicked rung returns the stored qualifying result, never a re-solve with altered config;
- serialize and carry exact contact witnesses unchanged across engine, worker, cache, and UI; report-only decimals never enter a cache key or verdict;
- convert results to field spots, rings, centre markers, concessions, and refusal copy;
- derive every Law control label, option, bound and default from public engine/spec data and expose them as bridge view models; the page contains no Law number or policy branch;
- expose a testable `createMagneticGridSolveService()` used by the worker.

The new `law.worker.ts` contains only message validation, Law bridge-service call and `postMessage`. The current worker and both comparator code paths remain byte-untouched during proof.

One versioned envelope carries discriminated operations; “one schema” does not mean nullable fields:

```ts
export type SolveOperation =
  | { kind: 'bands'; input: SolveBandsInput }
  | { kind: 'inspect-fixed'; input: InspectFixedSizeInput }

export interface SolveRequestEnvelope {
  schemaVersion: 1
  requestId: number
  engineId: 'v351-law-comparison'
  operation: SolveOperation
}
```

The all-band response already contains complete lawful layouts and their certificates; selecting a rung/layout is a pure lookup by `candidateId`, never another worker operation. Exact integer coefficients and rational terms serialize as decimal strings, so structured clone and canonical JSON are byte-stable across runtimes. At T6, comparison identities are deleted, the schema version increments, and the production cache key contains no dead comparison dimensions.

## 7. Exact algorithms

### 7.1 The supplied final contour is the Law engine boundary

Dan's WYSIWYG law is settled: the final user-edited shape must be the shape displayed, measured, printed and cut. This engine build does not wire ONEMO Studio; the comparison bench already loads premade exported cutouts. Law accepts the same normalized final contour the shell supplies to the existing modes and does not retrace, decimate, smooth or reinterpret it.

Every finite supplied coordinate is converted to its exact IEEE-754 binary rational, preserving the actual input bit pattern with no rounding or policy quantum. `contourIdentity` hashes the ordered coordinate bits. `BoundaryTruth` is carried into every prepared contour, witness, layout identity, worker envelope and cache key. Display and truth dots use the same supplied contour returned with the Law result.

The admitted Law domain is exactly one primitive: line segments from the supplied contour. There is no separate analytic circle, arc or cubic path. Irrational event/contact scales still arise from segment-distance equations and are represented as real algebraic numbers: a square-free integer polynomial, a rational isolating interval containing exactly one root, and its root index. Exact comparison refines isolating intervals or uses sign determination; a displayed `number` never decides a law.

### 7.4 All-band solve

```ts
function solveBands(input: SolveBandsInput): AllBandsResult {
  const evidenceById: Record<string, CentreEvidence> = {}
  const centreVerdicts: CentreLawEvaluation[] = []
  const candidateVerdicts: CandidateLawEvaluation[] = []
  const geometry = computeInputsFromSpec()
  const policy: EvaluationPolicy = { ...input.config, policyIdentity: policyIdentityOf(input.config) }

  for (const band of BANDS) {
    const prepared = prepareContour(input.contour)
    // Compute enumerates ALL geometry/centre branches independent of the selected CentrePolicy.
    const events = enumerateRegimeEvents(prepared, band.id, geometry)
    for (const regime of partitionRegimes(events, band.id)) {
      for (const site of [...regimeBoundarySites(regime), regime]) {
        for (const centreMeasured of measureCentreBranches(prepared, site, geometry)) {
          evidenceById[centreMeasured.evidence.id] = centreMeasured.evidence
          // Logic alone applies the comparison CentrePolicy.
          const centreVerdict = evaluateCentreLaw(centreMeasured, policy.centrePolicy)
          centreVerdicts.push(centreVerdict)
          // Every verdict has a decisions array; refused outcomes carry [] plus their refusal.
          for (const centre of centreVerdict.decisions) {
            for (const measured of measureFourParityCandidates(prepared, centre, site, geometry)) {
              // Compute finishes neutral root measurements before logic judges them.
              for (const rooted of measureContactRoots(prepared, regime, measured, geometry)) {
                candidateVerdicts.push(evaluateCandidateLaws(rooted, policy))
              }
            }
          }
        }
      }
    }
  }

  const reduced = reduceBandLadders(centreVerdicts, candidateVerdicts)
  return assembleAllBandsResult(reduced, evidenceById, finalizeResultIdentity)
}
```

`reduceBandLadders()` in logic considers the complete B1-B4 verdict set before assigning ownership. It owns parity/wrap enforcement, fixed/Auto-cap refusals, first-lawful count selection, cross-band ownership and `RUNG_CONFLICT`. Each accepted rung stores a `FirstLawfulCertificate` proving all earlier regimes/root candidates for that count absent or unlawful. `assembleAllBandsResult()` maps already-decided candidates through neutral `finalizeResultIdentity`, copies the bands/global refusal and attaches evidence; engine does not inspect a law flag or refusal code.

### 7.5 Auto flap

Auto does not scan allowances. For each centre-lawful contact candidate it derives the exact worst-belt required allowance, compares it exactly with the cap, and retains the minimum exact value for that count. Free inspection uses the same certified worst-belt calculation. The UI may show a rounded decimal, but the returned law value and cache identity remain rational/algebraic.

### 7.6 Manual / fixed size

Manual drag is inspection only:

- Recompute centre parity for the forced phase.
- Recompute required flap on the belt.
- Return `centreErrorMM`, `parityTrue`, exact `requiredFlap`, its report-only decimal, and concessions.
- Never return `status:'lawful'` unless all laws pass.
- Never silently set `parityTrue=true`.
- Never insert a manually forced layout into a band ladder or product cache.

### 7.7 Default truth

All public entry points use `SPOT_RADIUS_MM=12`. The 10mm admin slider floor never defaults the engine.

## 8. Control truth contract

| Control | Engine meaning | Required proof |
|---|---|---|
| Band B1-B4 | restrict exact contact-event scale range | every user-selectable band exercised; no cross-band repeat or boundary double-owner |
| Flap fixed | exact maximum worst-belt gap | 0 admits only a certified contact witness; no guard |
| Flap Auto | smallest exact required allowance, capped | 1mm need returns 1mm, never 2mm |
| Centre rule (comparison only) | chooses centre from shape evidence before seats | seat changes cannot change centre |
| Coverage | changes output population only; wrap stays belt-scoped | full/perimeter share wrap truth |
| Magnet plan | changes body diameters only | positions/counts unchanged |
| Manual drag | diagnostic forced phase | concessions measured and visible |
| Outline offset | changes input contour before solve | cache identity and result change |
| Source accuracy readout | evidence about how the contour was produced | never changes wrap law unless Dan separately rules a product allowance |

Production UI after cut-over exposes only product inputs. Comparison controls are deleted, not hidden.

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

### 9.3 Worker/service fixtures

- same request returns byte-equal cached result;
- every input field changes cache identity;
- shape collision attack cannot reuse a result;
- prefetch result equals direct result;
- clicked rung is selected directly from the stored all-band result with zero worker request;
- manual request never enters band cache;
- latest-only queue cannot publish a stale result;
- Auto and fixed flap caches cannot cross-contaminate.
- candidate replay by id returns the exact stored layout; comparison-policy/schema changes invalidate candidate caches while geometry-stable `layoutId` remains matchable.
- contact witnesses and exact scale identities are byte-identical across Node, browser, worker transport, and cache serialization;
- the UI's displayed decimal may change precision without changing lawful/refused state, identity, or truth dots.

### 9.6 Continuing performance gates

- direct fixed-size solve and cold/warm all-band solve are measured through the bridge service at T3-T5;
- cache-off and cache-on figures and §7.3 work counters are retained in the B1-B4 comparison evidence;
- performance thresholds are evidence gates, never substitutes for law tests;
- deployed-current-commit phone verification repeats the physical-phone gate after Dan authorizes publication.

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
