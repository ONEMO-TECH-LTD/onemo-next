# 12 — Migration Plan

> Moving from prototype to production Create module. Phase 0 through Phase 7.
> Consolidation: Phase 0 (contract repair) inserted before runtime extraction (U6).
> Phase sequence reordered per consolidated decision.

## Phase: [Phase 0] contracts first, then sequential extraction

## Migration Strategy [Phase 0]

**Phase 0 first** (U6). Correct the type contracts, create the revision snapshot table, and ship the CompatibilityEngine before extracting any runtime code. Every later phase depends on correct contracts.

Graduate FROM the prototype, not just decouple from it. The prototype proved the quality. Now we extract the proven patterns into production-grade architecture.

**The prototype stays.** It continues to work as a reference and development sandbox. Create imports replace prototype imports in Studio. No prototype files are deleted.

## Phase Sequence

### Phase 0: Contract Repair [Phase 0]

v4 schemas, immutable revision snapshots, compatibility engine — the foundation everything else builds on.

1. Create `create/domain/` — all v4 Zod schemas (see [03-domain-schemas.md](03-domain-schemas.md))
2. Create `design_revisions` table in Supabase (see [05-data-layer.md](05-data-layer.md))
3. Create `checkout_intents` table in Supabase
4. Create `create/domain/rules/compatibility.ts` — CompatibilityEngine (see [14-compatibility-engine.md](14-compatibility-engine.md))
5. Implement repository contract tests for DesignHead + DesignRevision split
6. Validate v4 schemas against existing .onemo studio.json files and design_spec_v2 data
7. **Verify:** Schemas parse existing data. Contract tests pass for both file and Supabase repos. CompatibilityEngine evaluates sample sessions correctly.

### Phase 1: Shared Runtime [Phase 1]

Extract the viewer shell. Wire ScenePackageLoader with hash validation. Still-first pattern.

1. Create `create/core/ViewerShell.tsx` — extract Canvas, OrbitControls, CameraSync, RendererSync, Environment from `prototype/core/EffectViewer.tsx`
2. Create `create/core/ScenePackageLoader.ts` — extract from `prototype/core/onemo-loader.ts`, add ScenePackageRef support with `package_hash` + `mesh_manifest_hash` validation
3. Create `create/core/ProjectionFallbackCanvas.tsx` — face-only projected compose preview (D7)
4. Create `create/core/types.ts` — ViewerSceneConfig (generic parts of prototype/types.ts)
5. Implement still-first live-upgrade pattern: poster still → crossfade to live canvas (U8)
6. Implement 4-level fallback ladder (U7): still-first → live-upgrade → ProjectionFallbackCanvas → still-only
7. Visual parity harness: screenshot live Create vs prototype, pixel-diff below threshold
8. **Verify:** Studio builds after pointing imports to `create/core/`. Fallback ladder degrades gracefully when WebGL is disabled. Visual parity > 98%.

### Phase 2: Effect Module + Edit Loop [Phase 2]

Product module, surface discovery, gesture reconciliation, three-class state management, autosave, resume.

1. Create `create/products/registry.ts` — ProductFamilyModule interface
2. Create `create/products/effect/EffectRenderer.tsx` — from prototype/core/EffectModel.tsx
3. Create `create/products/effect/EffectSurfaces.ts` — surface discovery logic
4. Create `create/products/effect/EffectOverrides.ts` — from onemo-loader.ts applyUserOverrides
5. Implement three-class state management (see [13-state-management.md](13-state-management.md)):
   - React Query for canonical server state
   - Zustand WorkspaceStore for working client state
   - Plain refs for interaction runtime state
6. Implement AutosaveController (debounce → flush → revision snapshot)
7. Wire CreateShell.tsx, ConfigPanel.tsx, useDesignSession.ts
8. Add `@create/*` tsconfig alias
9. **Verify:** `/create` loads a .onemo template and renders the Effect. Autosave round-trip works. Resume rehydrates last confirmed state.

### Phase 3: Proof + Render Factory [Phase 3]

Review gate using CompatibilityEngine. Render pages with revision in URL. Playwright capture. Fallback stills at publish time.

1. Wire `reviewDesign` use case to call `CompatibilityEngine.checkReviewReadiness()` — blocks proof on any COMP_BLOCK
2. Create render pages under `src/app/render/`:
   - `/render/design/[designId]/[revision]/[role]` — revision-specific capture (D3: P1 route)
   - `/render/fallback/[scenePresetId]/[context]` — poster still generation at publish time (D3: P2 route)
3. Implement Playwright capture worker
4. Wire preview generation to review flow — captures from immutable revision snapshot
5. Generate fallback stills for published ScenePresets
6. **Verify:** Review → preview appears in Cloudinary. Fallback stills exist for published presets. Review blocked when CompatibilityEngine returns COMP_BLOCK.

### Phase 4: Manufacturing [Phase 4]

Method A/B/C compilers consuming immutable revision snapshots.

1. Implement method A/B/C compilers (see [08-manufacturing-pipeline.md](08-manufacturing-pipeline.md))
2. Compilers load from `DesignRevisionRepository.getByRevision()` — never from mutable head
3. Manufacturing uses `design_ref` (structured) not flat `design_id` + `design_revision`
4. Wire to approval flow
5. **Verify:** Approved design → ManufacturingPackage in Supabase. Package references exact revision snapshot.

### Phase 5: Commerce [Phase 5]

CheckoutIntent replaces raw cart. Approval-expiry revalidation.

1. Implement CheckoutIntent creation from approved revision + add-ons (see [09-commerce-handoff.md](09-commerce-handoff.md))
2. Wire `CompatibilityEngine.checkCheckoutReadiness()` for approval-expiry and variant availability
3. Implement grouped contexts for bundle/pair/receiver relationships (D5)
4. Wire Shopify Storefront API cart from CheckoutIntent lines
5. Create Shopify app surface
6. Implement order webhook handler
7. **Verify:** Approved design → CheckoutIntent → cart → checkout → order webhook. Expired approvals blocked. Bundle lines grouped correctly.

### Phase 6: Share + Public [Phase 6]

Public previews, presentation routes, remix, social share.

1. Create presentation routes (`/presentation/[ref]`)
2. Create private share routes (`/share/private/[ref]`)
3. Implement remix flow (fork a design as new DesignSession with `create_context: 'remix'`)
4. Social share image generation via render factory
5. **Verify:** Share link resolves. Presentation page renders. Remix creates new draft.

### Phase 7: AI Sidecars [Phase 7]

Intent parser with discriminated union schema (D6). Intake adapters. Generated media pipeline.

1. Implement AI command schema as Zod discriminated union (see [11-gen-ai-hooks.md](11-gen-ai-hooks.md))
2. Implement intake adapters for artwork from AI generation, file upload, library pick, remix
3. Wire video texture as GeneratedMedia subtype
4. Validate AI commands through CompatibilityEngine before applying to DesignSession
5. Extend render factory for AI content generation (social shots, video captures)
6. **Verify:** AI-generated content appears on the product. Intent parser produces valid typed actions. CompatibilityEngine rejects invalid AI commands.

## File Migration Map [Phase 1]

| Current file | Production destination | Change type |
|---|---|---|
| `prototype/core/EffectViewer.tsx` | `create/core/ViewerShell.tsx` | Extract generic parts |
| `prototype/core/EffectModel.tsx` | `create/products/effect/EffectRenderer.tsx` | Move + rename |
| `prototype/core/onemo-loader.ts` | `create/core/ScenePackageLoader.ts` | Extract generic + add hash validation |
| `prototype/types.ts` | Split → `create/core/types.ts` + `create/products/effect/types.ts` | Split |
| `prototype/user/ColorPanel.tsx` | `create/products/effect/` | Move |
| `prototype/user/EditOverlay.tsx` | `create/products/effect/` | Move |
| `prototype/user/Toolbar.tsx` | `create/` (root-level UI) | Move |
| `studio/src/editor/adapter/onemo-format.ts` | Stays + re-exported via `create/domain/` | Keep, add Zod |
| `studio/` (all) | Stays, imports change to `create/core/` | Import path update |
| `prototype/` (all) | Stays as legacy reference | Untouched |

## Studio Import Changes [Phase 1]

| Studio file | Old import path | New import path |
|---|---|---|
| `StudioViewport.tsx` | `../../../../src/app/(dev)/prototype/core/EffectViewer` | `../../../../create/core` |
| `StudioViewport.tsx` | `../../../../src/app/(dev)/prototype/types` | `../../../../create/core/types` |
| `effect-viewer-mount.tsx` | `../../../../src/app/(dev)/prototype/types` | `../../../../create/core/types` |
| `viewport-render.ts` | `../../../../src/app/(dev)/prototype/core/EffectViewer` | `../../../../create/core` |
| `scene-schema.ts` | `../../../../src/app/(dev)/prototype/types` | `../../../../create/core/types` |
| `observer-r3f-bridge.ts` | `../../../../src/app/(dev)/prototype/core/EffectViewer` + types | `../../../../create/core` |

## Verification Gates

Each phase has a verification gate before proceeding:

| Phase | Gate |
|-------|------|
| 0 | v4 schemas parse existing data. Contract tests pass. CompatibilityEngine evaluates correctly. |
| 1 | Studio builds with create/core imports. Fallback ladder works. Visual parity > 98%. |
| 2 | /create route loads and renders. Autosave + resume round-trip. Three-class state split verified. |
| 3 | Controlled preview from revision snapshot. Fallback stills generated. Review gate blocks COMP_BLOCK. |
| 4 | ManufacturingPackage written from revision snapshot for approved design. |
| 5 | End-to-end: approved → CheckoutIntent → cart → checkout → order. Expiry enforced. |
| 6 | Share link resolves. Presentation renders. Remix creates new draft. |
| 7 | AI content on product. Intent parser valid. CompatibilityEngine rejects bad AI actions. |
