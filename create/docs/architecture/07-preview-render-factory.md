# 07 — Preview Render Factory

> Headless browser capture of deterministic previews for product listings, share, and order confirmation.
> Same renderer as Create — same material/tone-mapping path.
> Consolidation: D3 (revision in route + fallback route), U1 (captures from immutable snapshot).

## Phase: [Phase 3]

## Why Browser Capture [Phase 3]

- Same renderer as Create (R3F / Three.js)
- Same material and tone-mapping path
- Same product module
- Deterministic capture camera contracts from ScenePreset
- No duplicated shader/material stack
- One render factory produces: live preview, owner preview, public preview, order preview, catalog imagery, fallback stills

## Architecture [Phase 3]

```
POST /api/designs/:id/review
  → Server validates design (CompatibilityEngine)
  → Enqueues preview job for current immutable revision
  → Worker loads internal render page at /render/design/[id]/[revision]/[role]
  → Render page loads exact revision snapshot + exact published preset
  → Render page emits render-ready signal
  → Worker captures screenshot(s)
  → Upload to Cloudinary with strict folder/naming
  → Update preview URLs in Supabase
```

### Render Pages (D3: merged routes)

Internal routes under `src/app/render/`:

| Route | Purpose | Source |
|-------|---------|--------|
| `/render/design/[designId]/[revision]/[role]` | Revision-specific capture | D3: P1 (revision in path) |
| `/render/fallback/[scenePresetId]/[context]` | Poster still generation at publish time | D3: P2 (fallback route) |
| `/render/catalog/[captureSetId]` | Catalog/listing imagery | Original |

**Key change from pre-consolidation:** Render routes include `[revision]` in the path. Immutable capture must reference a specific revision snapshot, not the mutable head.

Each render page:
1. Loads the **immutable revision snapshot** via `DesignRevisionRepository.getByRevision()` + exact published preset versions
2. Mounts ViewerShell + product module (headless, no user controls)
3. Applies the snapshot's design overrides
4. Positions camera per CapturePreset
5. Waits for GLB loaded + textures loaded + scene applied + first stable frame
6. Emits `render-ready` signal via `ViewerShell.onRenderReady`

### Fallback Route [Phase 3]

Generates poster stills for the still-first pattern (U8):

```
/render/fallback/[scenePresetId]/[context]
  → Loads published ScenePreset
  → Renders with default product config (no customer design)
  → Captures per presentation_context camera + background
  → Uploads to ScenePreset.fallback_stills[]
```

This runs when a ScenePreset is published — not per-design. The stills are the "poster" shown before WebGL loads.

## Render Page Implementation [Phase 3]

```typescript
// app/render/design/[designId]/[revision]/[role]/page.tsx
import { createRepositories } from '@/server/repositories'

export default async function RenderPage({
  params,
}: {
  params: { designId: string; revision: string; role: 'owner' | 'public' | 'order' }
}) {
  const repos = createRepositories()
  const revisionNum = parseInt(params.revision)

  // Load from IMMUTABLE snapshot — not mutable head (U1)
  const snapshot = await repos.designRevision.getByRevision(params.designId, revisionNum)
  const preset = await repos.scenePreset.getPublished(snapshot.scene_preset_ref.id)
  const spec = await repos.productSpec.getById(snapshot.product_spec_ref.id)

  const cameraPreset = preset.payload.cameras.find(
    c => c.role === `${params.role}_preview`
  ) ?? preset.payload.cameras.find(c => c.role === 'create_default')!

  const capturePreset = preset.payload.capture_presets.find(
    c => c.role === params.role
  )

  return (
    <RenderScene
      preset={preset}
      session={snapshot.snapshot}
      spec={spec}
      cameraPreset={cameraPreset}
      capturePreset={capturePreset}
      role={params.role}
    />
  )
}
```

```typescript
// app/render/design/[designId]/[revision]/[role]/_components/RenderScene.tsx
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
          const surfaces = module.discoverSurfaces(root, preset.payload)
          module.applyOverrides(root, surfaces, sessionToOverrides(session))
        }}
        onRenderReady={() => {
          window.__ONEMO_RENDER_READY = true
          document.title = 'RENDER_READY'
        }}
      >
        <module.Renderer
          surfaces={null}
          session={session}
          preset={preset}
        />
      </ViewerShell>
    </div>
  )
}
```

## Preview Worker [Phase 3]

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
      // Revision in URL — captures from immutable snapshot
      const url = `${process.env.RENDER_BASE_URL}/render/design/${job.designId}/${job.revision}/${role}`

      await page.goto(url)
      await page.waitForFunction(() => window.__ONEMO_RENDER_READY === true, {
        timeout: 30_000,
      })
      await page.waitForTimeout(100)

      // Get capture dimensions from snapshot's preset
      const snapshot = await repos.designRevision.getByRevision(job.designId, job.revision)
      const preset = await repos.scenePreset.getPublished(snapshot.scene_preset_ref.id)
      const capturePreset = preset.payload.capture_presets.find(c => c.role === role)

      const screenshot = await page.screenshot({
        type: capturePreset?.format ?? 'webp',
        quality: capturePreset?.quality ?? 90,
        clip: {
          x: 0, y: 0,
          width: capturePreset?.width_px ?? 1200,
          height: capturePreset?.height_px ?? 1200,
        },
      })

      const publicId = `${process.env.CLOUDINARY_ENV_PREFIX}/designs/${job.designId}/${role}/r${job.revision}`
      await repos.assets.uploadBuffer(screenshot, {
        publicId,
        format: capturePreset?.format ?? 'webp',
        folder: `designs/${job.designId}/${role}`,
      })

      const deliveryUrl = repos.assets.getDeliveryUrl(publicId)
      await repos.designHead.updatePreviewUrls(job.designId, {
        [`${role}PreviewUrl`]: deliveryUrl,
      })

      await page.close()
    }
  } finally {
    await browser.close()
  }
}
```

## Capture Presets [Phase 3]

Defined in ScenePreset:

```typescript
interface CapturePreset {
  id: string
  role: 'owner' | 'public' | 'order' | 'catalog'
  cameraPresetId: string
  width_px: number
  height_px: number
  pixelRatio: number
  format: 'png' | 'jpg' | 'webp'
  quality?: number
}
```

## Fallback Stills [Phase 1+3]

If WebGL fails or is unavailable, stills preserve trust:
- Minimum 4 views: front, three-quarter, side-detail, back
- Generated at ScenePreset publish time via `/render/fallback/` route
- Same object/camera family as live scene
- Used by still-first pattern (U8) as poster image before WebGL loads

## Render-Ready Contract [Phase 3]

The render page must wait until ALL of these are true before signaling ready:
1. GLB loaded and parsed
2. All textures loaded (artwork, material maps, environment)
3. ScenePreset applied (materials, lighting, camera)
4. DesignSession overrides applied (colors, artwork placement)
5. First stable frame rendered (no pending invalidations)

```typescript
function useRenderReadySignal(onRenderReady?: () => void) {
  const modelLoaded = useRef(false)
  const texturesLoaded = useRef(false)
  const firstFrameRendered = useRef(false)

  useFrame(() => {
    if (modelLoaded.current && texturesLoaded.current && !firstFrameRendered.current) {
      firstFrameRendered.current = true
      requestAnimationFrame(() => onRenderReady?.())
    }
  })

  return { setModelLoaded, setTexturesLoaded }
}
```

## Job Queue Integration [Phase 3]

```typescript
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
```
