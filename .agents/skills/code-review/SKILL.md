---
name: code-review
description: Structured self-review for onemo-next before commits and PRs. Next.js / TypeScript / Supabase / Cloudinary.
---

# Code Review — onemo-next

Two modes: **Full Review** (pre-commit/pre-PR) and **Quick Scan** (during development).

## Full Review (pre-commit/pre-PR)

### Step 1: Run automated checks

```bash
npm run typecheck
npm run lint
npm test
```

Stop if any fail.

### Step 2: Review changed files

List changed files (e.g. `git diff --name-only HEAD`). For each file, check:

- **a) Works?** No runtime errors, broken imports, undefined refs. Async has try/catch. No `any` unless justified.
- **b) Matches requirements?** Linear issue acceptance criteria met. SSOT deliverable acceptance signal met. Invariant checks (INV-XX) verified if listed.
- **c) Conventions?** PascalCase components, camelCase functions, kebab-case files. Error envelope: `{ ok, data }` or `{ ok, error: { code, message } }`. No unused imports.
- **d) Project rules?** No hardcoded URLs (`.myshopify.com`, `supabase.co`, `onemo.fashion`). No secrets. Cloudinary paths use `CLOUDINARY_ENV_PREFIX` — no bare `dev/` or `onemo-designs/`. RLS enforced (no service role key in client code). Cart redirects to `checkoutUrl` never `/cart`. No packs, bundles, sets, metaobjects, App Proxy, Remix (Shopify framework).
- **e) Breaks anything?** All tests pass. Shared code callers verified. API envelope consistent.

### Step 3: Grep checks

Search `src/` for: hardcoded `myshopify.com`, bare `onemo-designs/` without prefix, hardcoded `"dev/"`, `console.log`, secrets patterns. Flag any hits.

### Step 4: Summarise

Pass/fail per section (a–e) plus confidence verdict (ready to commit or needs attention).

---

## Quick Scan (during development)

1. `git diff --stat` — 5-point triage: high-risk files, debug artifacts, type safety, convention violations, incomplete work.
2. Run `npm run typecheck` and `npm run lint` (tail output).
3. One-line verdict: **clean** or **fix first** (list items).
