# ONEMO — Claude Code Project Memory

Read `AGENTS.md` in this repo root first. It contains all project rules, structure, and conventions.

This file adds Claude Code-specific instructions.

## Session Start Checklist

1. Read `AGENTS.md` (this repo root)
2. Check which task you're working on — ask Dan if not clear
3. Load relevant SSOT documents from `onemo-ssot-global` repo (see AGENTS.md for mapping)
4. Ask questions before writing code if anything is ambiguous

## Verification Commands

```bash
npm run typecheck     # Must pass before committing
npm run lint          # Must pass before committing
npm test              # Must pass before committing
npm run dev           # Local dev server at localhost:3000
```

## Working Agreements

- Make small, focused commits using conventional commit format
- Run typecheck + lint + test before every commit
- Never modify `.env.local` or any file matching `.env*` — these are gitignored secrets
- When creating API routes, always use the standard error envelope (see AGENTS.md)
- If you need to understand a Supabase table schema, check `02-architecture/data-model.md` in the SSOT
- If you need to understand an API contract, check `02-architecture/api-contracts.md` in the SSOT

## Scope Control

- Only implement what's in the task brief. No bonus features.
- If you spot a bug or improvement outside your current task, note it — don't fix it.
- Never create new Supabase tables or columns without checking the data model doc first.
- Never add npm dependencies without stating why and getting confirmation.

## File Patterns

- API routes: `src/app/api/[endpoint]/route.ts`
- Pages: `src/app/[page]/page.tsx`
- Shared utilities: `src/lib/[module]/`
- Tests co-located: `src/app/api/[endpoint]/__tests__/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
