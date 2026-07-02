# s58 — SKYLRK + Suede Studio

Standalone Vite prototypes for the ONEMO surface/material direction. No build step in the app — run independently.

## Pages

- **`suede-studio.html`** — the suede effect studio on the actual Effect Frame product. One model, full chrome (FRAMED/SLIM/SHAPED variants · MATERIAL/LIGHT/COLOUR/FRAME/FLIP dock), procedural suede (SVG `feTurbulence` + `feDiffuseLighting`), per-noise-type settings, reload persistence, and the real 3D perspective flip (single-face continuous turn, content swap pinned to the edge-on 90° instant so it's invisible). Safari-tuned.
- **`index.html`** — the SKYLRK surface comparator. Three grain engines side by side (skylrk hash, mattdesl simplex-3D, Paper) over a shared adaptive gradient, with GPU-load device simulation and on-device measure. WebGL.

## Run

```bash
npm install
npm run dev        # vite --host → http://localhost:5188 (and on your LAN for phone testing)
```

Open `/suede-studio.html` or `/` (the comparator).

## Noise — procedural vs baked

- **FRACTAL / TURBULENT** = SVG `feTurbulence` (Perlin). The only *truly procedural*, shippable, no-WebGL noise — what the 2D effect ships.
- **HASH / SIMPLEX / VORONOI** = no SVG primitive; generated once via WebGL → baked raster. Comparison only, not shippable in the no-WebGL stack.

## Stack notes

- The suede is **static** (suede doesn't shimmer) and **WebGL-free** at runtime (CSS + SVG), per the 2D-primary effect direction (ADR-3D-02).
- Research lineage + the SKYLRK dissection: `onemo-ssot-global/_ssot-workbench/_research/2026-06-29-skylrk-shop-dissection.md`.
