# Effect Creator V3 — Tunables

> Convention (blueprint §12): tunables recorded beside the code. Self-contained — no tracker IDs.

## Engine (`src/lib/effect/prepare-effect.ts` · `EFFECT_BUILD_CONFIG`)
| Key | Value | Why |
|---|---|---|
| `longestSideMM` | 70 | base ONEMO square / size-band reference |
| `thicknessMM` | 1 | physical ruling (coupon-pending confirm) |
| `edgeRadiusMM` | 0.15 | **TD-G: tuned for the old 0.5 mm body — re-pin for 1 mm at coupon time** |
| `edgeSegments` | 14 | lip rounding segments |
| `maxImageDim` | 1200 | mask/contour resolution cap |
| `textureDim` | 2400 | front-texture cap (G2: colour pixels come from the ORIGINAL at this res) |
| `paddingMM` | 1.5 | flat margin around the subject |
| `squareCornerMM` | 8 | standard-square corner radius (engine-internal rounding) |

## Segmentation (G5)
- Weights self-host path: `public/models/onnx-community/BEN2-ONNX/` (gitignored). Mirror once:
  `git clone https://huggingface.co/onnx-community/BEN2-ONNX public/models/onnx-community/BEN2-ONNX`
  (or copy the `onnx/` + config files). With the local copy present the worker loads same-origin —
  no runtime hub fetch. Absent → hub fallback with a loud "downloading" progress state.
- Inference watchdog: 90 s (`segment-ml.ts INFERENCE_WATCHDOG_MS`).
- COOP/COEP headers on `/effect-creator/*` (next.config.ts) → threaded-wasm fallback.

## Perf budgets (G3 / §9 — enforced at the QA gate, visible in the PerfHUD)
- editor tick ≤ 16 ms · no interaction task > 50 ms · ONE rebuild per gesture · idle = 0 frames.
- PerfHUD: ⏱ button bottom-left, or `?perf=1`.

## Scene
- `fitSize` 0.09 (ShapedModel) — mm → scene units for golden framing.
- DPR cap [1, 1.5] · `frameloop="demand"` · damping OFF (idle truly idles).

## Factory (Phase 2)
- Tile 1024², fov 35°, fit margin 1.32 — standardized framing from mm dims (G8).
- Angles: front (0°,90°) · threeQuarter (35°,78°) · back (180°,90°).
- Output: `.dev-factory-renders/<payload_hash>/<angle>.png` (gitignored).

## Attachment (Phase 3)
- Magnet grid pitch 54 mm · min anchors 2 · max edge gap 54 mm (`lib/effect/attachment.ts`,
  invented defaults — coupon-confirm eventually).

## Editor (G11/G12)
- Canvas zoom 1–6× (pinch / scroll); pan = drag outside the outline while zoomed, or two-finger.
- TickBar: 56 ticks, magnification radius 6, haptic pulse per notch (`navigator.vibrate(4)`).
