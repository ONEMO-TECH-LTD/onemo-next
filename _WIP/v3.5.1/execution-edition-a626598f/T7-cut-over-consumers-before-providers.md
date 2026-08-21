# Magnetic Grid v3.5.1 — portable three-rule engine proposal and execution contract

Status: DRAFT FOR DAN REVIEW
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: architecture, code contract, proof contract, and deletion-complete cut-over plan. No implementation is authorized by this document alone.

## 10. Clone → compare → delete execution plan

Every task is one commit, compiles alone, and receives focused tests plus a real surface gate. No push/merge/publication is implied.

### T7 — Cut over consumers before deleting providers

Dependency order:

1. Page: remove v3.5 modes/cards/controls; consume v3.5.1 bridge only.
2. Worker: remove v3.5 message path, config fields, caches, and `seatMarginMM`; consume bridge service only.
3. Old bridge consumers: switch remaining imports to the canonical bridge/API.
4. Delete old `grid-origin` door branches and exports.
5. Delete old logic and scoring.
6. Delete old spec values.
7. Delete old compute only after every reused primitive exists in the canonical package.
8. Delete old bridge.
9. After Dan's lane-precedence ruling, consume the T0 disposition manifest item by item: move kernel bodies, migrate every magnetic-grid consumer, then delete each proven-superseded `src/lib/grid-engine` artifact with its generated outputs, manifests, fixtures, and stale docs. A proven unrelated primitive may survive only after moving under its actual general-purpose owner. No action against the active v3.2 lane is authorized before that ruling, and no second magnetic-grid authority may survive final cut-over.
10. Remove old persisted namespace and stale screenshots/probes.

Each numbered deletion is its own compile-clean commit. Consumers die before providers.

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

### Required replacement after Dan's final proof

- The isolated Law package becomes the sole engine algorithm only after Dan's final live tests.
- Auto flap becomes a direct required-allowance calculation, not a 2mm scan.
- Manual/Free becomes inspection, not an alternative placement solver.
- Worker caching becomes bridge-owned orchestration with an executable request-sequence contract.

### Required deletion at cut-over

- Voting and old Centre-rules branches.
- All scoring weights, score functions, dominance orders, and placement sweep code.
- Placement-step control and phase search.
- `seatMarginMM`, `pressExcessMM`, old auto-flap scan, and the numeric `impliedFlapMM` API after its corrected worst-belt body is moved into the certified exact implementation.
- `positioning`, `votingOrder`, legacy `phaseStepMM`, and scoring-era persisted keys.
- `panMM`, `bestKx`, `bestKy`, and all zero-consumer registration state.
- Old `grid-origin` spec/compute/logic/door after all consumers use the canonical package.
- Every magnetic-grid authority under the existing `src/lib/grid-engine` family, but only after T0 records every tracked artifact and live consumer, Dan resolves precedence with the active v3.2 rebuild lane, kernel donors move, and consumers migrate. The contract does not pre-authorize deletion of another live lane. No second magnetic-grid authority may survive final cut-over; any proven unrelated reusable primitive moves under its actual general-purpose owner.
- Comparison UI and legacy documentation after Dan’s proof gate.

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
