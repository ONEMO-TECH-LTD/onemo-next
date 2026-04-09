# 02 — Product Modules

> Product-family-specific rendering, surface discovery, and material management.
> The viewer shell is generic. Product modules make it know about Effects, garments, caps.

## Phase: [v1] core interface + Effect module, [v5] additional families

## ProductFamilyModule Interface [v1]

```typescript
interface ProductFamilyModule {
  family: string
  displayName: string

  // Discover configurable surfaces from a loaded GLB
  discoverSurfaces(
    modelRoot: THREE.Object3D,
    productConfig: ProductConfig
  ): SurfaceRegistry

  // React component rendered inside ViewerShell as children
  Renderer: React.ComponentType<ProductRendererProps>

  // Apply user overrides (colors, artwork, materials) to the live scene
  applyOverrides(
    modelRoot: THREE.Object3D,
    surfaces: SurfaceRegistry,
    overrides: MaterialOverride[]
  ): void

  // Customer-facing control panel
  ConfigPanel: React.ComponentType<ConfigPanelProps>

  // [v3] Manufacturing compiler routing
  compileManufacturing?(args: CompileArgs): Promise<ManufacturingPackage>
}
```

## Surface Registry [v1]

```typescript
interface SurfaceRegistry {
  surfaces: Map<string, Surface>
  artworkSlot?: ArtworkSlot
}

interface Surface {
  id: string                        // 'face', 'back', 'frame'
  role: SurfaceRole                 // 'print', 'base', 'frame', 'anchor'
  meshNames: string[]               // actual mesh names in the GLB
  materials: THREE.Material[]       // live material references
  configurable: boolean
  configurableProperties?: string[] // ['color', 'roughness', 'metalness']
  defaults?: Record<string, unknown>
}

interface ArtworkSlot {
  meshName: string
  surfaceId: string                 // which surface this artwork goes on
  textureChannel: string            // 'map' = diffuse
  uvChannel: number                 // default 0
}
```

## Surface Discovery Priority [v1]

Surfaces are discovered in this order — first match wins:

1. **GLB userData tags** (preferred):
   ```json
   { "onemo": {
       "surface_id": "face",
       "surface_role": "print",
       "material_slot": "suede_face",
       "configurable": true,
       "attachment_system": "magnetic-grid"
   }}
   ```

2. **ScenePreset productConfig** (fallback):
   `materialRoles[].meshNames` from studio.json

3. **Mesh name patterns** (legacy prototype compat):
   Hardcoded name matching as last resort — to be removed when assets are re-exported with userData

## Product Registry [v1]

```typescript
// create/products/registry.ts
const registry = new Map<string, ProductFamilyModule>()

import { effectModule } from './effect'
registry.set('effect', effectModule)

// [v5] Future:
// import { shapedEffectModule } from './shaped-effect'
// registry.set('shaped-effect', shapedEffectModule)
// import { garmentModule } from './garment'
// registry.set('garment', garmentModule)

export function getProductModule(family: string): ProductFamilyModule {
  const mod = registry.get(family)
  if (!mod) throw new Error(`Unknown product family: ${family}`)
  return mod
}
```

## Effect Module — products/effect/ [v1]

The first and primary product family. Standard Effects with subtypes: edge_trim, plain, tv_retro.

### EffectRenderer.tsx

Manages material application on discovered surfaces. Handles artwork texture loading and UV projection onto the face mesh.

**Extracted from:** `prototype/core/EffectModel.tsx`

Key responsibilities:
- Load and apply per-surface materials from ScenePreset defaults
- Apply artwork texture to the face mesh's diffuse channel
- Handle `loadOptionalTexture` for artwork (undefined → null → no artwork)
- Manage material uniforms for roughness, metalness, clearcoat per surface preset

### EffectSurfaces.ts

Surface discovery for the Effect product family.

**Material roles from ScenePreset:**

| Role | Surface ID | Typical meshes | Configurable |
|------|-----------|---------------|-------------|
| `primary-surface` | `face` | Face mesh | Color, artwork |
| `back-surface` | `back` | Back mesh | Color |
| `frame-element` | `frame` | Frame/trim mesh | Color |
| `constant-element` | (various) | Hardware, magnets | No |

### EffectOverrides.ts

Applies customer color and material changes to the live scene.

**Extracted from:** `prototype/core/onemo-loader.ts` `applyUserOverrides()`

```typescript
interface MaterialOverride {
  surfaceId: string
  property: string    // 'color', 'roughness', 'metalness', etc.
  value: unknown      // hex string for color, number for scalars
}
```

### Subtype Handling [v1]

Each Effect subtype maps to different construction methods and mesh expectations:

| Subtype | Method | Surfaces | Notes |
|---------|--------|----------|-------|
| `edge_trim` | A | face + back | 3D-printed trim covers raw edges |
| `plain` | B | face + back | Magnetic caps on back, no frame |
| `tv_retro` | C | face + back + frame | Pre-made magnetic base, image patch inside |

Subtype is determined by `ProductSpec.subtype_routes[].subtype` → resolved from the active product context.

### Attachment System [v1]

Attachment systems are a dimension, not a hardcoded assumption:

```
ProductSpec.attachmentSystems → defines supported systems
ScenePreset.product.attachmentSystem → which system this template uses
DesignSession.attachmentSystem → customer's choice (if multiple available)
GLB meshes carry userData.onemo.attachment_system tags
Product module shows/hides meshes based on active system
ConfigPanel shows selector when multiple systems available
```

## Adding New Product Families [v5]

To add `products/shaped-effect/`:

1. Create module implementing `ProductFamilyModule` interface
2. Add new domain-safe subtype/manufacturing unions to schemas
3. Add new GLB metadata export rules (userData.onemo.* tags)
4. Add new manufacturing compilers
5. Register family in `products/registry.ts`

No viewer-shell rewrite required. No changes to existing Effect module.
