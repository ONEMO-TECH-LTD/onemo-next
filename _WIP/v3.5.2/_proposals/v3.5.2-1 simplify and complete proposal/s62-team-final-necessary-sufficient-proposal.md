# v3.5.2 final necessary-and-sufficient completion proposal

Status: consolidated R2 candidate pending explicit Grid-QA and Lead acceptance.

## Deliverable

Starting from a fresh clean product worktree at `2c043257`, graduate the existing `bandWalk` into the scaling law. Preserve the cleared Centre and Wrap behavior, then connect the stored B1-B4 result to the existing isolated worker and `v3.5.2` tab.

The finished tab enforces:

1. the existing Centre selection;
2. exact fixed/Auto Wrap on the same selected geometry;
3. the next available lawful magnet count, strictly greater than the previous rung, at an exact local contact scale;
4. one stored worker result and truthful UI.

Counts may increase by more than one when no intermediate lawful count exists.

## Minimal diff

No new runtime module, exact-Centre engine, global event platform or phase.

Edit only the existing magnetic-grid engine files, their focused tests and separation guard. After the engine is complete, edit only the existing bridge, `law.worker.ts` and `LawPanel.tsx` for the stored-result cut-over.

The existing walk remains discovery. The existing exact seat and Wrap machinery remains law. The only new mathematics is the local rational/quadratic contact solve for a state the walk has actually observed.

## 1. Keep the existing configuration surface

Keep `GridConfig`. Do not introduce a parallel public configuration schema.

At the Engine boundary, resolve its existing optional fields once to the existing defaults. The resolved record drives Compute, Logic and cache/policy identity. Pitch, padding/effective spot radius and mass depth must never fall back through a separate specification object below this boundary. Omitted defaults and explicitly supplied defaults have identical identity.

The worker cache identity contains the complete resolved `GridConfig` plus contour identity.

## 2. Seat and Wrap judge one geometry

`computeGrid` may use the current float predicate only as a cheap rejection prescreen. Any near-boundary seat is decided by the existing exact seat predicate on the same supplied IEEE-rational contour, anchor and spot radius used by exact Wrap.

No tolerance, micron quantum, rounded report value or display decimal decides seat, Wrap or a published rung.

## 3. Make the existing walk observe every candidate state

At each sampled size:

1. measure all four neutral placements before `chooseCentrePlacement` collapses them for Free display;
2. preserve every distinct state, including a lawful lower-count placement hidden by a higher-count winner;
3. key a state by count, Centre identity, placement, phase cell, complete seated lattice indices, belt indices and post-Coverage output indices;
4. retain every sampled interval for a repeated state separately; never fill a gap between disjoint observations.

The three populations remain distinct:

- seated indices decide seat legality;
- belt indices decide Wrap and witnesses;
- output indices decide Coverage and the published magnet count.

`MagnetPlan` changes diameters only. It never changes state, scale, count or Wrap evidence.

The walk certifies nothing. It only supplies bounded intervals containing observed state transitions.

## 4. Reconstruct only the selected state

The existing numeric Centre path remains the selector and emits the identities it already owns:

- Box or Weight branch identity;
- selected 2mm-mesh component/sample identity for Core, Deep, Top and Masses;
- chosen placement and phase cell;
- seated lattice indices, belt indices and output indices;
- source scale and count.

Nothing is recovered from report coordinates or decimals.

For one observed state only, reconstruct exact affine coordinates in scale from the supplied IEEE-rational contour:

- Box uses the complete outer-ring bounding box;
- Weight uses the complete outer-ring shoelace centroid;
- Core uses the selected component's sample count and index sums;
- Deep, Top and Masses use the selected sample identity;
- phase uses the emitted phase cell and chosen half-pitch placement;
- anchors use the emitted lattice indices;
- outer and holes remain structural exact rings.

This is an adapter for the already-selected state, not a second Centre implementation.

## 5. Replace approximate bisection with one local exact root

For each observed state interval:

1. solve the endpoint and valid interior-projection contact equation between every selected seated anchor and every supplied outer/hole segment;
2. retain only roots inside that observed interval and inside the equation's projection class;
3. order and deduplicate the rational/quadratic roots exactly;
4. at each root, rerun the numeric Centre path once at the root's report value — the midpoint of its rational isolating interval, refined until both ends yield the same state key; the reselection confirms the discrete state only and never judges law;
5. discard the root if the complete state key changed;
6. otherwise instantiate the selected state once and judge exact seat for every seated anchor, Coverage for output population only, MagnetPlan for diameters only, and complete worst-belt Wrap once.

Fixed and Auto use the same root and judge. Auto returns the exact required allowance at that root and compares it with the configured cap. A failed root is discarded; execution continues to the next observed state/root. There is no recursive stabilization and no proof over every real scale.

Every published rung has an exact scale and contact witness. Discovery coverage is operationally falsified by the mandatory denser-walk comparison; it is not presented as a continuum theorem.

## 6. Carry only the bounded allowance representation

At a quadratic scale root `s`, every squared distance reduces modulo the root polynomial to `u + v·s`. Law decisions compare this radicand directly. The square root is required only for the returned allowance value.

```ts
export interface FieldSqrtReal {
  kind: 'field-sqrt'
  u: Rational
  v: Rational
  root: AlgebraicReal
  subtract: Rational
  isolating: readonly [Rational, Rational]
}

export type RequiredAllowance = ExactReal | FieldSqrtReal
```

Rules:

- validate the scale root and prove `u + v·s >= 0`;
- compare a Fixed/Auto cap through `u + v·s` versus `(subtract + cap)^2`;
- compare allowances only among candidates at the same selected scale, by their radicands;
- identity contains normalized `u`, `v`, primitive scale polynomial, root index and `subtract`, never isolator bytes;
- invalid or non-separating evidence follows the existing typed refusal path;
- `RequiredAllowance` replaces `ExactReal` only on required/applied allowance and contact-witness fields.

At rational fixed/manual sizes, the existing `ExactReal` result remains sufficient.

## 7. Reduce rungs in Logic

For each resolved configuration:

1. accept only candidates that pass frozen Centre/parity, complete exact seat, Coverage and fixed/Auto Wrap;
2. group by output magnet count;
3. among roots from observed states, select the earliest accepted exact scale for that count;
4. at that same scale, Auto retains the minimum exact required allowance and all exact ties;
5. apply gravity only after Centre, Wrap, count, scale and allowance tie;
6. keep all remaining ties in stable identity order;
7. publish only counts strictly greater than the previous rung;
8. carry accepted ownership from B1 through B4 so a count appears once, in the first band that accepts it.

Delete seat-based `below` ownership. A count merely seen or seated in a lower band does not suppress a later lawful rung.

## 8. Preserve fixed/manual truth without a new subsystem

Keep `forcedPhaseMM` and the existing fixed-size inspection surface. It uses the same exact seat/Wrap judge and returns the existing typed measured Centre, parity and Wrap concessions. Engine never infers concessions from report decimals, object identity or refusal-code text.

No new manual-mode architecture is added.

## 9. Atomic cut-over

Only after the engine result is green:

- make B1-B4 half-open and remove B5;
- replace approximate seat-transition publication with the exact local-root result;
- keep sampled walking private to discovery;
- store the complete B1-B4 result in the existing worker;
- make band/rung selection a stored lookup;
- route free/manual through the same fixed inspection;
- remove the snap-step control and obsolete sampled publication/cache paths only after their last consumer is gone;
- update the honesty note only when Centre, Wrap and scaling render.

No T4 ownership rewrite is required to finish the working three-law engine.

## Required proof — nothing broader

1. Centre and Wrap zero- and positive-flap frozen replays remain unchanged.
2. Omitted config equals explicit defaults; pitch, padding/radius and mass-depth mutations change the correct geometry and cache identity.
3. Every Centre mode and Mass governor reconstructs from emitted identities; report-decimal mutation has no effect.
4. Square 25 at pitch 24: fixed and rung share one exact seat/Wrap verdict; restoring the micron seat decision fails.
5. Weight squircle 72: fixed and rung return the same exact verdict and evidence.
6. Diamond: irrational exact rung scale, witness and required allowance survive Logic, identity, worker and UI.
7. Holed cutout: hole-overlap seat refusal and hole binding witness.
8. Coverage changes only output population/count; belt and Wrap evidence stay fixed. MagnetPlan changes only diameters.
9. Forced off-centre phase and Wrap-only failure return only their typed concessions; decimal/refusal-code mutations do not change them.
10. Square rungs: 1@24; 2 and 4@72; 8@120; 12@168. Squircle count 8 belongs to B4. No cross-band repeat; a lawful lower count survives a higher count's refusal.
11. A denser walk over the named compact shape set finds no count absent from the normal walk.
12. Per-band squircle solve remains below 2 seconds.
13. The real `v3.5.2` tab shows stored B1-B4 results/refusals with zero console errors and exact serving-worktree provenance.

## Stop conditions

Stop and amend before code if implementation introduces:

- exact Centre reconstruction beyond the selected-state adapter;
- a global regime/event completeness proof;
- offset topology, integrals, resultants, RUR, expression graphs or recursive stabilization;
- a new runtime module or public platform;
- a helper without an immediate live consumer;
- float, epsilon, micron refinement or tolerance deciding seat, Wrap or a published rung;
- changed frozen Centre or Wrap behavior;
- worker/UI work before the engine result is complete.

## Execution cadence

1. Incorporate this block into the active master/T3 packet and remove its superseded scaling clauses in the same documentation commit.
2. Build the engine in semantic rollback commits, continuously checked against the stop conditions.
3. QA and Meta provide paste-ready repairs on the same branch; no finding-only handoffs.
4. Only after engine clearance, cut the existing worker/tab to stored results.
5. Run and visually verify the complete three-law surface. Centre repair remains conditional on one measured material failure.

## Necessity and sufficiency

**Necessity — no unnecessary elements.** The current walk is adapted, not replaced. Existing Centre, Wrap, configuration and tab remain. Scaling adds only emitted state identities, one selected-state adapter, local rational/quadratic roots, bounded allowance transport, accepted-count ownership and the existing worker consumer. All discarded proof-platform machinery stays deleted.

**Sufficiency — delivers the directive in full.** The proposal preserves Centre and exact fixed/Auto Wrap, publishes exact next-available-count B1-B4 rungs from operationally discovered states, preserves fixed/manual truth, stores the complete result once and renders it truthfully. Every published rung is exact; discovery completeness is the bounded, falsifiable product-corpus guarantee rather than a global theorem.
