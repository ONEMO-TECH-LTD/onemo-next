# Magnetic Grid v3.5.2 — portable three-rule engine and live comparison tab build contract

Status: canonical v3.5.2 master contract
Version: v3.5.2-2 — full vertical Centre-rules clone in T1; scaling = even-millimetre walk on the 1 mm ruler (Dan ruling 2026-08-23)
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: code reconstruction of the portable engine and live comparison tab only.

## 10. Engine and live-tab build sequence

Every semantic code change is one rollback commit and compiles/runs before the next code change. T1-T4 build the working code first. The optional §9 proof/audit work may follow after the build and does not authorize extra engine infrastructure. No push/merge/publication is implied.
### T4 — Finalize worker, bridge and tab wiring without changing the live Law behavior

- Add/finalize `magnetic-grid-bridge.ts` and `createMagneticGridSolveService()` only for the live T3 engine.
- Replace T1's cloned Law request queue, worker execution/cache/band/replay/prefetch bodies with the bridge-owned solve service and a transport-only `law.worker.ts` using one versioned discriminated envelope. Preserve the live Law tab's requests, results and visible behavior; do not change the current worker.
- Replace the remaining T1-cloned page-owned Law state, request assembly and control policy inside `LawPanel.tsx` with bridge-owned view models and actions without changing its visible cloned surface or results.
- Retain the third selection label `v3.5.2` and `magnetic-grid.compare.v1.*`; exactly three positioning selections render. Voting and Centre-rules remain untouched comparators; the old in-place `positioning===2` branch remains outside the new runtime.
- The final Law slot calls only `LawPanel.tsx` → bridge/API → `law.worker.ts`; it never sends `positioning===2` to the current door/worker. Show all law evidence and typed refusals.

Build completion: the Law tab compiles and runs through `LawPanel.tsx` → bridge/API → transport-only `law.worker.ts`; direct and worker calls return the same result; newest-only request replacement works; cache identities do not cross between legacy and Law; all three laws remain operational; exactly three selections render; current Voting/Centre-rules still run unchanged. Commit this final working build. Broader queue/mutation/audit work remains optional §9 (fixtures 12 and 17 remain mandatory B1 gates).

## 1. Product goal

The engine is one portable three-rule driver:

1. **CENTRE** — at each candidate physical scale, derive one governed centre from that scaled shape alone, before magnets exist. Place the lattice rigidly on that centre: odd line count puts a node on it; even line count puts the gap/centering line on it. The centre may change with physical scale because the safe core/masses change; it may never change because magnets landed somewhere.
2. **WRAP** — every perimeter-belt disc touches the outline within the configured flap allowance, measured on the 1 mm ruler: a disc's air to the outline is reported as a whole millimetre (nearest); `0` means the disc fits and its air rounds to 0 mm; `1` means up to 1 mm of air. Auto flap returns the smallest whole-millimetre allowance that makes the layout lawful.
3. **MAGNET-QUANTITY SCALING** — shape sizes are even millimetres (24, 26, 28 …), so every centre, lattice node and Centre-mesh sample lies on whole millimetres. Within each band the engine walks every even size and publishes each next available magnet count once, at the smallest even size where that count's layout is centred and wrapped. Counts are strictly increasing (jumps larger than one are valid). A count published in a lower band never reappears above worn loose. Every candidate size is evaluated, so coverage is complete by construction.

**The ruler.** No law measurement is finer than 1 mm (Dan, 2026-08-23: "we never should follow anything less than 1 mm"). Sizes and flap are whole millimetres; a measured air is rounded to the nearest whole millimetre before any law comparison. Exact arithmetic may be used to *measure*, never to *decide* below the ruler.

There is no score, weight, blended preference, silent fallback, or “best attempt” in the production driver. When no lawful layout exists, the engine returns a typed refusal. Fixed-size/manual inspection returns measured concessions; it does not invent a product winner.

Dan's separate gravity ruling is a mechanical invariant, not a hidden fourth driver: among candidates identical on centre, wrap, count, and required allowance, vertical eliminates horizontal. If multiple candidates remain equal after gravity, the engine returns all of them; it never manufactures a winner from coordinate order.

## 2. Governing directive set

The contract must deliver all of these together:

- Build v3.5.2 as a separately selectable comparison path first.
- Treat Voting/scoring as untrusted visual comparator evidence only. Treat accepted Centre-rules centering outputs as the trusted behavioral baseline while its shared door/worker and named 2mm-ruler defects remain untrusted infrastructure. Do not modify either current path during proof.
- Use the proved centering-tab enforcement as the behavioral base: preserve/re-room its accepted centre-rule/governor/parity canon, replace only its documented corrupt measurements/shared infrastructure, prove centre equivalence first, then add Wrap and Magnet-quantity scaling.
- Enforce the three laws as code invariants, not UI descriptions.
- Make every exposed control true to its label.
- Make every concession explicit.
- Split the implementation into portable `spec → compute → logic → engine API`; UI reaches it only through a bridge.
- End v3.5.2 with one isolated working Law runtime beside the frozen Voting/Centre-rules comparators.
- Product cut-over, deletion and any one-engine migration require a separate later contract if and when Dan authorizes that work; they are not v3.5.2 build tasks.

## 3. Necessity baseline — the smallest complete rebuild

### Required additions

One canonical portable package and one product/bench bridge:

```text
src/lib/magnetic-grid/
  spec.ts
  compute.ts
  compute/
    seat.ts
    centre-evidence.ts
    exact-real.ts      # live since Wrap: rational values and comparison (measurement only)
    contact-root.ts    # live since Wrap: belt-disc distance measurement and witnesses
    identity.ts        # live since Wrap: canonical serialization
  logic.ts
  engine.ts

src/lib/effect/magnetic-grid-bridge.ts
src/app/(dev)/effect-creator/grid-origin/law.worker.ts
src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx
```

This is the approved maximum root, not a command to create empty or speculative modules. T1 creates only the files needed for the full isolated clone. T2 creates only the owners needed to re-room bodies that already exist. T3 creates a new module only when a live Centre/Wrap/scaling consumer requires it. No stub, unused public surface or foundation-only file enters the build.

The existing `grid-origin` page is the shared comparison shell. Its three positioning labels are currently one persisted `positioning` switch inside one shared page model, Stage, request builder and worker—not three isolated tab components. T1 materializes the existing third **Law** selection as a complete isolated vertical clone of Centre-rules: full visible tab UI, controls, local state, request assembly, worker execution/cache branch, rendered evidence surface, `positioning===1` engine branch and its dependency closure. Voting, Centre-rules, their page state, current worker and current modules remain untouched; the existing selector gains only the mount dispatch that opens the isolated `LawPanel`. The old in-place `positioning===2` branch becomes dormant evidence outside the new runtime. T2 re-rooms the cloned engine beneath that live surface; T3 adds Wrap and scaling while Centre stays frozen, then conditionally repairs Centre only if the completed engine proves it necessary; T4 replaces the cloned worker/request/UI internals with final bridge-owned orchestration and view models without changing the already-live Law behavior. No fourth tab or second page is required.

### Required reuse

**Baseline rule:** the isolated Law package starts from the embedded `8d17780c` Centre-rules (`positioning===1`) dependency closure. No body reachable only from Voting (`positioning===0`), `registrationScore`, scoring weights/orders, phase sweep or `centeringRef` may be moved or adapted into Law. Voting and the old in-place `positioning===2` Wrap/scaling branch are evidence only. No old Wrap/scaling law-bearing body — gate, refinement, ranking, press, tolerance — may be copied, moved or adapted into the new law; the neutral sampled walk shell is ADAPT as discovery only, exactly as the untangle row below states. A product invariant observed there may enter only after it is independently re-derived from Dan's directive and implemented anew over the exact T3 measurements.

**Clone-then-re-room order:** first clone the Centre-rules behavioral slice and prove it still produces the accepted centre outputs. Then re-room those same bodies into spec/compute/logic/engine under the dispositions below. Only after the re-roomed centre gate passes is Wrap added, then Magnet-quantity scaling. The frozen ruler and its evidence are retained unchanged through T3; Centre repair is permitted only by a later explicit bounded amendment if the final conditional F2 gate measures a material defect. T1, T2 and Wrap are complete; T3 scaling starts from product `2c043257`. This is not bottom-up replacement followed by an equivalence test; the preserved implementation is the starting material.

**Full vertical clone boundary:** the T1 clone begins at the current `grid-origin/page.tsx` Centre-rules experience and ends at the bodies that produce and render its result. It includes the shared visible bench surface needed to operate Centre-rules, its Centering controls and evidence display, its local state/defaults, newest-only request queue, request/config assembly, the relevant `solve.worker.ts` cache/band/replay/prefetch execution, `grid-origin.ts positioning===1`, and every reachable body in `grid-origin-spec.ts`, `grid-origin-compute.ts`, `grid-origin-logic.ts` and `grid-origin-bridge.ts`. The isolated clone substitutes only file/import names, request identity and persisted namespace; every cloned function body and JSX subtree is copied from the embedded donor snapshot before re-rooming. It imports or calls no current `grid-origin*` runtime or current worker. Voting-only bodies and the existing `positioning===2` branch are excluded. The original Centre-rules tab and isolated Law clone remain separately selectable throughout T1-T4 so every code change is immediately observable against the frozen baseline.

**What centering is preserved versus repaired:** preserve `governMass` branch semantics, the governor set, centre-rule branch meanings, node/gap parity canon and all four centred placements. T1 clones the current governor body verbatim; T2 re-rooms it without behavioral change. T3 leaves every Centre measurement body unchanged; it only makes the frozen path emit its already-computed selection identities (§6.2) and reconstructs the selected coordinates exactly. Exact comparison comes from the live exact-real kernel. The known ruler defect is current `safeSegments`: it samples clearance on a fixed 2mm mesh anchored to each scaled bbox, so its argmax jumps between samples as scale changes. Measured result: mesh centre left ~0.069mm contact residue; an exactly computed centre reduced it to ~0.000055mm reporting noise. Because erosion/mass depth is a fixed physical millimetre value while the shape scales, the mass map genuinely changes per scale; computing one normalized centre and scaling it is not equivalent.

Clone a current function body only when the embedded source and disposition table classify it for the current phase; do not alter its current consumers. The clone is temporary. Initial donor candidates are the exact segment-seat kernel, pure bbox traversal and contour scaling. The current mesh-derived centre evidence is retained frozen as the numeric selection source and is never a law geometry; `splitPerimeter`, float tangency/gap helpers, scoring helpers and shape adapters are source evidence—not pre-approved reuse.

Every cloned body receives exactly one disposition while T1 is built: `MOVE-VERBATIM` (function text copied from the embedded donor), `ADAPT` (only the named file/import/request-identity/persisted-namespace substitution), or `EXCLUDE` (Voting-only, old-Law-only or outside the Centre-rules closure). “Where possible”, silent rewrite and unclassified code are forbidden.

### Untangle map — current source to Law owner

| Current body | Disposition | Law destination and proof |
|---|---|---|
| `grid-origin.ts parityHolds` | MOVE-VERBATIM in T1; ADAPT only during a named T3 repair | `logic.ts parityIsLawful`; preserve donor behavior until the repair step |
| `grid-origin.ts` Centre-rules four parity placements | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2 | neutral placement measurements in compute; centre-law acceptance in logic; no ruler/Wrap/scaling change during the move |
| `grid-origin.ts` Law ranking (`lawful → count → press → gravity`) | REFERENCE-EVIDENCE only in T3; no body reuse | Re-derive the ruled ordering from Dan's directive over new exact measurements in `logic.ts`; the existing `positioning===2` ranking body is never copied or adapted |
| `grid-origin.ts bandWalk` gate/refinement/no-repeat | MOVE reached Centre-rules behavior through T1/T2; ADAPT at T3 scaling | T3 graduates it: 2 mm steps over even sizes, every placement judged, the Wrap verdict (whole-mm air ≤ flap) as the only gate, no bisection/refinement, and the seat-based `below` ownership replaced by ownership-by-acceptance (§7.2, §7.4) |
| `grid-origin.ts autoFlapInBand` | MOVE reached Centre-rules behavior through T1/T2; DELETE+REPLACE when T3 adds Wrap | T1/T2 preserve the allowance scan for equivalence only; T3 removes the scan and computes the exact worst-belt minimum directly |
| `grid-origin-logic.ts centeringAnchors` | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2; repair only named measurement defects in T3 | arithmetic owner `compute/centre-evidence.ts`; `logic.ts evaluateCentreLaw` owns the same ruled branch |
| `grid-origin-logic.ts governMass` | MOVE-VERBATIM in T1; move the current numeric body and signature unchanged in T2 | no representation or comparison change in T2 or T3; the governor keeps selecting on its numeric inputs |
| `grid-origin-logic.ts assignSizes` | ADAPT only when a live T3 result consumes it | extrema/corner measurements in `compute/seat.ts`; magnet-plan policy in `logic.ts` |
| `grid-origin-compute.ts splitPerimeter` | ADAPT only when live Coverage/Wrap code consumes it | neighbour measurements in `compute/seat.ts`; belt classification in `logic.ts`; no speculative reach value |
| `solve.worker.ts` request queue/cache/band/replay/prefetch execution reachable from Centre-rules | MOVE-VERBATIM into isolated T1 `law.worker.ts` clone, then REPLACE at T4 | T4 bridge service becomes the one Law orchestration owner and final `law.worker.ts` transports only. Voting-only and `positioning===2` worker branches never enter the clone |
| `page.tsx circle:` + `makeCircleSeatPredicate` | MOVE reached Centre-rules behavior through T1/T2 | preserve analytic-circle seating for clone/re-room equivalence; T3 may replace it only as a named boundary-law change |
| `seatMarginMM` in page/worker/`computeGrid`/band walk | MOVE reached Centre-rules behavior through T1/T2 | preserve the worker's positioning-1 seat-inflation path; T3 may replace it only when live Centre/Wrap code supplies the replacement |
| exact segment-seat kernel, pure bbox traversal, contour scaling | MOVE-VERBATIM | destination follows the import law; unchanged in T3 |
| `registrationScore`, `ORDERS`, weights, `centeringRef`, placement sweep, voting state | EXCLUDE from the new Law runtime | no Law destination; they belong only to the frozen comparator source |

The untangle table plus T1 ADAPT-EXTRACT map is closed. No body, state owner, request/result field or dependency row may be added during T1/T2 without revising the v3.5.2 contract first.

### Elements explicitly preserved

- Perimeter-belt coverage: native product behavior, not slop.
- Magnet plan/diameters: product output configuration, not a ranking force.
- Shape-source and cutout-library bench adapters.
- Legal-area/mass visualization needed to verify centre selection.
- Full-grid visualization as diagnostics; wrap is always belt-scoped.

### Canonical-root decision

`src/lib/magnetic-grid/` is the engine build root. `src/lib/grid-engine/` is neither a destination nor an allowed dependency of the portable package. Reuse is **kernel reuse only**: a body enters only when the clone-authority gate classifies it and the current build phase has a live consumer. The old spec values, bridge contract, candidate/offer result shapes, registration doctrine, package manifests and unrelated active-lane work are outside this engine build.

## 4. Non-goals

- No template catalogue driving search.
- No semantic shape names inside compute.
- No scoring or configurable weights.
- No continuous placement sweep.
- No unruled default layout recommendation inside a band.
- No non-semantic geometry-key winner. Co-lawful layouts are returned with stable identities; deterministic ordering is not product selection.
- No fulfilment, manufacturing-order, or cutout-engine migration in this increment.
- No production publication, cut-over or deletion in this engine build contract.

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
| `compute/contact-root.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts` |
| `compute/identity.ts` | `spec.ts`, `compute/exact-real.ts` |
| `logic.ts` | `spec.ts` types/measured records plus only `compareExact` from `compute.ts`; no geometry functions or other compute import |
| `engine.ts` | `spec.ts`, `compute.ts`, `logic.ts` |
| `magnetic-grid-bridge.ts` | public `engine.ts`, shape/vector adapters |
| `law.worker.ts` | T1-T3: isolated clone of the Centre-rules worker execution/cache branch; T4 onward: Law bridge service only. The current worker is outside the new package and unchanged during proof |
| `LawPanel.tsx` | T1-T3: isolated full UI/state/request/render clone used as the live equivalence harness; T4 onward: Law bridge view model, actions and control metadata only; never imports current `grid-origin*` runtime |
| existing page | existing comparator imports plus `LawPanel`; its existing three-way selector owns only the selection/mount dispatch. Its pre-existing Voting/Centre-rules source regions, state and worker remain unchanged |

The separation guard parses imports and ASTs. A convention comment is not enforcement. Its phase profile is explicit: T1 first proves the isolated vertical clone and forbids any runtime edge back to current `grid-origin*`; T2 makes the portable package obey the final import DAG as its bodies are re-roomed; T4 makes `law.worker.ts` transport-only and `LawPanel.tsx` bridge-only. A later profile may tighten an earlier profile but never waive comparator immutability or portable-package separation.

## 6. Module contracts

These contracts define ownership and the maximum build API. A phase implements only the declarations required by bodies and consumers that exist in that phase. No phase creates unused declarations merely because they appear below; every implemented declaration keeps the owner/import/behavior contract shown here.

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
export type ExactReal = Rational | AlgebraicReal
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
/** id grammar is ruled: `outer:segment:<i>` or `hole:<n>:segment:<i>`, i = index of the segment's end vertex in its ring. */
export interface BoundaryElement { kind: 'segment'; id: string; a: readonly [Rational, Rational]; b: readonly [Rational, Rational] }
export interface ExactRing { elements: readonly BoundaryElement[] }
export interface BoundaryTruth {
  rule: 'supplied-final-contour'
  contourIdentity: string
}
export interface NormalizedBoundary {
  outer: ExactRing                       // exact normalized outer ring (§7.1b rule)
  holes: readonly ExactRing[]            // exact normalized holes, same rule
  truth: BoundaryTruth
  normalizedLongestSideMM: 1
  displayContour: Contour                // report/render only; never read by a law path
}
export interface RegionEvidence { id: string; centres: readonly ExactPoint[]; area: ExactReal; peakClear: ExactReal; rings: readonly (readonly PointMM[])[] }
export type MassEvidence = RegionEvidence
export interface Anchor { centre: ExactPoint; diameterMM: 6 | 8 }
export interface PreparedContour { outer: ExactRing; holes: readonly ExactRing[]; boundary: readonly BoundaryElement[] /* derived flat view of outer+holes */; truth: BoundaryTruth; identity: string; source: Contour /* report-only */ }
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
export interface EvaluationContext { band: BandId; scale: ExactScale }
export interface CentreBranchMeasurement { context: EvaluationContext; evidence: CentreEvidence }
export interface CentreLawEvaluation { context: EvaluationContext; evidenceId: string; decisions: readonly CentreDecision[]; refusal: Refusal | null }
export type CandidateLawEvaluation =
  | { status: 'lawful'; candidate: LawfulCandidateMeasurement }
  | { status: 'refused'; refusal: Refusal; measured: RootedCandidateGeometry; policyIdentity: string }
export interface LawfulRungDecision { band: BandId; scale: ExactScale; magnetCount: number; candidates: readonly LawfulCandidateMeasurement[] }
export interface BandLawDecision { band: BandId; rungs: readonly LawfulRungDecision[]; refusal: Refusal | null }
export interface LawReduction { bands: readonly BandLawDecision[]; globalRefusal: Refusal | null }
export interface ContactWitness {
  scale: ExactScale
  boundaryTruth: BoundaryTruth
  beltAnchorId: string
  outlineElementId: string
  outlineElementKind: 'segment'
  allowance: ExactReal
  equation: { kind: 'polynomial'; polynomial: readonly ExactInteger[]; rootIndex: number }
  tangency: { x: ExactReal; y: ExactReal }
  path: 'fixed-size' | 'rung' // B1 renames the live `regimeId: 'fixed-size'` field
  certificateId: string
}

export const GRID_PITCH_MM = 48
export const SPOT_RADIUS_MM = 12
export const MASS_DEPTH_MM = 16
/** Sizes are even millimetres; a band owns its even sizes minMM..maxMM inclusive. */
export const SIZE_STEP_MM = 2
export const BANDS = [
  { id: 1, minMM: 24, maxMM: 70 },
  { id: 2, minMM: 72, maxMM: 118 },
  { id: 3, minMM: 120, maxMM: 166 },
  { id: 4, minMM: 168, maxMM: 214 },
] as const

export type FixedFlap = { mode: 'fixed'; allowance: Rational }
export type AutoFlap = { mode: 'auto'; maxAllowance: Rational }
export type FlapLaw = FixedFlap | AutoFlap

export interface EngineConfig {
  flap: FlapLaw
  coverage: CoverageMode
  magnetPlan: MagnetPlan
  /** Exposed ruled geometry controls; defaults GRID_PITCH_MM / SPOT_RADIUS_MM / MASS_DEPTH_MM. */
  pitchMM: 24 | 48 | 96
  spotRadiusMM: number
  massDepthMM: number
}
/** Comparison-only ruled input. The enum crosses the bridge; the selection function never does. */
export interface ComparisonEngineConfig extends EngineConfig { centrePolicy: CentrePolicy }
/** Engine-derived internal record; callers cannot supply policyIdentity. */
export interface EvaluationPolicy extends ComparisonEngineConfig { readonly policyIdentity: string }
/** Neutral geometry inputs derived by engine from the config's exposed values (exact rationals); contains no policy selector. */
export interface ComputeInputs { pitchMM: Rational; spotRadiusMM: Rational; massDepthMM: Rational }
/** One evaluated placement at one even size: what the walk judges and Logic reduces. */
export interface PlacementCandidate {
  sizeMM: number                 // even whole millimetres
  placement: { xHalf: boolean; yHalf: boolean }
  seated: readonly PointMM[]
  belt: readonly PointMM[]
  anchors: readonly Anchor[]     // post-Coverage output population
  magnetCount: number
  requiredFlapMM: number         // whole-mm air of the worst belt disc (nearest mm)
  parityTrue: boolean
  wrap: WrapEvaluation
}

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

/** Comparison-stage factory. A later product contract may replace it with one locked instance. */
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

The engine evaluates the full user-selectable B1-B4 horizon and returns all lawful rungs and every co-lawful layout at each rung. `candidateId` is a content identity for cache/replay, never a tie-break. The payload stores verdict-changing truth (deduplicated centre evidence by id, phase, belt, required flap); the bridge derives field spots and SVG projections without re-solving. It does not choose a commercial default. Throughout T1-T4 the bridge passes the complete `CentrePolicy`; `logic.ts` alone owns `evaluateCentreLaw`.

Identity is canonical exact content, not float/string accident:

```ts
geometryLayoutId = sha256(canonicalJson([
  'layout-v1', inputIdentity,
  canonicalExact(scale.exact), canonicalExactPoint(phase), xParity, yParity,
  sortLex(seated.map(canonicalExactPoint)),
  sortLex(belt.map(canonicalExactPoint)), centre.evidenceId,
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

If a live result/cache consumer requires it, `compute/identity.ts` assigns neutral `geometryLayoutId` and `measuredId` to the complete rooted record before Logic sees it. Engine derives `policyIdentity` from the complete config through `policyIdentityOf`; callers cannot supply it. Logic uses `measuredId` for stable ordering and carries the opaque identity; it never hashes or reconstructs geometry. After Logic returns `LawReduction`, engine assembly calls neutral `finalizeResultIdentity()` and exposes `layoutId = geometryLayoutId`, `candidateId = resultId`. Thus two configured outputs with different Coverage, MagnetPlan, flap or centre policy cannot share a content-complete result id, while their neutral geometry identity remains comparable. A report-only decimal never enters identity.

Each rung carries its even size, accepted layout(s), whole-mm required flap and contact witnesses.

### 6.5 `magnetic-grid-bridge.ts` — adapters and worker service

Responsibilities:

- accept the same normalized final contour already loaded by the comparison shell; this build does not add ONEMO Studio runtime wiring, re-tracing or a new cutout format;
- convert supplied contour coordinates to exact segment rationals without changing them, attach `BoundaryTruth`, and include ordered contour coordinate bits in contour/cache identity;
- carry adapter provenance and any certified source-error bound as diagnostic evidence only; never add it to flap/contact allowance;
- fixed-size scaling and optional admin outline offset;
- full-content contour identity;
- call public engine `policyIdentityOf(config)` for cache identity; callers cannot supply the id. It derives from schema/Law version plus every comparison config field (centre mode and Masses governor where applicable, flap mode/value/cap, coverage, magnet plan, pitch, spot radius, mass depth and ruled spec version), and every field mutation changes it;
- cache the all-band result by schema version + engine id + centre-policy id + contour bytes + complete config; derive a selected-band view without re-solving;
- invalidate when any engine input changes;
- ensure clicked rung returns the stored qualifying result, never a re-solve with altered config;
- serialize and carry exact contact witnesses unchanged across engine, worker, cache, and UI; report-only decimals never enter a cache key or verdict;
- convert results to field spots, rings, centre markers, concessions, and refusal copy;
- derive every Law control label, option, bound and default from public engine/spec data and expose them as bridge view models; the page contains no engine-law constant or policy branch; the ruled `v3.5.2` tab label is the only version literal;
- expose a testable `createMagneticGridSolveService()` used by the worker.

During T1-T3, `law.worker.ts` is the isolated, hash-characterized clone of the Centre-rules worker execution/cache branch so the complete cloned tab runs independently and every engine change is visible. T4 replaces that cloned orchestration with only message validation, Law bridge-service call and `postMessage`. The current worker and both comparator code paths remain byte-untouched during proof.

One versioned envelope carries discriminated operations; “one schema” does not mean nullable fields:

```ts
export type SolveOperation =
  | { kind: 'bands'; input: SolveBandsInput }
  | { kind: 'inspect-fixed'; input: InspectFixedSizeInput }

export interface SolveRequestEnvelope {
  schemaVersion: 1
  requestId: number
  engineId: 'v352-law-comparison'
  operation: SolveOperation
}
```

The all-band response contains complete lawful layouts and their evidence; selecting a rung/layout is a pure lookup by `candidateId`, never another worker operation. Exact integer coefficients and rational terms serialize as decimal strings so structured clone and canonical JSON are byte-stable across runtimes.

## 8. Control truth contract

| Control | Engine meaning | Required proof |
|---|---|---|
| Band B1-B4 | restrict exact contact-event scale range | every user-selectable band exercised; no cross-band repeat or boundary double-owner |
| Grid pitch 24 / 48 / 96 | lattice pitch in `ComputeInputs`; default 48 | square 25 at pitch 24 (fixture 12); identity changes with pitch |
| Magnet padding (spot radius) | exact spot radius in `ComputeInputs`; default 12 | 12 is the public default; a changed value changes seat, Wrap and identity |
| Mass depth | depth probe of the frozen Centre ruler; default 16 | governed mass changes only through the frozen ruler; identity changes with depth |
| Flap fixed | exact maximum worst-belt gap | 0 admits only a certified contact witness; no guard |
| Flap Auto | smallest exact required allowance, capped | 1mm need returns 1mm, never 2mm |
| Centre rule (comparison only) | chooses centre from shape evidence before seats | seat changes cannot change centre |
| Coverage | changes output population only; wrap stays belt-scoped | full/perimeter share wrap truth |
| Magnet plan | changes body diameters only | positions/counts unchanged |
| Manual drag | diagnostic forced phase | concessions measured and visible |
| Outline offset | changes input contour before solve | cache identity and result change |
| Source accuracy readout | evidence about how the contour was produced | never changes wrap law unless Dan separately rules a product allowance |

The comparison tab exposes only controls that map truthfully to the live engine build.
