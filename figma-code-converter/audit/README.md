# Fidelity audit — node-by-node matrix + visual side-by-side

The standard for verifying a conversion (Dan, C3): don't eyeball — compare the **full anatomy**
(every node's Figma properties ↔ the emitted CSS/React) AND the **visual** (Figma render vs the
converted screen rendered with the app container context).

## 1. Node-by-node anatomy matrix

```
# convert first (writes convert-run.json + *.module.css + *.tsx into <outDir>)
node bin/figma-to-code.mjs convert <frame-url> --out <outDir> --tokens-css <app tokens.css>

# then the anatomy report
node audit/anatomy.mjs <outDir> cache/<fileKey>-<node>.nodes.json <app tokens.css>
# → <outDir>/anatomy.html : per node, Figma props (size/sizing/layout/fills/strokes/effects/
#   radius/text) on the left, the exact emitted CSS/React on the right, token vars resolved (green).
```

Read it as the token conformance report's big brother: any Figma property with no matching CSS
value (a dropped stroke, a mis-mapped size) is visible side by side.

## 2. Visual side-by-side — MEASURED (visual-diff.mjs)

```
node audit/visual-diff.mjs <outDir> <figma.png> <converted.png> [--bands "name:y0:y1,…"]
# → <outDir>/visual-diff.html — side-by-side + diff heatmap + measured mismatch % (overall and
#   per-band). Serve over http (file:// blocks canvas reads); numbers in #out / window.__diff.
```

Get the two inputs:

- **Figma's own render:** `GET /v1/images/:key?ids=<node>&format=png&scale=2` (needs `FIGMA_TOKEN`).
- **Converted render (real container context):** the emitted CSS uses fluid `clamp(… cqi …)` tokens,
  so it must render inside a `container-type: inline-size` context — which the converter now emits on
  the root frame (C3.3, "frame = viewport"). Render the `.tsx`/`.module.css` in a real React route
  (e.g. the `s58-converted` onemo-next route) OR a static HTML shim that inlines tokens.css + the
  module.css at the frame's width. Screenshot both at 402×871 @2x and diff by eye.

  Shim caveat: a raw-HTML shim mis-renders inline **stroked** SVG as a flex item (icon collapses to
  width 0) — that is a shim artifact, not a converter defect (the SVG is valid and renders in a real
  React route). Prefer the real route for icon-level fidelity checks.

## What each C3 fix should show
- Rotation: `transform: rotate(±90deg)` on the glass buttons/ticks (not `1.57deg`).
- Card border: `.rectangle49` has `border: 10px solid #333333; border-radius: 40px` (rounded, present).
- Container: `.<root>` starts with `container-type: inline-size`.
- Refusals: `convert-run.json` `refusals.length === 0` on the golden mother screen.

## 3. Fidelity-budget gate (fidelity-gate.mjs) — "works on any screen" as a machine check

```
# 1) prep (writes fidelity-gate.html with approximation-region + dev-badge masks)
node audit/fidelity-gate.mjs <outDir> <figma.png> <converted.png> <raw-nodes.json> [--budget 10] &
# 2) measure from the SHELL (a node-spawned Chrome SIGTRAPs on macOS interactive contexts) + judge:
<chrome> --headless=new --disable-gpu --virtual-time-budget=15000 --dump-dom http://<served>/fidelity-gate.html \
  | node audit/fidelity-gate.mjs <same args> --judge     # exit 0 pass / 1 fail
```

Masks: every ledgered-approximation node's region (declared-lossy) + the Next dev badge. The
RESIDUAL is what remains — unledgered drift. Default budget 10% = the font-rasterizer floor on
text-heavy screens (Figma's text AA ≠ Chrome's); structural regressions measure far above it
(live: wrong-screen = 16.5%, mother = 4.3%, text-heavy candidate = 8.1%).
