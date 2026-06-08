# Shaped-Effect Configurator — Folder Architecture

> Self-contained configurator at route `/shaped`. A copy of the golden `/prototype` whose 3D
> object is replaced by a **generated cut-out mesh** built from the uploaded image. The golden
> `/prototype` is untouched; this folder owns its own scene/admin/user/core tree so the two
> configurators launch and evolve independently.

---

## What's different from `/prototype`

`/prototype` renders a fixed **GLB** product and maps artwork onto its named meshes. `/shaped`
has **no GLB** — `page.tsx` is hard-wired `shaped = true`, so `core/EffectViewer` renders
`core/shaped/ShapedModel` instead of `core/EffectModel`. Everything else (golden scene config,
camera, lighting, environment, suede material, colour/edit UI) is reused as-is.

## The shaped engine — `core/shaped/`

The pipeline turns an uploaded image into a thin cut-out object, fully in-browser:

| File | Role |
|---|---|
| `pipeline.ts` | Orchestrator + `DEFAULT_BUILD_CONFIG`. image → segment → contour → simplify → mm → mesh + bled texture. |
| `segment-ml.ts` | **Active default** segmentation: BEN2-ONNX via transformers.js (WebGPU→WASM). |
| `mask.ts` | Mask post-processing (octagonal dilation, box-blur smoothing) + the **fallback** flood-fill adapter used only if the model can't load. |
| `contour.ts` | Marching-squares contour → closed-loop RDP → angle-group corner fillet → Catmull-Rom smooth. |
| `edge-bleed.ts` | Grows the subject's own edge colours outward (replaces the original background) for a clean padding halo. |
| `mesh.ts` | Custom `BufferGeometry` (not `ExtrudeGeometry`): front cap + rounded edge lip + back cap. Three material groups (0 front, 1 edge matte-copy, 2 back). |
| `ShapedModel.tsx` | Builds the mesh on artwork change, wires the three materials (golden front, matte edge, solid back), maps design-state pan/zoom. |
| `types.ts` | Shared engine types (`ShapeSpecDraft`, `Dimensions`, …). |

## Reused surfaces (copied from golden, unchanged in role)

- `core/EffectViewer.tsx` — Canvas wrapper; chooses ShapedModel vs EffectModel by the `shaped` flag.
- `core/EffectModel.tsx` — golden GLB renderer. Present for parity but **not rendered** on `/shaped`.
- `admin/` — golden scene/material setup (dev-only; excluded from a prod embed).
- `user/` — customer controls (toolbar, colour panel, edit overlay).

## Scope of this lane

Browser **preview + draft** only — the tracing engine. Server canonical cutline, manufacturing
output, checkout, and the deferred add-ons (edge-round/thickness lock, magnetic grid overlay +
gap-fill, manual controls, image upscaler) are **not** in this folder.
