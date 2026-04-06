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
