# Magnetic Grid v3.5.1 — portable three-rule engine proposal and execution contract

Status: DRAFT FOR DAN REVIEW
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: architecture, code contract, proof contract, and deletion-complete cut-over plan. No implementation is authorized by this document alone.

## 10. Clone → compare → delete execution plan

Every task is one commit, compiles alone, and receives focused tests plus a real surface gate. No push/merge/publication is implied.

### T0 — Characterize v3.5 before moving code

- Freeze the current baseline (`8d17780c` for this revision), hashes, public exports, worker envelope/cache shapes, persisted keys, and the 11-file runtime inventory.
- Record the provisional §9.5 performance-limit owner/provenance and declared devices; obtain Dan's ratification or replacement before T1b starts.
- Add current-behavior fixtures for proven geometry primitives only.
- Record Voting, Centre-rules and the old in-place `positioning===2` outputs as evidence, never expected v3.5.1 winners. The old Law branch is not a live comparator after T4.
- Build the donor graph from the Centre-rules branch outward and mark every Voting-only symbol `DELETE-LATER / NOT-A-LAW-DONOR`; the T1 allowlist contains no Voting-only body.
- Treat accepted Centre-rules governing-mass/evidence and node-gap parity outputs across every §9.4 shape, B1-B4 comparison scale and all nine `CentrePolicy` combinations as the centering characterization baseline. Create the named defect allowlist with side-by-side evidence; Dan sees every allowed difference before T5. No policy combination may be deduplicated unless T0 proves equivalence and records an explicit ADAPT/DELETE disposition.
- Complete the §3 untangle map for every tracked module body; record MOVE-VERBATIM function hashes, ADAPT reasons/equivalence fixtures, and DELETE evidence. No unclassified body may enter T1.
- Inventory every production consumer and tracked artifact under both `grid-origin*` and `src/lib/grid-engine/**`; record exports, re-exports, runtime/test/build consumers, generated-source owner, active-lane owner, destination, and deletion proof. Legal dispositions are `MOVE-BODY`, `MIGRATE-CONSUMER-THEN-DELETE`, or `PROVEN-UNRELATED` under a non-grid owner. `KEEP-AS-SECOND-GRID-ENGINE` is forbidden.
- Record the active `session62-task/s62-kai-lead-v3.2-rv-t3` T5-T9 state and its consumers. Obtain Dan's lane-precedence ruling before any task may modify or delete that lane's files.
- No product code change.

Gate: characterization tests pass at the frozen baseline; the symbol/untangle map and re-export-aware disposition manifest are complete; every MOVE hash and ADAPT equivalence fixture is recorded; zero bodies are unclassified; active-lane ownership is recorded. This gate authorizes package work only, not deletion of `grid-engine/**`.

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

### Untangle map — current source to Law owner

| Current body | Disposition | Law destination and proof |
|---|---|---|
| `grid-origin.ts parityHolds` | ADAPT: exact point types replace micron-rounded phases | `logic.ts parityIsLawful`; equivalence on every T0 parity fixture, plus exact off-grid cases |
| `grid-origin.ts` Centre-rules four parity placements | ADAPT/RE-ROOM: retain node/gap canon, remove shared-door ranking dependencies | neutral placement measurements in compute; centre-law acceptance in logic; equivalence on every accepted centering-tab fixture |
| `grid-origin.ts` Law ranking (`lawful → count → press → gravity`) | ADAPT: exact flap values and explicit tie sets replace rounded `pressQ` winner | `logic.ts chooseLawfulCandidate`; T0 winners remain members of the new co-lawful set |
| `grid-origin.ts bandWalk` gate/refinement/no-repeat | ADAPT preserved first-count/no-repeat behavior + DELETE sampled walk/tolerance | exact contact roots in `compute/contact-root.ts`; centre/wrap/no-repeat predicates in `logic.ts`; sequencing/result assembly in `engine.ts`; equivalence on characterized integer-contact cases, named differences only for tolerance/search defects |
| `grid-origin.ts autoFlapInBand` | ADAPT: allowance scan deleted | `logic.ts` selects the minimum exact required allowance measured by compute; characterized whole-mm cases remain equal |
| `grid-origin-logic.ts centeringAnchors` | ADAPT accepted centre-mode behavior + DELETE mesh/sample implementation | arithmetic re-roomed to `compute/centre-evidence.ts`; `logic.ts evaluateCentreLaw` owns the same ruled branch; equivalence across the centering baseline, differences only on the named mesh/sliver/seat-derived/tie defect allowlist |
| `grid-origin-logic.ts governMass` | ADAPT representation only + DELETE numeric-signature body after compatibility gate | T1 clones the current body verbatim against numeric evidence; final `evaluateCentreLaw` replaces native number comparison with `compareExact` while preserving identical governor branches/decisions across the full centering baseline |
| `grid-origin-logic.ts assignSizes` | ADAPT measurement/policy separation + DELETE mixed-layer body | extrema/corner measurements in `compute/seat.ts`; magnet-plan policy in `logic.ts`; anchor diameters byte-equal on every T0 fixture |
| `grid-origin-compute.ts splitPerimeter` | ADAPT: measurement and belt policy separated | neighbour measurements in `compute/seat.ts`; belt classification in `logic.ts`; any reach value is named in spec and must be T0-characterized before reuse |
| `solve.worker.ts` seat-inflation branches and direct `computeGrid` prefetch | DELETE from Law | one Law config owner in engine/bridge; `law.worker.ts` transports only |
| `page.tsx circle:` analytic predicate choice | DELETE from Law | supplied-contour segment domain has no alternate circle path; current comparator branch remains untouched during proof |
| exact segment-seat kernel, pure bbox traversal, contour scaling | candidate MOVE-VERBATIM | destination compute submodule fixed by T0; donor/copy function hashes equal |
| `registrationScore`, `ORDERS`, weights, `centeringRef`, placement sweep, `seatMarginMM`, `panMM`, `bestKx/bestKy`, positioning/voting state | DELETE at Dan-approved cut-over | no Law destination; characterization proves they belong only to untrusted comparators |

T0 fails if a tracked body has no row/disposition. The table may gain rows from the complete inventory, but no row may disappear without evidence.

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
