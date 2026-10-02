# Effect render — engine + admin

Shows a user's Effect on a garment photo as a realistic object, by layering images — no AI per render,
no re-drawing of the photo or the artwork. The Effect is the user's cut-out; the photo is stock or an upload.

Layers, all lit by one light direction: drop shadow · contact shadow · side wall (thickness) · face
(tone-matched artwork + bevel light and glint + material texture bump).

```bash
npm install
npm run dev      # admin → http://localhost:5190 (LAN too)
npm test
```

- `src/engine/` — pure TypeScript, config → SVG string. Rasterise in a browser, worker or server (e.g. resvg).
- `src/admin/` — dashboard: pick photo / Effect / material, drag to place, sliders for every layer, PNG export.
- `public/stock/` — garment photos (T-shirts generated for the prototype; hoodie/trousers from the suede prototype).
- `public/materials/` — height maps from `public/assets/materials` (suede, velour, woven fabric).
- `public/effects/` — sample Effects cut from `public/assets/test-artwork.png`.
