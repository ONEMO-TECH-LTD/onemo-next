# QA handoff — engine build end to end — @s62-lead → @s62-grid-pixel
Frozen head d8395f36 · tag s62-grid-engine-e2e-freeze-2 · branch session62-task/KAI-10261-grid-canvas

Dan's cadence ruling: per-increment QA dropped mid-build; you QA the ENTIRE build now. Meta gate after yours.

## Pack
- Self-audit vs EC-01..EC-13, evidence per line + residuals: _WIP/grid-engine-v3/lead-self-audit.md
- Build ledger: _WIP/grid-engine-v3/lead-build-ledger.md
- Corpus results (7 shapes, 50,316 families, all six centres answer all shapes, 0 empty bands): ~/.claude/jobs/98a4885e/tmp/corpus-out/*.json  (produced at tag freeze-1)
- Visual gate: _WIP/grid-engine-v3/evidence/applied-proof-pill-family4.jpg — live 4200 worker solve, stepper over 6,937 pill families; independent SVG re-measurement reproduced the engine's per-side flap digits exactly (L70.4 R70.4 T72.0 B72.0) and confirmed disc containment.
- Tests 67/67: oracle agreement exact (square + L), non-monotonic C with analytic interval endpoints [0.5,0.6]∪[2.5,5], sliver, B7 attacks (collinear overlap / T-touch / repeated non-adjacent vertex), serialiser, streaming-hash equality.

## Attack hardest
1. contacts.ts incremental status walk (commit d8395f36, landed AFTER the corpus run): per-piece full predicate replaced by O(1) per-event feature updates; outline-vertex-over-corner degeneracy reseeds with the full predicate. Verify interval endpoints unchanged vs a full-predicate reference and vs the oracle on adversarial shapes. Motivation: 0.50s → target ms per box; Dan refused minutes-per-shape.
2. solve.ts family identity dedup (parity target + sorted coords) + ∃-window maximality at published σ — vs the oracle's union-over-windows semantics.
3. §7.6 measured region binding + per-magnet clearances (float display values; lawfulness never reads them).

## Known residuals (stated, not hidden)
- ExactValue fields = stringified floats, not algebraic identity (your B5 — open).
- Family-level 'optimum' (base AND sparse at once) fires zero times corpus-wide — the two populations never first-publish four corners at the same even size; per-population optima exist on 6/7 shapes. Definition ruling held for Dan.
- Trace fidelity: 6k-point pixel traces drive all costs; manufacturing-scale simplification is Dan's input ruling, not taken.
- Corpus JSONs predate the perf commit; family sets should be identical (same mathematics) — verifying that identity is a legitimate QA check.
