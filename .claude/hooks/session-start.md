# Hook: SessionStart
# Fires when a new Claude Code session begins.
# Purpose: Enforce Tier 1 startup so the agent never starts work without context.

---

**MANDATORY BEFORE ANY OTHER WORK:**

You just started a new session. Before doing anything else, execute these steps in order:

1. Read `CLAUDE.md` (this repo root) — your operating rules
2. Read `AGENTS.md` — engineering rules and project structure
3. Read APM-2 from Linear (`Linear:get_issue id="APM-2"`) — last session's handoff
4. Scan the ONEMO board: `Linear:list_issues team="ONEMO" state="In Progress"` then `state="Todo" limit=10`
5. If Dan said "continue" or referenced previous work, also check Claude-Mem for recent session context

Then orient Dan with a brief status (2-3 lines max) and confirm which issue to work on.

**Do not skip this.** Do not start coding without knowing what APM-2 says. If APM-2 is stale (last update >6 hours ago), say so — Dan should know.
