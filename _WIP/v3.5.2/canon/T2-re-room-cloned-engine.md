# Magnetic Grid v3.5.2 — portable three-rule engine and live comparison tab build contract

Status: canonical v3.5.2 master contract
Version: v3.5.2-1 — full vertical Centre-rules clone in T1; scaling simplified to discovery + exact local contact (2026-08-22)
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: code reconstruction of the portable engine and live comparison tab only.

## 10. Engine and live-tab build sequence

Every semantic code change is one rollback commit and compiles/runs before the next code change. T1-T4 build the working code first. The optional §9 proof/audit work may follow after the build and does not authorize extra engine infrastructure. No push/merge/publication is implied.
### T2 — Re-room the cloned Centre-rules engine without changing behavior

- Keep the complete T1 Law clone running as the comparison harness. Re-room only its cloned underlying centering bodies, incrementally, into `spec.ts`, public `compute.ts`, focused `compute/*`, `logic.ts`, `engine.ts` and the pass-through bridge under `src/lib/magnetic-grid/`, following the untangle map and MOVE/ADAPT equivalence obligations.
- Copy only disposition-approved neutral geometry bodies from the embedded source. Rejected approximate/policy helpers remain unchanged source bodies during T2; no defect is repaired while the structure moves. The portable package has no runtime import back into current `grid-origin*` or `src/lib/grid-engine`.
- After every semantic commit, compile and run the Law selection, then replay the named T1 squircle/72mm snapshot and require the same contour bytes, complete result record and rendered Centre evidence before continuing. The broader matrix/mutation work remains optional §9.
- Keep the label `v3.5.2` and the Centre-clone honesty note throughout T2; it must still state that Wrap and scaling are not implemented yet.

Exact T2 re-room map: `centre-clone-spec.ts` → `spec.ts`; `centre-clone-compute.ts` → public `compute.ts` plus only the reached focused `compute/*` owners; `centre-clone-geometry.ts` exact seat bodies → `compute/seat.ts`; `centre-clone-logic.ts` → `logic.ts` for policy bodies and the declared neutral compute owner for measurements; `centre-clone-engine.ts` → `engine.ts`; `magnetic-grid-clone-bridge.ts` → `magnetic-grid-bridge.ts`. Each move is committed separately, deletes the vacated temporary body in the same commit, and preserves the named T1 snapshot byte-for-byte. No temporary file survives T2.

Build completion: the re-roomed portable package compiles and drives the still-live Law clone through the declared owners; the frozen snapshot is unchanged across every re-room commit; Centre-rules still runs unchanged; no ruler repair, Wrap, scaling or conditional support kernel exists yet. Commit this working state before T3.

## 1. Product goal

The engine is one portable three-rule driver:

1. **CENTRE** — at each candidate physical scale, derive one governed centre from that scaled shape alone, before magnets exist. Place the lattice rigidly on that centre: odd line count puts a node on it; even line count puts the gap/centering line on it. The centre may change with physical scale because the safe core/masses change; it may never change because magnets landed somewhere.
2. **WRAP** — every perimeter-belt disc touches the outline within the configured flap allowance. `0` means exact spot-edge tangency on the ruled source geometry; neither outline-source uncertainty nor size-walk quantum becomes hidden wrap tolerance. Auto flap returns the smallest allowance that makes the layout lawful.
3. **MAGNET-QUANTITY SCALING** — within each band, publish each next available magnet count once, at the exact scale where that count's layout is centred and wrapped. The existing band walk discovers candidate states operationally; the rung scale is solved exactly from that layout's local contact equations and validated by the full laws at that exact scale. Counts are strictly increasing (jumps larger than one are valid). A count published in a lower band never reappears above worn loose. The promise is exact truth for every published rung plus measured operational discovery; it is not a proof over every real scale.

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
    exact-real.ts      # live: rational/algebraic values, comparison, quadratic roots
    contact-root.ts    # live: exact boundary, seat/Wrap judgement, local contact roots
    identity.ts        # live: canonical serialization and witness certification
  logic.ts
  engine.ts

src/lib/effect/magnetic-grid-bridge.ts
src/app/(dev)/effect-creator/grid-origin/law.worker.ts
src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx
```

This is the approved maximum root, not a command to create empty or speculative modules. T1 creates only the files needed for the full isolated clone. T2 creates only the owners needed to re-room bodies that already exist. T3 creates a new module only when a live Centre/Wrap/scaling consumer requires it. No stub, unused public surface or foundation-only file enters the build.

The existing `grid-origin` page is the shared comparison shell. Its three positioning labels are currently one persisted `positioning` switch inside one shared page model, Stage, request builder and worker—not three isolated tab components. T1 materializes the existing third **Law** selection as a complete isolated vertical clone of Centre-rules: full visible tab UI, controls, local state, request assembly, worker execution/cache branch, rendered evidence surface, `positioning===1` engine branch and its dependency closure. Voting, Centre-rules, their page state, current worker and current modules remain untouched; the existing selector gains only the mount dispatch that opens the isolated `LawPanel`. The old in-place `positioning===2` branch becomes dormant evidence outside the new runtime. T2 re-rooms the cloned engine beneath that live surface; T3 adds Wrap and scaling while Centre stays frozen, then conditionally repairs Centre only if the completed engine proves it necessary; T4 replaces the cloned worker/request/UI internals with final bridge-owned orchestration and view models without changing the already-live Law behavior. No fourth tab or second page is required.

### Required reuse

**Baseline rule:** the isolated Law package starts from the embedded `8d17780c` Centre-rules (`positioning===1`) dependency closure. No body reachable only from Voting (`positioning===0`), `registrationScore`, scoring weights/orders, phase sweep or `centeringRef` may be moved or adapted into Law. Voting and the old in-place `positioning===2` Wrap/scaling branch are evidence only. No old Wrap/scaling function body may be copied, moved or adapted into the new law. A product invariant observed there may enter only after it is independently re-derived from Dan's directive and implemented anew over the exact T3 measurements.

**Clone-then-re-room order:** first clone the Centre-rules behavioral slice and prove it still produces the accepted centre outputs. Then re-room those same bodies into spec/compute/logic/engine under the dispositions below. Only after the re-roomed centre gate passes may the faulty centre ruler be adapted, then Wrap added, then Magnet-quantity scaling added. This is not bottom-up replacement followed by an equivalence test; the preserved implementation is the starting material.

**Full vertical clone boundary:** the T1 clone begins at the current `grid-origin/page.tsx` Centre-rules experience and ends at the bodies that produce and render its result. It includes the shared visible bench surface needed to operate Centre-rules, its Centering controls and evidence display, its local state/defaults, newest-only request queue, request/config assembly, the relevant `solve.worker.ts` cache/band/replay/prefetch execution, `grid-origin.ts positioning===1`, and every reachable body in `grid-origin-spec.ts`, `grid-origin-compute.ts`, `grid-origin-logic.ts` and `grid-origin-bridge.ts`. The isolated clone substitutes only file/import names, request identity and persisted namespace; every cloned function body and JSX subtree is copied from the embedded donor snapshot before re-rooming. It imports or calls no current `grid-origin*` runtime or current worker. Voting-only bodies and the existing `positioning===2` branch are excluded. The original Centre-rules tab and isolated Law clone remain separately selectable throughout T1-T4 so every code change is immediately observable against the frozen baseline.

**What centering is preserved versus repaired:** preserve `governMass` branch semantics, the governor set, centre-rule branch meanings, node/gap parity canon and all four centred placements. T1 clones the current governor body verbatim; T2 re-rooms it without behavioral change. T3 adapts only the measurement bodies proved wrong. Exact comparison comes from the live exact-real kernel. The known ruler defect is current `safeSegments`: it samples clearance on a fixed 2mm mesh anchored to each scaled bbox, so its argmax jumps between samples as scale changes. Measured result: mesh centre left ~0.069mm contact residue; an exactly computed centre reduced it to ~0.000055mm reporting noise. Because erosion/mass depth is a fixed physical millimetre value while the shape scales, the mass map genuinely changes per scale; computing one normalized centre and scaling it is not equivalent.

Clone a current function body only when the embedded source and disposition table classify it for the current phase; do not alter its current consumers. The clone is temporary. Initial donor candidates are the exact segment-seat kernel, pure bbox traversal and contour scaling. The current mesh-derived centre evidence, `splitPerimeter`, float tangency/gap helpers, scoring helpers and shape adapters are source evidence—not pre-approved reuse.

Every cloned body receives exactly one disposition while T1 is built: `MOVE-VERBATIM` (function text copied from the embedded donor), `ADAPT` (only the named file/import/request-identity/persisted-namespace substitution), or `EXCLUDE` (Voting-only, old-Law-only or outside the Centre-rules closure). “Where possible”, silent rewrite and unclassified code are forbidden.

### Untangle map — current source to Law owner

| Current body | Disposition | Law destination and proof |
|---|---|---|
| `grid-origin.ts parityHolds` | MOVE-VERBATIM in T1; ADAPT only during a named T3 repair | `logic.ts parityIsLawful`; preserve donor behavior until the repair step |
| `grid-origin.ts` Centre-rules four parity placements | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2 | neutral placement measurements in compute; centre-law acceptance in logic; no ruler/Wrap/scaling change during the move |
| `grid-origin.ts` Law ranking (`lawful → count → press → gravity`) | REFERENCE-EVIDENCE only in T3; no body reuse | Re-derive the ruled ordering from Dan's directive over new exact measurements in `logic.ts`; the existing `positioning===2` ranking body is never copied or adapted |
| `grid-origin.ts bandWalk` gate/refinement/no-repeat | MOVE reached Centre-rules behavior through T1/T2; ADAPT at T3 scaling | T1/T2 preserve the sampled walk; T3 keeps it as cheap candidate discovery only and removes its authority to certify contact or publish a rung: the gate becomes exact local contact roots plus full-law validation (§7.2, §7.4), and the seat-based `below` ownership is deleted |
| `grid-origin.ts autoFlapInBand` | MOVE reached Centre-rules behavior through T1/T2; DELETE+REPLACE when T3 adds Wrap | T1/T2 preserve the allowance scan for equivalence only; T3 removes the scan and computes the exact worst-belt minimum directly |
| `grid-origin-logic.ts centeringAnchors` | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2; repair only named measurement defects in T3 | arithmetic owner `compute/centre-evidence.ts`; `logic.ts evaluateCentreLaw` owns the same ruled branch |
| `grid-origin-logic.ts governMass` | MOVE-VERBATIM in T1; move the current numeric body and signature unchanged in T2 | no representation or comparison change in T2; any `ExactReal`/`compareExact` adaptation requires a named T3 repair invoking Support A |
| `grid-origin-logic.ts assignSizes` | ADAPT only when a live T3 result consumes it | extrema/corner measurements in `compute/seat.ts`; magnet-plan policy in `logic.ts` |
| `grid-origin-compute.ts splitPerimeter` | ADAPT only when live Coverage/Wrap code consumes it | neighbour measurements in `compute/seat.ts`; belt classification in `logic.ts`; no speculative reach value |
| `solve.worker.ts` request queue/cache/band/replay/prefetch execution reachable from Centre-rules | MOVE-VERBATIM into isolated T1 `law.worker.ts` clone, then REPLACE at T4 | T4 bridge service becomes the one Law orchestration owner and final `law.worker.ts` transports only. Voting-only and `positioning===2` worker branches never enter the clone |
| `page.tsx circle:` + `makeCircleSeatPredicate` | MOVE reached Centre-rules behavior through T1/T2 | preserve analytic-circle seating for clone/re-room equivalence; T3 may replace it only as a named boundary-law change |
| `seatMarginMM` in page/worker/`computeGrid`/band walk | MOVE reached Centre-rules behavior through T1/T2 | preserve the worker's positioning-1 seat-inflation path; T3 may replace it only when live Centre/Wrap code supplies the replacement |
| exact segment-seat kernel, pure bbox traversal, contour scaling | MOVE-VERBATIM until a named live T3 boundary defect invokes ADAPT | destination follows the import law. T3 Wrap may ADAPT contour scaling only to preserve supplied holes and make the returned exact longest side equal the requested size after the measured live 24mm float-scaling failure; the frozen governed Centre/evidence hashes must remain equal |
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
  regimeId: string // 'fixed-size' | 'rung'
  certificateId: string
}

export const GRID_PITCH_MM = 48
export const SPOT_RADIUS_MM = 12
export const MASS_DEPTH_MM = 16
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
```

`SPOT_RADIUS_MM` defaults the public API. Slider floors/ceilings belong to the bench UI, not the engine spec.

### 6.2 `compute.ts` — one geometry surface, focused internals

Every export returns a measurement or certificate; it never selects a product answer. `compute.ts` is the public barrel only. Implementation is split under `compute/`: `exact-real.ts` owns rational/algebraic values, comparison and quadratic roots; `seat.ts` owns the frozen numeric Centre ruler's seat helpers and the exact seat predicate; `centre-evidence.ts` owns the frozen 2mm `safeSegments` ruler and centre branches; `contact-root.ts` owns the exact boundary, the exact coordinate adapter, seat/Wrap judgement and local contact roots; `identity.ts` owns canonical serialization. This is a layer split inside compute, not public abstractions.

**Boundary rule.** The supplied final contour is converted to exact IEEE-754 rationals and is never retraced, decimated, rounded or reinterpreted for seat, contact, parity, Wrap or rung decisions (§7.1). The frozen Centre ruler keeps its own 2mm mesh and 800-point decimation as Centre's measurement; that mesh never judges seat, contact or a rung.

**Exact coordinate adapter (§7.1b).** The numeric Centre path selects the discrete state — centre branch/governor, parity class, placement, lattice indices, belt membership. Compute then reconstructs only that state's coordinates exactly from their source identities and the scale: contour segments `A_i·s` (+ the product's bbox shift where it applies), centre `c(s) = a_c·s + b_c`, anchors `p_k(s) = c(s) + phase + k·pitch`. Fixed inspection and rung validation consume this same construction; there is one law geometry and no tolerance.

```ts
export function prepareContour(input: NormalizedBoundary): PreparedContour
/** Exact contour, centre, phase and anchors for the state the numeric Centre path selected, at an exact scale. */
export function exactSelectedState(prepared: PreparedContour, numeric: NumericSelection, scale: ExactReal): ExactState
/** Exact seat legality of every node and exact worst-belt Wrap of the state; one function for fixed inspection and rung validation. */
export function judgeState(state: ExactState, inputs: ComputeInputs): StateJudgement
/** Finite local contact equations of the state inside a discovery bracket: every belt disc × every supplied segment (endpoint and interior projection), each a quadratic in scale; returns their exact roots inside the bracket. */
export function contactRoots(state: ExactState, bracket: readonly [Rational, Rational], inputs: ComputeInputs): readonly ContactRoot[]
/** Neutral exact ordering only; no policy, geometry lookup or acceptance semantics. */
export function compareExact(a: ExactReal, b: ExactReal): -1 | 0 | 1
/** Neutral post-policy serialization; called by engine assembly, never by Logic. */
export function finalizeResultIdentity(candidate: LawfulCandidateMeasurement): string
```

`NumericSelection` carries only what the frozen Centre path already outputs (centre branch and its mesh sample/island identities, chosen placement, lattice indices, belt membership); `ExactState` carries the exact contour, centre, phase, anchors and belt; `StateJudgement` carries per-node seat legality, the exact worst-belt required allowance and its binding witnesses. The current micron seat predicate may remain only as a conservative float prescreen inside `judgeState`; every near-boundary answer comes from the exact supplied-coordinate predicate Wrap uses.

For fixed-size inspection compute reports the exact worst-belt required allowance and a report-only decimal. Truth dots come only from `ContactWitness`; there is no `guardMM` parameter anywhere in the law or drawing API.

### 6.3 `logic.ts` — the three rules

Logic receives self-contained measurements and returns decisions. No `Math.hypot`, polygon, lattice, edge or identity calls. Its sole math dependency is neutral `compareExact(a,b)`, used to order already-measured exact values for fixed flap, Auto minimum, scale and stable candidate ordering; the comparator knows no law or config.

```ts
export function evaluateCentreLaw(
  measured: CentreBranchMeasurement,
  policy: CentrePolicy,
): CentreLawEvaluation

export function parityIsLawful(
  candidate: CandidateGeometry,
  centre: CentreDecision,
): boolean

export function wrapIsLawful(
  requiredFlap: ExactReal,
  allowedFlap: ExactReal,
): boolean

export function chooseLawfulCandidate(
  candidates: readonly LawfulCandidateMeasurement[],
): readonly LawfulCandidateMeasurement[] | Refusal

export function evaluateCandidateLaws(
  measured: RootedCandidateGeometry,
  config: EvaluationPolicy,
): CandidateLawEvaluation

/** Owns next-count selection, cross-band ownership, conflicts and all refusal propagation. */
export function reduceBandLadders(
  candidates: readonly CandidateLawEvaluation[],
): LawReduction
```

Candidate choice is deterministic law, not score. Compute supplies both neutral populations/counts; Logic applies Coverage before grouping:

1. select `seated/seatedCount` for Full or `belt/beltCount` for Perimeter; set final `coverage`, `magnetCount` and anchors from the same rooted record without mutating it;
2. discard centre-unlawful candidates;
3. fixed flap: refuse candidates above the allowance;
4. Auto flap: retain only candidates at the minimum exact required allowance for that selected count, or return the typed cap refusal;
5. vertical orientation eliminates horizontal among otherwise-equal candidates;
6. return every candidate still tied, sorted by neutral `measuredId` for stable serialization only.

Magnet count is the ladder axis, not a hidden intra-layout score. Stable order never collapses a tie set.

During this build, the lossless `CentrePolicy` is selected by the comparison bench. Choosing and collapsing a later production policy is outside this engine build contract.

A comparison centre selector may return `CentreTie`; the engine evaluates every tied centre and preserves the resulting lawful candidates. Iteration order and evidence id may never break a centre tie silently.

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

Each rung carries its exact solved scale, accepted layout(s) and contact witnesses. Discovery bookkeeping stays private; no sampled size, quantum or report decimal decides a rung.

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
| Flap fixed | exact maximum worst-belt gap | 0 admits only a certified contact witness; no guard |
| Flap Auto | smallest exact required allowance, capped | 1mm need returns 1mm, never 2mm |
| Centre rule (comparison only) | chooses centre from shape evidence before seats | seat changes cannot change centre |
| Coverage | changes output population only; wrap stays belt-scoped | full/perimeter share wrap truth |
| Magnet plan | changes body diameters only | positions/counts unchanged |
| Manual drag | diagnostic forced phase | concessions measured and visible |
| Outline offset | changes input contour before solve | cache identity and result change |
| Source accuracy readout | evidence about how the contour was produced | never changes wrap law unless Dan separately rules a product allowance |

The comparison tab exposes only controls that map truthfully to the live engine build.
