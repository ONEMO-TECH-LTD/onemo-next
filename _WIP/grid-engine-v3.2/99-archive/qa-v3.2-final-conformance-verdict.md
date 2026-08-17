# Grid engine v3.2 — final conformance verdict

**Verdict: NON-CONFORMANT.** v3.2 is a valuable source of exact geometry, UI wiring, guarded-value patterns, and test contours. It is not the product engine described by the current v3.3 contract, and it is not a sound base for finishing that engine by continuing to tune `judgement.ts`.

The shortest correct path is to preserve the reusable substrate, replace the search/selection/output path with the delivered v3.3.1 architecture if that implementation passes its own independent audit, and delete the superseded v3.2 selector after equivalence, canon, live-surface, determinism, and performance gates pass.

## Audited states

- **Committed v3.2:** `fabd1be07afb436ce8e35abe90df5bc99abbb79e`.
- **Uncommitted Kai state:** the same commit plus a dirty `logic/judgement.ts` change. It changes mass-tier ranking and preserves template names during twin collapse.
- **Governing sources:** Dan's direct rulings in the full 2026-08-16 Kai transcript; `logic-spec-optimum.md`; the GPT Pro product-base document; the amended R3 Compute/Logic contracts.
- **No v3.2 code was changed by this audit.**

## Execution result

### Committed v3.2

Independent full engine suite:

- **91/97 tests pass; 6 fail.**
- Five canon shapes fail: Bat, Duck, Butterfly, Poke1, Poke2.
- The square solve also exceeds its 60-second test timeout.
- Full suite duration: **391.96 seconds**.

### Dirty Kai state

Independent full engine suite:

- **92/97 tests pass; 5 fail.**
- Canon failures remain on Bat B4, Duck B4, Butterfly B4, Poke1 B2, and Poke2 B3.
- Full suite duration: **350.62 seconds**.

The dirty change repairs one label/family mismatch. The square test did not time out in that run, but one run is not evidence that the performance defect was repaired. It does not restore conformance.

### Live bench

Port 3063 was proven to serve the v3.2 worktree. The real `/grid-engine` route was exercised with BAT-WOMAN. The UI returned:

- B1 `single·60·1pt`
- B2 `pair-v·88·2pt`
- B3 `tee-96·146·4pt`
- B3 `win-3x3·166·5pt`
- B4 `six-48x96·206·6pt`

The solve blocked the click for longer than the browser's five-second interaction timeout. Screenshot: `.playwright-cli/page-2026-08-16T13-17-34-281Z.png` in the audit worktree.

## P0 findings

### 1. The focus spec is not a clean final authority

`logic-spec-optimum.md` is useful synthesis, but it cannot be treated as fully ratified truth.

It says there is no band-count law (§3, lines 69–75), then requires every band to out-count the previous band's top rung (lines 85–88). It says every size is evaluated independently (line 104), while the implementation and cross-band section impose a previous-result size floor and count floor. It places fewer magnets last when support is equivalent (line 55), while its distinct-offer definition equates a new optimum with magnet-count growth (lines 24–28).

It also promotes derived values and interpretations to ruled policy:

- the B4 upper-mass bound is treated as the 40mm limb allowance;
- every answer must sit at least 24mm above the previous answer;
- every later band must contain more magnets;
- Bat B4 `5pt·172` and `6pt·206` are recorded as derived options even though Dan rejected the current B4 presentations as non-optimal.

Those claims are not present as settled laws in the GPT Pro product-base selection contract. They must not be used to judge v3.3.1 unless independently traced to a direct Dan ruling.

### 2. The current engine fails its own mutable canon gate

The committed and dirty states are both red. This is not a documentation mismatch: the running selector returns families its own gate rejects.

The gate itself is also weak evidence. `canon-gate.test.ts` says its expectations were “re-pinned” to law-derived winners, rather than being frozen directly from Dan's approved frames. It permits `null`/auto layouts for several rows and usually checks count plus a loose family label, not region coverage, registration, window identity, flap optimum, or decision reasons.

Therefore:

- passing rows are useful regression evidence, not proof of product correctness;
- failing rows are real regressions;
- the fixture expectations must not be copied into v3.3.1 as authority without source adjudication.

### 3. v3.2 implements a heuristic candidate flood, not certified placement

For every size, the selector runs:

- the legacy grid search;
- every released template over a 2mm sweep;
- a phase family;
- every rectangular sub-window of the resulting node sets.

This finite search is neither continuous nor certified complete. It can miss a lawful placement and cannot prove that the selected placement is globally optimal. Its nested sub-window enumeration is also the main runtime explosion.

The v3.3 contract instead requires a bounded certified feasibility/critical-set operation, exact verification of every construction, explicit indeterminate/failure semantics, and no representative-sampling shortcut. This is a replacement boundary, not a comparator tweak.

### 4. Selection does not implement the governing lexicographic order

The product-base order is:

1. exact legality;
2. major-region coverage;
3. upper gravity-critical support;
4. unsupported extent;
5. peel leverage;
6. approved pattern;
7. distribution across distinct masses;
8. balance;
9. fewer magnets at equivalent support.

v3.2 has no region graph, no coverage criterion, no distribution criterion, no peel-leverage criterion, and no approved-pattern registry. Its comparator instead uses inferred top/bottom/side guards, universal band targets, a corners trump, symmetry, silhouette-class scoring, fit tiers, sparse spread, mass-axis buckets, wrap buckets, and a count direction that flips by band.

Several measures are unsound:

- `sideHangMM` divides unsupported side area by candidate block height, so making the candidate taller can make the same unsupported side mass appear safer;
- B4 silently weakens the upper bound from 28mm to 40mm;
- class heuristics stand in for measured support-region coverage;
- count is sometimes preferred upward, directly contrary to the governing equivalent-support rule.

### 5. Offer identity and cross-band pruning discard valid solutions

`layoutIdentity()` contains anchor topology only. It drops scale/window, registration, profile, and artifact identity. Equal-topology placements collapse even when they are distinct certified solutions.

The offer path then requires strictly increasing magnet count, caps the list at four, and lets the previous band's winner set the next band's size and count floors. A wrong or loose earlier answer can hide a lawful later optimum before it is evaluated.

The fallback can then re-emit an arrangement rejected by the growth/echo policy. This is internally inconsistent and cannot produce the v3.3 output contract.

### 6. Performance is non-conformant by orders of magnitude

The provisional product gate is a typical warm all-band solve of at most 16ms, with a 50ms hard failure threshold. v3.2 takes tens of seconds per canon shape and roughly six minutes for its 97-test engine suite.

Kai's final audit omitted performance from both MISSING and GO. That omission is material. The phase/sub-window flood is not a production substrate to optimize; it is at most a temporary falsification oracle.

### 7. Test residue inflates the suite without proving behavior

Both `probe-winners.test.ts` and `probe-bat4.test.ts` are print-only probes with no assertions. They rerun expensive whole-shape solves inside the normal suite. Kai identified only `probe-winners.test.ts` for deletion and missed `probe-bat4.test.ts`.

The probes should be removed from the acceptance suite. If their diagnostics remain useful, keep them outside the test gate as explicit tools.

## Adjudication of Kai's final KEEP / CHANGE / GO / MISSING analysis

### Correct and retained

- Exact contour legality and exact construction verification are reusable.
- Guarded writers, refusal-not-clamping behavior, and deep-frozen templates are reusable patterns.
- Comparator order must be replaced.
- Registration must become canonical-first evaluation plus governed alternatives, with mechanics deciding and canonical registration breaking actual ties.
- The result must return all distinct governed optima and mark one bulls-eye; a count ladder and slice are not equivalent.
- Pattern admission must be governed.
- Major-region coverage, distribution, axis/class hypotheses, square/rectangle/circle controls, bulls-eye marking, rejection reasons, peel leverage, and certified feasibility are absent.
- Universal `targetMagnets`, upward count preference, fullest-per-footprint, and the current heuristic fallback do not belong in the final selector.

### Overcredited or incorrect

- **“B4 40mm upper allowance is ruled” — rejected.** The numeric exception is an inference, not a settled direct ruling.
- **“Cross-band +24, identity suppression, and out-counting are all ruled” — rejected.** They conflict with independent per-size evaluation and equivalent-support minimization, and are not established by the product-base contract.
- **“Structure law is a KEEP stand-in” — only as a temporary oracle.** It cannot remain in production selection once region coverage exists.
- **“Grid-growth door is KEEP substrate” — rejected for production.** It is incomplete, combinatorial, ungoverned, and slow. Keep only temporarily if it falsifies the certified solver, then delete it.
- **“Canon harness is already correct” — rejected.** Keep the input contours and directly sourced frames; rebuild expectations and mechanics assertions from authority.
- **“Nothing else is unnecessary” — rejected.** The phase flood, cross-band pruning, side proxy, inferred 40mm policy, fallback, count-growth offer logic, mutable derived canon, debug branch, and both print-only probe tests are unnecessary in the final engine.
- **“Steps 1–2 are a day” — unsupported.** No schedule evidence exists; time estimates do not belong in the conformance verdict.

### Missing from Kai's audit

- measured runtime and mobile interaction failure;
- full result/artifact identity and engine/profile hashes;
- deterministic decision trace and explicit indeterminate semantics;
- the fact that the focus spec itself contains unresolved contradictions and cannot solely govern the next audit;
- separation of reusable neutral measures from unratified policy values;
- the second print-only probe test.

## Reuse boundary

### Preserve

- exact contour normalization/preparation and legality predicates;
- exact construction verification;
- neutral geometry measures that are independently validated;
- bridge/module separation and the UI scaffold;
- guarded configuration mechanics;
- source contours and directly ratified visual frames as test inputs;
- connectivity, freeze, refusal, and determinism tests where their predicates remain part of the approved v3.3 profile.

### Replace

- `logic/judgement.ts` search, ranking, offer assembly, and fallback;
- band-target/count-growth policy;
- phase/sub-window growth door;
- candidate-dependent side-mass proxy;
- topology-only result identity;
- current rejection-by-discard behavior;
- the mutable/re-pinned canon expectations.

### Delete after v3.3.1 passes

- the 2mm template sweep and phase flood;
- cross-band search truncation and increasing-count ladder;
- inferred B4 40mm exception;
- print-only tests and `B4DEBUG` runtime output;
- all parallel selector code superseded by the certified implementation.

## Minimum comparison gate for GPT Pro v3.3.1

The next audit must judge v3.3.1 against Dan's direct rulings plus the amended R3 contracts, not against v3.2's outputs or `logic-spec-optimum.md` where those sources conflict.

It must independently verify:

1. package contents, build provenance, public API, and exact profile used;
2. exact legality and full-ring containment, including holes and tangency boundaries;
3. certified placement completeness and the R3 global-anchor/compound-interval counterexamples;
4. region graph, node classification, approved-pattern admission, and the nine-part lexicographic order;
5. scale/window/registration/profile/artifact identity and deterministic decision reasons;
6. all directly ratified canon frames plus square/rectangle/circle controls, without re-pinning;
7. explicit rejection and indeterminate behavior;
8. byte determinism and measured payload/runtime on the real browser surface;
9. live integration through the existing v3.2 bridge/UI scaffold.

Only after v3.3.1 passes those gates should it replace v3.2's selector. v3.2 is the comparison oracle and reusable substrate, not the product-selection authority.

## Necessity and sufficiency

**Necessity — shrink:** do not keep repairing v3.2's heuristic selector, add templates, add shape-specific rules, or preserve parallel production engines. Preserve only the neutral proven substrate and evidence that the v3.3.1 implementation actually needs.

**Sufficiency — partial:** v3.2 does not deliver certified placement, the governing selection criteria, complete result identity, explicit failure semantics, trustworthy canon coverage, or product performance. It cannot conform to the goal without replacing its search/selection/output path.
