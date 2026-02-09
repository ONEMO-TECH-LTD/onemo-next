# CLAUDE.md — onemo-next

> For Claude Code sessions. Read AGENTS.md first — it has full project context.

## Key Reminders

- This is a **Next.js App Router** project with TypeScript
- **Supabase** is the canonical database (not Shopify metaobjects)
- **Cloudinary** handles all image storage/delivery
- **Shopify Storefront API** for cart creation only — never redirect to `/cart`
- All API routes use the standard error envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details } }`
- Full docs in `ONEMO-TECH-LTD/onemo-ssot-global`

## Commands

```bash
npm run dev          # Dev server
npm test             # Vitest
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run build        # Production build
```

## Scope Control

- Only work on what's in the assigned Linear issue
- Create branch: `task/<issue-id>-<description>`
- Commit format: `<type>(<scope>): <description>`
- If you discover work not covered by the issue, stop and flag it

## Forbidden Patterns

- No `any` types without justification
- No hardcoded secrets or credentials
- No hardcoded `dev/` prefix — use `CLOUDINARY_ENV_PREFIX`
- No hardcoded `.myshopify.com` domains — use env vars
- No metaobjects, App Proxy, or Shopify Remix references
- No packs, bundles, or quantity presets
- No redirect to `/cart` from any Next.js flow
- No accessing another user's private Cloudinary assets
