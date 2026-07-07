# Figma field reference crops (pixel-fidelity oracle)

`field-pixel-fidelity.mjs` compares these PNGs pixel-for-pixel (expert method: per-pixel
max-channel Δ, Δ>32 mismatch, heatmap + budget, exit 1) against the SAME fields rendered
by the build. **Fail-closed: a manifest field with no PNG here is a red gate, not a skip.**

## Capturing references (one-time, ~2 min, needs the Figma window ON-SCREEN at 100% zoom)
1. Open the DS file at node 4076-15236 (Top Section) in Chrome at **100% browser zoom** (⌘0).
2. In DevTools console, get each field container rect (aria-labels in manifest.json → the
   census labels), or reuse `figma-census-full.json` rects.
3. For each field: `screencapture -x -R"<x>,<contentY+y>,88,24" <key>.png`
   where contentY = window.screenY + (outerHeight - innerHeight).
   Retina saves 176x48 px — reference grade.
4. Keys/expected displayed values: manifest.json. Verify each PNG visually (a black or
   blank crop = wrong window frontmost — recapture).

Captured refs are COMMITTED so the gate is reproducible; recapture only when Figma's
own UI changes (then the gate SHOULD go red first — that is the point).
