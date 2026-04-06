# 05 — Data Layer

> Repository pattern, Supabase/file swap, state ownership.
> Canonical source: `onemo-ssot-global/5-architecture/baseline/onemo-v3-repositories.ts`

## Phase: [v2]

## Repository Pattern [v2]

Every artifact has a repository interface. Dev uses file-backed implementations. Production uses Supabase. Same test suite for both — GPT Pro review confirmed this is mandatory.

```typescript
interface ProductSpecRepository {
  getById(id: string): Promise<ProductSpec>
  getByFamily(family: string): Promise<ProductSpec[]>
  getPublished(family: string): Promise<ProductSpec>
}

interface ScenePresetRepository {
  getPublished(presetId: string): Promise<ScenePreset>
  getDraft(presetId: string): Promise<ScenePreset>      // Studio only
  saveDraft(preset: ScenePreset): Promise<void>          // Studio only
  publish(presetId: string): Promise<void>               // Studio only
}

interface DesignSessionRepository {
  create(input: CreateDesignInput): Promise<DesignSession>
  get(id: string): Promise<DesignSession>
  save(session: DesignSession): Promise<void>
  listByUser(userId: string): Promise<DesignSessionSummary[]>
}

interface ManufacturingRepository {
  enqueue(designId: string, revision: number): Promise<string>
  getPackage(id: string): Promise<ManufacturingPackage>
}

interface AssetStore {
  getSignedUploadUrl(params: UploadParams): Promise<SignedUploadUrl>
  getDeliveryUrl(assetId: string, transform?: ImageTransform): string
}
```

## Implementation Strategy [v2]

| Repository | Dev (file-backed) | Production |
|-----------|-------------------|------------|
| ProductSpec | `data/product-specs/effect/*.json` | Supabase `product_specs` |
| ScenePreset | .onemo files in `data/scene-presets/` | Supabase `scene_presets` |
| DesignSession | `data/design-sessions/dev-seed/*.json` | Supabase `designs` (existing table) |
| Manufacturing | `data/manufacturing-packages/dev-seed/` | Supabase `manufacturing_packages` |
| Assets | Local filesystem | Cloudinary |

### Existing `designs` Table Mapping

`DesignSessionRepository` maps to the existing Supabase `designs` row shape:
- `design_spec_v2` = canonical DesignSession JSON
- `editor_state` = restore-only (not canonical)
- `design_revision` = monotonically increasing
- `owner_preview_url`, `public_preview_url`, `order_preview_url` = derived outputs
- `create_state`, `visibility`, `discovery_state` = lifecycle around the artifact

## State Ownership [v2]

From the UX content models domain (11a):

| State | Owner | Storage |
|-------|-------|---------|
| Artwork source + intake | Supabase | Supabase `designs` |
| Active design draft | Supabase | `designs.design_spec_v2` |
| Composition workspace | Next.js client | Client state (autosaved to Supabase) |
| Commerce variant context | Shopify | Shopify product/variant |
| Preview trust | Next.js client | Client-only UI state |
| Resume checkpoint | Supabase | `designs` row |
| Private share context | Supabase | `shares` table |
| Public presentation | Supabase | `presentations` table |
| Action safety envelope | Next.js client | Client-only guard state |

## Supabase Tables [v2]

Existing:
- `designs` — stays, maps to DesignSession

New:
- `product_specs` (id, family, status, version, slug, payload jsonb, timestamps)
- `scene_presets` (id, family, status, version, slug, product_spec_id, payload jsonb, timestamps)
- `manufacturing_packages` (id, design_id, design_revision, method, status, compiler_version, payload jsonb, production_asset_ref, timestamps)
- `job_queue` — existing, add types: preview_generation, manufacturing_compile, cleanup_orphan_assets, shopify_projection_sync

## Auth Model [v2]

Supabase Auth with anonymous sessions:
- Visitors get `user_id` immediately — no login required
- Account creation deferred until save/buy time
- Anonymous session promotes seamlessly to full account
- Identity mapping to Shopify customer created at first purchase

## File-Backed Dev Rules [v2]

- File-backed repos read/write `data/**` directories
- NOT a production persistence strategy (Vercel functions have read-only filesystem)
- Must be identical interface to Supabase repos
- Repository contract tests run against both implementations

## File-Backed Implementation Detail [v2]

```typescript
// server/repositories/product-spec/file.ts
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { ProductSpecSchema, type ProductSpec } from '@create/domain/product-spec'

export class FileProductSpecRepository implements ProductSpecRepository {
  constructor(private dataDir: string = 'data/product-specs') {}

  async getById(id: string): Promise<ProductSpec> {
    const files = await this.findFiles()
    for (const file of files) {
      const raw = JSON.parse(await readFile(file, 'utf-8'))
      const spec = ProductSpecSchema.parse(raw)
      if (spec.id === id) return spec
    }
    throw new Error(`ProductSpec not found: ${id}`)
  }

  async getPublished(family: string): Promise<ProductSpec> {
    const files = await this.findFiles()
    for (const file of files) {
      const raw = JSON.parse(await readFile(file, 'utf-8'))
      const spec = ProductSpecSchema.parse(raw)
      if (spec.payload.family === family && spec.status === 'published') return spec
    }
    throw new Error(`No published ProductSpec for family: ${family}`)
  }

  async getByFamily(family: string): Promise<ProductSpec[]> {
    const files = await this.findFiles()
    const results: ProductSpec[] = []
    for (const file of files) {
      const raw = JSON.parse(await readFile(file, 'utf-8'))
      const spec = ProductSpecSchema.parse(raw)
      if (spec.payload.family === family) results.push(spec)
    }
    return results
  }

  private async findFiles(): Promise<string[]> {
    const families = await readdir(this.dataDir)
    const files: string[] = []
    for (const family of families) {
      const dir = join(this.dataDir, family)
      const entries = await readdir(dir)
      files.push(...entries.filter(e => e.endsWith('.json')).map(e => join(dir, e)))
    }
    return files
  }
}
```

## Supabase Implementation Detail [v2]

```typescript
// server/repositories/product-spec/supabase.ts
import { supabaseAdmin } from '@/server/db/supabaseAdmin'
import { ProductSpecSchema, type ProductSpec } from '@create/domain/product-spec'

export class SupabaseProductSpecRepository implements ProductSpecRepository {
  async getById(id: string): Promise<ProductSpec> {
    const { data, error } = await supabaseAdmin
      .from('product_specs')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return ProductSpecSchema.parse({ ...data, payload: data.payload })
  }

  async getPublished(family: string): Promise<ProductSpec> {
    const { data, error } = await supabaseAdmin
      .from('product_specs')
      .select('*')
      .eq('status', 'published')
      .eq('family', family)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    return ProductSpecSchema.parse({ ...data, payload: data.payload })
  }

  async getByFamily(family: string): Promise<ProductSpec[]> {
    const { data, error } = await supabaseAdmin
      .from('product_specs')
      .select('*')
      .eq('family', family)
      .order('version', { ascending: false })
    if (error) throw error
    return data.map(row => ProductSpecSchema.parse({ ...row, payload: row.payload }))
  }
}
```

## DesignSession Repository — Full Contract [v2]

```typescript
interface CreateDesignInput {
  userId: string
  templateId: string
  productSpecId: string
  productSpecVersion: number
  scenePresetId: string
  scenePresetVersion: number
  effectVariant: {
    subtype: EffectSubtype
    constructionMethod: ConstructionMethod
  }
}

interface DesignSessionSummary {
  id: string
  templateId: string
  createState: CreateState
  designRevision: number
  ownerPreviewUrl?: string
  modifiedAt: string
}

interface DesignSessionRepository {
  create(input: CreateDesignInput): Promise<DesignSession>
  get(id: string): Promise<DesignSession>
  getByRevision(id: string, revision: number): Promise<DesignSession>
  save(session: DesignSession): Promise<{ revision: number }>
  listByUser(userId: string, limit?: number): Promise<DesignSessionSummary[]>
  updateCreateState(id: string, state: CreateState): Promise<void>
  updatePreviewUrls(id: string, urls: PreviewUrlSet): Promise<void>
}

interface PreviewUrlSet {
  ownerPreviewUrl?: string
  publicPreviewUrl?: string
  orderPreviewUrl?: string
}
```

### Supabase designs Table Mapping

```typescript
// Row shape → DesignSession mapping
function rowToDesignSession(row: DesignRow): DesignSession {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    productSpecRef: {
      id: row.product_spec_id,
      version: row.product_spec_version,
    },
    scenePresetRef: {
      id: row.scene_preset_id,
      version: row.scene_preset_version,
    },
    designRevision: row.design_revision,
    createdAt: row.created_at,
    modifiedAt: row.updated_at,
    ...row.design_spec_v2,  // canonical DesignSession fields
  }
}

function designSessionToRow(session: DesignSession): Partial<DesignRow> {
  const { id, userId, templateId, productSpecRef, scenePresetRef,
          designRevision, createdAt, modifiedAt, ...designSpec } = session
  return {
    id,
    user_id: userId,
    template_id: templateId,
    product_spec_id: productSpecRef.id,
    product_spec_version: productSpecRef.version,
    scene_preset_id: scenePresetRef.id,
    scene_preset_version: scenePresetRef.version,
    design_revision: designRevision,
    design_spec_v2: designSpec,
  }
}
```

## AssetStore — Cloudinary Contract [v2]

```typescript
interface UploadParams {
  folder: string                    // e.g. 'designs/{designId}/originals'
  publicId?: string                 // deterministic naming
  resourceType: 'image' | 'video'
  allowedFormats?: string[]
  maxFileSize?: number
  transformation?: string           // e.g. 'c_limit,w_1536'
}

interface SignedUploadUrl {
  uploadUrl: string
  signature: string
  timestamp: number
  publicId: string
  folder: string
}

interface ImageTransform {
  width?: number
  height?: number
  crop?: 'fill' | 'limit' | 'fit'
  quality?: number | 'auto'
  format?: 'webp' | 'png' | 'jpg'
}

interface AssetStore {
  getSignedUploadUrl(params: UploadParams): Promise<SignedUploadUrl>
  getDeliveryUrl(publicId: string, transform?: ImageTransform): string
  deleteAsset(publicId: string): Promise<void>
}

// Cloudinary path conventions:
// CLOUDINARY_ENV_PREFIX/designs/{designId}/originals/{assetId}
// CLOUDINARY_ENV_PREFIX/designs/{designId}/applied/{revision}
// CLOUDINARY_ENV_PREFIX/designs/{designId}/owner/r{revision}.webp
// CLOUDINARY_ENV_PREFIX/designs/{designId}/public/r{revision}.webp
// CLOUDINARY_ENV_PREFIX/designs/{designId}/order/r{revision}.webp
```

## Repository Wiring — Dependency Injection [v2]

```typescript
// server/repositories/index.ts
import { env } from '@/lib/env'

export function createRepositories() {
  if (env.USE_FILE_REPOS) {
    return {
      productSpec: new FileProductSpecRepository(),
      scenePreset: new FileScenePresetRepository(),
      designSession: new FileDesignSessionRepository(),
      manufacturing: new FileManufacturingRepository(),
      assets: new LocalAssetStore(),
    }
  }
  return {
    productSpec: new SupabaseProductSpecRepository(),
    scenePreset: new SupabaseScenePresetRepository(),
    designSession: new SupabaseDesignSessionRepository(),
    manufacturing: new SupabaseManufacturingRepository(),
    assets: new CloudinaryAssetStore(),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
```

## Repository Contract Tests [v2]

```typescript
// tests/integration/repositories/product-spec.test.ts
function testProductSpecRepository(repo: ProductSpecRepository) {
  it('returns published spec by family', async () => {
    const spec = await repo.getPublished('effect')
    expect(spec.status).toBe('published')
    expect(spec.payload.family).toBe('effect')
  })

  it('returns spec by id', async () => {
    const published = await repo.getPublished('effect')
    const byId = await repo.getById(published.id)
    expect(byId.id).toBe(published.id)
  })

  it('throws on unknown id', async () => {
    await expect(repo.getById('nonexistent')).rejects.toThrow()
  })
}

describe('FileProductSpecRepository', () => {
  testProductSpecRepository(new FileProductSpecRepository('tests/fixtures/product-specs'))
})

describe('SupabaseProductSpecRepository', () => {
  testProductSpecRepository(new SupabaseProductSpecRepository())
})
```

## Supabase Schema DDL [v2]

```sql
-- product_specs table
CREATE TABLE product_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  slug TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE (slug, version)
);

-- scene_presets table
CREATE TABLE scene_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  slug TEXT NOT NULL,
  product_spec_id UUID REFERENCES product_specs(id),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE (slug, version)
);

-- manufacturing_packages table
CREATE TABLE manufacturing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id),
  design_revision INTEGER NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'compiled', 'failed')),
  compiler_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  production_asset_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (design_id, design_revision, method)
);

-- job_queue types extension
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS job_type TEXT;
-- Types: preview_generation, manufacturing_compile, cleanup_orphan_assets, shopify_projection_sync
```
