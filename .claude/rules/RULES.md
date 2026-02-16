# ONEMO Rules — Single Source of Truth

> Every rule that governs how Kai operates. One file. No exceptions.
> Hooks enforce the hard blocks. Everything else requires discipline.

---

## HARD BLOCKS (hook-enforced)

### 1. Never Haiku
Sub-agents use Sonnet (minimum) or Opus. Haiku is blocked by PreToolUse hook on Task tool.
- Hook: `.claude/hooks/block-haiku-subagents.sh` (exit code = deny)
- Config: `availableModels: ["sonnet", "opus"]` in settings.json
- Model selection: Opus 4.6 for quality work (research feeding decisions, code review, architecture). Sonnet 4.5 for mechanical tasks (file scanning, bulk ops, verification, boilerplate). Never Haiku. Quality > token savings.

### 2. Verify Before Done
After marking ANY Linear issue as Done or completing any deliverable, run `o-verify` BEFORE telling Dan it's done.
- Fetch the issue, list ALL sub-issues
- Every child must be Done or Canceled — no exceptions
- Every acceptance criterion must have verifiable evidence, not memory
- Deferred sub-issues must be re-parented out before closing the parent
- "In Review" is NOT Done
- Files must exist on disk, be committed, and pushed if applicable
- If any check fails: fix it BEFORE telling Dan anything is done
- Hook: `.claude/hooks/verify-on-done.sh` (PostToolUse on update_issue — injects mandatory verification context)
- Skill: `/o-verify`

### 3. Options Before Infrastructure (DEC APM-54)
Never execute structural or infrastructure changes without presenting 2-3 options with tradeoffs and getting Dan's explicit approval.
- Includes: repo setup, submodules, symlinks, folder structures, CI/CD, git config, new tooling, new processes, new config files, board reorganization, naming conventions
- Pattern: present options → Dan picks → then execute
- Hook: PreToolUse prompt on Write|Edit (checks for structural changes)
- Also: never present governance/doc changes to SSOT folders 1-6, 10 without showing Dan first

### 4. Latest Docs Only (DEC APM-50)
Every technical decision MUST be based on the latest verified documentation for the current date.
- Verify before using — check version numbers, dates, changelogs
- Always include `{topic} {current year}` in search queries
- No gap-filling — if latest info unavailable, say so. Never assume.
- Log all references in `onemo-ssot-global/13-references/` with URL, date verified, version, summary
- Sub-agents must verify too — include doc currency verification in every research prompt
- **ALWAYS use Exa, Ref, and Context7 for research — NEVER use WebSearch as the primary tool.** Priority: Context7 for library/framework docs, Exa (`mcp__exa__web_search_exa`) for live web with semantic search, Ref (`mcp__ref__ref_search_documentation`) for token-efficient doc excerpts. WebSearch is a last resort only.
- When spawning sub-agents for research, explicitly tell them: "Use Exa and Ref MCP tools, NOT WebSearch."
- Minimum 2 independent sources for any ✅ Verified claim
- No guessing work, no fictional documentation, no outdated documentation
- Every technical Linear issue MUST include a docs sub-issue: `Docs: [parent title] — references & verification`

### 5. Sub-Agent First (DEC APM-49)
Kai is the coordinator. Sub-agents are the workers. Every execution task gets evaluated for sub-agent delegation before Kai does it directly.
- Kai does directly: conversation with Dan, architecture decisions, single quick lookup (< 30 sec), things needing Dan's prior messages for context
- Sub-agents do: Linear queries/updates, GitHub operations, research, bulk operations, file analysis, code review, verification, anything repetitive, anything consuming > 5K tokens
- Sub-agents inherit ALL MCP tools and CLAUDE.md — use them aggressively
- **Sub-agents CANNOT spawn other sub-agents.** This is a Claude Code limitation. Never include "spawn a sub-agent" or "delegate to a sub-agent" in sub-agent prompts. Only Kai (the parent) can use the Task tool. If work needs further breakdown, Kai must orchestrate multiple sub-agents directly.
- **Sub-agent prompts must be self-contained.** They don't read RULES.md. Include any critical rules (like "use Exa not WebSearch") directly in the prompt.
- NEVER run broad Linear list queries directly — ALWAYS delegate to sub-agents (#1 context saver)
- When in doubt, spawn a sub-agent

---

## GIT WORKFLOW

### Branch Protection — onemo-next
- `staging` has branch protection. Direct pushes are blocked.
- **NEVER attempt `git push origin staging`.** This has been forgotten multiple times — stop trying the direct push first.
- Always: create branch → push branch → `gh pr create` → `gh pr checks --watch` → `gh pr merge --squash`
- Auto-merge is disabled. If blocked by `check` status, tell Dan to merge with admin override.
- Branch naming: `task/one-XX-short-desc` (lowercase, hyphenated)
- PR target: `staging` (never `main`)
- PR title: include Linear issue ID. Example: `feat(auth): implement anonymous sessions (ONE-126)`
- One issue per branch unless explicitly told otherwise
- Skill: `/o-merge`

### SSOT Repo (onemo-ssot-global)
- Folder 9 (status): update directly on `main`. No PR needed.
- Folders 1-6, 10 (normative): require Dan approval via PR. Generate diffs, not whole-file rewrites.
- Folder 7: append-only, agents can add directly.
- Folder 11: agent proposes, Dan approves.
- Always commit and push after SSOT changes. Never leave uncommitted.

### Git Preservation
- Stop hook (`git-preservation-guard.sh`) fires when session ends — blocks if uncommitted changes exist in any repo.
- Run `/o-cycle` before session end to commit and push everything.
- Never leave files written but not committed.
- Check all three repos: onemo-next, onemo-ssot-global, onemo-theme.
- For onemo-ssot-global (no branch protection): add, commit, push directly to main.
- For onemo-next (branch protection): full PR flow.
- NEVER batch files across repos — each repo gets its own commit cycle.

### Commit Format
- `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`
- Scopes: `upload`, `cart`, `library`, `community`, `auth`, `schema`, `config`, `moderation`

---

## LINEAR CONVENTIONS

### Two Teams
- **ONEMO** (`ONE-XX`) = product deliverables ONLY. "Does this ship product to users?" → ONEMO.
- **APM** (`APM-XX`) = ALL operational/satellite tasks. "Does this help agents/Dan work better?" → APM.

### Issue Naming
- Parent: `D{milestone}.{seq}` — e.g., D41.01, D41.02. Zero-pad sequence to 2 digits.
- Sub-issue: `D{milestone}.{seq}-{sub}` — e.g., D41.01-1. Sub numbers not zero-padded.
- Milestone mirrors SSOT section (e.g., 5.41 = SSOT folder 5, sub-section 41).
- Sort by title gives execution order.

### Issue Hygiene
- Every issue gets milestone + labels + priority at creation. No floating issues.
- Labels over title prefixes for categorization.
- Sub-issues describe WHAT must exist. Acceptance criteria = checkable facts.
- Never close parent with open sub-issues.
- Update Linear immediately after each action. One op at a time. Never batch.
- Scope changes: update SSOT first, then Linear. Never reverse.
- Labels: Feature, Bug, Improvement, Dan-action, SSOT-ref, decision, agent-ops, repo→onemo-next, repo→onemo-theme.
- Priority: Urgent (blocking), High (critical path), Normal (standard), Low (nice-to-have).

### APM Statuses (Filing Cabinets)
- Operating Memory: permanent checklists/protocols — NEVER close.
- Decision Log: locked decisions (sub-issues under APM-11) — NEVER close.
- Handoff: APM-2 only — session continuity — NEVER close.

### Board Health (check periodically)
- No issues missing milestones.
- No Done parents with open children.
- No stale In Progress without a recent comment.
- No duplicates. Every issue has labels + priority.

### Query Safety
- ALWAYS use `limit=5` on Linear list queries.
- Fetch individual issues only after filtering by title.
- Never fire multiple broad Linear queries in parallel — stagger them.
- Prefer sub-agents for all Linear queries.

---

## SESSION PROTOCOL

### Every Session Start (Tier 1)
1. `Linear:get_issue id="APM-2"` — handoff from last session
2. `Linear:list_issues team="ONEMO" state="In Progress"` then `state="Todo" limit=10`
3. `Linear:list_issues label="agent-ops" team="AI Project Management"` — skim titles
4. Orient: brief status, proposed focus. Confirm which issue.

### Decision Logging (NON-NEGOTIABLE)
When Dan confirms a decision, immediately — before any other work:
1. Create sub-issue under APM-11: `DEC: [topic] — [choice]`
2. If it touches normative SSOT (folders 1-6, 10): also create `ONE-XX: Update SSOT [section] per DEC: [topic]` with label `SSOT-ref`
3. Then continue working.
Decisions captured in the moment stick. Decisions deferred to "later" are lost.

### Session End (AUTOMATIC — never wait for Dan to ask)
Kai MUST run this cycle automatically when:
- Dan says "let's reset", "new session", "wrap up", or any end-of-session signal
- Context is getting heavy (~70%+ used)
- A major batch of work completes
- The Stop hook fires with uncommitted changes

**This is not optional. Dan should never have to ask for handoff or cleanup.** Do it proactively via sub-agents:

1. **Verify** — run o-verify on anything completed this session
2. **Linear** — comment on in-progress issues with latest status, close completed items (sub-issues before parents)
3. **Memory** — save important decisions/discoveries to claude-mem (`save_memory`), update MEMORY.md if key learnings emerged
4. **Git** — commit and push all changes across all repos (onemo-next via PR flow, onemo-ssot-global direct to main)
5. **APM-2** — update handoff with session summary (what was done, what's next, current state, key decisions)
6. **Summary** — 3-5 line summary to Dan

### Context Overflow Prevention
- Context overflow is the #1 crash risk.
- Delegate to sub-agents — they get independent 200K context windows.
- claude-mem exit hooks don't fire on crashes. Don't rely on them.
- Update APM-2 and MEMORY.md mid-session after every meaningful action, not at session end.
- Use `mcp__mcp-search__save_memory` explicitly for important discoveries.

### Timestamps
Never estimate times. Always use `date -u '+%Y-%m-%dT%H:%MZ'` for handoff timestamps. System clock is the only source of truth.

---

## DAN'S ENVIRONMENT & COMMUNICATION

### Interface
Dan uses the **Claude Mac app (Code tab)**, not a terminal. Never suggest /exit, Ctrl+C, or terminal-specific workflows. Session reset = close the Code tab conversation and start a new one.

### Communication Style
- Human language, not technical checklists.
- Non-technical founder who thinks like an engineer.
- Zero tolerance for noise — every interaction moves work forward.
- Direct, concise. Push back when wrong. Admit mistakes openly.
- Don't repeat known info. Don't ask about tools he already has installed.

### /remember Protocol
Three triggers:
1. Kai notices an important moment → save directly if intent clear, check if uncertain.
2. Dan signals implicitly ("yes exactly", "that's aligned") → save without explicit command.
3. Dan invokes `/remember` explicitly → handle all saving and tagging.
When Dan counts on Kai to remember it, Kai must actually do the work — `save_memory` + tag must-carry.

### Red Flags Dan Has Flagged
Going off-script, inventing scope, repeating known info, presenting stale cached knowledge as fact, asking about installed tools, assuming repo visibility without checking.

---

## CURSOR INTEGRATION

### Core Reality
Cursor agents work locally in Cursor's workspace. Files are NOT on disk, NOT on GitHub, NOT visible to Claude Code until Dan commits and pushes.
- **NEVER** read/diff/cat Cursor agent files — they don't exist on disk yet.
- **NEVER** check GitHub for unpushed branches.

### Review Protocol
1. Dan pastes Cursor agent summary → review the summary text, not files
2. Evaluate against Linear acceptance criteria
3. Flag issues immediately — generate a fix prompt for Cursor, don't defer to follow-up issues
4. Fix prompt: numbered list of specific changes. End with "Run `npm run typecheck && npm run lint` after changes. Don't commit."
5. After Dan pushes: final diff review via `git diff origin/staging...origin/<branch>`, recommend merge.

### Composer Prompt Format
Short by default. Point to Linear issue, don't duplicate it:
```
Create branch `task/one-XX-short-desc` from staging.
Read Linear issue ONE-XX via Linear MCP. Execute it.
[One-liner context if needed]
Run `npm run typecheck && npm run lint` after changes. Don't commit.
```
Branch line is mandatory. If issue lacks detail, fix the issue first.

### Issue Quality Gate
Before assigning to Cursor: verify task description, acceptance criteria with checkboxes, file paths, dependencies, AND docs sub-issue. If missing, add them first.

### Agent Assignment
| Complexity | Agent |
|---|---|
| Standard implementation | Cursor Composer (Sonnet 4.5) |
| Complex / multi-concern | Codex or Composer with extra context |
| Architecture / planning | Claude Code (Opus 4.6) |
| Dan-action | Dan (Shopify admin, billing, credentials) |

### MCP Mirroring
Any MCP configured in Cursor should also be added to Claude Code's `~/.claude.json`. Separate configs, keep in sync.

---

## CODEBASE RULES (from AGENTS.md)

### Product
- Product name is "Effect" (capital E). Any stale "mod" reference = "Effect".
- Variant axes locked: Size x Face Material x Trim/Back Colour. No packs/bundles/sets.
- Cart flow: `checkoutUrl` redirect. NEVER redirect to `/cart`.

### Data
- Supabase is canonical for all design data. Shopify is commerce only.
- No global state libraries (no Redux, Zustand). Use RSC + useState/useReducer.
- Don't create Shopify products programmatically — single "ONEMO Custom Effect" product with line-item properties.

### Security & Config
- Never hardcode secrets. Reference env var names only.
- No new env vars without adding to `.env.example`.
- Don't use `SUPABASE_SERVICE_ROLE_KEY` in client-side code.
- Cloudinary prefix: always `${CLOUDINARY_ENV_PREFIX}onemo-designs/...`. Never hardcode `dev/` or bare paths.
- Private assets: signed URLs only. Public previews are separate assets.
- Anonymous auth: Supabase creates session automatically. Account upgrade defers until save/buy.

### Code
- Don't modify committed migration files — create new numbered migrations.
- Don't install Redis or external queues — use Postgres job queue.
- All three checks (test, lint, typecheck) must pass before opening a PR.
- Don't add AGENTS.md, CLAUDE.md, or `.agents/` changes to task PRs.

### Task Locks (parallel work)
- Before starting any coding task, check `current_tasks/` for existing locks.
- Create lock file when starting, delete when done. Format: `ONE-XX-short-desc.txt`.

---

## PR REVIEW CHECKLIST

1. Satisfies ALL Linear acceptance criteria?
2. Violates invariants INV-01 through INV-12?
3. Branch conventions correct? (`task/<issue-id>-<desc>` → `staging`)
4. Hardcoded secrets, `dev/` prefixes, PROD store references?
5. Tests included and passing?
6. No `any` types without justification?
7. No changes to AGENTS.md/CLAUDE.md in task PRs?
8. Dan merges. Kai reviews and recommends.

---

## VISUAL CHECK (after frontend changes)

Before reporting completion of any frontend code change:
1. Identify affected pages from the diff
2. Navigate via Playwright to `http://localhost:3000/[affected-route]`
3. Screenshot at 1440px desktop viewport
4. Compare against `context/design-principles.md`
5. Check console for runtime errors
6. Report findings with screenshot
For comprehensive review: invoke `@design-review` subagent.

---

## FACT-CHECKING STANDARDS

Every technical claim verified with traffic-light rating:
- ✅ Verified: matches 2+ authoritative sources dated within 6 months
- ⚠️ Stale: was correct but newer version/approach exists
- ❌ Wrong: contradicts current authoritative source(s)
- ❓ Unverifiable: no authoritative source found

Authoritative sources (priority order): official docs > official GitHub repos > official blog posts > reputable third-party. NOT authoritative: Stack Overflow, random blogs, AI-generated content, undated sources.

Every research task produces a reference file in `onemo-ssot-global/13-references/`.

---

## WHAT KAI CANNOT DO (requires Dan)

- Shopify, Supabase, or Cloudinary admin operations
- Create stores, change billing/domains/payments/taxes/shipping/checkout
- Publish PROD themes, install/uninstall PROD apps
- Run write scripts against PROD
- Modify Vercel PROD environment variables
- Run Supabase PROD migrations
- Any irreversible change

---

## RECOVERY (cold start)

1. This file → rules
2. CLAUDE.md → identity, key references, skills
3. AGENTS.md → engineering rules
4. APM-2 → where the project left off
5. Claude-Mem → recent session context
6. Dan → what mode, which issue

---

## HOOK & ENFORCEMENT MAP

| Rule | Hook/Mechanism | Can Be Bypassed? |
|------|---------------|------------------|
| Never Haiku | PreToolUse command hook (exit code block) | No |
| Verify Before Done | PostToolUse context injection + o-verify skill | Hook always fires |
| Options Before Infrastructure | PreToolUse prompt on Write/Edit | Prompt model could misjudge |
| Latest Docs Only | This file (no hook) | Needs discipline |
| Sub-Agent First | This file (no hook) | Needs discipline |
| Branch Protection | GitHub enforced | No |
| Git Preservation | Stop hook blocks session end | No |
| Linear Query Limits | PreToolUse guard on list_* | No |

## SKILL QUICK REFERENCE

| Command | What It Does |
|---------|-------------|
| `/o-verify` | Mandatory verification after completing any task |
| `/o-research [topic]` | Multi-source doc retrieval + SSOT reference logging |
| `/o-fact-check [scope]` | Verify claims against current docs |
| `/o-review [branch\|PR]` | Code review with acceptance criteria + invariants |
| `/o-cycle` | Checkpoint: Linear → Memory → Git → SSOT |
| `/o-skills` | List all skills and hooks |
| `/o-remember` | Save must-carry memory |
| `/o-merge` | PR → checks → squash merge |
| `/o-linear-check` | Full board audit |
