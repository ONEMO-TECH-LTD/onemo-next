# ONEMO Next.js Application

The ONEMO web application — a custom magnetic Effect design platform where customers create personalized decorative panels through a 3D visual configurator.

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| 3D Engine | React Three Fiber + drei |
| Commerce | Shopify Plus (Storefront API + checkout) |
| Database | Supabase (PostgreSQL) |
| Assets | Cloudinary |
| Hosting | Vercel |

## Project Structure

```
onemo-next/
├── src/                        ← all runtime source code
│   ├── app/                    ← Next.js app router
│   │   ├── (store)/            ← product pages (create, library, community, design)
│   │   ├── (admin)/            ← admin pages (moderation)
│   │   ├── (dev)/              ← dev tools (prototype, token dashboard)
│   │   ├── api/                ← API routes (cart, designs, shopify, uploads)
│   │   └── tokens/             ← generated CSS token files (do not edit)
│   ├── components/             ← shared UI components
│   ├── lib/                    ← service clients (shopify, supabase, cloudinary, api)
│   ├── __tests__/              ← integration tests
│   └── middleware.ts           ← Supabase auth session management
│
├── public/                     ← static assets served by Next.js (live/in-use only)
├── asset-library/              ← non-runtime asset container (see asset-library/README.md)
├── scripts/                    ← build tools and utilities (see scripts/README.md)
├── supabase/                   ← database migrations
├── docs/                       ← repo documentation
│
├── .agents/                    ← agent skills
├── .claude/                    ← Claude Code hooks, settings
├── .cursor/                    ← Cursor rules
├── .github/                    ← CI workflows
│
├── CLAUDE.md                   ← Claude Code project instructions
├── AGENTS.md                   ← agent engineering rules
├── CHANGELOG.md                ← release log
└── config files                ← tsconfig, eslint, postcss, next.config, vitest
```

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Key Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run build-tokens` | Regenerate CSS tokens from Figma JSON |
| `npm run validate-tokens` | Validate token pipeline |
| `npm run test` | Run tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Design Tokens

Tokens are auto-generated from the SSOT Figma Variables export. Never edit `src/app/tokens/*.css` directly.

```bash
# Source: onemo-ssot-global/11-design-system/artifacts/
# Pipeline: scripts/tokens/build-tokens.mjs
# Output: src/app/tokens/{primitives,aliases,semantic,semantic-inline}.css
npm run build-tokens
```

## Prototype

The 3D Effect configurator prototype lives at `/prototype` (route group: `(dev)`).

```
src/app/(dev)/prototype/
├── page.tsx              ← entry point
└── EffectViewer.tsx      ← R3F 3D viewer with suede PBR materials
```
