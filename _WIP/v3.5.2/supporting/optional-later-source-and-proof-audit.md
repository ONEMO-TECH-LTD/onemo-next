# Magnetic Grid v3.5.2 — portable three-rule engine and live comparison tab build contract

Status: SUPERSEDED 2026-08-22 — describes the rejected regime/Support-A/B contract; historical evidence only, not authority. The current optional audit is master §9 (v3.5.2-1).

Status: supporting v3.5.2 reference; not execution authority
Version: v3.5.2 — full vertical Centre-rules clone in T1
Source baseline: `session62-task/grid-v3.5` at `8d17780c`
Scope: code reconstruction of the portable engine and live comparison tab only.

## 10. Engine and live-tab build sequence

Every semantic code change is one rollback commit and compiles/runs before the next code change. T1-T4 build the working code first. The optional §9 proof/audit work may follow after the build and does not authorize extra engine infrastructure. No push/merge/publication is implied.

## 9. Optional later proof and audit reference — not build phases

Nothing in this section precedes or blocks T1-T4 code construction. Use these fixtures, mutation checks and comparison matrices after the engine and tab code run, or earlier only when they directly help diagnose a live build failure.

### 9.1 Module separation

AST/import guard asserts:

- spec has no functions/arithmetic;
- compute imports spec only through the declared internal DAG and has no policy selection, ranking or UI imports;
- logic imports spec/measured records only and has no geometry arithmetic or geometry functions;
- engine is the only compute+logic orchestrator and contains no law predicate, ranking, geometry arithmetic or view mapping;
- bridge is the only adapter/caching surface;
- T1-T3 `law.worker.ts` clone imports only isolated Law-clone modules and shares no cache, request identity or runtime import with the current worker; T4 replaces it with a worker that imports the Law bridge service only. The current worker remains hash-identical throughout comparison;
- T1-T3 `LawPanel.tsx` is the isolated full Centre-rules UI/state/request/render clone and cannot read current `grid-origin.*` state; T4 replaces its cloned internals so it imports bridge/view types/actions only and carries no Law numeric literal;
- the existing page retains its three-way selector and adds only the isolated `LawPanel` mount dispatch; the pre-existing comparator source regions, state/request branch and every old module/worker remain unchanged from the embedded donor source;
- T1 clone provenance pins every copied UI JSX subtree, state/default block, request-builder body, worker/cache body and Centre-rules dependency body to its exact donor hash except named file/import/request-identity/persisted-namespace substitutions; mutation of an unlisted clone byte fails the pre-room equivalence gate;
- every Law control label, option, bound and default in the rendered model traces to spec through engine API and bridge; no UI hardcode can pass by falling below a numeric threshold.
- compute APIs reject policy-bearing configs at compile time; for identical boundary/geometry inputs, event sets and centre-branch measurements are byte-identical across every `CentrePolicy` combination because logic filters only after measurement.
- engine AST contains no `parityTrue`/`wrapTrue` read, flap comparison, refusal-code switch, first-lawful/count ownership or conflict reducer; those symbols/functions are logic-owned and engine only calls `reduceBandLadders` then assembles its returned decision.
- the Law package contains no Voting-only symbol/body/import (`registrationScore`, orders/weights, phase sweep, `centeringRef`, voting config); the embedded Centre-rules donor/disposition table is the only initial reuse surface.
- Logic's only compute import is `compareExact`; the guard rejects every geometry/identity/root import and any native numeric comparison of `ExactReal` law values.

### 9.2 Three-law fixtures

1. **Centre:** odd single sits exactly on governed centre; even pair midpoint/centering line equals it; off-centre manual phase returns `parityTrue=false` and an explicit concession.
2. **Wrap:** flap 0 rungs carry a certified spot-edge `ContactWitness`; integer size scans find no circle/ellipse rungs while solve-not-search finds and certifies them; adapter source variation cannot widen the gate.
3. **Scaling:** across B1-B4, counts are unique and increasing; each rung is first lawful size for that count; no lower-band count repeats.
4. **Auto:** first lawful 1mm requirement returns 1mm; cap refusal is typed; Free and band use identical worst-belt measurement.
5. **Defaults:** public empty config uses 12mm spot radius; 24/72/120 standards are tangent.
6. **Gravity:** equal lawful pair chooses vertical; non-equal candidates are not relabeled a gravity tie.
7. **Truth dots:** rendered only from stored `ContactWitness` points; allowance-ring contact earns no spot dot; deleting any witness deletes its dot.
8. **Centre ties:** equal-evidence centres return a typed tie set in comparison; no iteration-order winner is manufactured.
9. **Identity:** Node and browser recomputation produce byte-identical `layoutId`/`candidateId`; anchor order and float formatting mutations cannot change identity.
10. **Regime completeness:** a sub-1mm narrow regime, equal-end-sign two-root case, unchanged-topology centre branch swap, mass birth/death, parity flip, binding-element swap, exact tangential double root, arbitrarily close near-miss, and band-boundary root are each asserted. Disabling any event family must delete or mis-own a known lawful rung and fail its fixture.
11. **One supplied contour:** Voting, Centre-rules and Law receive the same premade normalized contour during comparison; Law returns that contour unchanged for display/truth dots. Mutating the Law adapter to retrace, decimate, smooth or substitute a separate circle/curve primitive must fail the fixture.
12. **Certified centre evidence:** prior mesh-residue and sliver-hijack fixtures, near-equal maxima with a proved winner, exact-equal maxima preserved as a tie, and an unresolved enclosure returning `CENTRE_EVIDENCE_UNRESOLVED`; segment/traversal reorder mutations cannot change the result.
13. **Proven centering base:** after the code build, the optional matrix compares every §9.4 shape, B1-B4 scale and `CentrePolicy` combination. Differences require a named mesh/sliver/seat-derived/tie repair; an unlisted difference fails the optional audit.
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

The original Centre-rules tab and full isolated Law clone are both live from T1 onward. The initial clone frame must match before re-rooming; the same matrix reruns after every re-room, ruler, Wrap, scaling, worker/bridge and UI-finalization increment so the first divergent commit is observable rather than reconstructed later.

Dan’s “proven” gate requires all four user-selectable bands, B1-B4.

#### T1 frozen vertical donor snapshot — `8d17780c`

The Centre-rules donor is `src/app/(dev)/effect-creator/grid-origin/**` plus `src/lib/effect/grid-origin*`. The separate Session 59 `src/app/(dev)/effect-creator/grid-lab/**` workbench has no Voting/Centre-rules/Law positioning switch and is not a donor for this clone.

The files below are copied byte-for-byte from `8d17780cb0efb5db896f9ac62d03b01d6bbed89b`. They are the complete source available to execute the T1 full vertical clone without hunting elsewhere. The disposition table controls which bodies enter Law: Voting-only and existing `positioning===2` bodies remain excluded even though their surrounding source file is reproduced for exact context.

| Frozen donor file | SHA-256 |
|---|---|
| `src/app/(dev)/effect-creator/grid-origin/page.tsx` | `515603b5ca2a4e13df24b24789e2f7828556bd9038d846aed9274b1cf3bcf1cf` |
| `src/app/(dev)/effect-creator/grid-origin/solve.worker.ts` | `0352f320cfeeb89cea7634b3d186cba4c5d50cf7329d6d49a0bf628d3fa17e0c` |
| `src/lib/effect/grid-origin.ts` | `4afa144c7be468f94a9e6efc2f4b5c64c3ee1430c0963dac5a24c3afdea06fe7` |
| `src/lib/effect/grid-origin-spec.ts` | `bc8df2bc297f76a7e1f4dd4964b0582f5dd1cb9e0e45bd989870d11eb00fe9e6` |
| `src/lib/effect/grid-origin-compute.ts` | `44b5144fb493284d28be3fff6c82c1be93ff8be90bad052ba6fa0569f6ab90fc` |
| `src/lib/effect/grid-origin-logic.ts` | `bc317ef497bbcf19d0fdd9ae56431bd9ab5aab4ded470b363008e010de54659e` |
| `src/lib/effect/grid-origin-bridge.ts` | `4878c9934c31f8ba54fd4c7cad7b7ac4a3552eb34da268321f6906db97a14eb0` |
| `src/lib/grid-engine/compute/geometry.ts` | `0bca7ef8e0a407779608a40e93145bc54785fa300198559d161c09113d26195e` |

## 11. Optional later acceptance audit

### Product

- [ ] Exactly three selectable comparison modes exist; Law uses one isolated new runtime and Voting/Centre-rules remain frozen legacy comparators.
- [ ] Centre is derived from shape evidence before seats.
- [ ] The Law centre result is one decision, an explicit tie or a typed refusal; never an iteration-order tie-break.
- [ ] Flap 0 rungs carry a certified spot-edge contact witness at a solved exact scale; no policy tolerance or size scan is added.
- [ ] Auto returns the minimum exact required allowance; Free and band agree.
- [ ] Every B1-B4 rung is the first lawful size for a unique increasing count.
- [ ] No silent fallback or concession exists.
- [ ] No score/weight/preference exists in the isolated Law runtime.
- [ ] Co-lawful comparison ties remain explicit.

### Architecture

- [ ] Portable package imports no React, Next, app, browser, or filesystem code.
- [ ] UI imports only bridge/view contracts.
- [ ] Worker is transport only; bridge service owns tested orchestration.
- [ ] Spec/compute/logic/engine import law passes.
- [ ] Public default is the released 12mm spot radius.
- [ ] Candidate identity is exact-canonical and byte-equal across Node/browser replay.
- [ ] Exact scale/contact certificates are byte-equal across Node, browser, worker transport, and cache replay.
- [ ] Law admits supplied contour segments only and returns the same contour for display/truth dots; no analytic or retraced alternative exists.

## 12. Risks and build constraints

| Risk | Build constraint |
|---|---|
| Clone silently differs before any intended repair | T1 copies from the embedded donor snapshot and must run before structural changes |
| Re-rooming changes behavior | T2 changes ownership only and runs the same Law surface after every commit |
| Later law rewrites an earlier law | T3 freezes Centre before Wrap and Centre+Wrap before scaling |
| Support infrastructure becomes the project | Support A/B require a live code need and leave no unused module or public surface |
| Adapter changes the boundary being solved | Law adapter is pass-through; the same supplied contour feeds solve and display |
| Worker/state collides with the frozen comparator | T1-T3 use an isolated request/worker/cache/namespace; T4 finalizes the separate bridge path |

## 13. Necessity and sufficiency verdict

**Necessity — no unnecessary elements.** T1 builds the complete isolated Centre-rules vertical clone immediately from embedded source so every later change is observable. T2 re-rooms only code already running in that clone. T3 performs only the measured Centre repair, Wrap and scaling work required for the product. T4 replaces temporary cloned orchestration/UI internals with the final bridge/worker/view ownership. Support A/B are conditional code options, never phases, tests or foundation work.

**Sufficiency — delivers the code rebuild in full.** The contract produces a working isolated Law tab, a re-roomed portable engine, corrected Centre behavior, Wrap, Magnet-quantity scaling and final bridge/worker/UI wiring while the original Centre-rules path remains available for comparison. Each phase ends in compiling, running code and a rollback commit. Optional proof/audit references may be used after the build but cannot delay code construction or authorize extra infrastructure.
