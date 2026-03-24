# Changelog

All notable changes to the ONEMO Next.js application.

## [Unreleased]

### Added
- R3F 3D Effect prototype at `/prototype` (route group: `(dev)`)
  - KeyShot GLB model with 3 named meshes (PRINT_SURFACE_FRONT, BACK, FRAME)
  - GSG SuedeBlack 4K PBR material setup (normal, height, roughness, sheen)
  - Runtime planar UV projection for artwork mapping (KeyShot UVs unusable)
  - MeshPhysicalMaterial with sheen for suede fabric rendering
  - NeutralToneMapping at 0.7 exposure for artwork contrast preservation
  - Material presets V1 (manual) and V2 (research-tuned) saved in `asset-library/presets/`
- `CHANGELOG.md`
- `docs/` folder with `project-structure.md` — repo conventions and external dependencies
- README files in every major folder (`src/`, `public/`, `asset-library/`, `scripts/`, `supabase/`, `docs/`)

### Changed
- **Repo restructure:** unified app router under `src/app/` (removed duplicate root `app/`)
- **Route groups:** organized pages into `(store)`, `(admin)`, `(dev)` groups
- **Scripts:** organized from flat into `scripts/tokens/`, `scripts/shopify/`, `scripts/3d/` — all references rewired
- **Asset separation:** `public/` holds only live in-use files; `asset-library/` holds reserved copies, alternative textures, presets, screenshots
- **Shopify MCP config:** moved from `docs/` to `scripts/shopify/`
- `tsconfig.json` path alias `@/*` updated for `src/` structure
- `package.json` script paths updated for `scripts/tokens/` reorganization
- `next.config.ts` comments updated for new script paths
- `src/app/api/dev/save/route.ts` config path updated

### Removed
- `Design System/` folder (superseded by `scripts/tokens/build-tokens.mjs` pipeline — moved to archive)
- Next.js template SVGs (file.svg, globe.svg, next.svg, vercel.svg, window.svg)
- Old texture files from `public/` (Poly Haven velour_velvet, ambientCG Fabric026, procedural bump — moved to `asset-library/textures/`)
- Stale `BRANCH-COMPOSER-CURSOR-BATCH.md` from docs
- Empty `context/` folder (design-principles.md covered by SSOT `11.4`)
- Duplicate `app/` directory at project root

---

## [0.0.1] — 2026-02-14

### Added
- Initial Next.js project setup
- Supabase integration with auth middleware
- Shopify Storefront API integration
- Cloudinary asset pipeline (upload signatures, paths)
- Design token pipeline (`scripts/tokens/build-tokens.mjs`)
- CSS token output (`src/app/tokens/`)
- Admin moderation page
- Store pages: create, library, community, design/[slug]
- API routes: cart, designs, upload-permission, shopify storefront-verify
- Dev tools: token dashboard with validation panel
