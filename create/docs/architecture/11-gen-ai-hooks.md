# 11 — Gen AI Integration Hooks

> Three integration points wired in the architecture, built later.
> AI is a translator and content engine, not the renderer or primary UI.

## Phase: [v5]

## Principle [v5]

From Session 37 + GPT Pro AI Configurator review:

- **AI = translator, not renderer.** Build a deterministic configurator first. AI sits on top.
- **Config object = source of truth.** The DesignSession drives everything. AI writes to it via typed actions.
- **Don't make chat the primary UI.** Make it a sidecar assistant.

## Hook 1: Video Texture ("Image Comes Alive") [v5]

After design finishes, AI generates a short animation of the artwork content.

```typescript
const videoTexture = new THREE.VideoTexture(videoElement)
faceMaterial.map = videoTexture
```

Standard Three.js — no architecture change. Product module already manages the face texture.

**Pipeline:**
```
DesignSession → Job Queue → AI Provider (Veo 3 / Kling) → GeneratedMedia → CDN
```

Independent of the viewer. `domain/generated-media.ts` schema (empty for v1-v4).

## Hook 2: AI Intent Parsing [v5]

Natural language → typed configuration actions:

```
User: "make it blue"
  → AI parser (Gemini 2.5 Flash)
  → SET_ZONE_COLOR { zone: "face", color: "#1a3a6b" }
  → Rules validator (rejects illegal combinations)
  → DesignSession update
  → Viewer re-renders
```

Action types:
- `SET_ZONE_COLOR` — change surface color
- `SET_MATERIAL` — change surface material
- `APPLY_DECAL` — position artwork
- `SUGGEST_PATTERN` — generate pattern for surface

## Hook 3: Render Factory for Content [v5]

Dedicated render pages produce AI-generated content:
- Social-media-ready product shots
- Dynamic storefront imagery
- Video captures from 3D viewport

Same render factory as preview generation (see [07-preview-render-factory.md](07-preview-render-factory.md)), extended with:
- Video capture mode (frame sequence → MP4)
- Multiple scene/lighting setups per design
- AI-suggested camera angles

## Video Texture Implementation [v5]

```typescript
// products/effect/renderer/VideoTextureManager.ts
class VideoTextureManager {
  private videoElement: HTMLVideoElement | null = null
  private videoTexture: THREE.VideoTexture | null = null

  async applyVideoTexture(
    mesh: THREE.Mesh,
    videoUrl: string,
    options?: { loop?: boolean; autoplay?: boolean }
  ): Promise<void> {
    // Clean up previous
    this.dispose()

    // Create video element
    this.videoElement = document.createElement('video')
    this.videoElement.src = videoUrl
    this.videoElement.loop = options?.loop ?? true
    this.videoElement.muted = true  // required for autoplay
    this.videoElement.playsInline = true
    this.videoElement.crossOrigin = 'anonymous'

    // Create Three.js video texture
    this.videoTexture = new THREE.VideoTexture(this.videoElement)
    this.videoTexture.colorSpace = THREE.SRGBColorSpace
    this.videoTexture.minFilter = THREE.LinearFilter
    this.videoTexture.magFilter = THREE.LinearFilter

    // Replace the face material's diffuse map
    const material = mesh.material as THREE.MeshPhysicalMaterial
    material.map = this.videoTexture
    material.needsUpdate = true

    if (options?.autoplay !== false) {
      await this.videoElement.play()
    }
  }

  revertToStillTexture(mesh: THREE.Mesh, stillTexture: THREE.Texture): void {
    this.dispose()
    const material = mesh.material as THREE.MeshPhysicalMaterial
    material.map = stillTexture
    material.needsUpdate = true
  }

  dispose(): void {
    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.src = ''
      this.videoElement = null
    }
    if (this.videoTexture) {
      this.videoTexture.dispose()
      this.videoTexture = null
    }
  }
}
```

## AI Intent Parsing — Full Pipeline [v5]

```typescript
// features/create/ai/intentParser.ts

// Action types the AI can produce
type ConfigAction =
  | { type: 'SET_ZONE_COLOR'; surfaceId: SurfaceId; colorHex: string }
  | { type: 'SET_MATERIAL'; surfaceId: SurfaceId; materialId: string }
  | { type: 'SET_SIZE'; sizeId: string }
  | { type: 'MOVE_ARTWORK'; offsetX: number; offsetY: number }
  | { type: 'SCALE_ARTWORK'; scale: number }
  | { type: 'ROTATE_ARTWORK'; degrees: number }
  | { type: 'SUGGEST_PATTERN'; prompt: string; surfaceId: SurfaceId }
  | { type: 'UNKNOWN'; rawIntent: string }

interface IntentParseResult {
  actions: ConfigAction[]
  confidence: number
  reasoning?: string
}

// Parser sends user text + current config state to AI
async function parseIntent(
  userText: string,
  currentSession: DesignSession,
  spec: ProductSpec
): Promise<IntentParseResult> {
  const systemPrompt = buildSystemPrompt(spec)
  const userContext = buildUserContext(currentSession)

  const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GOOGLE_AI_API_KEY!,
    },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${userContext}\n\nUser request: ${userText}` }] }
      ],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: ConfigActionArraySchema,
      },
    }),
  })

  const data = await response.json()
  return parseAiResponse(data)
}

function buildSystemPrompt(spec: ProductSpec): string {
  const surfaces = spec.payload.surfaces.map(s =>
    `Surface "${s.id}" (${s.role}): configurable=${s.artwork_allowed}`
  ).join('\n')

  const colors = spec.payload.variant_axes.trim_back_colour.values.map(v =>
    `"${v.id}": ${v.label} (${v.swatch ?? 'no swatch'})`
  ).join('\n')

  const materials = spec.payload.variant_axes.face_material.values.map(v =>
    `"${v.id}": ${v.label}`
  ).join('\n')

  return `You are a product configurator assistant for ONEMO Effects.
You translate natural language into typed configuration actions.

Available surfaces:
${surfaces}

Available colors:
${colors}

Available materials:
${materials}

Rules:
- Only output actions for valid surfaces and valid option IDs
- If the user's request is ambiguous, output your best guess with lower confidence
- If the request is impossible (e.g. a color that doesn't exist), output UNKNOWN
- Never invent option IDs that aren't in the available lists
- Output JSON array of ConfigAction objects`
}
```

## Rules Validator [v5]

AI output passes through a deterministic validator before touching the DesignSession:

```typescript
// features/create/ai/rulesValidator.ts
function validateActions(
  actions: ConfigAction[],
  spec: ProductSpec,
  session: DesignSession
): { valid: ConfigAction[]; rejected: { action: ConfigAction; reason: string }[] } {
  const valid: ConfigAction[] = []
  const rejected: { action: ConfigAction; reason: string }[] = []

  for (const action of actions) {
    switch (action.type) {
      case 'SET_ZONE_COLOR': {
        const surface = spec.payload.surfaces.find(s => s.id === action.surfaceId)
        if (!surface) {
          rejected.push({ action, reason: `Unknown surface: ${action.surfaceId}` })
        } else if (!surface.artwork_allowed && action.surfaceId === 'face') {
          // Face color changes are only valid for non-artwork surfaces
          valid.push(action)
        } else {
          valid.push(action)
        }
        break
      }
      case 'SET_MATERIAL': {
        const exists = spec.payload.variant_axes.face_material.values.some(
          v => v.id === action.materialId && v.enabled
        )
        if (!exists) {
          rejected.push({ action, reason: `Invalid or disabled material: ${action.materialId}` })
        } else {
          valid.push(action)
        }
        break
      }
      case 'SCALE_ARTWORK': {
        const constraints = spec.payload.manufacturing_profiles[0]?.constraints
        if (constraints && (action.scale < constraints.min_scale || action.scale > constraints.max_scale)) {
          rejected.push({ action, reason: `Scale ${action.scale} outside range [${constraints.min_scale}, ${constraints.max_scale}]` })
        } else {
          valid.push(action)
        }
        break
      }
      default:
        valid.push(action)
    }
  }

  return { valid, rejected }
}
```

## Generated Media Schema [v5]

```typescript
// domain/generated-media.ts
const GeneratedMediaSchema = z.object({
  id: z.string().uuid(),
  designId: z.string().uuid(),
  designRevision: z.number(),
  type: z.enum(['video_texture', 'hero_render', 'social_content', 'try_on']),
  provider: z.enum(['veo_3', 'kling', 'gemini_image', 'internal_render']),
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  inputAssetRef: z.string(),       // what was sent to the AI
  outputAssetRef: z.string().nullable(), // result in Cloudinary
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
})

type GeneratedMedia = z.infer<typeof GeneratedMediaSchema>
```

## Content Generation Pipeline [v5]

```
DesignSession (approved)
  → Content Generation Job (job_queue, type: 'content_generation')
  → Worker picks up job
  → Extracts artwork + scene context from DesignSession
  → Calls AI provider (Veo 3 for video, Gemini Image for stills)
  → Receives generated asset
  → Uploads to Cloudinary: designs/{designId}/generated/{type}/{id}
  → Updates GeneratedMedia record in Supabase
  → If video_texture: available in viewer via VideoTextureManager
  → If hero_render: available for storefront/social display
```
