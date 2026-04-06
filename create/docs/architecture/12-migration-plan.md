# 12 — Migration Plan

> Moving from prototype to production Create module. Phase sequence, file map, verification gates.

## Phase: [v1] extraction and rewiring, sequential phases after

## Migration Strategy [v1]

Graduate FROM the prototype, not just decouple from it. The prototype proved the quality. Now we extract the proven patterns into production-grade architecture.

**The prototype stays.** It continues to work as a reference and development sandbox. Create imports replace prototype imports in Studio. No prototype files are deleted.

## Phase Sequence

### Phase 1: Extract core/ (ViewerShell) [v1]

1. Create `create/core/ViewerShell.tsx` — extract Canvas, OrbitControls, CameraSync, RendererSync, Environment from `prototype/core/EffectViewer.tsx`
2. Create `create/core/SceneLoader.ts` — extract from `prototype/core/onemo-loader.ts`
3. Create `create/core/types.ts` — ViewerSceneConfig (generic parts of prototype/types.ts)
4. **Verify:** Studio builds after pointing imports to `create/core/`

### Phase 2: Create domain schemas [v1]

1. Create `create/domain/scene-preset.ts` — Zod schema wrapping existing OnemoStudioJson shape
2. Create `create/domain/design-session.ts` — Zod schema wrapping existing OnemoUserConfig
3. Create `create/domain/product-spec.ts` — simplified v1
4. Create `create/domain/manufacturing-package.ts` — placeholder [v3]
5. **Verify:** Schemas validate against existing .onemo studio.json files

### Phase 3: Create products/effect/ module [v1]

1. Create `create/products/registry.ts` — ProductFamilyModule interface
2. Create `create/products/effect/EffectRenderer.tsx` — from prototype/core/EffectModel.tsx
3. Create `create/products/effect/EffectSurfaces.ts` — surface discovery logic
4. Create `create/products/effect/EffectOverrides.ts` — from onemo-loader.ts applyUserOverrides
5. **Verify:** Effect module discovers surfaces from existing GLBs

### Phase 4: Build CreateShell [v1]

1. Create `create/CreateShell.tsx` — assembles ViewerShell + Effect module
2. Create `create/useScenePreset.ts` — load .onemo, validate, convert
3. Create `create/useDesignSession.ts` — manage user config state
4. Create `src/app/create/page.tsx` — Next.js route (1-line wrapper)
5. Add `@create/*` tsconfig alias
6. **Verify:** /create loads a .onemo template and renders the Effect

### Phase 5: Update Studio imports [v1]

1. Point all Studio files to `create/core/` instead of `prototype/core/`
2. Fix stale ViewerRenderPass import in viewport-render.ts
3. **Verify:** Studio builds, loads scenes, saves scenes — full round-trip

### Phase 6: Wire data persistence [v2]

1. Implement repository interfaces (file-backed first)
2. Wire DesignSession autosave
3. Wire resume/restore from saved sessions
4. Add Supabase implementations
5. **Verify:** Create → save → close → reopen → same design

### Phase 7: Preview render factory [v3]

1. Create render pages under `src/app/render/`
2. Implement Playwright capture worker
3. Wire preview generation to review flow
4. **Verify:** Review → preview appears in Cloudinary

### Phase 8: Manufacturing compilers [v3]

1. Implement method A/B/C compilers
2. Wire to approval flow
3. **Verify:** Approved design → ManufacturingPackage in Supabase

### Phase 9: Commerce handoff [v4]

1. Wire Shopify Storefront API cart
2. Implement line-item property serialization
3. Create Shopify app surface
4. **Verify:** Approved design → cart → checkout → order webhook

### Phase 10: Gen AI integration [v5]

1. Wire video texture hook
2. Implement AI intent parsing sidecar
3. Extend render factory for content generation
4. **Verify:** AI-generated content appears on the product

## File Migration Map [v1]

| Current file | Production destination | Change type |
|---|---|---|
| `prototype/core/EffectViewer.tsx` | `create/core/ViewerShell.tsx` | Extract generic parts |
| `prototype/core/EffectModel.tsx` | `create/products/effect/EffectRenderer.tsx` | Move + rename |
| `prototype/core/onemo-loader.ts` | `create/core/SceneLoader.ts` | Extract generic parts |
| `prototype/types.ts` | Split → `create/core/types.ts` + `create/products/effect/types.ts` | Split |
| `prototype/user/ColorPanel.tsx` | `create/products/effect/` | Move |
| `prototype/user/EditOverlay.tsx` | `create/products/effect/` | Move |
| `prototype/user/Toolbar.tsx` | `create/` (root-level UI) | Move |
| `studio/src/editor/adapter/onemo-format.ts` | Stays + re-exported via `create/domain/` | Keep, add Zod |
| `studio/` (all) | Stays, imports change to `create/core/` | Import path update |
| `prototype/` (all) | Stays as legacy reference | Untouched |

## Studio Import Changes [v1]

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
| 1 | Studio builds with create/core imports |
| 2 | Schemas validate against existing .onemo files |
| 3 | Effect module discovers surfaces from existing GLBs |
| 4 | /create route loads and renders |
| 5 | Studio full round-trip (load → edit → save → reload) |
| 6 | Design persistence round-trip (save → close → reopen) |
| 7 | Controlled preview appears after review |
| 8 | ManufacturingPackage written for approved design |
| 9 | End-to-end cart → checkout → order |
| 10 | AI content appears on product |
