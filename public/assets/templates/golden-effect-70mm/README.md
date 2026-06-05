# Golden — `effect-70mm` — render-asset versions

> **Baseline = `v0` = `../effect-70mm.onemo`** (the tracked production template). This folder holds the **optimized render derivatives**.

## Manufacturing model vs render asset (important)
`v0` is exported from a **Fusion 360 MANUFACTURING model** — the *accurate* product geometry built for production (NURBS→mesh, solid bodies, precise tessellation). It is **not wrong** — it's correct *for manufacturing*. It's simply **not a render asset**: hence 516K triangles, **solid bodies with hidden inner faces**, and a 365K-triangle bezel.

**Pipeline (per product):** Fusion 360 manufacturing model → *[render-optimization: trim inner faces + retopo/decimate, NO visual-quality loss]* → render asset (`.onemo`) → Studio / Creator. Keep the manufacturing model as source-of-truth; derive **separate trimmed + optimized render assets**.

## Facts
- **All geometry, ZERO textures/materials** — materials are applied at runtime by Studio/Creator (the `studio.json` material **roles**: face/back/frame suede + artwork on the print surface). Compression is pure geometry; **no KTX2 needed**.
- `.onemo` = `scene.glb` + `studio.json` (render/material/camera/artwork contract).

## Versions
| File | Size | Triangles | Method | Quality | Status |
|---|---|---|---|---|---|
| `../effect-70mm.onemo` (**v0**) | 21 MB | 516K | Fusion 360 export (raw) | accurate (manufacturing) | **BASELINE / render-truth — do NOT ship** |
| **`v1-draco-lossless.onemo`** | 1.4 MB | 516K | Draco geometry compression | visually lossless (all triangles) | safe production baseline; under ≤5MB budget |
| **`v2-draco-decimated-smooth.onemo`** | 1.1 MB | 258K | Draco + error-driven decimate (err 0.0001) | smooth corners, no visible loss | **CHOSEN working version (2026-06-05)** |

### Rejected (do NOT ship)
- Aggressive decimate (`--ratio 0.05`) → 25.8K tris / 195 KB — **choppy corners**.
- `gltf-transform optimize` → 175 KB — **joins/flattens meshes + drops names → breaks the material-role + artwork pipeline**. Never use `optimize` on `.onemo`.

## Reproduce (on a COPY of `v0`, never the original)
```sh
unzip ../effect-70mm.onemo scene.glb studio.json
gltf-transform draco scene.glb v1.glb                                      # v1 lossless
gltf-transform simplify scene.glb s.glb --ratio 0.5 --error 0.0001 \
  && gltf-transform draco s.glb v2.glb                                     # v2 smooth
# then re-zip the optimized scene.glb + the original studio.json into a .onemo
```
Studio v2's loader decodes Draco + meshopt.

## TODO ("remodel properly later")
Smooth corners **at low triangle count + no inner faces** needs a real per-product render-optimization pass (trim hidden inner faces → curvature-weighted retopo → Draco), best in Blender off the Fusion export. Studio Save should default to Draco + FrontSide solids.

*Session 56 · Plane-5 / Studio v2 + compression. Branch: `session56-task/studio-v2-3d-editor`.*
