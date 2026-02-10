# AGENTS.md — onemo-next

> Read this file at the start of every session. It is the project context for all coding agents.

## Project

ONEMO is a custom magnetic badge ("mod") design platform. Customers upload artwork, preview it on a mod mockup, configure options, and purchase.

**This repo** (`onemo-next`) is the Next.js application that handles:
- Design configurator (`/create`)
- Design library (`/library`)
- Community feed (`/community`)
- Public design pages (`/design/:slug`)
- Admin moderation page (`/admin/moderation`)
- All API routes (`/api/*`)

**It does NOT handle:** Shopify theme pages (products, collections, cart, checkout, accounts). Those live in `onemo-theme`.

## Stack

- **Framework:** Next.js (App Router), TypeScript
- **Deployment:** Vercel
- **Database:** Supabase Postgres (canonical for all design data)
- **Auth:** Supabase Auth (anonymous sessions → account creation)
- **Images:** Cloudinary (upload, transform, CDN delivery)
- **Commerce:** Shopify Storefront API (cart creation → checkout redirect)
- **Routing:** Cloudflare reverse proxy splits paths between Vercel and Shopify

## SSOT (Single Source of Truth)

Full architectural docs are in `ONEMO-TECH-LTD/onemo-ssot-global`. Key references:

| Topic | File |
|-------|------|
| Authority & rules | `1-governance/1.1-authority-and-rules.md` |
| System overview | `2-architecture/2.1-system-overview.md` |
| Tech stack | `2-architecture/2.2-tech-stack.md` |
| Data model | `2-architecture/2.3-data-model.md` |
| Security & auth | `2-architecture/2.4-security-and-auth.md` |
| API contracts | `2-architecture/2.5-api-contracts.md` |
| Preview system | `2-architecture/2.6-preview-system.md` |
| Invariants | `2-architecture/2.7-invariants-and-failure-modes.md` |
| Features & flows | `3-product/3.1-features-and-flows.md` |
| Environments | `4-operations/4.1-environments.md` |
| Work management | `4-operations/4.6-work-management.md` |
| Moderation | `6-compliance/6.2-moderation.md` |

## Work Management

All work is tracked in **Linear** (project: ONEMO-WEB-APP, team: ONEMO).

- Every coding task requires a Linear issue (ONE-XX) before starting
- Branch naming: `task/<issue-id>-<short-description>` (e.g., `task/one-15-upload-permission`)
- Include the Linear issue ID (e.g., `ONE-15`) in PR title or description
- Linear auto-updates status when PRs are opened/reviewed/merged

## Environments

| Environment | Shopify Store | Supabase | Cloudinary Prefix | Branch |
|-------------|---------------|----------|-------------------|--------|
| **DEV** | `onemo-dev.myshopify.com` | DEV project | `dev/` | `staging` + `task/*` |
| **PROD** | `onemo-4865.myshopify.com` | PROD project | *(none)* | `main` |

**Cloudinary cloud_name:** `du6q2q4ab` (shared, isolated by folder prefix)

## Branching

- `main` — production (protected, deploy via Vercel)
- `staging` — integration (protected, PR target)
- `task/<issue-id>-<description>` — feature/fix branches

**Flow:** `task/*` → PR to `staging` → CI + review → merge → promote `staging` → `main` when stable

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm test             # Run Vitest tests
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run build        # Production build
npm run test:e2e     # Playwright E2E tests
npm run test:watch   # Vitest watch mode
```

## Commit Convention

`<type>(<scope>): <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`
Scopes: `upload`, `cart`, `library`, `community`, `auth`, `schema`, `config`, `moderation`

Examples:
- `feat(upload): add signed permission API route`
- `fix(cart): handle missing variant gracefully`
- `test(rls): add RLS policy enforcement tests`

## Hard Rules

1. **No PROD writes without Dan.** Never modify Vercel production env vars, run Supabase PROD migrations, or push to `main` without Dan's explicit approval.
2. **Supabase is canonical.** All design data lives in Supabase. Shopify receives only line-item properties at cart time and order webhooks.
3. **No metaobjects, no App Proxy, no Remix (Shopify).** These are not part of the architecture.
4. **No packs, bundles, or sets.** Single "Custom Mod" product. Quantity via Shopify cart only.
5. **Variant axes are locked:** Size × Face Material × Trim/Back Colour. No other variant dimensions.
6. **Never redirect to `/cart`.** Custom design purchases go from `POST /api/cart` → `checkoutUrl` redirect. Headless cart lines don't appear on Shopify's native cart page.
7. **Asset verification is mandatory.** Every `POST /api/designs` must verify the Cloudinary asset server-side before creating the design record.
8. **Self-certification before upload.** Users must check the self-certification checkbox before uploading.
9. **Cloudinary paths use `CLOUDINARY_ENV_PREFIX`.** No hardcoded `dev/` or bare `onemo-designs/` anywhere.
10. **Secrets never in code.** Use `process.env.VARIABLE_NAME`. No hardcoded credentials, not even temporarily.
11. **Every task needs a Linear issue.** No undocumented work.
12. **Conventional commits.** Follow the format above for all commits.
13. **Filter underscore-prefixed properties.** Line-item properties starting with `_` must never be shown to customers.

## API Error Envelope

All API routes return this shape:

```json
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": { "code": "STRING_ENUM", "message": "Human readable", "details": {} } }
```

Error codes: `VALIDATION_ERROR` (400), `AUTH_REQUIRED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `ASSET_VERIFICATION_FAILED` (422), `MODERATION_BLOCKED` (403), `RATE_LIMITED` (429), `UPSTREAM_UNAVAILABLE` (502), `INTERNAL_ERROR` (500).

## Key Invariants (Check Before Marking Done)

- **INV-01:** Cloudflare must not cache authenticated/dynamic pages
- **INV-03:** Upload permission must support retry on signature expiry
- **INV-04:** Asset verification applies only to original uploads (not derived assets)
- **INV-05:** Design-buy flow always bypasses theme cart page
- **INV-06:** Line-item properties have fixed schema, under 1KB total
- **INV-07:** Self-certified private designs can be purchased but rejected designs cannot
- **INV-08:** Share endpoint must be idempotent
- **INV-09:** Remix must only access the public preview asset (never private original)
- **INV-10:** Background jobs must check resource existence before acting
- **INV-11:** Cloudinary folder prefix from single env constant

## Review Guidelines

When reviewing PRs (applies to Codex automated reviews and all agents):

### Always Check
- No secrets, API keys, or tokens in code (search for `api_key`, `secret`, `token`, `password`)
- No hardcoded store domains (search for `.myshopify.com`, `supabase.co`)
- No hardcoded Cloudinary paths — must use `CLOUDINARY_ENV_PREFIX` (INV-11)
- Scope check: PR only touches files relevant to the Linear issue
- Conventional commit messages on all commits
- CI checks pass (lint + typecheck + test)

### Architecture Red Flags (Block PR)
- References to metaobjects, App Proxy, or Shopify Remix framework
- Any redirect to `/cart` from Next.js flows (INV-05)
- Client-side code providing derived asset IDs (only original upload asset ID allowed) (INV-04)
- Code that accesses another user's `cloudinary_asset_id` during remix (INV-09)
- Missing server-side asset verification on design save (INV-04)
- Line-item properties exceeding fixed schema or containing JSON blobs (INV-06)
- `moderation_state` checks missing on cart/share endpoints (INV-07, INV-08)
- Background jobs that don't check resource existence before acting (INV-10)

### Quality Checks
- API routes use standard error envelope (`{ ok, data/error }`)
- Rate limiting present on public-facing endpoints
- RLS-relevant queries use authenticated Supabase client (not service role) for user-scoped data
- Loading and error states present for UI components
- TypeScript types — no `any` without justification
