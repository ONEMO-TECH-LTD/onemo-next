# 07 — Preview Render Factory

> Headless browser capture of deterministic previews for product listings, share, and order confirmation.
> Same renderer as Create — same material/tone-mapping path.

## Phase: [v3]

## Why Browser Capture [v3]

- Same renderer as Create (R3F / Three.js)
- Same material and tone-mapping path
- Same product module
- Deterministic capture camera contracts from ScenePreset
- No duplicated shader/material stack
- One render factory produces: live preview, owner preview, public preview, order preview, catalog imagery

## Architecture [v3]

```
POST /api/designs/:id/review
  → Server validates design + enqueues preview job
  → Worker loads internal render page
  → Render page loads exact revision + exact published preset
  → Render page emits render-ready signal
  → Worker captures screenshot(s)
  → Upload to Cloudinary with strict folder/naming
  → Update preview URLs in Supabase
```

### Render Pages

Internal routes under `src/app/render/`:

| Route | Purpose |
|-------|---------|
| `/render/design/[designId]/owner` | Owner continuity preview |
| `/render/design/[designId]/public` | Public/share preview |
| `/render/design/[designId]/order` | Order confirmation preview |
| `/render/catalog/[captureSetId]` | Catalog/listing imagery (hero, angles, detail, thumbnail) |

Each render page:
1. Loads the exact revision + exact published preset versions
2. Mounts ViewerShell + product module (headless, no user controls)
3. Applies the DesignSession overrides
4. Positions camera per CapturePreset
5. Waits for GLB loaded + textures loaded + scene applied + first stable frame
6. Emits `render-ready` signal via `ViewerShell.onRenderReady`

### Worker

Playwright/Chromium worker process:
- Captures screenshots at exact viewport sizes from `ScenePreset.capture_presets`
- Uploads to Cloudinary: `designs/{designId}/{role}/r{revision}.webp`
- Updates preview URLs and status in Supabase

### Capture Presets

Defined in ScenePreset:

```typescript
interface CapturePreset {
  id: string
  role: 'owner' | 'public' | 'order' | 'catalog'
  cameraPresetId: string   // reference to cameras[]
  widthPx: number
  heightPx: number
  pixelRatio: number
  format: 'png' | 'jpg' | 'webp'
  quality?: number
}
```

## Fallback Stills [v3]

If WebGL fails or is unavailable, stills preserve trust:
- Minimum 4 views: front, three-quarter, side-detail, back
- Same object/camera family as live scene
- If only one still in MVP: canonical front proof image

## Catalog Images [v3]

Same render worker, different route:
- `/render/catalog/[captureSetId]`
- One `captureSetId` produces hero, angle-left, angle-right, detail, thumbnail variants
- Used for product listings, collections, social sharing
