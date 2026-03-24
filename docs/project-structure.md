# Project Structure

## Overview

The ONEMO Next.js application follows a layered structure:

1. **`src/`** — All runtime source code (app router, components, libraries, tests)
2. **`public/`** — Static assets served at runtime (models, textures, images)
3. **`asset-library/`** — Non-runtime asset container (reserved copies, alternatives, presets)
4. **`scripts/`** — Build tools and utilities (token pipeline, Shopify integration, 3D conversion)
5. **`supabase/`** — Database migrations
6. **`docs/`** — This documentation

## Conventions

### Route Groups
Next.js route groups `(name)` organize pages without affecting URLs:
- `(store)` — customer-facing pages
- `(admin)` — admin tools
- `(dev)` — development tools and prototypes

### Tokens
CSS design tokens are auto-generated. Never edit `src/app/tokens/*.css` directly. Regenerate with `npm run build-tokens`. Source lives in `onemo-ssot-global/11-design-system/artifacts/`.

### Assets
- **In use** → `public/` (served by Next.js)
- **Reserved/alternatives** → `asset-library/` (not served, reference only)
- **Archived/historical** → deleted or in git history

### Scripts
Organized by domain: `scripts/tokens/`, `scripts/shopify/`, `scripts/3d/`. Each has its own context. See `scripts/README.md` for the full index.

## External Dependencies

| System | Where |
|---|---|
| Design system SSOT | `onemo-ssot-global/11-design-system/` |
| Brain (agent infrastructure) | `kai-solo-brain/` |
| Shopify store | `onemo-dev.myshopify.com` |
| Supabase project | configured in `.env.local` |
| Cloudinary | configured in `.env.local` |
