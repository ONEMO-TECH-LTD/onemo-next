# AGENTS.md — onemo-next

> Instructions for AI coding agents (Codex, Claude Code, Cursor).
> Read automatically at session start.
> Rules arrive via `.claude/rules/` symlinks — requires companion repos alongside.

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

---

## Companion Repos (required)

Rules and project knowledge are loaded automatically via `.claude/rules/` symlinks. These repos must be cloned alongside this repo:

| Repo | Clone At | Purpose |
|---|---|---|
| `kai-solo-brain` | `../kai-solo-brain` | Universal agent rules (hard blocks, session protocol, Linear workflow, quality standards) |
| `onemo-ssot-global` | `../onemo-ssot-global` | ONEMO project knowledge (architecture, codebase conventions, design system, specs) |

**Cloud agents (Codex):** Clone both repos alongside this one. Read `kai-solo-brain/agents/AGENTS.md` first, then `kai-solo-brain/memory/patterns/dan-patterns.md`.

**Slack coordination:** All agents post to #hive-mind (`C0AGC9Z18QL`) with their prefix (e.g., `[Codex]`, `[Mac Kai]`).

---

## Full Documentation (SSOT)

All architecture, data model, API contracts, invariants, security, operations, and compliance specs live in `onemo-ssot-global`.

**Key files to read before working on a task:**

| Topic | File |
|---|---|
| System overview | `onemo-ssot-global/2-architecture/2.1-system-overview.md` |
| Tech stack | `onemo-ssot-global/2-architecture/2.2-tech-stack.md` |
| Data model | `onemo-ssot-global/2-architecture/2.3-data-model.md` |
| Security & auth | `onemo-ssot-global/2-architecture/2.4-security-and-auth.md` |
| API contracts | `onemo-ssot-global/2-architecture/2.5-api-contracts.md` |
| Invariants (must not violate) | `onemo-ssot-global/2-architecture/2.7-invariants-and-failure-modes.md` |
| Codebase conventions | `onemo-ssot-global/2-architecture/2.8-codebase-conventions.md` |
| Environments & secrets | `onemo-ssot-global/4-operations/4.1-environments.md`, `4.4-secrets-and-local-dev.md` |
| CI & branching | `onemo-ssot-global/4-operations/4.2-ci-and-branching.md` |
| GDPR & webhooks | `onemo-ssot-global/6-compliance/6.1-gdpr-and-webhooks.md` |
| Moderation | `onemo-ssot-global/6-compliance/6.2-moderation.md` |
| Verified external references | `onemo-ssot-global/13-references/` (anti-hallucination layer) |
| Token naming convention | `onemo-ssot-global/11-design-system/11.5-naming-convention.md` |

**Always read the Linear issue description first** — it contains task-specific acceptance criteria and references to relevant SSOT sections.
