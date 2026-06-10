# Sticker Maker — Build Blueprint

> The authority for how the Sticker Maker is built, refactored, and extended. Engine internals live in
> `ARCHITECTURE.md` (the shaped cut-out pipeline); this document defines the **2D-first architecture**,
> the **spec as the millimetre source of truth**, and the **refactor plan** to get there.

---

## 1. The core principle — one spec, three consumers

There is exactly **one canonical artifact**: the **Sticker Spec**, measured in **millimetres**. It is
computed once from the uploaded image (and mutated by the 2D editor), and it is the single source of
truth consumed by everything downstream:

```
              ┌──────────────────────┐
   image ───▶ │  Sticker Spec (mm)   │ ───▶ 2D view        (clip + composite, the creation surface)
   (+ edits)  │  • outline contour   │ ───▶ 3D preview     (mesh + suede material, on demand)
              │  • dimensions        │ ───▶ Manufacturing  (dieline / cutline, print + cut files)
              │  • generator/trim    │
              └──────────────────────┘
```

- **Millimetres are canonical.** The contour, dimensions, corner radii, edge/bleed — all in mm. Pixels
  (`maskWidthPx`, `mmPerPx`) are intermediate scaffolding for computation, never the source of truth.
- The spec is **persisted** (per design) so the same measured geometry drives the on-screen 3D preview
  **and** the manufacturing output — they can never diverge. What you see is what gets cut.
- The 2D editor's edits **mutate the spec** (OutlineDocument → resolved → mm contour). The edited mm
  contour IS the final spec.

## 2. 2D-first, 3D on demand

WebGL is the heavy cost and the only thing that needs the GPU render loop. The **entire creation flow
is 2D**; 3D is a *preview/render of the finished spec*, mounted only when explicitly requested.

| Stage | Surface | WebGL? |
|---|---|---|
| Empty state (no image) | pearly/aluminium glass square + load control | **no** |
| Upload | flat square sticker, 2D composite | **no** |
| **Magic** (auto cut-out) | run BEN → update the spec's contour | **no** |
| **Edit** (outline / face) | 2D outline editor (anchors, shape, hug, draw) | **no** |
| **Trim** (colour / material / edge) | 2D choices, stored on the spec | **no** |
| **Preview 3D** | mount R3F, build mesh from spec, show suede object | **yes — only here** |
| Manufacturing export | dieline + print from the spec | **no** |

Shape and face editing are **sufficient on the 2D plane** — the 3D adds material/lighting realism, not
geometry. Exiting the 3D preview **unmounts** the canvas so WebGL stops.

## 3. Module split (target)

```
core/shaped/
  pipeline.ts
    prepareSticker(url, mode)      → { spec (mm), composite (magic-blend), subjectMatte }   [PURE 2D, no three.js render]
    buildMeshFromSpec(spec, srcs)  → { geometry, frontTexture, edgeTexture }                [three.js — 3D preview only]
    composeFront(orig, subj, blur) → magic-blend canvas                                      [2D canvas, shared]
  segment-ml.ts / mask.ts / contour.ts   → segmentation + contour (compute the mm contour)
  mesh.ts                                 → BufferGeometry from the mm contour (3D only)

user/
  Sticker2D.tsx        → the 2D hero: composite clipped to the spec's outline + shadow on the backdrop
  OutlineEditor.tsx    → the 2D editor (already 2D); edits mutate the spec
  Toolbar.tsx          → Replace · Magic · Edit · Trim · (Preview 3D)
  outlineStore.ts      → holds the spec, the composite, the edited outline, the trim choices

core/EffectViewer.tsx  → the R3F canvas; mounted ONLY for the 3D preview
```

**Decoupling rule:** segmentation + contour + composite are pure (no three.js render). The three.js
mesh/material is assembled from the spec **only at 3D-preview time** via `buildMeshFromSpec`. The 2D flow
never instantiates the render loop.

## 4. Performance contract (CORRECTED 2026-06-10 — see ADDENDUM-V1-RECOVERY.md)

> **⚠ Correction.** The original §4 claimed: *"with the R3F canvas mounted and a mesh present, the scene
> render is a ~166 ms main-thread task that, run continuously, starved the event loop to ~12 FPS —
> therefore the canvas must not be mounted during 2D work."* **That attribution was wrong.** The ~166 ms
> task was the `buildSquareShape` build effect re-firing every render (an unstable-callback effect-deps
> React bug — diagnosed correctly at the time, then lost when a broken-HMR dev server made every fix-test
> read 12 FPS regardless). QA's same-day review flagged the misattribution ("NOT an intrinsic scene-render
> cost; every measurement confounded") and prescribed a confirmation spin-test; the 2026-06-10 audit ran
> it on this snapshot: **mesh loaded, damping on, continuous orbit = 120 FPS, avg 8.3 ms/frame, zero long
> tasks.** The scene render costs ~1–2 ms. A mounted canvas during 2D work is an idle-efficiency/battery
> concern (damping defeats `frameloop="demand"` → continuous cheap renders), not a framerate constraint.

Rules (corrected):

- The R3F canvas MAY stay mounted during 2D work; with `frameloop="demand"` it must genuinely idle —
  disable OrbitControls damping (or stop it settling) so demand mode reaches zero frames at rest.
- The real per-interaction budget lives in the **2D pipeline**: no full SDF/resolve/mesh rebuild per
  slider tick (the Hug bug); preview cheap per tick, commit expensive work on release.
- No `backdrop-filter` over the live canvas (full-screen backdrop blur is a real cost). Aluminium / faux-glass stays.
- When the 3D canvas is up: `frameloop="demand"`, capped DPR, no idle auto-render. (Already shipped here.)
- Heavy one-shot work (segmentation, `toDataURL`) runs on explicit user action, never on every render —
  and segmentation belongs in a worker (the wasm fallback otherwise freezes the main thread).

## 5. Material / look direction (ONEMO, not Apple)

Surfaces use **anodised / brushed aluminium**, not glass: a metallic-grey base + subtle brushed noise +
a machined cut-edge gradient shimmer. No transparency, no `backdrop-filter`. Values sourced from the
ONEMO Figma aluminium style. The 2D border-beam (Apple-sticker trace) stays for the outline in edit mode;
the square plays a one-shot surface shimmer on generate.

## 6. Refactor plan (ordered)

1. **Decouple** `prepareSticker` (pure) + `buildMeshFromSpec` (three.js) in `pipeline.ts`. Keep
   `buildShape`/`buildSquareShape` as thin wrappers during the transition so the current 3D keeps working.
2. **Spec in the store** as the SSOT: `prepareSticker` writes `spec` + `compositeUrl` + `subjectMatteUrl`;
   the editor mutates the spec.
3. **`Sticker2D`** 2D hero — render the composite clipped to the spec outline. Becomes the default scene.
4. **Gate WebGL**: `page.tsx` stops mounting the canvas by default; add **Preview 3D** to mount it on
   demand (build from the stored spec, no re-segmentation), unmount on exit.
5. **Aluminium surfaces** across the chrome (replace faux-glass with the ONEMO aluminium treatment).
6. **Manufacturing surface (later):** export the spec's mm contour as the dieline/cutline + print file.
   Server-side canonical lock is the deferred slice; the spec is already manufacturing-grade in mm.

## 7. Documentation + working conventions

- This blueprint is the **authority**; Linear tasks reflect it (the blueprint instructs Linear, not the
  reverse). No Linear IDs in this doc — it must stand alone.
- All edits happen in the worktree; `TUNING.md` records every tunable parameter + value.
- Every visual/perf change is **measured** (FPS sample) and **verified in Chrome** before "done".
- Keep `prepareSticker` free of three.js. If a change needs the GPU, it belongs in `buildMeshFromSpec`
  behind the 3D preview.
