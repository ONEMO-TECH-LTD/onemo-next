# Manual Sticker Maker — Tuning Sheet

Every adjustable parameter in the cut-out + 2D editor, with its current value, where it lives, and
what it controls. Use this to experiment and diff: change a value, note the visual effect here, and
git-diff the file to see exactly what moved. Values are the current snapshot.

> Two separate flatten stages by design: the **editable handle density** (coarse, few anchors) is
> independent from the **manufacturing polygon** (fine). Tuning handles never changes cut precision.

---

## 1. Auto-outline generation — anchor density & default shape
`user/OutlineEditor.tsx · docFromSpec()`

| Parameter | Value | Controls |
|---|---|---|
| Control-node RDP tolerance | `max(2, maxDim × 0.022)` | How many anchors the AI outline simplifies to. ↑ = fewer anchors, cleaner straight lines; ↓ = more anchors, follows wobble. |
| Coincident-merge spacing | `max(3, maxDim × 0.008)` | Anchors closer than this are merged (prevents overlapping/crossing handles). |
| Default corner radius | `round(min(W,H) × 0.25)`, auto-capped | Ships maximally rounded; `maxSafeGlobalRadius()` backs it off to the largest radius that doesn't self-intersect. |

`maxDim = max(imageWidthPx, imageHeightPx)` in source-image pixels.

## 2. Corner rounding (fillet math)
`lib/outline-core/resolver.ts · applyCornerRadii()`

| Parameter | Value | Controls |
|---|---|---|
| Fillet clamp factor | `0.49` | Max fraction of the shorter adjacent edge a fillet may consume. ≤0.5 guarantees two fillets on one edge can't overlap (no self-intersection). ↑ rounder but risks crossing. |
| Arc segments | `10` | Points per rounded corner (smoothness of each arc). |
| Near-straight skip | `cosA < -0.999` | Corners flatter than this aren't rounded (no handle). |

## 3. Smoothing (Catmull-Rom)
`lib/outline-core/resolver.ts · resolveOutlineDocument()` / `catmullRomClosed()`

| Parameter | Value | Controls |
|---|---|---|
| Samples per segment | `round(2 + smoothing × 8)` | Curve resolution of the Smooth pass (smoothing = slider 0..1). |

## 4. Editor UI controls (ranges)
`user/OutlineEditor.tsx`

| Control | Range / value | Notes |
|---|---|---|
| Round slider | `0 … round(min(W,H) × 0.25)` | Per-corner when a node is selected, else global. |
| Smooth slider | `0 … 100` → `style.smoothing 0..1` | |
| Hug slider (square↔silhouette blend) | `0 … 100` → `t 0..1` | 100 = tight silhouette, 0 = full square. |
| Scale slider | `50 … 150` (%) | Jog: bakes on release, re-centres to 100. |
| Scale step buttons | `±5%` | `nudgeScale()`. |
| Node handle radius | `(imgW / 1000) × 11` | Visual handle size. |
| Tap-vs-drag threshold | `2 px` | Below this a node press just selects (no move). |
| Resolve flatten tolerance | `0.5 px` | Editor-preview flatten (not manufacturing). |
| Seed canvas (no image) | `1000 × 1000` | `VIEW_W / VIEW_H`. |

## 5. SDF blend (Hug)
`user/OutlineEditor.tsx · onBlend()` → `lib/outline-core/sdf.ts`

| Parameter | Value | Controls |
|---|---|---|
| SDF grid | `120` | Morph resolution between square and silhouette. ↑ smoother morph, slower. |
| Post-blend RDP | `max(2, domainMax × 0.01)` | Simplify the morphed ring to anchors. |
| Domain padding | `20%` (`sdf.ts`) | Pads the raster so a frame-filling shape isn't degenerate (fixes "snap, no easing"). |

## 6. Magnetic livewire (manual draw)
`user/edgeCost.ts · buildEdgeCost()` / `lib/outline-core/livewire.ts`

| Parameter | Value | Controls |
|---|---|---|
| Edge-cost downscale | `maxDim 600` | Resolution of the gradient cost grid. |
| Edge cost mapping | `1 − 0.98 × (grad / maxGrad)` | Lower cost on strong edges. |
| BEN-prior band width | `max(2, maxDim × 0.02)` dilations | How wide the AI-boundary "magnet" band is. |
| BEN-prior band cost | `min(cost, 0.08)` | Strength of the AI-boundary pull. |
| Livewire ROI margin | `48 cells` | Search window around the drawn segment. |

## 7. Look & feel (CSS)
`user/outline-editor.module.css`

| Parameter | Value | Controls |
|---|---|---|
| Scrim (dim outside cut) | `fill-opacity 0.5` | How dark the area outside the outline is. |
| Handle fill | `fill-opacity 0.28` | Translucency of anchor dots. |
| Handle stroke | `stroke-opacity 0.85, width 1.5, blur 0.4px` | Soft frosted look. |
| Controls max-width | `34rem` | Toolbar/slider cap on desktop (centred). |

## 8. Cut-out engine (BEN2 → mesh)
`core/shaped/pipeline.ts · DEFAULT_BUILD_CONFIG`

| Parameter | Value | Controls |
|---|---|---|
| `longestSideMM` | `100` | Physical size the longest side maps to. |
| `thicknessMM` | `0.5` | Body thickness (preview value; physical lock pending coupons). |
| `edgeRadiusMM` | `0.15` | Rounded-edge lip radius. |
| `edgeSegments` | `14` | Rim rounding smoothness. |
| `rdpEpsilonMM` | `0.4` | Contour simplification (mm). |
| `maxImageDim` | `1200` | Mask/contour resolution. |
| `textureDim` | `2400` | Front-texture resolution (sharpness). |
| `paddingMM` | `1.5` | Flat image margin around the subject. |
| `minCornerAngleDeg` | `135` | Round contour corners sharper than this. |
| `cornerRadiusMM` | `24` | Engine-side contour corner fillet. |

`core/shaped/contour.ts`: holes are **suppressed** (`holes: []`) → always a solid cut-out, no interior cut-outs.
`core/shaped/segment-ml.ts`: model `onnx-community/BEN2-ONNX`, runtime `webgpu → wasm` fallback. Loaded once per session; weights browser-cached. Inference re-runs per upload on the **main thread** (the ~30–60s blank-canvas window).

---

## Known coordinate convention
The mask loads **y-up** (`segment-ml.ts`/`mask.ts`) so the 3D renders upright; the editor draws the photo
**y-down**, so `docFromSpec` flips Y, and the editor→3D feedback (`toMM`) flips it back — they cancel.
