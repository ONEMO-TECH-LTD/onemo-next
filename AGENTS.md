# AGENTS.md — onemo-next

> Instructions for AI coding agents (Codex, Claude Code, Cursor).
> Read automatically at session start.

## Project

ONEMO custom magnetic Effect design platform. Product name is "Effect" (capital E) everywhere — customer-facing and Shopify `product_type`. This repo is the Next.js app — design tools, library, community, API routes. Runs on Vercel alongside a Shopify theme for commerce.

> **Naming note:** The product was previously called "Mod". All references have been updated to "Effect". If any stale "mod" reference surfaces in code, docs, or Linear issues, treat it as "Effect". Mod = Effect.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm test             # Run tests (Vitest)
npm run lint         # Lint
npm run typecheck    # TypeScript check
```

All three checks (test, lint, typecheck) must pass before opening a PR.

## Branching & Commits

- **Branch from:** `staging` (never `main`)
- **Branch naming:** `task/<issue-id>-<short-desc>` (e.g., `task/one-101-anonymous-auth`)
- **PR target:** `staging` (never `main`)
- **Never push directly to `staging` or `main`**
- **Commit format:** `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`
  - Scopes: `upload`, `cart`, `library`, `community`, `auth`, `schema`, `config`, `moderation`

## Agent Branch Rules

All coding agents (Codex, Claude Code, Cursor Composer) MUST follow:

1. **Branch naming:** `task/<issue-id>-<short-description>` (lowercase)
   - ✅ `task/one-126-anonymous-sessions`
   - ✅ `task/one-93-liquid-cart-filter`
   - ❌ `codex/linear-mention-one-126-implement-...` (auto-generated, not allowed)

2. **PR target:** Always `staging`. NEVER `main`.

3. **PR title:** Include Linear issue ID. Example: `feat(auth): implement anonymous sessions (ONE-126)`

4. **One issue per branch** unless explicitly told otherwise.

## Task Locks (Parallel Work)

When starting a coding task, check `current_tasks/` for conflicts first.

1. `ls current_tasks/` — any overlapping scope?
2. Create `current_tasks/ONE-XX-short-desc.txt` with: agent, started (UTC), branch, scope
3. Do the work
4. Delete the lock file when done (merged or abandoned)

Lock files are `.gitignored` — they're ephemeral coordination, not committed. See `current_tasks/README.md` for full format.

---

## Universal Brain (Kai Solo Brain)

All agents share a universal knowledge base at `ONEMO-TECH-LTD/kai-solo-brain` (private). Contains agent identities, universal decisions, Dan's working patterns, tool capabilities, and communication protocol.

**Cloud agents (Codex):** Clone `kai-solo-brain` alongside this repo. Read `agents/AGENTS.md` first, then `memory/patterns/dan-patterns.md`, then `protocols/communication.md`.

**Local agents (Claude Code, Cursor):** Brain repo is at `../kai-solo-brain` relative to this repo.

**Slack coordination:** All agents post to #hive-mind (`C0AGC9Z18QL`) with their prefix (e.g., `[Codex]`, `[Mac Kai]`).

---

## Full Documentation (SSOT)

All architecture, data model, API contracts, invariants, security, operations, and compliance specs live in the `onemo-ssot-global` repo (GitHub: `ONEMO-TECH-LTD/onemo-ssot-global`, private). Agents access it directly from their local clone — there is no submodule. The repo is cloned alongside other ONEMO repos (e.g., `../onemo-ssot-global` relative to this repo).

**Key files to read before working on a task:**

| Topic | File |
|---|---|
| System overview | `onemo-ssot-global/2-architecture/2.1-system-overview.md` |
| Tech stack | `onemo-ssot-global/2-architecture/2.2-tech-stack.md` |
| Data model | `onemo-ssot-global/2-architecture/2.3-data-model.md` |
| Security & auth | `onemo-ssot-global/2-architecture/2.4-security-and-auth.md` |
| API contracts | `onemo-ssot-global/2-architecture/2.5-api-contracts.md` |
| Invariants (must not violate) | `onemo-ssot-global/2-architecture/2.7-invariants-and-failure-modes.md` |
| Environments & secrets | `onemo-ssot-global/4-operations/4.1-environments.md`, `4.4-secrets-and-local-dev.md` |
| CI & branching | `onemo-ssot-global/4-operations/4.2-ci-and-branching.md` |
| GDPR & webhooks | `onemo-ssot-global/6-compliance/6.1-gdpr-and-webhooks.md` |
| Moderation | `onemo-ssot-global/6-compliance/6.2-moderation.md` |
| Verified external references | `onemo-ssot-global/13-references/` (anti-hallucination layer) |
| Token naming convention (blueprint) | `onemo-ssot-global/11-design-system/11.5-naming-convention.md` — READ before any token/CSS/theme work |

**Always read the Linear issue description first** — it contains task-specific acceptance criteria and references to relevant SSOT sections.

## Latest Documentation Only (DEC APM-50 — HARD RULE)

Every technical decision and implementation **MUST** be based on the latest verified documentation for the current date. No exceptions. No guessing. No outdated docs.

1. **Verify before using** — check version numbers, dates, changelogs before applying any framework/platform convention
2. **Search explicitly** — always include `{topic} {current year}` in research queries
3. **No gap-filling** — if latest info is unavailable, flag it. Never assume.
4. **Log all references** — every external source used goes into `onemo-ssot-global/13-references/` with URL, date verified, version, summary
5. **Documentation sub-issue required** — every technical Linear issue must have a sub-issue titled `Docs: [parent title] — references & verification` listing the verified sources the work is based on

This applies to ALL agents: Claude Code, Cursor, Codex, and Dan. Violations waste tokens, time, and trust.

---

## Key Rules (Non-Negotiable)

These are the most critical rules from SSOT governance. For the complete list with failure modes and mitigations, read `onemo-ssot-global/2-architecture/2.7-invariants-and-failure-modes.md`.

1. **Supabase is canonical** for all design data. Shopify is commerce only.
2. **Cart flow:** `checkoutUrl` redirect. NEVER redirect to `/cart`.
3. **Variant axes locked:** Size × Face Material × Trim/Back Colour. No packs/bundles/sets.
4. **Cloudinary prefix:** Always `${CLOUDINARY_ENV_PREFIX}onemo-designs/...`. Never hardcode `dev/` or bare paths.
5. **No global state libraries** (no Redux, Zustand). Use RSC + useState/useReducer.
6. **No new env vars** without adding to `.env.example`.
7. **Don't modify committed migration files** — create new numbered migrations.
8. **Secrets:** Never hardcode. Reference env var names only.
9. **Anonymous auth:** Supabase creates anonymous session automatically. Account upgrade defers until save/buy.
10. **Private assets:** Signed URLs only. Public previews are separate assets. Remix reads public preview, never private original.

## File Structure

```
src/
  app/                    # Next.js App Router pages and API routes
    api/                  # API route handlers
    create/               # /create page
    library/              # /library page
    community/            # /community page
    design/[slug]/        # /design/:slug public design page
    admin/moderation/     # /admin/moderation page
  components/             # Shared components (PascalCase)
  lib/
    supabase/server.ts    # createServerClient() — server-side Supabase
    supabase/client.ts    # createBrowserClient() — client-side Supabase
    supabase/admin.ts     # Service role client — admin operations
    cloudinary/           # Upload, transform, signed URL helpers
    shopify/              # Storefront API client
  types/                  # TypeScript type definitions
supabase/
  migrations/             # SQL migrations (001_*, 002_*, etc.)
docs/                     # Non-code documentation (MCP configs, etc.)
```

## What NOT To Do

- Don't add `AGENTS.md`, `CLAUDE.md`, or `.agents/` changes to task PRs
- Don't install Redis or external queues — we use Postgres job queue
- Don't create Shopify products programmatically
- Don't use `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- Don't create one product per design — there's a single "ONEMO Custom Effect" product with line-item properties
