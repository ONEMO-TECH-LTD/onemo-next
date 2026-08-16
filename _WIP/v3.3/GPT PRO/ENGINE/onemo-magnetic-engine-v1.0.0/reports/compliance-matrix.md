# Specification compliance matrix

| Requirement area | Status | Evidence / qualification |
|---|---|---|
| Three modular packages | Complete | Compute, Logic and Next packages with independent source/dist/docs/tests. |
| Compute product neutrality | Complete | No profile import, band/pattern semantics or React/DOM dependency; neutrality tests. |
| One simple outer ring V1 | Complete | Canonical validation rejects self-intersection and invalid ring; hole/disconnected multi-ring input is not accepted by the API. |
| Exact final protected-disc legality | Complete | Integer-quantised BigInt predicate; tangency/intrusion/concavity tests. |
| Safe/feasible continuous domain | Complete with conservative representation | Adaptive boxes, witnesses, exact final revalidation and indeterminate status. |
| False-negative discipline | Complete for adaptive API | Empty unresolved regions are indeterminate, not silently infeasible. |
| Multi-clearance useful-area evidence | Implemented as certified sampled evidence | Carries sample half-diagonal error envelope; profile controls step/thresholds. |
| Neutral criterion registry | Complete | All `geometry-criteria-v1` descriptors implemented. |
| Dominance-safe interval helpers | Complete | Scalar/compound anchor and overlap tests. |
| Joint continuous mechanical certification | Implemented conservatively | `certifySizeSolution`; may return `DECISION_INDETERMINATE`. Preview path is explicitly not certified. |
| Band/frame/parity model | Complete | B1–B5, per-axis classes, capacity frames, mixed parity. |
| 96 mm population | Disabled pending product decision | Generic backend supports it; reference profile does not enable it. |
| Exact mechanics policy | Implemented in reference profile | Formulas/order/tolerances encoded; unresolved product calibration remains. |
| Canon Batwoman regression | Blocked by missing authoritative vector | No implementer tracing invented. |
| Deterministic artifact identity | Complete | Generated compiled-JS digests for Compute and Logic. |
| Canonical ManufacturingSpec | Complete | Hashing, exact geometry/centres/profile/artifact identity, verifier. |
| Physical fulfilment completion | Complete technically, blocked in reference profile | Zero-tolerance technical test passes; reference profile intentionally refuses fulfilment. |
| React/Next integration | Complete as adapter/reference page | Lazy loader, hook, overlay, persistence, certification binding, server verifier. |
| Browser tests | Not verified in environment | Chromium blocked by administrator; WebKit unavailable. |
| Payload gates | Pass | Compute ~17 KB gzip, Logic ~13 KB, adapter ~2 KB. |
| 16 ms typical all-band target | Not met in container | ~50 ms median low-node preview. |
| Downloadable archives | Complete | Three package ZIPs plus one complete master ZIP. |
