# Product profile authoring and calibration

## Values that belong in the profile

- coordinate quantum and approximation tolerance;
- base/effective verification radius and tolerance composition;
- base cell, node stride and enabled populations;
- band boundaries and size rung policy;
- canonical translation period and permitted axes;
- structural clearance levels and classification thresholds;
- pattern templates and permissions;
- exact mechanical criterion order, formulas and tolerances;
- per-band offer policy;
- regression fixture hashes and expected outcomes.

## Values that must not enter Compute

Band names, pattern names, gravity preference, “major/marginal”, the 24/48 values, ONEMO labels and pattern ranks must remain profile data supplied by Logic.

## Production approval checklist

1. Replace every template marker.
2. Decide whether the 96 mm sparse population exists; if enabled, define exact origin parity and permissions.
3. Calibrate structural thresholds against the approved canon plus counterexamples.
4. Approve the complete pattern permission/rank matrix.
5. Attach the canonical Batwoman vector hash and B1/B2/B3 mappings.
6. Define real process tolerances and effective radius.
7. Approve maximum input complexity and upstream simplification ownership.
8. Run all predicate, band, pattern, mechanical, uncertainty and manufacturing tests.
9. Run the browser/mobile benchmark corpus.
10. Change to `approvalState: "approved"`, set `productionReady: true`, register/hash, and archive the exact artifact/profile pair.

## Alternative products

Clone the profile and change values; do not fork the geometry engine. The tests include a non-ONEMO grid profile to prove the neutral Compute contract is reusable.
