# v3.5.2 — final minimal delivery proposal

Author: **s62-grid-qa (Codex)**, incorporating the measured Grid-Meta and Lead counter-input.

Status: proposed single execution answer. It replaces the scattered proposal/review stack; it does not itself edit product code.

## Outcome

Finish the existing `v3.5.2` comparison engine from product base `2c043257`:

1. keep the working Centre behaviour;
2. keep the working exact Fixed/Auto Wrap behaviour;
3. add the missing B1-B4 magnet-count ladder;
4. deliver the complete result through the existing worker and tab.

The engine publishes each next available count at the first accepted exact local root found for that count. Counts increase, never repeat in a higher band, and all co-lawful layouts remain visible. The walk discovers candidates; it never decides law.

## Why the previous build failed

The work stopped being a three-law product build and became a universal continuous-geometry proof programme. It tried to replace Centre, enumerate every topology/regime transition, and build resultants, RUR, expression graphs and certificate layers before one scaling rung reached the product.

None of that is required to add a 24 mm disc pattern, solve its local contact scale and check the three laws. The correction is subtraction, not a smaller proof platform.

## Minimal diff

### Keep

- Centre: `safeSegments`, all six modes, four Masses governors, parity and four placements.
- Wrap: supplied outer+hole segments, exact seat legality, worst-belt measurement, Fixed/Auto comparison, typed refusals and contact witnesses.
- Narrow exact math: Rational arithmetic, quadratic roots, exact comparison and canonical identity.
- Existing orchestration: private band-walk shell, isolated newest-only worker/cache, current ladder controls and `v3.5.2` tab.

### Delete or replace

- B5.
- The walk's sampled contact verdict, tolerance refinement, seat-based `below` ownership and max-count winner.
- Exact Wrap on every sampled millimetre.
- Worker per-size prefetch/re-solve after a rung is selected.
- Any continuous Centre reconstruction, topology/regime enumeration, medial-axis/offset arrangement, resultant, RUR, generic expression or recursive stability machinery.
- Any helper/type/test with no live scaling consumer in the same semantic commit.

### Add

Only four connected pieces:

1. one exact selected-state adapter shared by fixed inspection and rung validation;
2. candidate-local seat/Wrap roots;
3. the B1-B4 count reducer;
4. stored worker/UI delivery of the complete result.

## One geometry for fixed inspection and scaling

The supplied contour bytes are law. Normalize them once with exact rational arithmetic. Do not round, symmetrise, retrace or manufacture an analytic circle.

The existing numeric Centre path remains authoritative for the discrete choice. It emits only identities it already computed:

- selected Centre branch/sample/component;
- selected placement and phase cell;
- lattice indices;
- belt membership;
- count and source scale.

From those identities Compute reconstructs the selected coordinates directly:

- Box: exact bbox midpoint;
- Weight: exact shoelace centroid of the supplied bytes;
- Core: exact mean of the already-selected 2 mm mesh samples;
- Deep, Top and Masses: the already-selected mesh sample;
- phase/anchors: exact centre plus pitch multiples;
- boundary: normalized supplied segments multiplied by scale.

Inside one observed state, every anchor is `p(s)=a*s+b`. Fixed inspection and rung validation instantiate this same record. Approximate report coordinates never re-enter law.

## Scaling algorithm

For each B1-B4 band:

1. Run the existing numeric walk cheaply in increasing size. Observe all four placements before the old winner collapse. Record each distinct state and its discovery bracket. Do not run exact Wrap at every sample.
2. For each new state, solve only its local disc-to-supplied-segment equations inside that bracket:
   - seat boundary `distance = spotRadius`;
   - Fixed/Auto boundary `distance = spotRadius + allowedFlap` when non-zero;
   - endpoint and valid interior projection cases.
3. Sort and deduplicate those Rational/quadratic roots exactly.
4. At each root, rerun numeric Centre once. If the discrete state changed, discard that root and continue; do not recurse.
5. If the state matches, instantiate the exact state and run exact seat, parity, Coverage and complete worst-belt Wrap.
6. Logic keeps the earliest accepted root for each count, retains every co-lawful layout at that root, applies gravity only after Centre/Wrap/count/allowance tie, and suppresses a count already owned below.
7. Larger count jumps are valid. A lawful lower count is never removed because a higher count exists or fails.

Discovery is operational, not a theorem over every real scale. A denser independent walk over the product corpus checks that the production walk misses no count. A measured miss becomes one fixture and one local discovery correction; it does not authorize a global event system.

## Two contract seams that must be closed before code

### Config reaches geometry

The current pseudocode wrongly calls `computeInputsFromSpec()` while pitch, spot radius and mass depth are configurable.

Use one public optional input and one resolved internal config:

```ts
type ComparisonEngineConfigInput = Partial<ComparisonEngineConfig>

function resolveConfig(input: ComparisonEngineConfigInput): ComparisonEngineConfig
function computeInputsFromConfig(config: EngineConfig): ComputeInputs
```

Resolve once to the existing defaults: Masses/Smallest centre, Fixed `0`, Perimeter, `all6`, pitch `48`, radius `12`, mass depth `16`. Geometry and policy/cache identity consume the same resolved record. Empty input and the explicit defaults are byte-identical.

### Exact required allowance reaches the result

At an algebraic rung, a nonbinding disc may require `sqrt(u+v*s)-r`. Do not force it into `ExactReal` and do not build a general expression system.

Keep one bounded measurement:

```ts
type RequiredAllowance = ExactReal | {
  kind: 'field-sqrt'
  u: Rational
  v: Rational
  scale: AlgebraicReal
  subtract: Rational
}
```

Rules:

- Fixed/Auto cap comparison uses the exact sign of `u+v*s-(subtract+limit)^2`.
- At one rung, candidates share the same scale and spot radius, so worst-allowance ordering compares their radicands exactly.
- A cross-scale or different-radius comparison is a typed `RUNG_CONFLICT`; no extra algebra is opened.
- Identity hashes normalized `u`, `v`, the scale's normalized primitive polynomial/root index and `subtract`; isolator refinement is replay detail, not identity.
- The report decimal is derived by directed interval refinement from the scale isolator and never enters law or identity.
- Thread `RequiredAllowance` only through required/applied flap, witnesses, lawful layouts and result identity. Coordinates and scales remain `ExactReal`.

## Build sequence

### Commit 1 — shared exact judgement

- Resolve config once.
- Emit the existing numeric selection identities without changing Centre output.
- Add the exact selected-state adapter.
- Route fixed inspection through that adapter and existing Wrap.

Proof: square 25/pitch 24 has one fixed/rung verdict; Weight squircle 72 has the same exact refusal in both paths; every Centre mode/governor preserves its discrete selection; report-decimal mutations change nothing.

### Commit 2 — engine scaling

- Adapt the walk to discovery only.
- Add local roots and exact root validation.
- Add complete B1-B4 count reduction, Fixed/Auto, Coverage, MagnetPlan and gravity.
- Remove B5, `below`, sampled refinement and sampled publication.

Proof: square publishes `1@24`, `2 and 4@72`, `8@120`, `12@168`; irrational diamond witness; loose near-miss refusal; lower lawful count survives higher-count refusal; no cross-band repeat; co-lawful layouts remain plural; holed boundary participates in seat and contact.

### Commit 3 — worker and tab

- Worker caches one complete all-band result per contour/resolved config.
- Selecting a band/rung is a stored lookup, not a solve.
- Free/manual uses fixed inspection and shows concessions.
- UI displays rounded scale but retains exact scale/witness bytes.
- Remove per-mm prefetch, snap-step production control and diagnostic wording only when the stored result is live.
- Honesty note claims Centre + Wrap + Scaling only after the real tab renders them.

Proof: direct engine equals worker/cache; config mutation invalidates; selection triggers no solve; B1-B4 render; exact witness survives transport; Voting/Centre-rules remain untouched.

## Final proof, no extra programme

- Frozen Centre and fixed-size Wrap replay.
- All Centre modes and Masses governors.
- Fixed `0`, fixed positive, Auto pass and cap refusal.
- Perimeter/Full and all magnet plans.
- Square, circle, diamond, rectangles, heart, real concave and holed cutouts.
- Denser discovery comparison finds no missing count on that corpus.
- One measured live performance check: cheap walk plus exact work only at roots.
- Real `v3.5.2` tab observed with provenance, selectable rungs, witnesses, refusals and truthful copy.

## Hard stop conditions

Stop before adding anything when:

- it changes Centre or Wrap policy;
- it has no live consumer in the current commit;
- it attempts universal continuous completeness;
- it introduces a second result schema, general expression/certificate layer, recursion or a new module without a failing product fixture;
- a number, tolerance, sampled size or displayed decimal decides law;
- worker/UI work becomes a T4 rearchitecture.

## Necessity and sufficiency

**Necessity — no unnecessary elements.** Every retained or added body directly performs selected-state reconstruction, local root solving, exact law judgement, count ownership or product delivery. All machinery created to prove the continuum is excluded.

**Sufficiency — delivers the three laws in full.** Centre stays intact; Wrap stays exact; scaling emits unique increasing B1-B4 counts at validated exact local roots; Fixed/Auto, Coverage, MagnetPlan, gravity, ties, refusals, worker/cache and the live tab are all covered. The only non-theorem is discovery coverage, and it is bounded by an explicit denser product-corpus falsifier rather than hidden behind a claim.
