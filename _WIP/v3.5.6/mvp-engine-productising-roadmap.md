# MVP engine productising — roadmap (v2, for Dan's lock)

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

*v2 — QA's four findings applied verbatim (2026-09-02): T1/T2 merged, adapter owns the page model, V8 closed through Spec, no future test counts or README task.*

| # | task | what moves / changes | proof (Done means) |
|---|---|---|---|
| **T1** | **Headless data-only solve** | The non-browser body of `solve.worker.ts` moves **verbatim** into `pipeline/solve.ts`. Same change defines `GridRequest` (contour, Spec-owned settings, manual/band envelope) and `GridSolve` (domain attempts: layout/wrap facts, roles, landed band, evidence — never page state) as plain data; the pipeline derives the anchor internally. `adapters/gridViewModel.ts` maps `GridSolve` to today's page model (`idx`, ladder rows, `recog` stay there) so the bench is unchanged. The existing protection-padding control's value moves into Grid Spec / request settings before the pipeline reads it — no new control (closes V8). Worker = decode → call → cache → post. | Node test imports the call with no browser globals, JSON-round-trips both shapes, returns the same domain attempts as the current worker on the four fixtures · bench pixel-identical on 4065 · Spec → request → evidence test fails if the pipeline reads a literal or an out-of-band worker field |
| **T2** | **Seal the page leak and import matrix** | `libraryStageModel` returns the library segments the shell renders (page stops calling `safeSegments`). Evidence type via the door. Worker pins corrected, stale `[16,12]` pin fixed. | The page has no direct imports of engine units, foundation, computational barrels or worker-only types; it may import UI shape sources plus public adapters, Spec and shared data types. The full relevant suite is green with no skipped gate. Bench identical. |
| **T3** | **Measure headless performance, then fix only the measured bottleneck** | Stage timers on the pure call (classify, enumeration windows/seat tests, wraps, protection) over the four cutouts × bands. Optimise only the top measured cost; laws untouched; attempts byte-identical. | Before/after table per shape·band · attempts identical (oracle) · no invented ms target; Dan rules browser / server / incremental on the numbers |
| **T4** | **Package seam** | `pipeline/index.ts` exports the data-only call and types only; lift check runs the Node test with `src/app/` excluded. | Lift check green |

**Later, out of scope (recorded so they are not lost):** Studio selection / save / manufacturing SVG ·
retiring the three old sequencer seats and legacy shims · `recog` deletion (product-visible, Dan's call) ·
protector ranking order (Dan's ruling) · stale codex worktrees ≈12 GB (deletion, Dan's call).

## Necessity / sufficiency
No unnecessary elements: no new solver, no scoring, no framework, no persistence, no cutover, no
structure-for-its-own-sake. Delivers in full: liftable + integratable (T1, T4), shell-clean (T2),
performance addressed by measurement (T3); spec export named as later per directive.
