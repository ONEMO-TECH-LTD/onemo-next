# CLAUDE.md — onemo-next

> For Claude Code sessions. Read AGENTS.md first — it has full project context.

## Context Access (Priority Order)

1. **AGENTS.md** (this repo) — project rules, structure, conventions, review guidelines
2. **Local SSOT:** `../onemo-ssot-global/` — architecture, invariants, data contracts, execution specs
3. **Notion SSOT (fallback):** If local SSOT inaccessible, search Notion for "onemo-ssot-global". Parent page: `303c7af6-d784-80fa-9d50-d5777d3c4eac`
4. **Linear:** Live task status. Team: ONEMO. Project: ONEMO-WEB-APP
5. **Notion ACTIVE-CONTEXT:** Session state and recent decisions. Parent: `303c7af6-d784-81ce-b697-f93eba8702e8`. Read latest child page (after README).

## Session Start

1. Read this file + AGENTS.md
2. Pull Linear state: `list_issues state="In Progress"` then `state="Todo" limit=10`
3. If resuming previous work → read ACTIVE-CONTEXT from Notion
4. Confirm which Linear issue (ONE-XX) to work on before writing code
5. Read relevant SSOT docs for the task (local first, Notion fallback)

## MCP Servers

- **Notion** — read SSOT pages, read/write ACTIVE-CONTEXT
- **Linear** — full read/write: issues, projects, milestones, comments

If not configured:
```bash
claude mcp add -s user notion -- npx @notionhq/notion-mcp-server
claude mcp add -s user linear -- npx @anthropic/linear-mcp-server
```

## Key Reminders

- **Next.js App Router** project with TypeScript
- **Supabase** is canonical database (not Shopify metaobjects)
- **Cloudinary** handles all image storage/delivery
- **Shopify Storefront API** for cart creation only — never redirect to `/cart`
- All API routes use standard error envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details } }`

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

## Key Invariants

Full details: `../onemo-ssot-global/2-architecture/2.7-invariants-and-failure-modes.md` or Notion page `303c7af6-d784-814a-a57f-fb267dc5abf2`

- **INV-04:** Asset verification on original uploads only (not derived assets)
- **INV-05:** Design-buy flow bypasses theme cart page (always checkoutUrl redirect)
- **INV-06:** Line-item properties fixed schema, <1KB
- **INV-09:** Remix reads public preview only, never private original
- **INV-11:** Cloudinary folder prefix from single env constant

## Forbidden Patterns

- No `any` types without justification
- No hardcoded secrets or credentials
- No hardcoded `dev/` prefix — use `CLOUDINARY_ENV_PREFIX`
- No hardcoded `.myshopify.com` domains — use env vars
- No metaobjects, App Proxy, or Shopify Remix references
- No packs, bundles, or quantity presets
- No redirect to `/cart` from any Next.js flow
- No accessing another user's private Cloudinary assets

## What NOT To Do

- Don't redefine scope or architecture — only SSOT + Dan decide
- Don't publish PROD themes or run PROD migrations without Dan
- Don't modify Vercel PROD env vars
- Don't merge to `main` without Dan's approval
- Don't invent scope beyond the current Linear issue
