# 05 — Data Layer

> Repository pattern, Supabase/file swap, state ownership.
> Consolidation: D8 — separate DesignHeadRepository + DesignRevisionRepository.
> New tables: `design_revisions`, `checkout_intents`.

## Phase: [Phase 2]

## Repository Pattern [Phase 0+]

Every domain object has a repository interface. Dev uses file-backed implementations. Production uses Supabase. Same test suite for both — mandatory.

### Split Design Repositories (D8)

The mutable head and immutable revisions are fundamentally different data access patterns:
- **DesignHeadRepository** — read/write for autosave and resume
- **DesignRevisionRepository** — write-once/read-many for proof, commerce, manufacturing

Separate interfaces make the mutability boundary explicit and testable.

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

interface DesignHeadRepository {
  create(input: CreateDesignInput): Promise<DesignSession>
  get(id: string): Promise<DesignSession>
  save(session: DesignSession): Promise<{ revision: number }>
  listByUser(userId: string, limit?: number): Promise<DesignSessionSummary[]>
  updateCreateState(id: string, state: CreateState): Promise<void>
  updatePreviewUrls(id: string, urls: PreviewUrlSet): Promise<void>
}

interface DesignRevisionRepository {
  append(designId: string, revision: number, snapshot: DesignSession): Promise<DesignRevisionSnapshot>
  getByRevision(designId: string, revision: number): Promise<DesignRevisionSnapshot>
  listRevisions(designId: string, limit?: number): Promise<DesignRevisionSnapshot[]>
  getLatest(designId: string): Promise<DesignRevisionSnapshot>
}

interface CheckoutIntentRepository {
  create(intent: CheckoutIntent): Promise<CheckoutIntent>
  get(id: string): Promise<CheckoutIntent>
  getByDesign(designId: string): Promise<CheckoutIntent | null>
  updateStatus(id: string, status: CheckoutIntent['status']): Promise<void>
}

interface ManufacturingRepository {
  enqueue(designId: string, revision: number): Promise<string>
  getPackage(id: string): Promise<ManufacturingPackage>
  getByDesignRevision(designId: string, revision: number): Promise<ManufacturingPackage | null>
}

interface AssetStore {
  getSignedUploadUrl(params: UploadParams): Promise<SignedUploadUrl>
  getDeliveryUrl(assetId: string, transform?: ImageTransform): string
  deleteAsset(publicId: string): Promise<void>
}
```

## Implementation Strategy [Phase 2]

| Repository | Dev (file-backed) | Production |
|-----------|-------------------|------------|
| ProductSpec | `data/product-specs/effect/*.json` | Supabase `product_specs` |
| ScenePreset | .onemo files in `data/scene-presets/` | Supabase `scene_presets` |
| DesignHead | `data/design-sessions/dev-seed/*.json` | Supabase `designs` (existing table) |
| DesignRevision | `data/design-revisions/dev-seed/*.json` | Supabase `design_revisions` (new) |
| CheckoutIntent | `data/checkout-intents/dev-seed/*.json` | Supabase `checkout_intents` (new) |
| Manufacturing | `data/manufacturing-packages/dev-seed/` | Supabase `manufacturing_packages` |
| Assets | Local filesystem | Cloudinary |

### Existing `designs` Table Mapping

`DesignHeadRepository` maps to the existing Supabase `designs` row shape:
- `design_spec_v2` = canonical DesignSession JSON (v4 fields added)
- `editor_state` = restore-only (not canonical)
- `design_revision` = monotonically increasing
- `owner_preview_url`, `public_preview_url`, `order_preview_url` = derived outputs
- `create_state`, `visibility`, `discovery_state` = lifecycle around the artifact

### New `design_revisions` Table (U1)

Each row is an immutable snapshot appended on every save. The mutable head stays in `designs`.

### New `checkout_intents` Table (U4)

Commerce state separated from design truth. One intent per approved design, with lines and grouped contexts.

## State Ownership [Phase 2]

From the UX content models domain (11a):

| State | Owner | Storage |
|-------|-------|---------|
| Artwork source + intake | Supabase | Supabase `designs` |
| Active design draft (mutable head) | Supabase | `designs.design_spec_v2` |
| Immutable revision snapshots | Supabase | `design_revisions` |
| Composition workspace | Next.js client | Client state (autosaved to Supabase) |
| Commerce intent | Supabase | `checkout_intents` |
| Commerce variant context | Shopify | Shopify product/variant |
| Preview trust | Next.js client | Client-only UI state |
| Resume checkpoint | Supabase | `designs` row (mutable head) |
| Private share context | Supabase | `shares` table |
| Public presentation | Supabase | `presentations` table |
| Action safety envelope | Next.js client | Client-only guard state |

## Supabase Tables [Phase 0+]

Existing:
- `designs` — stays, maps to DesignHead (v4 schema in `design_spec_v2`)

New (Phase 0):
- `product_specs` (id, family, status, version, slug, payload jsonb, timestamps)
- `scene_presets` (id, family, status, version, slug, product_spec_id, payload jsonb, timestamps)
- `design_revisions` (id, design_id, revision, snapshot jsonb, product_spec_ref jsonb, scene_preset_ref jsonb, scene_package_hash, created_at)
- `checkout_intents` (id, user_id, primary_design_id, primary_design_revision, lines jsonb, grouped_contexts jsonb, compatibility_snapshot jsonb, approved_at, expires_at, status, created_at)
- `manufacturing_packages` (id, design_ref jsonb, product_spec_ref jsonb, scene_preset_ref jsonb, method, status, compiler_version, payload jsonb, production_asset_ref, timestamps)
- `job_queue` — existing, add types: preview_generation, manufacturing_compile, cleanup_orphan_assets, shopify_projection_sync

## Auth Model [Phase 2]

Supabase Auth with anonymous sessions:
- Visitors get `user_id` immediately — no login required
- Account creation deferred until save/buy time
- Anonymous session promotes seamlessly to full account
- Identity mapping to Shopify customer created at first purchase

## File-Backed Dev Rules [Phase 2]

- File-backed repos read/write `data/**` directories
- NOT a production persistence strategy (Vercel functions have read-only filesystem)
- Must be identical interface to Supabase repos
- Repository contract tests run against both implementations

## File-Backed Implementation Detail [Phase 2]

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

## DesignRevision Repository — File-Backed [Phase 2]

```typescript
// server/repositories/design-revision/file.ts
export class FileDesignRevisionRepository implements DesignRevisionRepository {
  constructor(private dataDir: string = 'data/design-revisions') {}

  async append(designId: string, revision: number, snapshot: DesignSession): Promise<DesignRevisionSnapshot> {
    const revisionSnapshot: DesignRevisionSnapshot = {
      id: crypto.randomUUID(),
      design_id: designId,
      revision,
      snapshot,
      product_spec_ref: snapshot.product_spec_ref,
      scene_preset_ref: snapshot.scene_preset_ref,
      scene_package_hash: snapshot.scene_package_hash ?? '',
      created_at: new Date().toISOString(),
    }
    const dir = join(this.dataDir, designId)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `r${revision}.json`), JSON.stringify(revisionSnapshot, null, 2))
    return revisionSnapshot
  }

  async getByRevision(designId: string, revision: number): Promise<DesignRevisionSnapshot> {
    const file = join(this.dataDir, designId, `r${revision}.json`)
    const raw = JSON.parse(await readFile(file, 'utf-8'))
    return DesignRevisionSnapshotSchema.parse(raw)
  }

  async getLatest(designId: string): Promise<DesignRevisionSnapshot> {
    const dir = join(this.dataDir, designId)
    const entries = await readdir(dir)
    const revisions = entries
      .filter(e => e.startsWith('r') && e.endsWith('.json'))
      .map(e => parseInt(e.slice(1, -5)))
      .sort((a, b) => b - a)
    if (revisions.length === 0) throw new Error(`No revisions for design: ${designId}`)
    return this.getByRevision(designId, revisions[0])
  }

  async listRevisions(designId: string, limit = 50): Promise<DesignRevisionSnapshot[]> {
    const dir = join(this.dataDir, designId)
    const entries = await readdir(dir)
    const revisions = entries
      .filter(e => e.startsWith('r') && e.endsWith('.json'))
      .map(e => parseInt(e.slice(1, -5)))
      .sort((a, b) => b - a)
      .slice(0, limit)
    return Promise.all(revisions.map(r => this.getByRevision(designId, r)))
  }
}
```

## Supabase Implementation Detail [Phase 2]

```typescript
// server/repositories/design-revision/supabase.ts
export class SupabaseDesignRevisionRepository implements DesignRevisionRepository {
  async append(designId: string, revision: number, snapshot: DesignSession): Promise<DesignRevisionSnapshot> {
    const row = {
      design_id: designId,
      revision,
      snapshot,
      product_spec_ref: snapshot.product_spec_ref,
      scene_preset_ref: snapshot.scene_preset_ref,
      scene_package_hash: snapshot.scene_package_hash ?? '',
    }
    const { data, error } = await supabaseAdmin
      .from('design_revisions')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return DesignRevisionSnapshotSchema.parse(data)
  }

  async getByRevision(designId: string, revision: number): Promise<DesignRevisionSnapshot> {
    const { data, error } = await supabaseAdmin
      .from('design_revisions')
      .select('*')
      .eq('design_id', designId)
      .eq('revision', revision)
      .single()
    if (error) throw error
    return DesignRevisionSnapshotSchema.parse(data)
  }

  async getLatest(designId: string): Promise<DesignRevisionSnapshot> {
    const { data, error } = await supabaseAdmin
      .from('design_revisions')
      .select('*')
      .eq('design_id', designId)
      .order('revision', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    return DesignRevisionSnapshotSchema.parse(data)
  }

  async listRevisions(designId: string, limit = 50): Promise<DesignRevisionSnapshot[]> {
    const { data, error } = await supabaseAdmin
      .from('design_revisions')
      .select('*')
      .eq('design_id', designId)
      .order('revision', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data.map(row => DesignRevisionSnapshotSchema.parse(row))
  }
}
```

## Repository Wiring — Dependency Injection [Phase 2]

```typescript
// server/repositories/index.ts
import { env } from '@/lib/env'

export function createRepositories() {
  if (env.USE_FILE_REPOS) {
    return {
      productSpec: new FileProductSpecRepository(),
      scenePreset: new FileScenePresetRepository(),
      designHead: new FileDesignHeadRepository(),
      designRevision: new FileDesignRevisionRepository(),
      checkoutIntent: new FileCheckoutIntentRepository(),
      manufacturing: new FileManufacturingRepository(),
      assets: new LocalAssetStore(),
    }
  }
  return {
    productSpec: new SupabaseProductSpecRepository(),
    scenePreset: new SupabaseScenePresetRepository(),
    designHead: new SupabaseDesignHeadRepository(),
    designRevision: new SupabaseDesignRevisionRepository(),
    checkoutIntent: new SupabaseCheckoutIntentRepository(),
    manufacturing: new SupabaseManufacturingRepository(),
    assets: new CloudinaryAssetStore(),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
```

## Repository Contract Tests [Phase 0]

```typescript
// tests/integration/repositories/design-revision.test.ts
function testDesignRevisionRepository(repo: DesignRevisionRepository) {
  it('appends a revision snapshot', async () => {
    const snapshot = await repo.append('design-1', 1, mockDesignSession)
    expect(snapshot.revision).toBe(1)
    expect(snapshot.design_id).toBe('design-1')
  })

  it('retrieves by exact revision', async () => {
    await repo.append('design-1', 1, mockDesignSession)
    await repo.append('design-1', 2, { ...mockDesignSession, design_revision: 2 })
    const r1 = await repo.getByRevision('design-1', 1)
    expect(r1.revision).toBe(1)
  })

  it('returns latest revision', async () => {
    await repo.append('design-1', 1, mockDesignSession)
    await repo.append('design-1', 2, { ...mockDesignSession, design_revision: 2 })
    const latest = await repo.getLatest('design-1')
    expect(latest.revision).toBe(2)
  })

  it('throws on unknown revision', async () => {
    await expect(repo.getByRevision('design-1', 999)).rejects.toThrow()
  })
}

describe('FileDesignRevisionRepository', () => {
  testDesignRevisionRepository(new FileDesignRevisionRepository('tests/fixtures/design-revisions'))
})

describe('SupabaseDesignRevisionRepository', () => {
  testDesignRevisionRepository(new SupabaseDesignRevisionRepository())
})
```

## AssetStore — Cloudinary Contract [Phase 2]

```typescript
interface UploadParams {
  folder: string
  publicId?: string
  resourceType: 'image' | 'video'
  allowedFormats?: string[]
  maxFileSize?: number
  transformation?: string
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
```

## Supabase Schema DDL [Phase 0]

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

-- design_revisions table (U1: immutable snapshots)
CREATE TABLE design_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES designs(id),
  revision INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  product_spec_ref JSONB NOT NULL,
  scene_preset_ref JSONB NOT NULL,
  scene_package_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (design_id, revision)
);

CREATE INDEX idx_design_revisions_design_id ON design_revisions(design_id);
CREATE INDEX idx_design_revisions_lookup ON design_revisions(design_id, revision);

-- checkout_intents table (U4: separate commerce from design)
CREATE TABLE checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  primary_design_id UUID NOT NULL REFERENCES designs(id),
  primary_design_revision INTEGER NOT NULL,
  lines JSONB NOT NULL,
  grouped_contexts JSONB NOT NULL DEFAULT '[]',
  compatibility_snapshot JSONB NOT NULL DEFAULT '[]',
  approved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (primary_design_id, primary_design_revision) REFERENCES design_revisions(design_id, revision)
);

-- manufacturing_packages table (v4: structured refs)
CREATE TABLE manufacturing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_ref JSONB NOT NULL,
  product_spec_ref JSONB NOT NULL,
  scene_preset_ref JSONB NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'compiled', 'failed')),
  compiler_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  production_asset_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ((design_ref->>'design_id')::uuid, (design_ref->>'revision')::int, method)
);

-- job_queue types extension
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS job_type TEXT;
-- Types: preview_generation, manufacturing_compile, cleanup_orphan_assets, shopify_projection_sync
```
