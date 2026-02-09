---
name: linear
description: Execute Linear issues for the ONEMO project. Fetches issue details via Linear MCP, loads project context from AGENTS.md and SSOT, implements acceptance criteria, and prepares changes for review. Use when the user invokes /linear with issue IDs (e.g. /linear ONE-70 ONE-71) or asks to implement Linear issues.
---

# Linear — Execute ONEMO Issues

Run this workflow when the user invokes `/linear` with one or more issue IDs (and optional scope, e.g. "just the cart integration part").

## 1. Fetch issues

- Use Linear MCP to fetch each issue: `mcp_linear_get_issue` with the given IDs.
- For each issue, read: **title**, **description**, **acceptance criteria** (in description or body), and any **SSOT reference** (link or path to `onemo-ssot-global`).
- If an issue is a sub-issue (has a parent), fetch the parent with `mcp_linear_get_issue` for context.
- **Before proceeding:** Present a short summary (issue ID, title, key AC, parent if any). If the user specified a narrow scope (e.g. "just the cart integration part"), note that and restrict implementation to that scope.

## 2. Load context

- Read **AGENTS.md** in the repo root (onemo-next) for project rules and structure.
- If an issue references an SSOT doc (path or link), read it from the SSOT repo. Path is typically `../onemo-ssot-global/` relative to onemo-next, or the workspace path to `onemo-ssot-global`.
- **Dependency gate:** Read `onemo-ssot-global/9-setup-status/9.1-status-tracker.md`. If any dependency the task relies on is "Not done", **stop** and report: "Blocked: <dependency> is Not done in 9.1-status-tracker. Complete that first."

## 3. Branch

From the onemo-next repo:

```bash
git checkout staging && git pull origin staging
git checkout -b task/<lowest-issue-id>-<short-description>
```

- **Lowest-issue-id:** Smallest issue number (e.g. ONE-70 → `70`).
- **Short-description:** 2–4 words from the main issue title, lowercase, hyphens (e.g. `cart-integration`).

## 4. Implement

- Work through each issue’s acceptance criteria in order (or in dependency order if one blocks another).
- If scope was limited (e.g. "just the cart integration part"), implement only that part and note the rest as out of scope.
- Follow AGENTS.md and SSOT: no PROD changes, no hardcoded secrets, standard error envelope for API routes, conventional patterns.

## 5. Verify

Before committing, run:

```bash
npm run lint
npx tsc --noEmit
npm test
```

- Fix any failures.
- Sanity-check: no secrets or hardcoded PROD URLs in the diff.

## 6. Commit

- Use conventional commits: `<type>(<scope>): <description>` (e.g. `feat(cart): add Storefront API cart creation`).
- One commit per logical change; multiple commits per branch are fine.

## 7. Present for review

Summarise:

- **Per issue:** What was done, which acceptance criteria were met.
- **Files changed:** List of paths.
- **Blockers / out of scope:** Anything not done (e.g. dependency "Not done", or user-limited scope).
- State that the branch is ready for a PR to `staging`.
