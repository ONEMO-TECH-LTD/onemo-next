---
name: sub-agent-first
description: "Sub-agent delegation as the default execution model. Every task gets evaluated for delegation before Kai does it directly. Sub-agents get independent 200K context. Always active — DEC APM-49."
user-invocable: false
---

# Sub-Agent First — Practical Workflow

**DEC APM-49:** Kai is the coordinator. Sub-agents are the workers. Kai's context is reserved for strategy, decisions, and Dan's conversation. Mechanical work goes to sub-agents.

---

## Decision Tree

```
TASK ARRIVES
    |
    v
Is this a conversation with Dan? (strategy, brainstorm, decision)
    |-- YES --> Kai does it directly
    |-- NO
         |
         v
    Is this a single quick lookup? (one file read, one Linear query, < 30 sec)
         |-- YES --> Kai does it directly
         |-- NO
              |
              v
         Does this require reading Dan's prior messages for context?
              |-- YES --> Kai does it directly
              |-- NO
                   |
                   v
              Will this consume > 5K tokens of context?
                   |-- YES --> SPAWN SUB-AGENT
                   |-- NO
                        |
                        v
                   Is this one of 3+ similar operations?
                        |-- YES --> SPAWN SUB-AGENT (batch them)
                        |-- NO --> Kai does it directly
```

**When in doubt, spawn.** The overhead (~500 tokens prompt + ~500 result) is almost always cheaper than doing work in Kai's context.

---

## Kai Does Directly

| Task | Why |
|------|-----|
| Conversation with Dan | Needs full chat history |
| Architecture decisions | Needs Dan's input in real-time |
| Single Linear query | Fast MCP call, small payload |
| Session protocol (APM-2 read, orientation) | Keep lean — 3 queries max |
| Decision logging (APM-11) | Small write, needs conversation context |
| Quick single file read (< 100 lines) | Overhead of spawn > cost of read |

---

## Spawn Sub-Agents For

| Task Type | Model | Parallel OK? |
|-----------|-------|-------------|
| Research (multi-file) | Opus 4.6 | YES (if independent) |
| Code review | Opus 4.6 | YES (split by area) |
| Verification (typecheck/lint/build) | Sonnet 4.5 | YES |
| Bulk file ops | Sonnet 4.5 | DEPENDS |
| Board audit | Sonnet 4.5 | YES |
| Web research | Opus 4.6 | YES |
| Design review | @design-review agent | NO (one at a time) |

---

## Prompt Template

Every sub-agent prompt follows this structure:

```
## Objective
[One sentence: what to do]

## Context
[Minimum viable context. File paths, issue IDs, constraints.]

## Scope
[What to do AND what NOT to do.]

## Return Format
[Exactly what the summary should contain. Structured.]
```

---

## Model Selection

**Opus 4.6** — Research that feeds decisions, code review, architecture analysis
**Sonnet 4.5** — File scanning, bulk ops, verification, board audits, boilerplate
**Never Haiku** — Dan explicitly prohibited it.

Decision rule: "Will the quality of this output directly influence a product decision or code merge?" YES → Opus. NO → Sonnet.

---

## Anti-Patterns

1. **Spawning for trivial tasks** — if < 30 sec and < 1K tokens, do directly
2. **Passing too much context** — give file PATHS, not file CONTENTS
3. **Not specifying return format** — always include structured `## Return Format`
4. **Sequential when parallel is possible** — independent tasks → same message
5. **Re-reading sub-agent output** — trust Opus results. Sonnet on critical paths → spawn Opus to verify
6. **Forgetting to delegate research before decisions** — textbook delegation case
