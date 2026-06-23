# Effect Creator V3 — Tunables

> Convention (blueprint §12): tunables recorded beside the code. Self-contained — no tracker IDs.

## Engine (`src/lib/effect/prepare-effect.ts` · `EFFECT_BUILD_CONFIG`)
| Key | Value | Why |
|---|---|---|
| `longestSideMM` | 70 | base ONEMO square / size-band reference |
| `thicknessMM` | 1 | physical ruling (coupon-pending confirm) |
| `edgeRadiusMM` | 0.2 | straight-wall edge on the 1 mm body (Dan 2026-06-15, accepted): ~0.6 mm straight wall + short soft top/bottom corner — not a full half-round |
| `edgeSegments` | 18 | lip rounding segments |
| `maxImageDim` | 1200 | mask/contour resolution cap |
| `textureDim` | 2400 | front-texture cap (G2: colour pixels come from the ORIGINAL at this res) |
| `paddingMM` | 1.5 | flat margin around the subject |
| `squareCornerMM` | 8 | standard-square corner radius (engine-internal rounding) |

## Segmentation (DEC-v5-01 — self-hosted free trio)
- Cut-out engine: **u2netp** (4.6 MB, primary, preloaded) → **silueta** (44 MB, LAZY — fetched only
  when u2netp errors) → **flood-fill** (no-AI last resort). BEN2 retired (219 MB → iPhone OOM).
- Self-hosted SAME-ORIGIN (no third-party fetch, offline-capable): models in `public/seg-models/`
  (`u2netp.onnx`, `silueta.onnx`); ONNX runtime in `public/ort/` (`ort.wasm.min.mjs` +
  `ort-wasm-simd-threaded.{mjs,wasm}`). Runtime = onnxruntime-web, **WASM EP, `numThreads=1`**
  (threaded WASM deadlocks inside the worker). `?seg=<model>` switches a single model (test harness).
- Inference watchdog: 120 s (`segment-ml.ts INFERENCE_WATCHDOG_MS`).
- COOP/COEP headers on `/effect-creator/*` (next.config.ts) → threaded-wasm fallback.

## Perf budgets (G3 / §9 — enforced at the QA gate, visible in the PerfHUD)
- editor tick ≤ 16 ms · no interaction task > 50 ms · ONE rebuild per gesture · idle = 0 frames.
- PerfHUD: ⏱ button bottom-left, or `?perf=1`.

## Scene
- `fitSize` 0.09 (ShapedModel) — mm → scene units for golden framing.
- DPR cap [1, 2] · `frameloop="demand"` · damping OFF (idle truly idles).

## Manufacturing + Attachment (Phase 2 — re-scoped after Phase 0/1; NOT in the active tree)
> Per the v5 build-plan, Phase 2 = manufacturing readiness + attachment system. There is **no Phase 3**.
> The values below are FUTURE intent / dormant — no active implementation exists in this tree yet.
- Factory render (future, not implemented): tile 1024², fov 35°, fit margin 1.32; angles front (0°,90°) ·
  threeQuarter (35°,78°) · back (180°,90°); output would be `.dev-factory-renders/<payload_hash>/<angle>.png`.
- Attachment (dormant `lib/effect/attachment.ts`): magnet grid pitch 54 mm · min anchors 2 · max edge
  gap 54 mm — invented defaults, coupon-confirm eventually.

## Editor (G11/G12)
- Canvas zoom 1–6× (pinch / scroll); pan = drag outside the outline while zoomed, or two-finger.
- TickBar: 56 ticks, magnification radius 6, haptic pulse per notch (`navigator.vibrate(4)`).
