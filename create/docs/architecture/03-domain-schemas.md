# 03 — Domain Schemas

> v4 Zod schemas for all domain objects. These are the type contracts that every layer references.
> Consolidation: Upgraded to v4 per schema version decision. New types from U1, U2, U3, U4, U5.

## Phase: [Phase 0] schemas + validation, [Phase 2] repository integration

## Domain Objects [Phase 0]

| Object | Authority | Create module file |
|--------|-----------|-------------------|
| **ProductSpec** | What can physically exist | `create/domain/product-spec.ts` |
| **ScenePreset** | How the product is rendered | `create/domain/scene-preset.ts` |
| **DesignSession** | What the customer chose (mutable head) | `create/domain/design-session.ts` |
| **DesignRevisionSnapshot** | Immutable point-in-time design | `create/domain/design-revision.ts` |
| **CheckoutIntent** | What the customer wants to buy | `create/domain/checkout-intent.ts` |
| **ManufacturingPackage** | Immutable production output | `create/domain/manufacturing-package.ts` |
| **CompatibilityResult** | Domain rule evaluation output | `create/domain/compatibility.ts` |
| **ImageSource** | Artwork origin abstraction | `create/domain/image-source.ts` |
| **OnemoSceneBundle** | Self-describing .onemo metadata | `create/domain/onemo-scene-bundle.ts` |
| **GeneratedMedia** | AI-produced content | `create/domain/generated-media.ts` |

## Schema Strategy [Phase 0]

v4 schemas are defined in the Create module's domain layer. They supersede the v3 SSOT baseline (`onemo-v3-schemas.ts`).

Key v3 → v4 deltas:
- `DesignSession` adds: `image_source`, `create_context`, `purchase_mode`, `attachment_system`, `pair_context`, `compatibility_snapshot`, `scene_package_hash`
- `ScenePreset` adds: `scene_package_ref`, `fallback_stills[]`, `gesture_profiles[]`, `presentation_contexts[]`
- New types: `DesignRevisionSnapshot`, `CheckoutIntent`, `CompatibilityResult`, `OnemoSceneBundle`, `ImageSource`
- `ManufacturingPackage` adds: `design_ref` (replaces flat `design_id` + `design_revision`), `product_spec_ref`, `scene_preset_ref`

## Shared Enums [Phase 0]

```typescript
const SurfaceIdSchema = z.enum(['face', 'back', 'frame'])
const SurfaceRoleSchema = z.enum(['print', 'base', 'frame', 'anchor'])
const EffectSubtypeSchema = z.enum(['edge_trim', 'plain', 'tv_retro'])
const ConstructionMethodSchema = z.enum([
  'method_a_edge_trim', 'method_b_magnetic_caps', 'method_c_tv_retro', 'solid'
])
const AttachmentSystemSchema = z.enum(['magnetic', 'velcro'])
const PreviewRoleSchema = z.enum(['owner', 'public', 'order'])
const CreateStateSchema = z.enum([
  'draft', 'configured', 'proofed', 'approved', 'purchased', 'fulfilled'
])
const PurchaseModeSchema = z.enum(['single', 'pair', 'bundle'])
```

## ProductSpec Shape [Phase 0]

Authority: what can physically and commercially exist.

```typescript
const ProductSpecSchema = z.object({
  id: z.string().uuid(),
  family: z.literal('effect'),
  status: z.enum(['draft', 'published', 'archived']),
  version: z.number().int().positive(),
  slug: z.string(),
  payload: z.object({
    tier: z.enum(['standard', 'shaped']),
    supported_subtypes: z.array(EffectSubtypeSchema),
    variant_axes: z.object({
      size: VariantAxisSchema,
      face_material: VariantAxisSchema,
      trim_back_colour: VariantAxisSchema,
      subtype: VariantAxisSchema,
      attachment_system: VariantAxisSchema.optional(),
    }),
    surfaces: z.array(SurfaceDefinitionSchema),
    print_areas: z.array(PrintAreaSchema),
    magnet_grids: z.array(MagnetGridSchema),
    subtype_routes: z.array(EffectSubtypeRouteSchema),
    manufacturing_profiles: z.array(ManufacturingProfileSchema),
    shopify_projection: ShopifyProjectionSchema,
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
})

type ProductSpec = z.infer<typeof ProductSpecSchema>
```

Create uses ProductSpec to:
- Determine available variant options (ConfigPanel)
- Validate placement against print areas and safe areas
- Route to correct manufacturing profile on compile [Phase 4]
- Resolve Shopify variant ID for cart [Phase 5]
- Feed CompatibilityEngine for rule evaluation [Phase 0]

## ScenePreset Shape [Phase 0]

Authority: how the product is rendered. Contains `scene_package_ref` pointing to the immutable `.onemo` delivery bundle.

```typescript
const ScenePackageRefSchema = z.object({
  package_id: z.string(),
  package_hash: z.string(),        // content hash of the full .onemo ZIP
  url: z.string().url(),           // CDN URL for the .onemo file
  environment_url: z.string().url().optional(),
  mesh_manifest_hash: z.string(),  // hash of mesh names + slot structure
})

const FallbackStillSchema = z.object({
  view: z.enum(['front', 'three_quarter', 'side_detail', 'back']),
  url: z.string().url(),
  width_px: z.number().int().positive(),
  height_px: z.number().int().positive(),
})

const GestureProfileSchema = z.object({
  gesture: z.enum(['orbit', 'pan', 'pinch', 'drag_artwork']),
  enabled: z.boolean(),
  sensitivity: z.number().min(0).max(2).default(1),
  bounds: z.record(z.string(), z.number()).optional(),
})

const PresentationContextSchema = z.object({
  context: z.enum(['create', 'listing', 'share', 'order']),
  camera_preset_id: z.string(),
  background: z.string().optional(),
})

const ScenePresetSchema = z.object({
  id: z.string().uuid(),
  family: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  version: z.number().int().positive(),
  slug: z.string(),
  product_spec_id: z.string().uuid(),
  payload: z.object({
    target_subtypes: z.array(EffectSubtypeSchema),
    surface_materials: z.record(z.string(), SurfaceMaterialProfileSchema),
    cameras: z.array(CameraPresetSchema),
    lighting_rig: LightingRigSchema,
    render_settings: RenderSettingsSchema,
    capture_presets: z.array(CapturePresetSchema),
    // v4 additions
    scene_package_ref: ScenePackageRefSchema,
    fallback_stills: z.array(FallbackStillSchema).min(1),
    gesture_profiles: z.array(GestureProfileSchema).default([]),
    presentation_contexts: z.array(PresentationContextSchema).default([]),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
})

type ScenePreset = z.infer<typeof ScenePresetSchema>
```

**Critical rule:** Create never reads `theatre_source`. That's Studio-only. Create reads compiled runtime only.

## ImageSource [Phase 0]

Abstraction for artwork origin — upload, AI-generated, library pick, or remix source.

```typescript
const ImageSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('upload'),
    original_asset_id: z.string(),
    upload_timestamp: z.string().datetime(),
    mime_type: z.string(),
    dimensions: z.object({ width: z.number(), height: z.number() }),
  }),
  z.object({
    kind: z.literal('ai_generated'),
    original_asset_id: z.string(),
    provider: z.enum(['gemini_image', 'dall_e', 'midjourney']),
    prompt: z.string(),
    generation_id: z.string(),
  }),
  z.object({
    kind: z.literal('library'),
    original_asset_id: z.string(),
    library_item_id: z.string(),
    license: z.string().optional(),
  }),
  z.object({
    kind: z.literal('remix'),
    original_asset_id: z.string(),
    source_design_id: z.string(),
    source_revision: z.number(),
  }),
])

type ImageSource = z.infer<typeof ImageSourceSchema>
```

## DesignSession Shape (Mutable Head) [Phase 0 schema, Phase 2 persistence]

Authority: what the customer actually chose. This is the **mutable head row** — fast reads/writes for autosave and resume.

```typescript
const DesignSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  template_id: z.string(),
  product_spec_ref: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  scene_preset_ref: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  design_revision: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  modified_at: z.string().datetime(),

  // v4 additions
  image_source: ImageSourceSchema.optional(),
  create_context: z.enum(['direct', 'remix', 'ai_intake']).default('direct'),
  purchase_mode: PurchaseModeSchema.default('single'),
  attachment_system: AttachmentSystemSchema.default('magnetic'),
  pair_context: z.object({
    pair_id: z.string().uuid(),
    polarity: z.enum(['N', 'S']),
    orientation: z.string(),
  }).optional(),
  scene_package_hash: z.string().optional(),

  // Design state
  effect_variant: z.object({
    subtype: EffectSubtypeSchema,
    construction_method: ConstructionMethodSchema,
    size: z.string().optional(),
  }),
  surface_appearance: z.record(SurfaceIdSchema, z.object({
    material_id: z.string(),
    color_id: z.string(),
    hex: z.string().optional(),
  })),
  artwork: z.object({
    original_asset_id: z.string(),
    applied_texture_asset_id: z.string(),
    transform_hash: z.string(),
  }).optional(),
  placements: z.array(PlacementSchema),

  // Compatibility snapshot (last evaluated)
  compatibility_snapshot: z.array(CompatibilityResultSchema).default([]),

  // Lifecycle
  create_state: CreateStateSchema,
  render_intent: z.object({
    capture_revision: z.number(),
    requested_at: z.string().datetime(),
  }).optional(),
})

type DesignSession = z.infer<typeof DesignSessionSchema>
```

### Version Pinning Invariant [Phase 0]

Every saved DesignSession pins:
- `product_spec_ref.version` — exact ProductSpec version loaded
- `scene_preset_ref.version` — exact ScenePreset version loaded

This ensures old orders are reproducible. If the spec or preset changes, new DesignSessions pin the new version.

### Transform Hash Invariant [Phase 0]

`artwork.transform_hash` is a deterministic hash of (placement coordinates + artwork asset ID + texture policy). Review is rejected if the hash doesn't match the current placement — prevents "approved design shows stale render."

## DesignRevisionSnapshot [Phase 0]

Immutable point-in-time snapshot. Appended on every save. Referenced by proof, commerce, manufacturing, and share.

```typescript
const DesignRevisionSnapshotSchema = z.object({
  id: z.string().uuid(),
  design_id: z.string().uuid(),
  revision: z.number().int().positive(),
  snapshot: DesignSessionSchema,           // full design state at this revision
  product_spec_ref: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  scene_preset_ref: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  scene_package_hash: z.string(),
  created_at: z.string().datetime(),
})

type DesignRevisionSnapshot = z.infer<typeof DesignRevisionSnapshotSchema>
```

## CheckoutIntent [Phase 5]

Commerce state — what the customer wants to buy. Separated from design truth (U4). Uses grouped context for bundle/pair/receiver relationships (D5).

```typescript
const CheckoutLineSchema = z.object({
  line_id: z.string().uuid(),
  design_id: z.string().uuid(),
  design_revision: z.number().int().positive(),
  variant_id: z.string(),             // resolved Shopify variant GID
  quantity: z.number().int().positive().default(1),
  line_kind: z.enum(['primary', 'add_on', 'pair_partner', 'bundle_member']),
  line_properties: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })),
})

const GroupedContextSchema = z.object({
  group_id: z.string().uuid(),
  group_kind: z.enum(['bundle', 'pair', 'receiver_set']),
  member_line_ids: z.array(z.string().uuid()),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

const CheckoutIntentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  primary_design_id: z.string().uuid(),
  primary_design_revision: z.number().int().positive(),
  lines: z.array(CheckoutLineSchema).min(1),
  grouped_contexts: z.array(GroupedContextSchema).default([]),
  compatibility_snapshot: z.array(CompatibilityResultSchema),
  approved_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  status: z.enum(['pending', 'submitted', 'completed', 'expired']),
  created_at: z.string().datetime(),
})

type CheckoutIntent = z.infer<typeof CheckoutIntentSchema>
```

## OnemoSceneBundle [Phase 1]

Self-describing metadata schema for the `.onemo` file itself (D4: P2's bundle schema).

```typescript
const OnemoSceneBundleSchema = z.object({
  format_version: z.literal(1),
  scene_hash: z.string(),               // content hash of scene.glb
  mesh_manifest_hash: z.string(),        // hash of mesh names + slot structure
  files: z.object({
    scene_glb: z.literal('scene.glb'),
    studio_json: z.literal('studio.json'),
    environment_hdr: z.string().optional(),
  }),
  exported_at: z.string().datetime(),
  studio_version: z.string(),
  target_subtypes: z.array(EffectSubtypeSchema),
})

type OnemoSceneBundle = z.infer<typeof OnemoSceneBundleSchema>
```

## ManufacturingPackage Shape [Phase 4]

Authority: immutable production artifact for one exact design revision snapshot.

```typescript
const ManufacturingPackageSchema = z.object({
  id: z.string().uuid(),
  // v4: structured refs instead of flat IDs
  design_ref: z.object({
    design_id: z.string().uuid(),
    revision: z.number().int().positive(),
  }),
  product_spec_ref: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  scene_preset_ref: z.object({
    id: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  compiler_version: z.string(),
  method: ConstructionMethodSchema,
  status: z.enum(['pending', 'compiled', 'failed']),
  outputs: z.array(ManufacturingOutputSchema),
  placements: z.array(ProductionPlacementSchema),
  validations: z.array(ValidationResultSchema),
  production_asset_ref: z.string(),
  created_at: z.string().datetime(),
})

type ManufacturingPackage = z.infer<typeof ManufacturingPackageSchema>
```

## CompatibilityResult [Phase 0]

Output of the CompatibilityEngine. See [14-compatibility-engine.md](14-compatibility-engine.md) for the full engine.

```typescript
const CompatibilitySeveritySchema = z.enum([
  'COMP_OK', 'COMP_INFO', 'COMP_ADVISORY', 'COMP_BLOCK', 'COMP_INACTIVE',
])

const CompatibilityReasonCodeSchema = z.enum([
  'receiver_required', 'pair_required', 'attachment_system_mismatch',
  'cap_requires_active_receiver', 'bundle_member_incompatible',
  'bundle_member_unavailable', 'approval_expired', 'track_not_active',
  'variant_unavailable', 'public_state_not_shareable', 'safe_area_violated',
  'transform_hash_stale', 'scene_preset_version_missing',
  'product_spec_version_missing',
])

const CompatibilityResultSchema = z.object({
  severity: CompatibilitySeveritySchema,
  code: CompatibilityReasonCodeSchema,
  message: z.string().min(1),
  recovery_actions: z.array(z.object({
    kind: z.enum([
      'choose_receiver', 'switch_purchase_mode', 'switch_attachment_system',
      'remove_bundle_member', 'choose_available_variant', 'regenerate_texture',
      'retry_review', 'update_artifact_pins',
    ]),
    label: z.string().min(1),
    target_id: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
})

type CompatibilityResult = z.infer<typeof CompatibilityResultSchema>
```

## GeneratedMedia Schema [Phase 7]

```typescript
const GeneratedMediaSchema = z.object({
  id: z.string().uuid(),
  design_id: z.string().uuid(),
  design_revision: z.number().int().positive(),
  type: z.enum(['video_texture', 'hero_render', 'social_content', 'try_on']),
  provider: z.enum(['veo_3', 'kling', 'gemini_image', 'internal_render']),
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  input_asset_ref: z.string(),
  output_asset_ref: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
})

type GeneratedMedia = z.infer<typeof GeneratedMediaSchema>
```
