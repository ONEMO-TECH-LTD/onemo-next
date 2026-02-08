# ONEMO Agent Instructions

This file is read automatically by all AI coding agents (Codex, Cursor, Claude Code).
Follow these instructions for every task in this repository.

---

## Project

ONEMO is a custom magnetic badge design platform. Users upload images, preview them on
mod mockups, save to a private library, share publicly, and purchase physical products.

**Architecture:** Hybrid split — this Next.js app handles design/community features while
a separate Shopify theme handles commerce (cart, checkout, orders, accounts).

**Stack:** Next.js (App Router) · TypeScript · Vercel · Supabase (Postgres + Auth) · Cloudinary · Shopify Storefront API

## Documentation (Single Source of Truth)

All architecture, product specs, compliance rules, and operational procedures live in a
separate repository: `ONEMO-TECH-LTD/onemo-ssot-global`.

Before starting any task, read the relevant SSOT documents. At minimum, always read:
- `01-governance/authority-and-rules.md` — defines what you can and cannot do

Then load documents relevant to your task:
- API work → `02-architecture/api-contracts.md`
- Database/schema → `02-architecture/data-model.md`
- Auth/security → `02-architecture/security-and-auth.md`
- Upload/preview → `02-architecture/preview-system.md`
- Feature specs → `03-product/features-and-flows.md`
- Environments → `04-operations/environments.md`
- Moderation → `06-compliance/6.2-moderation.md`
- GDPR/webhooks → `06-compliance/6.1-gdpr-and-webhooks.md`

If the SSOT repo is not available locally, ask Dan for the relevant document content.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm test             # Run Vitest tests
npm run test:e2e     # Run Playwright E2E tests
npm run lint         # ESLint
npm run typecheck    # TypeScript type check
```

## Environments

| Environment | Shopify Store | Supabase | Cloudinary Prefix | Branch |
|-------------|---------------|----------|-------------------|--------|
| DEV | `onemo-dev.myshopify.com` | DEV project | `dev/` | `staging` |
| PROD | `onemo-4865.myshopify.com` | PROD project | *(none)* | `main` |

**Never touch PROD** without Dan's explicit approval. All dev work targets DEV.

## Hard Rules

1. **No PROD changes.** No PROD writes, deployments, migrations, or env var changes without Dan.
2. **No hardcoded secrets.** Use `process.env.VARIABLE_NAME` only. Never ask Dan for secret values.
3. **No architecture changes.** The SSOT defines the architecture. If you think it's wrong, flag it — don't change it.
4. **Supabase is canonical.** All design data lives in Supabase. Shopify is for commerce only.
5. **Standard error envelope.** All API routes return `{ ok, data }` or `{ ok, error: { code, message, details } }`.
6. **No forbidden patterns.** Do not use: metaobjects, Remix framework, App Proxy, Fly.io, packs, bundles, or sets.
7. **Single Custom Mod product.** One Shopify product with variants (Size × Face Material × Colour). Design data goes in line-item properties.
8. **Conventional commits.** Format: `type(scope): description`. Types: feat, fix, refactor, docs, test, chore, ci.
9. **Test your work.** Every feature includes tests. Run `npm test` before committing.
10. **Ask before acting.** If a task brief is unclear, ask Dan. Don't guess on ambiguous requirements.

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── create/          # /create — upload + configurator
│   ├── library/         # /library — private design library
│   ├── community/       # /community — public feed
│   ├── design/          # /design/[slug] — public design pages
│   ├── admin/           # /admin/moderation — Dan-only admin
│   └── api/             # API routes
│       ├── designs/     # CRUD, share, unshare, remix, buy, appeal
│       ├── cart/        # Storefront API cart creation
│       ├── upload-permission/  # Cloudinary signed upload params
│       └── webhooks/    # Shopify webhook handlers
├── lib/                 # Shared utilities
│   ├── supabase/        # Supabase client, helpers, types
│   ├── cloudinary/      # Cloudinary helpers, signing
│   └── shopify/         # Storefront API client
└── middleware.ts        # Supabase Auth session refresh
```

## Key Patterns

- **Auth:** Supabase Auth with anonymous sessions. Account creation at save/buy time.
- **Uploads:** Browser → Cloudinary direct (signed params from API route). Server verifies after.
- **Cart:** `POST /api/cart` → Storefront API `cartCreate` + `cartLinesAdd` → redirect to `checkoutUrl`.
- **Privacy:** Private images use signed URLs (15–60 min). Public sharing creates a separate preview asset.
- **Moderation:** Self-certification at upload. Cloudinary AI Vision scan at share time only.
- **RLS:** Supabase Row-Level Security enforces data access. Users see only their own private designs.

## Branching

- `main` — production (protected, never push directly)
- `staging` — integration branch (PR target)
- `task/<phase>-<description>` — feature branches (e.g., `task/p3-upload-permission`)

**Flow:** Create `task/*` branch → work → PR to `staging` → CI passes → merge → promote to `main` when stable.

## Code Style

- TypeScript strict mode
- Prefer `async/await` over `.then()` chains
- Use Zod for request validation in API routes
- Named exports (not default) for components and utilities
- Error boundaries in page components
- All API routes wrapped in try/catch with standard error envelope
