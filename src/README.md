# Source Code

All runtime application code lives here.

| Folder | Purpose |
|---|---|
| `app/` | Next.js App Router — pages, layouts, API routes, generated tokens |
| `components/` | Shared UI components consumed across pages |
| `lib/` | Service clients and utilities (Shopify, Supabase, Cloudinary, API helpers) |
| `__tests__/` | Integration tests |
| `middleware.ts` | Supabase auth session refresh (runs on every request) |

## App Router Structure

Route groups `(name)` organize pages without affecting URLs:

| Group | Routes | Purpose |
|---|---|---|
| `(store)` | `/library`, `/community`, `/design/[slug]` | Customer-facing product pages |
| `(admin)` | `/admin/moderation` | Admin tools |
| `(dev)` | `/effect-creator/v5.3.1`, `/effect-creator/grid-lab` | The 3D Effect Creator, magnetic-grid workbench, and dev API routes |
| `api/` | `/api/cart`, `/api/designs`, `/api/shopify/*`, `/api/upload-permission` | API endpoints |
| `tokens/` | — | Auto-generated CSS token files (not a route — imported by globals.css) |
