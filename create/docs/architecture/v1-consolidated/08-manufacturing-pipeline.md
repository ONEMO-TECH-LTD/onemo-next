# 08 — Manufacturing Pipeline

> From approved DesignSession to immutable ManufacturingPackage.
> Method-specific compilers transform normalized placement into production output.

## Phase: [v3]

## Overview [v3]

```
Trigger (approval / ops compile / order webhook recovery)
  → Load approved DesignSession + pinned ProductSpec + pinned ScenePreset
  → Route to method compiler via ProductSpec.subtype_routes
  → Transform normalized placement → production coordinates
  → Write immutable ManufacturingPackage
  → Store production_asset_ref for Shopify line-item
```

## Construction Methods [v3]

| Method | Subtype | Compiler | Key output |
|--------|---------|----------|-----------|
| A (edge trim) | `edge_trim` | `compileMethodA` | Print raster + cutline SVG + registration JSON |
| B (magnetic caps) | `plain` | `compileMethodB` | Print raster + cap placement + QA preview |
| C (TV retro) | `tv_retro` | `compileMethodC` | Patch raster + frame registration + QA preview |
| Solid | (any, no sublimation) | `compileSolid` | BOM JSON + QA preview |

## Coordinate System Contract [v3]

**Hard rule:** Store normalized placement in print-area coordinates only. Never store raw screen pixels as product truth.

```
Normalized placement (0-1 in print area UV space)
  → Compiler applies: print area bounds + output DPI + bleed + safe inset
  → Production coordinates (pixels at production DPI, mm offsets)
```

## ManufacturingPackage Output Roles [v3]

| Output role | What it is |
|------------|-----------|
| `print_raster` | Final print-ready raster at production resolution |
| `patch_raster` | Image patch for method C (smaller than full face) |
| `cutline_svg` | Die-cut path for shaped/trimmed edges |
| `registration_json` | Physical alignment marks and magnet positions |
| `qa_preview` | Visual preview for QA verification |
| `bom_json` | Bill of materials for solid-color products |

## Version Pinning [v3]

Every ManufacturingPackage records:
- `designRevision` — exact revision compiled from
- `compilerVersion` — which compiler code was used
- Pinned ProductSpec version (via DesignSession)
- Pinned ScenePreset version (via DesignSession)

Old orders are always reproducible from these pins.

## Triggers [v3]

- Approval path (user approves → compile queued)
- Explicit ops compile (admin action)
- Order webhook recovery (if package missing at fulfillment)

## Compiler Interface [v3]

```typescript
// products/contracts/manufacturing-contract.ts
interface CompileArgs {
  session: DesignSession
  spec: ProductSpec
  preset: ScenePreset
  profile: ManufacturingProfile
}

interface CompileResult {
  outputs: ManufacturingOutput[]
  placements: ProductionPlacement[]
  validations: ValidationResult[]
}

interface ManufacturingOutput {
  role: OutputRole
  assetRef: string           // Cloudinary public_id
  format: string
  widthPx?: number
  heightPx?: number
  dpiActual?: number
}

interface ProductionPlacement {
  slotId: string
  surfaceId: SurfaceId
  xPx: number               // production pixels from left
  yPx: number               // production pixels from top
  widthPx: number
  heightPx: number
  rotationDeg: number
  dpi: number
}

interface ValidationResult {
  check: string
  passed: boolean
  message?: string
}

type OutputRole = 'print_raster' | 'patch_raster' | 'cutline_svg' |
                  'registration_json' | 'qa_preview' | 'bom_json'
```

## Method A Compiler — Edge Trim [v3]

```typescript
// products/effect/manufacturing/compileMethodA.ts
async function compileMethodA(args: CompileArgs): Promise<CompileResult> {
  const { session, spec, profile } = args
  const printArea = spec.payload.print_areas.find(
    p => p.id === profile.face_print_area_id
  )!

  // 1. Transform normalized placement → production pixels
  const placement = session.placements[0]
  const production = normalizedToProduction(placement, printArea)

  // 2. Generate print raster at production DPI
  const printRaster = await generatePrintRaster({
    artworkAssetId: session.artwork!.appliedTextureAssetId,
    placement: production,
    printArea,
    outputWidth: printArea.output.width_px,
    outputHeight: printArea.output.height_px,
    bleedMm: printArea.output.bleed_mm,
  })

  // 3. Generate cutline SVG for edge trim
  const cutline = generateCutlineSvg({
    outerBounds: printArea.output,
    safeInsetMm: printArea.output.safe_inset_mm,
    cornerRadius: 2, // mm, from ProductSpec
  })

  // 4. Generate registration JSON for magnet positions
  const magnetGrid = spec.payload.magnet_grids.find(
    g => g.id === spec.payload.subtype_routes.find(
      r => r.subtype === session.effectVariant.subtype
    )!.magnet_grid_id
  )!
  const registration = generateRegistration(magnetGrid, printArea)

  // 5. QA preview
  const qaPreview = await generateQaPreview(printRaster, cutline, registration)

  // 6. Validate
  const validations = [
    validateDpi(production.dpi, 300),
    validateSafeArea(placement, printArea),
    validateArtworkResolution(session.artwork!, printArea),
  ]

  return {
    outputs: [
      { role: 'print_raster', assetRef: printRaster.publicId, format: 'png', ...printArea.output },
      { role: 'cutline_svg', assetRef: cutline.publicId, format: 'svg' },
      { role: 'registration_json', assetRef: registration.publicId, format: 'json' },
      { role: 'qa_preview', assetRef: qaPreview.publicId, format: 'png' },
    ],
    placements: [production],
    validations,
  }
}
```

## Coordinate Transform [v3]

```typescript
// products/effect/manufacturing/placementToPixels.ts
function normalizedToProduction(
  placement: Placement,
  printArea: PrintArea
): ProductionPlacement {
  const { output } = printArea

  // Normalized (0-1) → print area UV → production pixels
  const xInUv = placement.x * (printArea.normalized_bounds.x_max - printArea.normalized_bounds.x_min)
                + printArea.normalized_bounds.x_min
  const yInUv = placement.y * (printArea.normalized_bounds.y_max - printArea.normalized_bounds.y_min)
                + printArea.normalized_bounds.y_min

  const xPx = Math.round(xInUv * output.width_px)
  const yPx = Math.round(yInUv * output.height_px)
  const widthPx = Math.round(placement.scale * output.width_px)
  const heightPx = Math.round(placement.scale * output.height_px)

  return {
    slotId: placement.slot_id,
    surfaceId: placement.surface_id,
    xPx,
    yPx,
    widthPx,
    heightPx,
    rotationDeg: placement.rotation_deg,
    dpi: output.dpi,
  }
}
```

## Manufacturing Use Case [v3]

```typescript
// server/use-cases/compileDesignManufacturing.ts
async function compileDesignManufacturing(
  repos: Repositories,
  designId: string,
  revision: number
): Promise<ManufacturingPackage> {
  // 1. Load pinned artifacts
  const session = await repos.designSession.getByRevision(designId, revision)
  const spec = await repos.productSpec.getById(session.productSpecRef.id)
  const preset = await repos.scenePreset.getPublished(session.scenePresetRef.id)

  // 2. Route to correct construction method
  const route = spec.payload.subtype_routes.find(
    r => r.subtype === session.effectVariant.subtype
  )!
  const profile = spec.payload.manufacturing_profiles.find(
    p => p.id === route.manufacturing_profile_id
  )!

  // 3. Get the product module's compiler
  const module = getProductModule(spec.payload.family)
  if (!module.compileManufacturing) {
    throw new Error(`Product family ${spec.payload.family} has no manufacturing compiler`)
  }

  // 4. Compile
  const result = await module.compileManufacturing({
    session, spec, preset, profile,
  })

  // 5. Check validations
  const failed = result.validations.filter(v => !v.passed)
  if (failed.length > 0) {
    // Write failed package for debugging
    const pkg: ManufacturingPackage = {
      id: crypto.randomUUID(),
      designId,
      designRevision: revision,
      compilerVersion: COMPILER_VERSION,
      method: profile.construction_method,
      status: 'failed',
      outputs: [],
      placements: result.placements,
      validations: result.validations,
      productionAssetRef: '',
    }
    // Store for ops debugging
    return pkg
  }

  // 6. Write successful package
  const pkg: ManufacturingPackage = {
    id: crypto.randomUUID(),
    designId,
    designRevision: revision,
    compilerVersion: COMPILER_VERSION,
    method: profile.construction_method,
    status: 'compiled',
    outputs: result.outputs,
    placements: result.placements,
    validations: result.validations,
    productionAssetRef: result.outputs.find(o => o.role === 'print_raster')?.assetRef ?? '',
  }

  return pkg
}

const COMPILER_VERSION = '1.0.0'
```

## Method B / C Compilers [v3]

Method B (magnetic caps) differs from A:
- No cutline SVG (no 3D-printed trim)
- Cap placement output instead (magnetic cap positions on back surface)
- Full-bleed sublimation, no trim offset

Method C (TV retro) differs from A:
- Smaller image area (patch inside frame)
- Frame registration output (where frame meets patch)
- No cutline (frame is pre-made)

```typescript
// products/effect/manufacturing/compileMethodB.ts — same interface, different output set
// products/effect/manufacturing/compileMethodC.ts — same interface, different output set
// products/effect/manufacturing/compileSolid.ts — no print raster, BOM only
```
