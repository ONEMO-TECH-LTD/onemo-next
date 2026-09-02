# T1 — Headless data-only solve: migration plan (v3, QA-CLEAR 2026-09-02 · engine v3.5.7-2 → v3.5.8)

Roadmap v3 task 1. Baseline: staging `8ba9bb9f` (PR #214). Method: **surgical swap** (Dan 08-29) —
bodies MOVE verbatim, the worker keeps working through every step, one commit per step.
Laws in force: L2 units never import units · L3 pipeline holds sequence, never rules · L5 shell
reaches the engine only through adapters · L6 proven bodies move, never retyped.

## 0 · The seam today (measured)

`solve.worker.ts` (227 lines): 12 engine import lines · `SolveRequest` (worker-local) · `shapeSig` +
`rungCache` + `bakeCache` · `bakeOf` (step-1 bake) · `anchorFnFor` (centring rule) · `FITS_CAP` ·
`ctx.onmessage` with three branches (manual · band · no-lawful-offer) posting `model`.
The page reads from `model`: `contour · grid · effSize · ladder · idx · segments · unprotected` (+ `recog`,
`bandClass`, `bandClasses`, `recommendation`, `offMM`, `diagnostic` carried for readouts).

## 1 · Movement matrix — every worker declaration, its owner, its class

| worker declaration | → owner | class | note |
|---|---|---|---|
| `SolveRequest` | `pipeline/types.ts` as **`GridRequest`** | AMEND | same fields minus `id` (transport) ; `protectionPaddingMM` becomes a Spec-typed setting `settings.protectionPaddingMM` (default from `grid-magnet-spec`) — closes V8; no new control |
| `shapeSig`, `rungCache`, `bakeCache`, `FITS_CAP` | `pipeline/solve.ts` (module-level caches) | VERBATIM | keyed exactly as today; a headless caller gets the same memoisation |
| `bakeOf` | `pipeline/solve.ts` | VERBATIM | step-1 bake; stays one function |
| `anchorFnFor` | `pipeline/solve.ts` | VERBATIM | exported for the existing separation-gate test that calls it |
| `ctx.onmessage` — destructure + `makeSizer` + `contourCacheKey` + cache reset | `pipeline/solve.ts :: solveGrid(req)` prelude | VERBATIM | |
| — manual branch | `solveGrid` | VERBATIM | returns `GridSolve` |
| — band branch (classify → lookup → priority → `solveCanonExperiment` → landing → coverage → `wrapGrid` → `assignSizes` → protection → `recog`) | `solveGrid` | VERBATIM | |
| — no-lawful-offer branch | `solveGrid` | VERBATIM | |
| `ctx.postMessage({ id, model })` / `catch` | **worker** (adapter) | VERBATIM | worker = `onmessage → solveGrid → postMessage`; error path unchanged |
| the posted `model` shape | `adapters/gridViewModel.ts :: toPageModel(solve)` | NEW (T1-authorised) | pure projection `GridSolve → Model`: `selectedRungIndex → idx`, rungs → ladder rows, `classificationDiagnostics → recog`; never calls judge or classifier. Identity mapping on day one — the point is ownership, not change |

Nothing else moves. `grid-magnet.ts`, `grid-magnet-canon-experiment.ts`, `grid-magnet-wrap-compute.ts`,
units, catalogue, page rendering: **zero diff** except the page's import of the model type (from the
adapter) and the worker's shrink.

## 2 · Public boundary (data only)

```ts
// pipeline/types.ts
GridRequest  = { base: Contour; offsetMM: number; cfg: GridConfig; mode: number;
                 manualBand?: boolean; sizeMM: number; stepSel: number | null;
                 settings: { protectionPaddingMM: number }; activeBandIds?: number[] }
GridSolve    = domain facts only: contour, grid, effSize, segments, offMM?, bandClass, bandClasses,
                 recommendation, unprotected?, offers?, diagnostic?, rungs (roles/sizes as data),
                 selectedRungIndex, classificationDiagnostics
solveGrid(req: GridRequest): GridSolve      // pure; throws on invalid request (worker catches → error post)
```
`GridSolve` contains domain facts and domain decisions, not page projection: it carries the raw rungs plus
`selectedRungIndex` (the current worker's Rule-4/manual selection fact) and `classificationDiagnostics`
(the current `recog` fact). It contains no `ladder` display rows and no page `idx`. `toPageModel(GridSolve)`
maps `selectedRungIndex` to its current `idx`, turns rungs into ladder rows, and renders
`classificationDiagnostics`; it never calls judge or classifier. The exact field list is copied from the
worker's pre-postMessage local result when S1 moves it; no field is invented in this plan. `GridRequest` and
`GridSolve` are JSON-round-tripped as they are actually constructed.
`anchorAtMM` (a function) never
crosses this boundary — it is built inside `solveGrid` from the bake, exactly as the worker does today.

## 3 · Steps — one commit each, worker working at every step

| # | step | proof before next |
|---|---|---|
| S1 | create `pipeline/solve.ts` + `pipeline/types.ts`; **cut/paste** the worker body into `solveGrid`; worker becomes `onmessage → solveGrid → postMessage` | worker test (zone 7/8/10 worker cases) green unchanged · bench identical (live) |
| S2 | `adapters/gridViewModel.ts`: `toPageModel` identity projection; worker posts `toPageModel(solveGrid(req))`; page's `Model` type imports from the adapter | serialised adapter page model equal before/after on the four fixtures (excluding declared timing fields) |
| S3 | `protectionPaddingMM` → `settings` via Spec default; page sends it in `settings` | Spec → request → evidence test: a literal or an out-of-band field fails |
| S4 | Node proof: `pipeline/__tests__/headless.test.ts` imports `solveGrid` with no `self`/`Worker`/DOM, JSON-round-trips request + result, compares offers to the worker path on the four fixtures | green · separation gate: `pipeline/` pinned as the shell's one sequencer; worker unit edges → `[]`; `grid-magnet.ts` allow-list unchanged |

## 4 · Gates that change (separation test)

- Zone 2 allow-list gains `pipeline/solve.ts` (may import units, door, catalogue, experiment, bridge — it
  is the sequencer) and `adapters/gridViewModel.ts` (types only).
- Zone 2d: worker pinned unit edges become `[]`; page `[]` (unchanged).
- Zone 2b "only the named sequencer seats hold unit edges": add `pipeline/solve.ts`.
- New: "the worker imports only `pipeline/` and `adapters/`" · "`pipeline/solve.ts` contains no threshold /
  sort / rank" is **not** claimed in T1 — the moved body still holds Rule-4 landing and Belt; those are
  later re-rooming (recorded, not hidden).

## 5 · Necessity / sufficiency

No unnecessary elements: no new solver, no rule change, no new control, one adapter with one function,
caches move rather than redesigned. Delivers T1 in full: headless callable, data-only boundary, adapter
owns the page model, V8 closed, worker = transport.

**Known and stated:** after T1 the pipeline module *contains* policy that L3 says it must not (landing,
Belt, sizes). That is the S2/T-later re-rooming; T1 is the move that makes it visible and testable, not
the tidy. Claiming L3 compliance at T1 would be false.
