# Magnetic Grid v3.5.1 — portable three-rule engine and live comparison tab build contract

Status: DRAFT FOR DAN REVIEW
Contract revision: R15 — full vertical Centre-rules clone in T1
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: code reconstruction of the portable engine and live comparison tab only.

## 10. Engine and live-tab build sequence

Every semantic code change is one rollback commit and compiles/runs before the next code change. T1-T4 build the working code first. The optional §9 proof/audit work may follow after the build and does not authorize extra engine infrastructure. No push/merge/publication is implied.

### T3 — Build Wrap, then Magnet-quantity scaling, then repair Centre only if the completed engine proves it is required

- **Freeze Centre first:** the Meta-cleared T2 Centre rule, governor, parity, four placements, 2mm `safeSegments` ruler and frozen Centre hashes are an untouchable baseline while Wrap and scaling are built. After every semantic commit, replay the named squircle/72mm flap-0 snapshot and require identical contour, complete result and Centre evidence except for fields explicitly introduced by the active Wrap/scaling increment. Before Wrap closes, also replay squircle/72mm at one positive flap: governed centre, centre targets and centre evidence remain identical; placement differences are permitted only when the replay proves they are exactly the named removal of double-counted `seatMarginMM` inflation authorized by the Wrap replacement row below.
- **Wrap first:** add the smallest implementation that makes every belt disc obey the configured allowance and makes flap 0 a proved contact. Do not edit Centre code. Compile and run the live Law tab after every change.
- Before scaling, demonstrate one flap-0 exact contact and one loose near-miss refusal in the running Law tab.
- Keep the tab label `v3.5.1`; after Wrap runs, update only the honesty note to describe Centre + Wrap and state that scaling is not implemented yet.
- Freeze Centre + Wrap before scaling exists.
- **Scaling second:** add the smallest implementation that exposes each new magnet count at its first lawful size across B1-B4 without repeats. Do not edit Centre or Wrap code. Compile and run the frozen Centre + Wrap behavior plus live scaling after every change.
- Demonstrate B1-B4 unique increasing first-lawful counts with no cross-band repeat in the running Law tab.
- Keep the tab label `v3.5.1`; use the full three-law honesty note only after scaling runs.
- Add fixed-size inspection with no implicit winner and complete three-law typed results only when their live consumer exists.
- **Full-system gate third:** run Centre + Wrap + scaling together on the live Law tab. Fix only failures observed in this completed path; no speculative hardening or broad audit may precede this gate.
- **Centre repair last and conditional:** evaluate the already-named 2mm-ruler case against the completed three-law engine. Repair only `safeSegments` or another already-named Centre defect if the measurement proves it materially changes a required law result. The repair may change only the named ruler/mesh, sliver, seat-derived-centre or tie/refusal outputs; every other frozen field stays equal. If the case does not block the completed product behavior, record that evidence and leave Centre code unchanged.
- Before adding any support kernel from §10A, record the failing fixture or measured defect that cannot be closed by reusing/re-rooming existing code, name the minimum support task required, and remove it again if it does not close that exact failure. No support task is an automatic phase.

Build completion: the live Law tab runs the frozen Centre baseline with Wrap and scaling; flap-0 contact and near-miss refusal work; B1-B4 return unique increasing first-lawful counts without repeats; Centre changes only if the final measured gate proves the named repair necessary; every support task used has a named live-code need and no unused support code remains. Commit this working engine before T4. Broader fixtures, mutations and audits remain optional §9 work.

### 10A. Conditional support tasks — not automatic phases

#### Support A — Exact-real and contact-witness code

- Invoke only when the live T3 contact behavior cannot be implemented correctly by the re-roomed donor code.
- Add the minimum rational/algebraic representation, serialization, comparison, root isolation/sign determination and segment `ContactWitness` surface required by that live code path. No float, epsilon, `guardMM`, analytic shortcut or sampled size may certify contact.

Build completion: the live contact behavior compiles and runs through the Law tab; no unused exact-value variant or comparator remains. Detailed tangency/near-miss and replay tests belong to optional §9.

#### Support B — Centre/regime code

- Invoke only when the live T3 ruler or first-lawful-size behavior cannot be implemented correctly without exact offset topology, certified region integrals/maxima, regime events or boundary sites.
- Add only the §7.1b/§7.2 mechanisms required by that live code path. No second centre implementation, mesh, tolerance or sampled size walk is created.

Build completion: the live Centre/scaling behavior compiles and runs through the Law tab; no unused event family or proof kernel remains. Detailed centre/regime mutations belong to optional §9.

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
- End R15 with one isolated working Law runtime beside the frozen Voting/Centre-rules comparators.
- Product cut-over, deletion and any one-engine migration require a separate later contract if and when Dan authorizes that work; they are not R15 build tasks.

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
    exact-real.ts      # only if Support A is invoked
    regimes.ts         # only if Support B is invoked
    contact-root.ts    # only if Support A/B is invoked
    identity.ts        # only when a live result/cache consumer requires it
  logic.ts
  engine.ts

src/lib/effect/magnetic-grid-bridge.ts
src/app/(dev)/effect-creator/grid-origin/law.worker.ts
src/app/(dev)/effect-creator/grid-origin/LawPanel.tsx
```

This is the approved maximum root, not a command to create empty or speculative modules. T1 creates only the files needed for the full isolated clone. T2 creates only the owners needed to re-room bodies that already exist. T3 creates a new module only when a live Centre/Wrap/scaling consumer or conditional Support A/B requires it. No stub, unused public surface or foundation-only file enters the build.

The existing `grid-origin` page is the shared comparison shell. Its three positioning labels are currently one persisted `positioning` switch inside one shared page model, Stage, request builder and worker—not three isolated tab components. T1 materializes the existing third **Law** selection as a complete isolated vertical clone of Centre-rules: full visible tab UI, controls, local state, request assembly, worker execution/cache branch, rendered evidence surface, `positioning===1` engine branch and its dependency closure. Voting, Centre-rules, their page state, current worker and current modules remain untouched; the existing selector gains only the mount dispatch that opens the isolated `LawPanel`. The old in-place `positioning===2` branch becomes dormant evidence outside the new runtime. T2 re-rooms the cloned engine beneath that live surface; T3 adds Wrap and scaling while Centre stays frozen, then conditionally repairs Centre only if the completed engine proves it necessary; T4 replaces the cloned worker/request/UI internals with final bridge-owned orchestration and view models without changing the already-live Law behavior. No fourth tab or second page is required.

### Required reuse

**Baseline rule:** the isolated Law package starts from the embedded `8d17780c` Centre-rules (`positioning===1`) dependency closure. No body reachable only from Voting (`positioning===0`), `registrationScore`, scoring weights/orders, phase sweep or `centeringRef` may be moved or adapted into Law. Voting and the old in-place `positioning===2` Wrap/scaling branch are evidence only. No old Wrap/scaling function body may be copied, moved or adapted into the new law. A product invariant observed there may enter only after it is independently re-derived from Dan's directive and implemented anew over the exact T3 measurements.

**Clone-then-re-room order:** first clone the Centre-rules behavioral slice and prove it still produces the accepted centre outputs. Then re-room those same bodies into spec/compute/logic/engine under the dispositions below. Only after the re-roomed centre gate passes may the faulty centre ruler be adapted, then Wrap added, then Magnet-quantity scaling added. This is not bottom-up replacement followed by an equivalence test; the preserved implementation is the starting material.

**Full vertical clone boundary:** the T1 clone begins at the current `grid-origin/page.tsx` Centre-rules experience and ends at the bodies that produce and render its result. It includes the shared visible bench surface needed to operate Centre-rules, its Centering controls and evidence display, its local state/defaults, newest-only request queue, request/config assembly, the relevant `solve.worker.ts` cache/band/replay/prefetch execution, `grid-origin.ts positioning===1`, and every reachable body in `grid-origin-spec.ts`, `grid-origin-compute.ts`, `grid-origin-logic.ts` and `grid-origin-bridge.ts`. The isolated clone substitutes only file/import names, request identity and persisted namespace; every cloned function body and JSX subtree is copied from the embedded donor snapshot before re-rooming. It imports or calls no current `grid-origin*` runtime or current worker. Voting-only bodies and the existing `positioning===2` branch are excluded. The original Centre-rules tab and isolated Law clone remain separately selectable throughout T1-T4 so every code change is immediately observable against the frozen baseline.

**What centering is preserved versus repaired:** preserve `governMass` branch semantics, the governor set, centre-rule branch meanings, node/gap parity canon and all four centred placements. T1 clones the current governor body verbatim; T2 re-rooms it without behavioral change. T3 adapts only the measurement bodies proved wrong. If the live repair needs exact comparison, Support A supplies only that minimum. The known ruler defect is current `safeSegments`: it samples clearance on a fixed 2mm mesh anchored to each scaled bbox, so its argmax jumps between samples as scale changes. Measured result: mesh centre left ~0.069mm contact residue; an exactly computed centre reduced it to ~0.000055mm reporting noise. Because erosion/mass depth is a fixed physical millimetre value while the shape scales, the mass map genuinely changes per scale; computing one normalized centre and scaling it is not equivalent.

Clone a current function body only when the embedded source and disposition table classify it for the current phase; do not alter its current consumers. The clone is temporary. Initial donor candidates are the exact segment-seat kernel, pure bbox traversal and contour scaling. The current mesh-derived centre evidence, `splitPerimeter`, float tangency/gap helpers, scoring helpers and shape adapters are source evidence—not pre-approved reuse.

Every cloned body receives exactly one disposition while T1 is built: `MOVE-VERBATIM` (function text copied from the embedded donor), `ADAPT` (only the named file/import/request-identity/persisted-namespace substitution), or `EXCLUDE` (Voting-only, old-Law-only or outside the Centre-rules closure). “Where possible”, silent rewrite and unclassified code are forbidden.

### Untangle map — current source to Law owner

| Current body | Disposition | Law destination and proof |
|---|---|---|
| `grid-origin.ts parityHolds` | MOVE-VERBATIM in T1; ADAPT only during a named T3 repair | `logic.ts parityIsLawful`; preserve donor behavior until the repair step |
| `grid-origin.ts` Centre-rules four parity placements | MOVE-VERBATIM in T1; RE-ROOM without behavior change in T2 | neutral placement measurements in compute; centre-law acceptance in logic; no ruler/Wrap/scaling change during the move |
| `grid-origin.ts` Law ranking (`lawful → count → press → gravity`) | REFERENCE-EVIDENCE only in T3; no body reuse | Re-derive the ruled ordering from Dan's directive over new exact measurements in `logic.ts`; the existing `positioning===2` ranking body is never copied or adapted |
| `grid-origin.ts bandWalk` gate/refinement/no-repeat | MOVE reached Centre-rules behavior through T1/T2; DELETE+REPLACE when T3 adds scaling | T1/T2 preserve the sampled walk and `seatMarginMM`; T3 may reuse its call boundary only, never its sampled scan/gate/refinement body |
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

The untangle table plus T1 ADAPT-EXTRACT map is closed. No body, state owner, request/result field or dependency row may be added during T1/T2 without revising R15 first.

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
| `compute/regimes.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts`, `compute/centre-evidence.ts` |
| `compute/contact-root.ts` | `spec.ts`, `compute/exact-real.ts`, `compute/seat.ts`, `compute/centre-evidence.ts`, `compute/regimes.ts` |
| `compute/identity.ts` | `spec.ts`, `compute/exact-real.ts` |
| `logic.ts` | `spec.ts` types/measured records plus only `compareExact` from `compute.ts`; no geometry functions or other compute import |
| `engine.ts` | `spec.ts`, `compute.ts`, `logic.ts` |
| `magnetic-grid-bridge.ts` | public `engine.ts`, shape/vector adapters |
| `law.worker.ts` | T1-T3: isolated clone of the Centre-rules worker execution/cache branch; T4 onward: Law bridge service only. The current worker is outside the new package and unchanged during proof |
| `LawPanel.tsx` | T1-T3: isolated full UI/state/request/render clone used as the live equivalence harness; T4 onward: Law bridge view model, actions and control metadata only; never imports current `grid-origin*` runtime |
| existing page | existing comparator imports plus `LawPanel`; its existing three-way selector owns only the selection/mount dispatch. Its pre-existing Voting/Centre-rules source regions, state and worker remain unchanged |

The separation guard parses imports and ASTs. A convention comment is not enforcement. Its phase profile is explicit: T1 first proves the isolated vertical clone and forbids any runtime edge back to current `grid-origin*`; T2 makes the portable package obey the final import DAG as its bodies are re-roomed; T4 makes `law.worker.ts` transport-only and `LawPanel.tsx` bridge-only. A later profile may tighten an earlier profile but never waive comparator immutability or portable-package separation.

## 6. Module contracts

These contracts define ownership and the maximum build API. A phase implements only the declarations required by bodies and consumers that exist in that phase. `ExactReal`, certified witnesses, regime/event surfaces and their serializers enter the runtime only when live T3 code invokes conditional Support A/B. No phase creates unused declarations merely because they appear below; every implemented declaration keeps the owner/import/behavior contract shown here.

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

/** Owns first-lawful count selection, cross-band ownership, conflicts and all refusal propagation. */
export function reduceBandLadders(
  centres: readonly CentreLawEvaluation[],
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

The engine evaluates the full user-selectable B1-B4 horizon and returns all lawful rungs and every co-lawful layout at each rung. `candidateId` is a content identity for cache/replay, never a tie-break. The payload stores verdict-changing truth (deduplicated centre evidence by id, phase, belt, required flap); the bridge derives field spots and SVG projections without re-solving. It does not choose a commercial default. Throughout T1-T4 the bridge passes the complete `CentrePolicy`; `logic.ts` alone owns `evaluateCentreLaw`.

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

If a live result/cache consumer requires it, `compute/identity.ts` assigns neutral `geometryLayoutId` and `measuredId` to the complete rooted record before Logic sees it. Engine derives `policyIdentity` from the complete config through `policyIdentityOf`; callers cannot supply it. Logic uses `measuredId` for stable ordering and carries the opaque identity; it never hashes or reconstructs geometry. After Logic returns `LawReduction`, engine assembly calls neutral `finalizeResultIdentity()` and exposes `layoutId = geometryLayoutId`, `candidateId = resultId`. Thus two configured outputs with different Coverage, MagnetPlan, flap or centre policy cannot share a content-complete result id, while their neutral geometry identity remains comparable. A report-only decimal never enters identity.

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
- derive every Law control label, option, bound and default from public engine/spec data and expose them as bridge view models; the page contains no engine-law constant or policy branch; the ruled `v3.5.1` tab label is the only version literal;
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
  engineId: 'v351-law-comparison'
  operation: SolveOperation
}
```

The all-band response contains complete lawful layouts and their evidence; selecting a rung/layout is a pure lookup by `candidateId`, never another worker operation. Any exact integer coefficients and rational terms used by live Support A/B code serialize as decimal strings so structured clone and canonical JSON are byte-stable across runtimes.

## 7. Necessity-gated exact algorithm reference

These mechanisms are approved code options, not an automatic construction programme. T3 begins from the working re-roomed clone and implements the smallest complete Centre repair, Wrap law and scaling law. A §7 mechanism enters the build only when the live engine cannot deliver the required behavior without it; conditional Support A/B then applies. Unused mechanisms are not built.

### 7.1 The supplied final contour is the Law engine boundary

Dan's WYSIWYG law is settled: the final user-edited shape must be the shape displayed, measured, printed and cut. This engine build does not wire ONEMO Studio; the comparison bench already loads premade exported cutouts. Law accepts the same normalized final contour the shell supplies to the existing modes and does not retrace, decimate, smooth or reinterpret it.

Every finite supplied coordinate is converted to its exact IEEE-754 binary rational, preserving the actual input bit pattern with no rounding or policy quantum. `contourIdentity` hashes the ordered coordinate bits. `BoundaryTruth` is carried into every prepared contour, witness, layout identity, worker envelope and cache key. Display and truth dots use the same supplied contour returned with the Law result.

The admitted Law domain is exactly one primitive: line segments from the supplied contour. There is no separate analytic circle, arc or cubic path. Irrational event/contact scales still arise from segment-distance equations and are represented as real algebraic numbers: a square-free integer polynomial, a rational isolating interval containing exactly one root, and its root index. Exact comparison refines isolating intervals or uses sign determination; a displayed `number` never decides a law.

### 7.1b Certified construction of every centre evidence member

No centre comes from a mesh, decimation, sample order, visited-cell order or seated magnet.

1. **Box and material weight:** bbox midpoint and polygon area centroid are exact rational expressions over the supplied segment coordinates at the candidate scale.
2. **Legal islands:** compute the exact inward offset arrangement at `SPOT_RADIUS_MM`: shifted segment pieces, exact vertex arcs and their intersections. Normalize winding and enumerate connected components with exact predicates. These components are the islands; no sampled occupancy grid exists.

#### Item 2 executable legal-island clause

##### Exact directed pieces

At one exact candidate scale and clearance, Compute first normalizes every supplied ring by exact winding and canonical rotation. Canonical rotation compares every full cyclic exact-coordinate sequence and selects the lexicographically minimal complete sequence, not merely a minimal starting coordinate. If identical coordinate tuples occur more than once, their occurrence ordinal within the winning full cyclic sequence is the deterministic final discriminator. The material-preserving traversal is used consistently. Compute then constructs the material inward offset from the complete normalized outer ring and holes:

- Each supplied segment produces one shifted-line primitive on the material side. Its active piece is parameter-bounded by its two adjacent joins and by every exact intersection that splits it.
- A material-convex vertex joins adjacent shifted lines at their exact miter. It produces no circle primitive.
- A material-reflex vertex produces one radius-clearance arc centred on the scaled supplied vertex. The arc stores exact start/end normal directions and a directed sweep. It is never treated as a full circle.
- `featureId` derives from canonical normalized ring content plus exact feature coordinates/directions—not source indices. `pieceId` derives from `featureId`, exact scale, clearance, exact parameter interval, endpoints and sweep.
- Every arrangement piece is a directed record `{ pieceId, featureId, kind, from, to, parameterInterval, materialSide }`. `from/to` are exact rational/algebraic/certified points. Arc pieces additionally carry exact centre, radius, start/end directions and sweep. `BoundaryTruth` remains separately carried.

Necessity: without directed bounded pieces, intersections cannot be trimmed or traversed and winding is undefined. Sufficiency contribution: this names every admitted boundary primitive and excludes the previously observed convex-circle/full-line false geometry.

##### Solved intersections and trimming

Compute solves every line-line, line-arc and arc-arc intersection exactly. A solution enters the arrangement only when exact predicates prove:

- it lies on every participating line span/parameter interval;
- it lies inside every participating arc sweep;
- it satisfies every participating primitive equation;
- it is distinct from, or exactly equal to, an existing vertex under semantic exact equality.

Parallel, non-real, out-of-span and out-of-sweep solutions are discarded with their exact reason. An undecidable predicate returns `CENTRE_EVIDENCE_UNRESOLVED`; it never drops the candidate, inserts it, or treats it as equality. Adjacent line/reflex-arc tangencies are constructed as their shared exact endpoint rather than rediscovered numerically.

Compute enumerates every zero/event root of every legality predicate over each piece’s open parameter interval against every supplied boundary generator: span and sweep endpoints, outer/hole winding crossings, projection-class changes and clearance equalities. Every root becomes a split vertex. Only after exact root isolation proves every legality predicate has constant sign on the resulting open interval may its midpoint witness that interval’s sign. A midpoint without this constant-sign certificate is forbidden and returns `CENTRE_EVIDENCE_UNRESOLVED`.

###### Predicate-root certificate

```ts
export type ExactPieceParameter =
  | { kind: 'line'; t: ExactReal }
  | { kind: 'arc'; chart: 0 | 1; q: ExactReal }

export interface PiecePredicateRootCertificate {
  predicateId: 'SPAN' | 'SWEEP' | 'WINDING' | 'PROJECTION_CLASS' | 'CLEARANCE'
  generatorId: string
  chart: 'line' | 0 | 1
  primitivePolynomial: readonly string[]
  rootIndex: number
  isolating: readonly [Rational, Rational]
  multiplicity: number
  parameter: ExactPieceParameter
  originalPredicateIdentity: string
}

export interface PiecePredicateSignCertificate {
  predicateId: PiecePredicateRootCertificate['predicateId']
  generatorId: string
  sign: -1 | 1
  witness: ExactPieceParameter
  lowerRootId: string | null
  upperRootId: string | null
}

export type PiecePredicateProof =
  | {
      status: 'isolated-roots'
      roots: readonly PiecePredicateRootCertificate[]
      intervalSigns: readonly PiecePredicateSignCertificate[]
    }
  | {
      status: 'identically-zero'
      predicateId: PiecePredicateRootCertificate['predicateId']
      generatorId: string
      originalPredicateIdentity: string
      zeroPolynomialProofId: string
    }

export interface ExactPieceIntervalCertificate {
  rootsComplete: true
  lower: ExactPieceParameter
  upper: ExactPieceParameter
  proofs: readonly PiecePredicateProof[]
}
```

Every line piece uses `p(t)=from+t(to-from)`, `t∈(0,1)`.

Every arc piece is split at the stereographic chart pole when that pole lies in its directed sweep. Within each resulting chart it uses the exact rational unit-circle parameter:

```text
chart 0: u=(1-q²)/(1+q²), v=2q/(1+q²), q=v/(1+u)
chart 1: u=(q²-1)/(1+q²), v=2q/(1+q²), q=v/(1-u)
transition on overlap: q1=1/q0
p(q)=centre+radius·(u(q),v(q))
```

Start/end direction and sweep choose directed intervals in either chart by exact substitution. A chart pole inside the sweep is a boundary site and splits the arc; it is never an open-interval root. The two charts cover the complete directed sweep without infinity. No floating angle or trigonometric approximation enters ordering or membership.

For every supplied segment and every named predicate family, Compute substitutes `p(t)` or `p(q)` into the original exact predicate. It clears rational denominators. When coefficients contain admitted algebraic scale values, it eliminates those algebraic generators against their defining primitive polynomials and produces one primitive integer polynomial. Every candidate root is back-substituted into the original, unsquared predicate; extraneous roots are rejected explicitly.

Every algebraic generator has:

```ts
export interface AlgebraicGeneratorProof {
  generatorIdentity: string
  semanticSourceIdentity: string
  normalizedDefiningPolynomial: readonly string[]
  representedMinimalPolynomial: readonly string[]
  representedRootIndex: number
  representedIsolating: readonly [Rational, Rational]
  factorizationProofId: string
  eliminatedAt: number
}

export interface GeneratorEliminationStepProof {
  generatorIdentity: string
  eliminatedVariable: string
  normalizedSubresultants: readonly (readonly string[])[]
  normalizedResultant: readonly string[] | null
  removedIntegerContent: readonly string[]
  commonFactorDisposition: 'NONE' | 'DECOMPOSED' | 'IDENTICALLY_ZERO'
}
```

`semanticSourceIdentity` names the geometry/algebraic source independently of coefficient scaling, isolator refinement, discovery order or runtime object identity. `generatorIdentity` hashes:

```text
['algebraic-generator-v2',
 semanticSourceIdentity,
 representedMinimalPolynomial,
 representedRootIndex]
```

Compute exact-factorizes the normalized square-free defining polynomial into normalized primitive irreducible factors over `Q`. It proves that exactly one factor has exactly one root inside `representedIsolating`; that factor becomes `representedMinimalPolynomial`. `factorizationProofId` hashes the normalized original polynomial, the complete ordered irreducible factorization, the selected factor and the exact root-count disposition for every factor.

`representedIsolating` must contain exactly one root of `representedMinimalPolynomial`. `representedRootIndex` is that root’s global exact order within `representedMinimalPolynomial`, not within the representation-dependent original defining polynomial. Invalid or mismatched factor, isolator or root index returns `CENTRE_EVIDENCE_UNRESOLVED`.

The original normalized defining polynomial, its factorization proof and isolator remain replay data but do not enter semantic identity. Scalar polynomial multiples, a defining polynomial with extra coprime factors and valid isolator refinement preserve the same generator identity when they certify the same semantic source and represented root. Different semantic sources remain distinct even when their numeric root is equal.

Deduplication requires equal semantic source, represented minimal polynomial and represented root index. Back-substitution evaluates only against this certified represented root. Compute deduplicates generators by `generatorIdentity` and eliminates them in ascending `generatorIdentity` order, never discovery, feature or traversal order.

After denominator clearing, the substituted predicate is one exact polynomial in the piece parameter and remaining algebraic generators over the integer multivariate polynomial ring. The ring uses a fixed variable order: piece parameter first, followed by ascending generator identity. Each generator is eliminated against its normalized defining polynomial by the exact subresultant polynomial-remainder sequence, treating coefficients as polynomials in the remaining ordered variables.

Every multivariate polynomial stored in a `readonly string[]` uses canonical term tokens. One token is `coefficient|e0,e1,...,en`, where `coefficient` is a base-10 signed primitive integer with no leading `+` or zero padding, and the exponent vector has exactly one non-negative base-10 integer for each variable in the fixed order `[pieceParameter, ...ascending generatorIdentity]`. Terms with equal exponent vectors are combined exactly; zero coefficients are removed. Terms sort by descending lexicographic exponent vector. The zero polynomial is represented by the empty array `[]`, never `['0']`. A nonzero normalized step/resultant removes positive integer content, fixes the first coefficient positive, and records the removed content separately. Parsing then serializing any proof polynomial must be byte-identical.

The source encoder accepts exact integer terms and emits the one canonical token sequence. The proof decoder accepts only canonical tokens and requires decode-then-encode byte equality; shuffled terms, split like terms, leading plus, zero padding, negative zero, zero-coefficient terms, wrong exponent arity/order, and `['0']` reject rather than normalize on ingress.

When one generator is eliminated, its exponent slot remains present with exponent zero in stored subresultants/resultants until the complete elimination proof is assembled. Only the final univariate projection may omit eliminated zero slots and serialize as the existing primitive coefficient sequence, with the conversion recorded in provenance.

Required token mutations:

18. Encoder permutations/split terms produce one canonical byte sequence; each noncanonical serialized spelling is independently rejected by the decoder.
19. Two remaining generators with swapped discovery order: exponent slots follow sorted generator identity and proof bytes remain equal.
20. Zero resultant: `[]`; `['0']` and a missing exponent slot reject.
21. Normalize only completed step/resultant: raw intermediate `2*x + 4` retains coefficients until step normalization records content `2`.

Necessity: only the missing serialization grammar required by existing proof fields and replay invariance is added.

Sufficiency contribution: coefficients, variables, exponents, zero, term order, strict ingress, normalization boundary and final-univariate conversion are deterministic and executable without changing the approved algorithm.

After every elimination step, Compute:

1. removes integer content;
2. normalizes the leading coefficient positive under the fixed monomial order;
3. canonically orders terms and variables;
4. records every normalized subresultant, resultant, removed content and retained component.

Intermediate multivariate resultants are not square-free-factorized and do not decide multiplicity. Multiplicity is determined only after all generators have been eliminated and the final univariate parameter polynomial exists, using the already-ruled `gcd(p,p')` square-free factorization.

If a resultant is zero, Compute does not silently discard the predicate and does not immediately claim `identically-zero`. It uses the subresultant chain to decompose the exact common factor/component in the eliminated generator, carries each surviving component forward with provenance, and later back-substitutes it through the original unsquared predicate. `IDENTICALLY_ZERO` is permitted only when exact symbolic reduction proves the original unsquared predicate is zero over the whole piece chart interval. Any common component that cannot be decomposed and validated returns `CENTRE_EVIDENCE_UNRESOLVED`.

After the final univariate polynomial is produced, its square-free factors are sorted by normalized coefficient sequence. Candidate roots from all factors are isolated and jointly refined until pairwise disjoint, then back-substituted through the original unsquared multi-generator predicate. Extraneous factors/roots are recorded and rejected. Valid roots are merged only by semantic exact-point root identity; representation-only generator order, resultant factors, scalar polynomial multiples or isolator refinements never enter semantic identity.

The root proof record contains ordered `AlgebraicGeneratorProof[]`, ordered `GeneratorEliminationStepProof[]`, the normalized final univariate factors with multiplicity/provenance, every back-substitution disposition and the canonical semantic root ids. Any unresolved generator equality, subresultant, common-factor decomposition, factor provenance, back-substitution or global root order returns `CENTRE_EVIDENCE_UNRESOLVED` and no partial piece certificate.

Required multi-generator mutations:

11. The same two-generator predicate with opposite discovery order: byte-identical generator order, elimination proof and semantic roots.
12. Scalar-multiple defining polynomials for the same semantic source: one deduplicated generator identity.
13. Different semantic sources with the same defining polynomial: distinct generator identities and deterministic order.
14. Elimination introduces an extraneous/repeated factor: provenance records it; original-predicate back-substitution rejects only the extraneous roots without changing true-root multiplicity.
15. A zero resultant with a nonzero common component: exact subresultant decomposition continues and validates the surviving component.
16. An original predicate proven zero over the whole chart: the existing `identically-zero` proof arm, no finite/fabricated roots.
17. A zero resultant/common factor that cannot be decomposed or validated: typed unresolved, no partial certificate.
22. `x²-2` positive and negative roots under the same semantic source: distinct generator identities and conjugate-sensitive back-substitution.
23. Positive `√2` defined by `x²-2` and by `(x²-2)(x-3)`: same selected minimal polynomial/root index and same generator identity.
24. Same represented root with a refined valid isolator: same generator identity and deduplication.
25. Isolator for one root paired with another root index: typed unresolved.
26. Isolator containing roots from two irreducible factors: typed unresolved; no arbitrary factor selection.
27. Same represented numeric root under different semantic sources: distinct deterministic generator identities.

Necessity: canonical multivariate subresultant elimination is already implied by the approved algebraic-generator clause; square-free factorization remains only at the final univariate stage; common-factor handling prevents both false `identically-zero` claims and unnecessary refusal.

Sufficiency contribution: deterministic generator identity/order, exact normalized elimination, common-component disposition, final factor/multiplicity isolation, back-substitution, semantic root merge and fail-closed unresolved behavior make the approved clause executable and replay-invariant.

Projection-class roots are isolated first and split the parameter domain before point-to-segment clearance polynomials are selected. The original polynomial and `gcd(p,p')` determine multiplicity before the square-free factors are isolated. All real roots in the open directed interval are isolated and ordered exactly. Equal-end-sign pairs and even-multiplicity tangencies are therefore retained; endpoint signs never establish completeness.

If exact symbolic reduction of the original unsquared predicate produces the zero polynomial on the whole chart interval, Compute emits the `identically-zero` proof arm and no split roots. Any predicate/generator pair that is neither proven finite-root nor proven identically-zero returns `CENTRE_EVIDENCE_UNRESOLVED`.

The ordered union of piece endpoints, chart-pole splits and every certified predicate root defines the only permitted split intervals. Each root-free open interval receives a canonical dyadic-rational witness chosen inside its exact isolating bounds. Compute evaluates every nonzero original predicate against every generator at that witness and stores the exact nonzero signs plus the adjacent semantic root ids. Every predicate/generator pair has exactly one completed proof arm.

`rootsComplete:true` is emitted only after every predicate/generator pair has a completed elimination, isolation, back-substitution, multiplicity, interval-membership and ordering proof. Any unresolved step returns `CENTRE_EVIDENCE_UNRESOLVED` for the whole legal-island result; it emits no partial piece set and no boolean completeness label.

Root identity hashes:

```text
['piece-root-v1', pieceId, predicateId, generatorId,
 canonicalExactPoint(parameterSubstitution(parameter)),
 multiplicity, originalPredicateIdentity]
```

Chart, normalized primitive polynomial, root index and isolating interval remain in the replay proof record but do not enter semantic root identity. Equal semantic points obtained through either chart, scalar-multiple polynomials or refined valid isolators hash identically. Distinct roots remain distinct by exact point identity. Root ordering, interval witnesses, proof arrays and semantic identities use canonical exact ordering and are input/traversal invariant.

Required mutations:

1. A line piece whose non-owning segment projection changes from interior to endpoint strictly inside the piece.
2. A line piece with two clearance roots, lawful endpoints and unlawful middle.
3. An arc piece with two clearance roots and equal endpoint signs.
4. An arc tangency with an even-multiplicity root.
5. A chart pole inside a directed arc sweep; the root set is identical after using the other chart.
6. A root exactly at a sweep endpoint; it is owned once as a boundary vertex, never duplicated in the open interval.
7. A squared/eliminated extraneous root that fails original-predicate back-substitution.
8. An unresolved elimination, multiplicity or root-order case; typed refusal and no partial geometry.
9. The same geometric arc root through chart 0/chart 1, scalar-multiple polynomials and refined valid isolators: identical semantic root id.
10. An owning clearance predicate: `identically-zero`, no infinite/fabricated roots; deleting its zero-polynomial proof refuses.

Necessity: the two rational charts avoid a generic angular/transcendental kernel; semantic identity excludes representation-only proof data; the zero-polynomial arm is required for owning/coincident predicates; every field replays a proof explicitly required by line 658.

Sufficiency contribution: complete line and full-arc parameter coverage, algebraic coefficient elimination, every finite root and multiplicity, identically-zero predicates, extraneous-root rejection, exact ordering/sign evidence, chart/refinement-invariant identity and fail-closed unresolved behavior.

Necessity: line 658 requires actual intersections; untrimmed feature pairs create spurious topology. Sufficiency contribution: all three intersection families and every acceptance/rejection predicate are ruled.

##### Full-boundary legality and face side

Every constant-sign-certified split piece is checked against the complete supplied boundary, outer plus every hole. A piece remains active only when its certified interval signs prove it:

- lies in material under normalized outer/hole winding;
- has clearance at least the ruled value from every supplied segment;
- has equality to the feature that owns the offset piece.

Compute keeps the direction whose left side is material. It proves face-side legality from the owning primitive’s material normal/sweep, exact directed edge and constant-sign certificates; it never chooses whichever half-edge orientation is visited first. Exterior and illegal faces are rejected by exact material-left legality, not signed orientation, feature-name prefixes or an uncertified probe.

Necessity: primitive membership alone does not prove that a face belongs to the erosion. Sufficiency contribution: every surviving piece is a boundary of the exact full-contour legal set.

##### Half-edge faces and canonical identity

The arrangement is a directed half-edge graph. At every vertex, outgoing half-edges are ordered by exact direction predicates. Face traversal always takes the next material-left half-edge. Degree greater than two, coincident/tangent vertices and triple concurrency are handled by this ordering; iteration or input order cannot choose a route.

One canonical loop identity hashes:

`['offset-loop-v1', canonicalExact(scale), canonicalExact(clearance), canonical rotation of ordered directed [pieceId, featureId, kind, from, to, parameterInterval, sweep, materialSide]]`

Canonical rotation starts at the lexicographically minimal full cyclic directed-piece sequence, using the same duplicate-occurrence rule as normalized rings. Content-derived feature/piece ids make ring, vertex, feature, intersection and queue reordering identity-invariant. Raw `BoundaryTruth` is carried alongside each loop/evidence result but never enters the semantic loop or island hash because it intentionally records ordered supplied bits. Reversal is not equivalent because it changes material-left legality. Two routes sharing vertices but different pieces remain distinct. Any unresolved equality or angle order returns `CENTRE_EVIDENCE_UNRESOLVED`.

Necessity: unordered vertex bags cannot represent arcs, winding or degree-greater-than-two faces. Sufficiency contribution: loops are deterministic, directed and content-complete.

##### Winding, islands and holes

Compute determines topological winding from ordered directed pieces. Lines use exact ray/turn predicates. Arcs use exact centre/radius/start/end/sweep predicates and exact ray–arc intersections; no chord and no item-4 Green/area integral substitutes for an arc. Winding proves geometric containment only. Legal face versus opposite half-edge face is decided independently by exact material-left legality on every piece.

- A loop whose directed pieces all prove material on the left seeds a legal boundary; its opposite half-edge traversal is rejected.
- Exact line/arc containment forms a strict partial order. Containment depth alternates outer and hole boundaries.
- Each hole is assigned to its unique immediate containing outer: the containing legal outer at greatest containment depth with no containing outer strictly between them. No item-4 area integral is used. Zero or multiple immediate owners for a hole returns `CENTRE_EVIDENCE_UNRESOLVED`. A top-level outer has no containing owner and must not refuse for that reason.
- Disjoint outer loops are separate islands. Nested holes and multiple islands are preserved.
- A hole boundary with no unique immediate containing outer, or undecidable containment/depth, returns `CENTRE_EVIDENCE_UNRESOLVED`.

Canonical output ordering sorts island outer loops by semantic loop identity and sorts every island’s hole list by semantic loop identity. `evidenceId` hashes `['legal-islands-v1', canonicalExact(scale), canonicalExact(clearance), ordered [outerLoopId, ordered holeLoopIds]]`. Raw `BoundaryTruth` is carried separately beside this semantic evidence and does not enter `evidenceId`.

The result is `ExactLegalIslands { islands, evidenceId, boundaryTruth }`, each with one ordered material-left outer loop and its unique immediate ordered hole loops. No area/centroid/deepest value is computed until its later clause.

Necessity: line 658 explicitly requires normalized winding and connected components. Sufficiency contribution: exterior rejection, multi-island separation and hole nesting are fully ruled without borrowing item 4.

##### Required item-2 fixtures

1. Convex triangle: three shifted-line miters, zero reflex arcs, one island.
2. Concave L/notch: exact reflex arcs with sweep rejection; one island.
3. Dumbbell neck: below the exact clearance event two islands; above it one; event site has one explicit disposition.
4. Supplied off-centre hole: one island with one immediate nested hole; reversing/rotating/reindexing either ring leaves feature, piece, loop, island and semantic evidence ids byte-identical, while raw `BoundaryTruth` differs where ordered supplied bits differ and remains separately carried.
5. Two islands plus nested outer/hole boundaries: containment depth assigns the hole to its unique immediate outer, never by area, array order or “region 0”; ambiguity refuses.
6. Same vertices/different arc route: distinct canonical loop identities.
7. Degree-four crossing and triple concurrency: reordered features/traversal produce byte-identical loop identities and islands.
8. Exterior face: rejected.
9. Tangent duplicate: one exact vertex, not two near vertices.
10. Deliberately unresolved equality/order/containment or incomplete legality-root isolation: typed `CENTRE_EVIDENCE_UNRESOLVED`; no partial island result.

Every fixture mutates its load-bearing predicate (span, sweep, material side, ordered piece identity, arc contribution, containment owner or unresolved propagation) and must fail when that predicate is removed.

3. **Depth masses:** repeat the same exact offset-region construction at the ruled mass-depth clearance. Birth, death, split and merge are arrangement events and feed `SAFE_TOPOLOGY`; no `MAXV` or millimetre step exists.
4. **Core/region centres and areas:** integrate the exact offset boundary pieces. Rational/algebraic results use those forms directly; arc/integral expressions use `CertifiedExpressionReal`, evaluated by deterministic BigInt interval arithmetic with directed bounds. The expression and proof id serialize across runtimes.
5. **Deepest/clearance maxima:** if live Support B requires this mechanism, enumerate every generalized Voronoi/medial-axis candidate generated by two/three boundary features plus admissible endpoints. Solve candidates exactly, then run hierarchical branch-and-bound over the remaining domain using clearance's 1-Lipschitz per-cell upper bound. Equal maxima remain an explicit tie set; undecidable bounds return `CENTRE_EVIDENCE_UNRESOLVED`—never a sampled point.
6. **Governed-centre identity:** compute records all co-equal evidence branches. Logic applies the complete `CentrePolicy` and returns one `CentreDecision`, an explicit `CentreTie`, or a typed refusal. Every area/depth/top-half/maximizer equality that can change the result is a `CENTRE_IDENTITY` event.

Fixtures include: the prior 2mm-mesh residue case; a sliver-hijack shape; two near-equal clearance maxima whose exact bounds select the ruled winner; an exactly equal pair that must remain a tie; and a deliberately unresolved enclosure that must refuse. Reordering input segments or traversal queues cannot change evidence ids, decisions or refusals.

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

The comparison tab exposes only controls that map truthfully to the live engine build.
