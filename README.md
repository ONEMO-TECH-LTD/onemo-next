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
│   │   ├── (dev)/              ← dev tools (the effect-creator/v5.3.1 Creator + dev API routes)
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
| `npm run test` | Run tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Design Tokens

`src/app/tokens/*.css` are the token outputs the app renders from. The in-repo `scripts/tokens` generator was retired in the v5.3.1 cleanup; the current pipeline is **DS-V2.1** in `onemo-ssot-global/11-design-system/` (the app adopts it at v5.4). Don't hand-edit the CSS — it's generated output.

## Creator

The 3D Effect Creator lives at `/effect-creator/v5.3.1` (route group: `(dev)`).

```
src/app/(dev)/effect-creator/v5.3.1/
├── page.tsx              ← composition root (the one persistent 3D scene)
├── core/                 ← 3D (EffectViewer, ShapedModel) + scene-format/ (.onemo loader)
└── user/                 ← the 2D editor overlay
```
