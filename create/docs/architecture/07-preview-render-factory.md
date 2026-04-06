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

## Render Page Implementation [v3]

```typescript
// app/render/design/[designId]/[role]/page.tsx
// This is a Server Component that loads data, then hands to a client RenderScene
import { createRepositories } from '@/server/repositories'

export default async function RenderPage({
  params,
}: {
  params: { designId: string; role: 'owner' | 'public' | 'order' }
}) {
  const repos = createRepositories()
  const session = await repos.designSession.get(params.designId)
  const preset = await repos.scenePreset.getPublished(session.scenePresetRef.id)
  const spec = await repos.productSpec.getById(session.productSpecRef.id)

  // Find the camera preset for this role
  const cameraPreset = preset.payload.cameras.find(
    c => c.role === `${params.role}_preview`
  ) ?? preset.payload.cameras.find(c => c.role === 'create_default')!

  // Find capture preset for viewport dimensions
  const capturePreset = preset.payload.capture_presets.find(
    c => c.role === params.role
  )

  return (
    <RenderScene
      preset={preset}
      session={session}
      spec={spec}
      cameraPreset={cameraPreset}
      capturePreset={capturePreset}
      role={params.role}
    />
  )
}
```

```typescript
// app/render/design/[designId]/[role]/_components/RenderScene.tsx
'use client'

import { ViewerShell } from '@create/core'
import { getProductModule } from '@create/products/registry'

export function RenderScene({
  preset, session, spec, cameraPreset, capturePreset, role,
}: RenderSceneProps) {
  const module = getProductModule(spec.payload.family)
  const config = scenePresetToViewerConfig(preset, cameraPreset)

  return (
    <div style={{
      width: capturePreset?.width_px ?? 1200,
      height: capturePreset?.height_px ?? 1200,
    }}>
      <ViewerShell
        config={config}
        modelUrl={resolveModelUrl(session, spec)}
        onModelReady={(root) => {
          // Apply surfaces + overrides
          const surfaces = module.discoverSurfaces(root, preset.payload)
          module.applyOverrides(root, surfaces, sessionToOverrides(session))
        }}
        onRenderReady={() => {
          // Signal to Playwright worker that capture is safe
          window.__ONEMO_RENDER_READY = true
          document.title = 'RENDER_READY'
        }}
      >
        <module.Renderer
          surfaces={null}  // initialized via onModelReady
          session={session}
          preset={preset}
        />
      </ViewerShell>
    </div>
  )
}
```

## Preview Worker [v3]

```typescript
// server/workers/previewWorker.ts
import { chromium } from 'playwright'
import { createRepositories } from '@/server/repositories'

interface PreviewJob {
  designId: string
  revision: number
  roles: ('owner' | 'public' | 'order')[]
}

async function processPreviewJob(job: PreviewJob): Promise<void> {
  const repos = createRepositories()
  const browser = await chromium.launch({ headless: true })

  try {
    for (const role of job.roles) {
      const page = await browser.newPage()
      const url = `${process.env.RENDER_BASE_URL}/render/design/${job.designId}/${role}`

      await page.goto(url)

      // Wait for render-ready signal
      await page.waitForFunction(() => window.__ONEMO_RENDER_READY === true, {
        timeout: 30_000,
      })

      // Allow one extra frame for settling
      await page.waitForTimeout(100)

      // Get capture dimensions from ScenePreset
      const session = await repos.designSession.get(job.designId)
      const preset = await repos.scenePreset.getPublished(session.scenePresetRef.id)
      const capturePreset = preset.payload.capture_presets.find(c => c.role === role)

      // Capture screenshot
      const screenshot = await page.screenshot({
        type: capturePreset?.format ?? 'webp',
        quality: capturePreset?.quality ?? 90,
        clip: {
          x: 0, y: 0,
          width: capturePreset?.width_px ?? 1200,
          height: capturePreset?.height_px ?? 1200,
        },
      })

      // Upload to Cloudinary
      const publicId = `${process.env.CLOUDINARY_ENV_PREFIX}/designs/${job.designId}/${role}/r${job.revision}`
      await repos.assets.uploadBuffer(screenshot, {
        publicId,
        format: capturePreset?.format ?? 'webp',
        folder: `designs/${job.designId}/${role}`,
      })

      // Update preview URL in Supabase
      const deliveryUrl = repos.assets.getDeliveryUrl(publicId)
      await repos.designSession.updatePreviewUrls(job.designId, {
        [`${role}PreviewUrl`]: deliveryUrl,
      })

      await page.close()
    }
  } finally {
    await browser.close()
  }
}
```

## Job Queue Integration [v3]

```typescript
// server/use-cases/enqueuePreviewGeneration.ts
async function enqueuePreviewGeneration(
  repos: Repositories,
  designId: string,
  revision: number,
  roles: ('owner' | 'public' | 'order')[] = ['owner', 'public', 'order']
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('job_queue')
    .insert({
      job_type: 'preview_generation',
      payload: { designId, revision, roles },
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// Worker polls job_queue for pending preview_generation jobs
// In dev: runs as a script (`scripts/run-preview-worker.ts`)
// In production: runs as a separate process or Vercel cron
```

## Render-Ready Contract [v3]

The render page must wait until ALL of these are true before signaling ready:
1. GLB loaded and parsed
2. All textures loaded (artwork, material maps, environment)
3. ScenePreset applied (materials, lighting, camera)
4. DesignSession overrides applied (colors, artwork placement)
5. First stable frame rendered (no pending invalidations)

```typescript
// Render-ready check inside ViewerShell
function useRenderReadySignal(onRenderReady?: () => void) {
  const modelLoaded = useRef(false)
  const texturesLoaded = useRef(false)
  const firstFrameRendered = useRef(false)

  useFrame(() => {
    if (modelLoaded.current && texturesLoaded.current && !firstFrameRendered.current) {
      firstFrameRendered.current = true
      // Wait one more frame for settling
      requestAnimationFrame(() => onRenderReady?.())
    }
  })

  return { setModelLoaded, setTexturesLoaded }
}
```
