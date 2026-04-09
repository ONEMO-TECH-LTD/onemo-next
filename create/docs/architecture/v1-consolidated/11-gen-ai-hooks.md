# 11 — Gen AI Integration Hooks

> Three integration points wired in the architecture, built later.
> AI is a translator and content engine, not the renderer or primary UI.
> Consolidation: D6 (discriminated union schema from P2), intake adapters, video texture as GeneratedMedia subtype.

## Phase: [Phase 7]

## Principle [Phase 7]

From Session 37 + GPT Pro AI Configurator review:

- **AI = translator, not renderer.** Build a deterministic configurator first. AI sits on top.
- **Config object = source of truth.** The DesignSession drives everything. AI writes to it via typed actions.
- **Don't make chat the primary UI.** Make it a sidecar assistant.
- **All AI actions go through CompatibilityEngine (U5)** before touching DesignSession.

## Hook 1: Video Texture ("Image Comes Alive") [Phase 7]

After design finishes, AI generates a short animation of the artwork content. Video texture is a **subtype of GeneratedMedia** — not a separate pipeline.

```typescript
// Video texture is GeneratedMedia with type: 'video_texture'
const videoMedia = await repos.generatedMedia.create({
  design_id: designId,
  design_revision: revision,
  type: 'video_texture',
  provider: 'veo_3',
  status: 'pending',
  input_asset_ref: session.artwork.original_asset_id,
})
```

Standard Three.js application — no architecture change. Product module already manages the face texture.

```typescript
const videoTexture = new THREE.VideoTexture(videoElement)
faceMaterial.map = videoTexture
```

**Pipeline:**
```
DesignSession → Job Queue → AI Provider (Veo 3 / Kling) → GeneratedMedia → CDN → VideoTextureManager
```

## Hook 2: AI Intent Parsing (D6: Discriminated Union) [Phase 7]

Natural language → typed configuration actions via Zod discriminated union:

```
User: "make it blue"
  → AI parser (Gemini 2.5 Flash)
  → AiCreateCommand (discriminated union)
  → CompatibilityEngine validates command
  → DesignSession update
  → Viewer re-renders
```

### Command Schema (D6: P2's discriminated union)

```typescript
const AiCreateCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SET_ZONE_COLOR'),
    surface_id: SurfaceIdSchema,
    color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  z.object({
    type: z.literal('SET_MATERIAL'),
    surface_id: SurfaceIdSchema,
    material_id: z.string(),
  }),
  z.object({
    type: z.literal('SET_SIZE'),
    size_id: z.string(),
  }),
  z.object({
    type: z.literal('MOVE_ARTWORK'),
    offset_x: z.number(),
    offset_y: z.number(),
  }),
  z.object({
    type: z.literal('SCALE_ARTWORK'),
    scale: z.number().positive(),
  }),
  z.object({
    type: z.literal('ROTATE_ARTWORK'),
    degrees: z.number(),
  }),
  z.object({
    type: z.literal('SUGGEST_PATTERN'),
    prompt: z.string(),
    surface_id: SurfaceIdSchema,
  }),
  z.object({
    type: z.literal('SET_ATTACHMENT_SYSTEM'),
    system: AttachmentSystemSchema,
  }),
  z.object({
    type: z.literal('SET_PURCHASE_MODE'),
    mode: PurchaseModeSchema,
  }),
  z.object({
    type: z.literal('UNKNOWN'),
    raw_intent: z.string(),
  }),
])

type AiCreateCommand = z.infer<typeof AiCreateCommandSchema>
```

Discriminated unions are more type-safe than typed action arrays: TypeScript narrows the type in switch statements, the schema self-validates per action type, and it's the standard Zod pattern for heterogeneous command sets.

### Intent Parser [Phase 7]

```typescript
interface IntentParseResult {
  commands: AiCreateCommand[]
  confidence: number
  reasoning?: string
}

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
      },
    }),
  })

  const data = await response.json()
  return parseAiResponse(data)
}
```

### AI Command Validation via CompatibilityEngine [Phase 7]

AI commands go through CompatibilityEngine before applying — same rules as user actions:

```typescript
async function executeAiCommands(
  commands: AiCreateCommand[],
  session: DesignSession,
  spec: ProductSpec
): Promise<{ applied: AiCreateCommand[]; rejected: { command: AiCreateCommand; reason: string }[] }> {
  const applied: AiCreateCommand[] = []
  const rejected: { command: AiCreateCommand; reason: string }[] = []

  for (const command of commands) {
    // Build a hypothetical session with this command applied
    const hypothetical = applyCommand(session, command)

    // Run CompatibilityEngine on the hypothetical state
    const results = evaluateCompatibility({
      session: hypothetical,
      spec,
      currentTime: new Date(),
    })

    const hasBlock = results.some(r => r.severity === 'COMP_BLOCK')
    if (hasBlock) {
      rejected.push({
        command,
        reason: results.filter(r => r.severity === 'COMP_BLOCK').map(r => r.message).join('; '),
      })
    } else {
      applied.push(command)
      session = hypothetical  // progressive application
    }
  }

  return { applied, rejected }
}
```

## Hook 3: Intake Adapters [Phase 7]

Intake adapters handle artwork from different sources, normalizing them into `ImageSource`:

```typescript
interface IntakeAdapter {
  kind: ImageSource['kind']
  process(input: IntakeInput): Promise<{ imageSource: ImageSource; assetId: string }>
}

const adapters: Record<ImageSource['kind'], IntakeAdapter> = {
  upload: {
    kind: 'upload',
    async process(input) {
      // Standard file upload → Cloudinary
      const assetId = await uploadToCloudinary(input.file)
      return {
        assetId,
        imageSource: { kind: 'upload', original_asset_id: assetId, ... },
      }
    },
  },
  ai_generated: {
    kind: 'ai_generated',
    async process(input) {
      // AI provider returns image → Cloudinary
      const result = await generateImage(input.prompt, input.provider)
      return {
        assetId: result.assetId,
        imageSource: { kind: 'ai_generated', original_asset_id: result.assetId, ... },
      }
    },
  },
  library: {
    kind: 'library',
    async process(input) {
      // Library item → reference (already in Cloudinary)
      return {
        assetId: input.libraryAssetId,
        imageSource: { kind: 'library', original_asset_id: input.libraryAssetId, ... },
      }
    },
  },
  remix: {
    kind: 'remix',
    async process(input) {
      // Fork from another design's revision snapshot
      const snapshot = await repos.designRevision.getByRevision(input.sourceDesignId, input.sourceRevision)
      return {
        assetId: snapshot.snapshot.artwork!.original_asset_id,
        imageSource: { kind: 'remix', original_asset_id: snapshot.snapshot.artwork!.original_asset_id, ... },
      }
    },
  },
}
```

## Hook 4: Render Factory for Content [Phase 7]

Dedicated render pages produce AI-generated content:
- Social-media-ready product shots
- Dynamic storefront imagery
- Video captures from 3D viewport

Same render factory as preview generation (see [07-preview-render-factory.md](07-preview-render-factory.md)), extended with:
- Video capture mode (frame sequence → MP4)
- Multiple scene/lighting setups per design
- AI-suggested camera angles

## Video Texture Manager [Phase 7]

```typescript
class VideoTextureManager {
  private videoElement: HTMLVideoElement | null = null
  private videoTexture: THREE.VideoTexture | null = null

  async applyVideoTexture(
    mesh: THREE.Mesh,
    videoUrl: string,
    options?: { loop?: boolean; autoplay?: boolean }
  ): Promise<void> {
    this.dispose()
    this.videoElement = document.createElement('video')
    this.videoElement.src = videoUrl
    this.videoElement.loop = options?.loop ?? true
    this.videoElement.muted = true
    this.videoElement.playsInline = true
    this.videoElement.crossOrigin = 'anonymous'

    this.videoTexture = new THREE.VideoTexture(this.videoElement)
    this.videoTexture.colorSpace = THREE.SRGBColorSpace
    this.videoTexture.minFilter = THREE.LinearFilter
    this.videoTexture.magFilter = THREE.LinearFilter

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

## Content Generation Pipeline [Phase 7]

```
DesignSession (approved, revision N)
  → Content Generation Job (job_queue, type: 'content_generation')
  → Worker picks up job
  → Extracts artwork + scene context from immutable revision snapshot
  → Calls AI provider (Veo 3 for video, Gemini Image for stills)
  → Receives generated asset
  → Uploads to Cloudinary: designs/{designId}/generated/{type}/{id}
  → Updates GeneratedMedia record in Supabase
  → If video_texture: available in viewer via VideoTextureManager
  → If hero_render: available for storefront/social display
```
