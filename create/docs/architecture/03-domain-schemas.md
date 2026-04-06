# 03 — Domain Schemas

> Zod schemas for the four canonical artifacts. These are the type contracts that every layer references.
> Canonical source: `onemo-ssot-global/5-architecture/baseline/onemo-v3-schemas.ts`

## Phase: [v1] schemas + validation, [v2] repository integration

## The Four Artifacts [v1]

| Artifact | Authority | Create module file |
|----------|-----------|-------------------|
| **ProductSpec** | What can physically exist | `create/domain/product-spec.ts` |
| **ScenePreset** | How the product is rendered | `create/domain/scene-preset.ts` |
| **DesignSession** | What the customer chose | `create/domain/design-session.ts` |
| **ManufacturingPackage** | Immutable production output | `create/domain/manufacturing-package.ts` |

## Schema Strategy [v1]

The canonical Zod code lives in the SSOT at `5-architecture/baseline/onemo-v3-schemas.ts`. The Create module schemas are either:
- **Re-exported directly** (when the SSOT schema is production-ready)
- **Subset/adapted** (when Create needs only a portion, e.g. runtime ScenePreset without Theatre source)

For v1, Create needs:
- `ScenePreset` (read-only — loads from .onemo)
- `ProductSpec` (read-only — loads constraints)
- `DesignSession` (read-write — manages customer state)
- `ManufacturingPackage` (write-only — triggers compilation) [v3]

## ProductSpec Shape [v1]

Authority: what can physically and commercially exist.

```typescript
// Key fields Create reads:
{
  family: 'effect',
  tier: 'standard' | 'shaped',
  supported_subtypes: ['edge_trim', 'plain', 'tv_retro'],
  variant_axes: {
    size: VariantAxis,
    face_material: VariantAxis,
    trim_back_colour: VariantAxis,
    subtype: VariantAxis,
  },
  surfaces: SurfaceDefinition[],
  print_areas: PrintArea[],
  magnet_grids: MagnetGrid[],
  subtype_routes: EffectSubtypeRoute[],
  manufacturing_profiles: ManufacturingProfile[],
  shopify_projection: ShopifyProjection,  // [v4]
}
```

Create uses ProductSpec to:
- Determine available variant options (ConfigPanel)
- Validate placement against print areas and safe areas
- Route to correct manufacturing profile on compile [v3]
- Resolve Shopify variant ID for cart [v4]

## ScenePreset Shape [v1]

Authority: how the product is rendered. This IS the `studio.json` content from the .onemo file.

```typescript
// Key fields Create reads:
{
  payload: {
    target_subtypes: ['edge_trim', 'plain', 'tv_retro'],
    surface_materials: Record<SurfaceId, SurfaceMaterialProfile>,
    cameras: CameraPreset[],
    lighting_rig: LightingRig,
    render_settings: RenderSettings,
    capture_presets: CapturePreset[],    // [v3]
    theatre_source?: TheatreSource,      // Create NEVER reads this
  }
}
```

**Critical rule:** Create never reads `theatre_source`. That's Studio-only. Create reads compiled runtime only.

### Existing Type Bridge

`studio/src/editor/adapter/onemo-format.ts` defines `OnemoStudioJson` (297 lines) — this is effectively the ScenePreset type. The domain schema formalizes it with Zod validation.

## DesignSession Shape [v1 schema, v2 persistence]

Authority: what the customer actually chose.

```typescript
{
  id: string,                          // UUID
  userId: string,
  templateId: string,                  // references .onemo file
  productSpecRef: {
    id: string,
    version: number,                   // pinned version
  },
  scenePresetRef: {
    id: string,
    version: number,                   // pinned version
  },
  designRevision: number,              // bumps on every save
  createdAt: string,
  modifiedAt: string,
  effectVariant: {
    subtype: EffectSubtype,
    constructionMethod: ConstructionMethod,
  },
  surfaceAppearance: Record<SurfaceId, {
    materialId: string,
    colorId: string,
    hex?: string,
  }>,
  artwork?: {
    originalAssetId: string,
    appliedTextureAssetId: string,
    transformHash: string,             // staleness invariant
  },
  placements: Placement[],
  renderIntent?: {
    captureRevision: number,
    requestedAt: string,
  },
}
```

### Version Pinning Invariant [v2]

Every saved DesignSession pins:
- `productSpecRef.version` — exact ProductSpec version loaded
- `scenePresetRef.version` — exact ScenePreset version loaded

This ensures old orders are reproducible. If the spec or preset changes, new DesignSessions pin the new version. Old sessions retain their original pins.

### Transform Hash Invariant [v2]

`artwork.transformHash` is a deterministic hash of (placement coordinates + artwork asset ID + texture policy). Review is rejected if the hash doesn't match the current placement — prevents "approved design shows stale render."

## ManufacturingPackage Shape [v3]

Authority: immutable production artifact for one exact design revision.

```typescript
{
  id: string,
  designId: string,
  designRevision: number,              // exact revision compiled from
  compilerVersion: string,
  method: ConstructionMethod,
  status: 'pending' | 'compiled' | 'failed',
  outputs: ManufacturingOutput[],      // method-specific files
  placements: ProductionPlacement[],   // normalized → production coordinates
  validations: ValidationResult[],
  productionAssetRef: string,          // Shopify line-item private property
}
```

## Shared Enums [v1]

```typescript
type SurfaceId = 'face' | 'back' | 'frame'
type SurfaceRole = 'print' | 'base' | 'frame' | 'anchor'
type EffectSubtype = 'edge_trim' | 'plain' | 'tv_retro'
type ConstructionMethod = 'method_a_edge_trim' | 'method_b_magnetic_caps' | 'method_c_tv_retro' | 'solid'
type PreviewRole = 'owner' | 'public' | 'order'
type CreateState = 'draft' | 'autosaved' | 'proofed' | 'ready_for_checkout' | 'ordered'
```
