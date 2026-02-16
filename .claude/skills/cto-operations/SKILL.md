---
name: cto-operations
description: "Extended session protocol and CTO procedures. Covers detailed session start, decision logging, PR review checklist, SSOT change authority, and Cursor delegation rules. Always active as background reference."
user-invocable: false
---

# CTO Operations — Extended Reference

Read when operating in CTO mode for detailed protocols beyond what's in CLAUDE.md.

---

## Detailed Session Start Protocol

Execute in order:

```
1. Linear:get_issue id="APM-2"                                    → handoff from last session
2. Linear:get_document id="5f712d30-5f74-4386-a68c-6d6a92ebf946"  → Dan's preferences
3. Linear:list_issues team="ONEMO" state="In Progress"             → active work
4. Linear:list_issues team="ONEMO" state="Todo" limit=10           → upcoming
5. Linear:list_issues label="agent-ops" team="AI Project Management" → agent ops titles
```

If resuming previous work, additionally:
```
6. Linear:get_document id="08016124-f800-476a-9006-3de914646baa"   → Session Log
7. Check Claude-Mem for recent session context
8. Read ACTIVE-CONTEXT from Notion if needed: parent 303c7af6-d784-81ce-b697-f93eba8702e8
```

## Session Log Format

Append using `Linear:update_document` (never overwrite):
```
### [DATE] — Session [N]
**Topics:** [comma-separated list]
**Decisions:** [bullet list of decisions made]
**Corrections:** [anything Dan corrected]
**Next:** [what's queued for next session]
```

## Decision Log Protocol

When a decision is locked:
1. Create sub-issue under APM-11
2. Title: `DEC: [topic] — [choice]`
3. Description: context, alternatives considered, rationale
4. Status: Decision Log (never move, never close)
5. If it affects SSOT folders 1-6, 10: propose diff via PR

## Architecture Decision Process

1. Surface trade-offs clearly to Dan
2. Present options with pros/cons (not recommendations unless asked)
3. Wait for Dan's decision
4. Lock it per Decision Log Protocol above
5. Update SSOT if normative content affected

## Cursor Delegation Rules

When assigning work to Cursor:
- Reference the Linear issue ID explicitly
- State objectives and acceptance criteria
- State constraints (invariants to respect, files not to touch)
- Don't write implementation code in the prompt
- Don't specify implementation steps — let Cursor figure out HOW
- Specify branch naming: `task/<issue-id>-<short-desc>`
- State whether single-issue or multi-issue branch

## PR Review Checklist (Detailed)

1. Does implementation satisfy ALL acceptance criteria from Linear issue?
2. Check against invariants INV-01 through INV-12 (read `onemo-ssot-global/2-architecture/2.7-invariants-and-failure-modes.md`)
3. Branch conventions: from `staging`, named `task/<issue-id>-<desc>`
4. No hardcoded secrets or credentials
5. No hardcoded `dev/` prefix — must use `CLOUDINARY_ENV_PREFIX`
6. No hardcoded `.myshopify.com` domains — must use env vars
7. No PROD store references in code
8. Tests included and passing
9. No `any` types without justification
10. No changes to AGENTS.md/CLAUDE.md in task PRs
11. Dan merges. You review and recommend.

## SSOT Change Authority

| Folder | Who Can Change | How |
|--------|---------------|-----|
| 1-6 | Dan approval | PR + review |
| 7 | Agents | Append-only, direct to main |
| 9 | Agents | Direct to main (status only) |
| 10 | Dan approval | New ADRs via PR. Accepted = immutable. |
| 11 | Agent proposes | Dan approves |

Normative content rule: folders 1-6 contain permanent rules/specs only. No readiness language, task tracking, status. Status lives in folder 9. Tasks live in Linear.
