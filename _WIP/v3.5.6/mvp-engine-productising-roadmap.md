# MVP engine productising — roadmap (v1, for Dan's lock)

**Directive (Dan, 2026-09-02):** "preserve what we have, make it liftable and integratable into the
studio and address the performance and potentially later spec export … no overkill and rocket science."
Boundary: engine = clean, all functionality kept, optimised where measured, headless API-callable
computation only. Studio owns save/selection/product flow. UI shell = admin surface.

**Necessity test for every task:** "delete `src/app/` — does the engine still solve, and does the bench
still behave identically?" A task exists only if it is needed for a *yes*, or for measured speed.

## Baseline (frozen)
`ddb0c7b5` code (docs commits `724081ff`, `d3257f1d` on top). Bench on 4065. Suite 76/3 (V1, V1b-unseen, V7).
Perf reference, cold per band: Duck B3 1.37 s · BOT B4 2.87 s · Batwoman B4 3.99 s.

## Tasks — in order, one commit each, QA before build (design) and after (head)

| # | task | what moves / changes | proof (Done means) |
|---|---|---|---|
| **T1** | **Re-room the solve into the engine** | The solving body of `solve.worker.ts` (bake, anchor, classify → lookup → priority → solve → landing → belt → wrapGrid → sizes → protection; both caches) moves **verbatim** to `src/lib/effect/pipeline/solve.ts` as `solveGrid(request): SolveResult`. Worker keeps decode / call / postMessage / catch (~25 lines). No rule, threshold or ordering changes. | Node test calls `solveGrid` with no browser, same offers as the worker for the four fixtures · bench pixel-identical on 4065 · worker has zero engine imports beyond the pipeline · separation gate pins `pipeline/` as the one sequencer for the shell |
| **T2** | **Data-only public boundary** | Request = `{ contour, cfg(spec values), band, activeBandIds, sizeMM/manual, protectionPaddingMM }`; result = today's `model` fields (contour, grid, offers/ladder with roles, idx, segments, recog, bandClass(es), recommendation, evidence). Anchor function stays internal (derived inside the pipeline from the bake, as today). | JSON round-trip of request and result in the Node test; `typeof` sweep finds no function on either |
| **T3** | **Seal the shell** | Page: library legal-box overlay stops calling `safeSegments`; the pipeline/adapter supplies it. Type import of `UnprotectedEvidence` via the door. Worker pin set corrected, stale `[16,12]` pin fixed. Gate: page may import only adapters/spec/types; computational barrel exports forbidden. | Suite green (79/79) · page imports contain no engine compute · bench identical |
| **T4** | **Perf probe → targeted fixes** | Stage timers on `solveGrid` (classify, enumeration windows/seat tests, wraps, protection) over the four cutouts × bands, headless. Then fix only the measured top cost, laws untouched, offers byte-identical. Candidates *if measured*: per-shape precompute shared across bands, wrap cache by free-set key, reveal/phase bounds proven by lattice geometry. | Before/after table per shape·band · offers identical (oracle) · no invented ms target; Dan sees the numbers and rules the run-where (browser / server / incremental) |
| **T5** | **Package seam** | `src/lib/effect/pipeline/index.ts` exports `solveGrid` + types only; a lift check runs the Node test against `lib/effect` with `app/` excluded from the tsconfig include. | Lift check green · README stanza: how Studio calls it, what it returns |

**Later, not in this roadmap (recorded so they are not lost):** spec export (SVG cutting spec = the
bench's drawing through an export adapter; Studio-side) · retiring the three old sequencer seats and
legacy shims (internal structure, packages fine as is) · `recog` readout deletion (product-visible, Dan's
call) · protector ranking (awaits Dan's order ruling) · stale codex worktrees ≈12 GB (deletion, Dan's call).

## Necessity / sufficiency
No unnecessary elements: no new solver, no scoring, no framework, no persistence, no cutover, no
structure-for-its-own-sake. Delivers in full: liftable (T1, T5), integratable (T2), shell-clean (T3),
performance addressed by measurement (T4); spec export named as later per directive.
