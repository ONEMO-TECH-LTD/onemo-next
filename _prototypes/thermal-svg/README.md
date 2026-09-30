# Thermal SVG — engine + admin

Standalone prototype of the "heat-map" SVG effect: an inflated, glowing shape with a moving light
band, coloured through a palette, softened and grained. Any text, SVG or image goes in; one small,
self-contained SVG comes out (about 3 KB for text). No canvas, no WebGL, no runtime script — the only
motion is an SVG gradient animation.

## Run

```bash
npm install
npm run dev          # admin dashboard → http://localhost:5189 (also on your LAN for phone testing)
npm test             # engine tests
npm run typecheck
npm run render -- config.json out.svg   # headless render, no browser — how an API route would call it
```

## Layout — engine and shell are separate

```
src/engine/          THE MODULE. Pure TypeScript, no DOM, no framework.
  index.ts           public API — the only import path for anything outside
  types.ts           ThermalConfig: the whole effect as one JSON-serialisable object
  defaults.ts        default config, named palettes, limits
  normalize.ts       fills missing values, clamps every number (a bad request degrades, never breaks)
  source.ts          text / SVG / image → SVG content; sanitises dropped SVG (no script, handlers, links)
  palette.ts         colour stops → lookup tables
  render.ts          config → SVG string (the filter pipeline)
src/runtime/view.ts  Live GPU view (browser). Animates the engine's still "field" on WebGL at 60 fps;
                     falls back to the animated SVG without WebGL.
src/admin/           THE SHELL. Dashboard only; renders nothing itself — it calls the engine.
scripts/render.ts    CLI proof that the engine runs without a browser
```

API:

```ts
import { renderThermal } from './src/engine'
const { svg, width, height, config } = renderThermal({ source: { kind: 'text', text: 'ONEMO' } }, { id: 'hero' })
```

Pass a partial config; everything missing comes from the defaults. `options.id` prefixes internal ids so
several renders can share a page.

## How the look is built (one SVG filter)

1. **Fill** — the shape filled with the base heat plus the moving stripe (a repeating grey gradient,
   animated with `animateTransform`), on black so the outside counts as no heat.
2. **Inflated edge** — the shape minus a blurred copy of itself leaves a band along the inside edge,
   which is subtracted from the heat.
3. **Blur** — softness and the outer glow.
4. **Grain** — `feTurbulence` noise, centred so it does not shift the heat.
5. **Palette** — `feComponentTransfer` tables map every grey level to a colour.

Reference: Mike Bespalov's "How I made this" (X, 30 Sep 2026), rebuilt from its steps.

## Admin

Every setting of the config has a control; the dashboard shows the config actually rendered (after
clamping). Drop an SVG, PNG/JPG, text file or a saved config `.json` anywhere on the page, or paste SVG
markup. **Space** plays/pauses. Export: download/copy SVG, download/copy config. The config persists in
the browser.

## Why the preview uses the GPU

An animated SVG filter is recomputed on the CPU every frame; on an iPhone that is ~2 fps. The live view
asks the engine for a still "field" (heat, stripe coverage, glow packed into R/G/B) once per change, and the
GPU adds the moving stripe and the palette lookup per frame — 60 fps, same look. Exported SVGs are still the
engine's full animated SVG (fine on desktop, slow on phones for the same reason).

## Fonts

The font dropdown follows the design-token roles (`tokens.css`): Brand/Primary = Chillax, Secondary = Satoshi,
plus Nippo. Web fonts come from `asset-library/fonts` (copied to `public/fonts`). Exports embed the used
font inside the SVG.

## Known limits

- Text can't be measured without a browser, so "Fit width" estimates the size and stretches to the exact
  width with `textLength`.
- The exported animated SVG is CPU-heavy on phones; use the runtime view (or a still export) on mobile.
