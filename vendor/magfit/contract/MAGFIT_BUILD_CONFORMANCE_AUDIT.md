# MAGFIT Build Conformance Audit — proof the build follows the contracts, not memory

**Audited build:** branch `session62-task/grid-engine-meta-sandbox`, engine `magfit-core/0.2.0`
**Audited against:** `MAGFIT_ENGINE_CONTRACT.md` (v1.0), `MAGFIT_V2_CORRECTION_SPEC.md`,
`MAGFIT_TEAM_REVIEW_VALIDATION.md`, `MAGFIT_CONTRACT_ADDENDUM_v1.1.md`, and the law book
(`_WIP/grid-engine-v3/grid-laws.md`).
**Method:** the complete diff against the vendor drop (`git diff d1a01c21..HEAD -- vendor/magfit`)
was walked hunk by hunk; every changed line is traced to a normative clause below; every
formula in the spec was checked against the code implementing it; every claim here has a
runnable witness (a test name or a reproduced command).

---

## 1. Was GPT's tier-first correction blindly accepted? No — proven, with one honest seam.

**What was proven before adopting:**

- The circle calibration is GPT's proof and it reproduces exactly: pair radius
  `24+12 = 36 → 72mm`; four-disc radius `√(24²+24²)+12 = 45.941125 → 91.882250 → 96mm`.
  I ran a 720-gon through the shipped v0.1.0 core and got 72/pair — confirming the defect
  — and through the corrected core's octagon fixture getting 96/four-disc under
  LAYOUT_FIRST and 72/pair under SIZE_FIRST. Test: `test_layout_first_calibration_octagon`.
- The tier principle traces to Dan's own record, not to GPT's authority: the 11:49 quadrant
  method (full four-disc square IS the band-2 calibration), the 09:23 scoping of the pair
  ("to accommodate narrow shapes less than 72mm" — an accommodation, not an early exit),
  and the law book's own circle rows (92→96). GPT's v2 spec agrees with that record; the
  record is the authority.
- The middle tiers (a 6-node block outranking a 5-node plus; an L outranking a pair) are
  the same principle one step down, and the divergence is EXERCISED, not assumed:
  `test_layout_first_band3_octagon_tier` proves a later size (132) wins over an earlier
  one (120) exactly when it carries a strictly stronger tier — the case where tier-first
  and size-first give different answers.

**The honest seam, stated rather than buried:** Dan's 09:37 locked pseudocode was
size-first. The 11:49 quadrant method and its validated circle example are later and more
developed, and pixel + GPT + the law book all read them as governing — so LAYOUT_FIRST is
the default. But the 09:37 lock is not erased: SIZE_FIRST is a first-class policy value,
one toggle away on the admin page, per Dan's standing method ("add all options and test").
Addendum §D.1 flags the default as his one-word flip.

**Where my first implementation was corrected BY the audit itself:** my initial two-pass
rule (full-square-else-smallest-size) was weaker than the v2 tier law for middle tiers.
Reading the v2 spec in full replaced it — commit `efeecd33` — and the octagon band-3
fixture pinned the difference. That is the opposite of blind acceptance in both
directions: GPT's correction was verified before adoption, and my own earlier code did
not survive the comparison either.

**Where GPT was overruled, with the evidence it lacked:** GPT marked the flap-maximum
reading "not proven by the inspected record" — its record was the brief alone. The law
book carries Dan's verbatim ruling ("no flap zone **greater than** 12–24mm on any side")
and a worked table (square 0mm = pass; circle band-3 20mm = FAIL at 12; circle band-4
30mm = fail both). The build follows the law book. GPT's real concern — no policy-loaded
`pass` field — is honoured anyway: the fields are factual (`within_12`, `broad_beyond_12`).

---

## 2. Conformance matrix — every normative clause → implementation → witness

### Base contract v1.0 (everything not amended must still hold)

| Clause | Requirement | Implementation | Witness |
|---|---|---|---|
| §3.1 | hardware constants 48/24/12/12-step, 9×9, no rotation, uniform scale | `EnginePolicy` defaults — untouched | `validate_policy` unchanged in diff |
| §3.2 | `span(b)=24+48(b−1)`; legal sizes `[span(b), span(b+1))` step 12 | `band_span_mm`, `default_band_spec` — untouched | `test_illegal_custom_band_size_rejected` |
| §5 | transform `X = s(2x−cₓ)/2D`, no rounding before decisions | `scale_polygon` — untouched | `test_source_scale_and_vertex_order_invariance` |
| §6 | parity runs `R(n)`, registration never recomputed after node drop | `run_coordinates`, `templates_for_band` — untouched | `test_band2_narrow_pair` (1×2 parity) |
| §7 | disc predicate: inside + `distance² ≥ r²` cross-multiplied, closed tangency, no ε | `disc_supported`, `distance_ge_radius` — untouched | `test_band2_square_tangent_full_four` (clearance exactly 12.000) |
| §8 | link = full 24mm capsule, exact segment-segment | `capsule_supported` — untouched | `test_band2_l_three_nodes_two_links` |
| §9.1 | deterministic total candidate order | `better_candidate` — untouched | `test_deterministic_retrace_invariance_corpus` (100 shapes) |
| §11 | walk every legal size, no monotonicity assumption, no rounding | both selection modes evaluate sizes independently | `test_first_legal_size_not_continuous_rounding` (72×23 → 84) |
| §12 | limiting contact with exact µm floors | `binding_contact` — untouched | tangency test: `clearance_um_floor == 12000` |
| §14 | canonicalisation order, reject don't repair | `canonicalize_and_validate` — untouched | bow-tie + backtracking rejection tests |
| §17.2 | translation/scale/winding/start invariance | untouched | corpus test, incl. 9×10¹⁸ origin |
| §20 | prohibited patterns (no pixels, no ε, no optimiser, no recentring…) | none introduced | diff scan below |

### Addendum v1.1 + v2 correction spec (the changes)

| Clause | Requirement | Implementation | Witness |
|---|---|---|---|
| v2 §2 / Add. §B1 | layout-tier-first: strongest tier anywhere in band, smallest size within tier; SINGLE never public | `select_candidate` LayoutFirst: best-per-size (node count is `better_candidate`'s leading key) then strictly-stronger-tier-else-earlier-size; `min_nodes=2` public floor untouched | `test_layout_first_calibration_octagon` (96 beats 72), `test_layout_first_band3_octagon_tier` (132/6 beats 120/5) |
| v2 §2 | SIZE_FIRST retained explicitly | `Selection::SizeFirst` = the v1.0 loop verbatim | same test, SIZE_FIRST branch → 72/pair |
| v2 §3 / Add. §B2 | band 2 sparse NOT_ENGAGED; bands 3+ two active nodes, 96mm orthogonal adjacency, connection | `sparse.min_band=3` gate in `best_candidate_at_size`; defaults `min_active=2`, `require_96mm_connected=true`; band-2 result carries no sparse phase | `test_band2_carries_no_sparse_gate` (strictest policy cannot gate band 2), `test_band3_requires_a_sparse_pair` (FIXED wrong phase rejects, right phase passes with connected pair) |
| v2 §4 / Add. §B4 | direct capsule kept as explicit conservative law, never claimed universal | predicate unchanged; labelled `DIRECT_CAPSULE` in CLI output (`linkMode`) | `test_u_shape_curved_connection_via_adjacent_links` — and see §4 below |
| v2 §5 / Add. §B3 | flap: raw extent + local tongue witnesses + narrow-limb exception; no bare `pass` | `FlapSide{num,mm,within_12,within_24,broad_beyond_12,broad_beyond_24}`; tongue = `[q, q+(h+1)n̂] ⊕ B₁₂` via the existing exact capsule | `test_flap_switches_use_exact_rationals` (12 exactly ≤ 12), `test_cross_trivial_limb_reported` (24mm flap: within24, exceeds 12, no broad tongue → exception) |
| law book L14 | 12/24 are maxima; square 0mm passes | `within = (flap ≤ limit)` | square test asserts within12/within24 true at 0mm |
| L14a | evenness per axis reported | `horizontal/vertical_imbalance_mm` kept | cross fixture: imbalance 0 |
| v2 §6/§10.7 | prepare-once must equal one-shot | C++ `solve_canonical` path | `test_prepared_equals_one_shot` (new) |
| v2 §9 | result carries link mode + tier identity | CLI: `linkMode`, `tierNodes` fields | CLI output inspected live |
| v2 §10.6 | band 4 full 4×4 at 168 | generic templates — untouched | `test_band4_square_regression` (168/16) |

### Formula-level check (spec formula → code expression, byte-for-byte semantics)

- `d²(x,e)` three-branch segment distance with endpoint cases (contract §7) →
  `point_segment_distance2`: `h≤0 → |w|²`, `h≥L → |x−b|²`, else `(v×w)²/L` as exact
  rational `{num, den}`. **Unchanged by this build.**
- radius comparison without division/sqrt: `(v×w)² ≥ R²L` → `distance2.num ≥ r²·distance2.den`
  in 128-bit, 256-bit compare where needed. **Unchanged.**
- tongue capsule `C(q,n,h) = [q, q+h·n] ⊕ B₁₂` (v2 §5) → `broad_tongue_on_side` builds the
  segment in exact internal units (`reach = (h+1)·denominator`) and calls the SAME
  `capsule_supported` predicate — no new geometry code was written for it. The `+1` is the
  deliberate strict-inequality witness ("reaches BEYOND the limit"), required because the
  law is a maximum: material reaching exactly the limit is lawful, so the exception
  evidence must test strictly past it. Documented in Addendum §B3.
- sparse phase `(x₂₄ mod 4, y₂₄ mod 4)` residues (contract §10) → `mod4`,
  `possible_sparse_phases` — **untouched**; only WHERE the gate applies changed (band ≥ min_band).
- circle numbers `2×(√1152+12)=91.882→96` — reproduced by test and by hand above.

---

## 3. Slop scan — mechanical checks on the diff itself

- **Scope:** the diff touches exactly 8 files: core (selection/sparse-gate/flap), headers,
  ABI adapter, CLI, two test files, addendum. Zero changes inside any geometric predicate,
  the canonicaliser, the transform, the ranking comparator, or the contact witness code.
- **No epsilon, no float in any decision:** grep over every added line: no `epsilon`, no
  `1e-`, no float literal. The only `double` fields added (`FlapSide::mm`) are display
  values beside their exact `num/exact_den` rationals — same pattern the v1.0 contract
  mandates (§12: "floating values are for display only").
- **Every numeric constant in the diff is a law value:** 12/24 (padding and spot — L14),
  3 (sparse min band — Dan 11:01), 2 (sparse pair — L14), `h+1` (strict-excess witness,
  documented), 10 (min_band validation ceiling = field limit + 1). Nothing invented.
- **Determinism preserved:** the 100-shape invariance corpus runs under the NEW defaults
  (tier-first + strict sparse) and passes; prepared-vs-one-shot equality pinned.
- **All 24 fixtures pass** under Apple clang; C ABI suite passes; the live page runs the
  same binary through the same CLI the tests exercise.

---

## 4. Findings the audit itself produced (not carried in from anyone's review)

1. **The U-corridor criticism is narrower than stated by both pixel and GPT.** Running
   GPT's own U counterexample through the real lattice: the two legs connect as ONE
   component through six adjacent direct links around the bottom — the layout graph
   already represents curved corridors at lattice resolution. The direct-capsule
   conservatism only bites for curved routes with no intermediate supported node.
   Pinned as `test_u_shape_curved_connection_via_adjacent_links`.
2. **My own first fixture expectation was wrong** (counted 8 nodes; the notch cavity
   swallows two, the engine's 7 is correct). The engine was not bent to the test; the
   test was corrected to the geometry — noted here because that is exactly the
   tune-to-green failure this audit exists to prevent, caught in the open.

## 5. Honest gaps — v2 requirements NOT in this build, and why

| v2 item | Status | Reason |
|---|---|---|
| Prepared C/Wasm API (opaque handle) | **Not built** | This integration uses the C++ solve-all-bands path (validates once). The C ABI is for future mobile embedding — flagged, not needed for the admin surface. |
| Sweep-line / BVH validation | **Not built** | Measured, not assumed: 8,105-vertex full pipeline = 94ms here. Necessity Law forbids the index without a measured need on a target device. |
| `policy_version` / `shape_hash` / previous-size failure witness in output | **Not built** | Fulfilment-pipeline fields; nothing consumes them yet. Listed for the production pass. |
| Reproducible CI (pinned images, sanitizer jobs, Wasm build) | **Not built** | Infrastructure — Options-Before-Infrastructure rule: Dan picks the shape of CI. |
| GeometryKernel/BandLogic as two source modules | **Partial** | The separation exists in structure (exact predicates vs policy in `EnginePolicy`/selection) but not as two compiled modules. Refactor deferred to the production pass — behaviour, not structure, was this build's contract. |
