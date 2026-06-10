# BLUEPRINT ADDENDUM — V1 Recovery (corrected diagnosis + target architecture)

> Status: **build authority for the V1 recovery work** (2026-06-10). Companion to `BLUEPRINT.md`
> (whose §4 perf contract is corrected in place) and to the full audit in SSOT
> `_ssot-workbench/v1/audit/v1-performance-audit-2026-06-10.md`. This addendum documents what was
> actually wrong in V1, what we aim to build to fix it, and the invariants the fixed V1 must hold.

---

## A. Corrected diagnosis (what actually broke V1)

Measured live on this snapshot (Chrome, rAF + PerformanceObserver longtask, synthetic event storms):

| # | Finding | Severity | Measured |
|---|---|---|---|
| F1 | **Hug slider**: full SDF morph + up-to-14× resolve binary search (O(n²) self-intersection each) + whole-doc apply + **full 3D mesh rebuild — synchronously per input tick**, wired to `onChange` | P0 | 392–555 ms/tick; 20 ticks = 9.9 s frozen |
| F2 | **Silent edit loss**: `commit()` replays the doc command log against `baseSnapshot`; generator swaps / restores desync node-id namespaces → replay throws inside `pointerup` → edit discarded, no feedback, drag state stuck | P0 | 16 uncaught exceptions in one session |
| F3 | **BEN segmentation**: weights fetched from HF hub at runtime; wasm fallback single-threaded (`crossOriginIsolated=false`) → main-thread freeze wherever WebGPU absent; historically 30–60 s | P1 | ~10 s first run (WebGPU); long tasks only ~130 ms |
| F4 | **Texture re-upload per pointer-move**: pan/zoom designState effect sets `needsUpdate=true` on the 2400px CanvasTexture (≈23 MB GPU upload per event). Currently latent — the pan/zoom edit mode lost its UI trigger entirely (dead feature) | P1 | code-confirmed |
| F5 | Build pipeline fully main-thread (duplicate full-res decode, 2400² canvas ops, `toDataURL`, ~18 dilate passes) | P1 | ~0.5–1.5 s stall per generate |
| F6 | Geometry/material churn: non-indexed ~6×-oversized mesh, `number[]` accumulation, undisposed replaced materials, unbounded texture caches | P2 | code-confirmed |
| F7 | Page-level `designState` in `useState` → whole-tree re-render per gesture event (same dead path as F4) | P2 | code-confirmed |
| F8 | Dead code: unreachable Edit Mode, unused admin/Leva remnants, unused `edge-bleed.ts`; GLB mutation inside `useMemo`; two geometry engines (contour.ts fillet/Chaikin vs outline-core) — double-round, AMEND-C2 violation | P2 | code-confirmed |

**Exonerated:** the 3D scene. Orbit with the cut-out mesh: **120 FPS, avg 8.3 ms, p95 9.2 ms, zero
frames >33 ms, zero long tasks** (dev build, M-series, DPR 1.5 cap). The "~12 FPS always-on-3D" verdict
came from a build-effect React loop (~166 ms/frame) measured through a broken-HMR dev server that made
every fix appear ineffective; QA's same-day correction never reached the docs.

## B. Target architecture (what the recovery builds)

The fixed V1 keeps its identity — **one persistent 3D scene, 2D editor layered on top** — and holds
these invariants:

1. **Tick/commit split everywhere.** Per input tick: cheap preview only (blend precomputed SDF fields,
   transient style overlay, SVG update). On release/commit: resolve + validate + doc apply + 3D push.
   No slider may run resolve-chains, safety searches, or mesh builds per tick. (Round/Smooth/Scale
   already comply; **Hug is rebuilt to comply** — `prepareSdfBlend(from,to,domain)` computed once per
   editor session, `(t) → rings` per tick.)
2. **Commit is exception-safe and id-stable.** Every generator swap (Hug/Shape/Draw/Reset/restore)
   bakes a fresh `baseSnapshot` with `commands: []` (the `BakeBase` op). `commit()` is try/caught:
   a failed replay drops the command with visible feedback and always clears drag state. Dev-mode
   invariant: a command's ringId/nodeId must resolve at append time.
3. **Texture transforms are matrix-only.** `repeat`/`offset` changes never set `needsUpdate`.
   Full-canvas re-uploads only when canvas *content* changes (blend recompose, on release).
4. **3D geometry rebuilds are deferred while the editor is open** (canvas is frozen) — one rebuild at
   the editor boundary, not per commit.
5. **Segmentation off the main thread**: BEN2 in a worker, weights self-hosted/pinned (port the V2
   §8.3 worker — it already exists; this is a cherry-pick, not new work).
6. **Idle means idle**: with `frameloop="demand"`, OrbitControls damping must not keep the loop warm
   at rest (disable damping or gate its settle).
7. **One geometry engine** (when the deeper refactor lands): outline-core is the only
   fillet/smooth/resolve path; `contour.ts` reduces to the marching-squares tracer (V2 already proved
   this by deletion — cherry-pick).

## C. Build order (recovery scope, this worktree)

| Step | Change | Files | Est. |
|---|---|---|---|
| 1 | F1: Hug tick/commit split + precomputed SDF fields + defer 3D push to release | `OutlineEditor.tsx`, `lib/outline-core/sdf.ts` | ~1 d |
| 2 | F2: BakeBase-on-swap + exception-safe commit + append-time validation | `OutlineEditor.tsx` | ~0.5 d |
| 3 | F4: delete `needsUpdate` on pan/zoom transforms | `ShapedModel.tsx`, `EffectModel.tsx` | ~1 h |
| 4 | Verify: re-run instrumented storms (Hug ≤16 ms/tick target; commit storm = zero exceptions; orbit stays 120 FPS) + typecheck/tests | — | ~0.5 d |
| Later (post-decision) | F3 worker port from V2 · F5 worker build · F6 indexed geometry/disposal · one-engine merge · restore-or-remove the dead pan/zoom mode | | |

Out of scope here: production integration, library UI, checkout (per the locked prototype scope).

## D. Decision context

This recovery makes V1 a true, correctly-diagnosed candidate so the V1-vs-V2-vs-V3 architecture
decision is made between two *working* options, not between a working V2 and a misdiagnosed V1.
The comparison + V3 recommendation live in the SSOT audit folder.
