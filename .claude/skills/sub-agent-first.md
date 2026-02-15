# Sub-Agent First — Practical Workflow

> Skill: Sub-agent delegation as the default execution model.
> Trigger: ALWAYS ACTIVE. Every execution task gets evaluated for sub-agent delegation before Kai does it directly.
> Decision: DEC APM-49

---

## The Math

Kai's parent context: ~200K tokens. Each sub-agent: ~200K tokens (independent).
Five sub-agents running = ~1M effective tokens with Kai using only ~15K on spawn prompts + returned summaries.

**The rule:** Kai is the coordinator. Sub-agents are the workers. Kai's context is reserved for strategy, decisions, and Dan's conversation. Mechanical work goes to sub-agents.

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
              Will this consume > 5K tokens of context? (multi-file reads,
              large diffs, web research, bulk operations, repetitive tasks)
                   |-- YES --> SPAWN SUB-AGENT
                   |-- NO
                        |
                        v
                   Is this one of 3+ similar operations?
                        |-- YES --> SPAWN SUB-AGENT (batch them)
                        |-- NO --> Kai does it directly
```

**When in doubt, spawn.** The overhead of a sub-agent spawn (~500 tokens for prompt + ~500 tokens for summary) is almost always cheaper than doing the work in Kai's context.

---

## Kai Does Directly

These stay in the parent context:

| Task | Why |
|------|-----|
| Conversation with Dan | Needs full chat history |
| Architecture decisions | Needs Dan's input in real-time |
| Single Linear query | Fast MCP call, small payload |
| Session protocol (APM-2 read, orientation) | Keep lean -- 3 queries max |
| Decision logging (APM-11 sub-issue creation) | Small write, needs conversation context |
| Presenting task assignments to Dan | Needs conversation flow |
| Quick single file read (< 100 lines) | Overhead of spawn > cost of read |
| Answering "what's the status of X" | Usually one Linear lookup |

---

## Spawn Sub-Agents For

These go to sub-agents. No exceptions.

### Research (Opus 4.6)
- Codebase exploration: "find all files that do X", "how does Y work"
- Web research: documentation lookups, API reference checks
- SSOT analysis: reading multiple docs/ssot/ files to answer a question
- Multi-source investigation: "what are all the places that reference Z"

### Code Review (Opus 4.6)
- PR diff analysis: `git diff origin/staging...origin/<branch>`
- Acceptance criteria checking against Linear issue
- Invariant violation scanning (INV-01 through INV-12)
- Pattern compliance (response helpers, error handling, auth guards)

### Verification (Sonnet 4.5)
- Running `npm run typecheck && npm run lint && npm run build`
- Checking CI status and parsing failures
- Before/after comparison of outputs
- Validating file structure matches conventions

### Bulk Operations (Sonnet 4.5)
- Multi-file edits (rename refactors, import updates)
- Scanning codebase for patterns (grep + read + summarize)
- Linear board health audits (checking milestones, labels, stale issues)
- Generating migration scripts or boilerplate

### File Analysis (model depends on complexity)
- Reading files > 100 lines (Sonnet for mechanical, Opus for analytical)
- Parsing configs and identifying issues
- Comparing multiple files for consistency
- Auditing directory structure

### Design Review (Sonnet 4.5 via @design-review agent)
- Use the dedicated `@design-review` subagent for visual checks
- It has Playwright tools scoped in, takes screenshots at 3 viewports
- Always use this instead of doing visual checks in Kai's context

---

## Prompt Templates

Every sub-agent prompt follows this structure:

```
## Objective
[One sentence: what to do]

## Context
[Minimum viable context. File paths, issue IDs, constraints. NOT the full conversation history.]

## Scope
[What to do AND what NOT to do. Explicit boundaries.]

## Return Format
[Exactly what the summary should contain. Structure it.]
```

### Template 1: Research Agent (Opus 4.6)

```
## Objective
Research [specific question] in the onemo-next codebase.

## Context
- Repo root: /Users/daniilsolopov/claude-code-repos/onemo-next
- Relevant paths: [list specific directories or files to start from]
- Related: [any known file names, function names, or patterns]

## Scope
- DO: Read files, grep for patterns, trace dependencies, analyze architecture
- DO NOT: Make any changes, create files, or run commands that modify state

## Return Format
1. **Answer** -- direct answer to the question (2-3 sentences)
2. **Evidence** -- file paths and relevant code snippets (keep snippets short)
3. **Related findings** -- anything noteworthy discovered during research
4. **Gaps** -- what you couldn't determine and why
```

### Template 2: Code Review Agent (Opus 4.6)

```
## Objective
Review the diff for branch [branch-name] against staging.

## Context
- Repo root: /Users/daniilsolopov/claude-code-repos/onemo-next
- Linear issue: ONE-XX -- [one-line description]
- Acceptance criteria:
  [ ] [criterion 1]
  [ ] [criterion 2]
  [ ] [criterion 3]
- Invariants doc: docs/ssot/2-architecture/2.7-invariants-and-failure-modes.md

## Scope
- DO: Run `git diff origin/staging...origin/[branch]`, read changed files in full, check against criteria
- DO: Check for hardcoded secrets, dev/ prefixes, PROD store references
- DO: Verify response helpers, error handling patterns, auth guards
- DO NOT: Make changes, push, merge, or modify any files

## Return Format
1. **Criteria check** -- each acceptance criterion marked PASS/FAIL with evidence
2. **Invariant violations** -- any INV-XX violations found (or "none")
3. **Issues** -- numbered list, severity (blocker/high/medium/nitpick), what and where
4. **Fix prompt** -- if issues found, a numbered Cursor fix prompt ready to send
5. **Recommendation** -- "merge" or "fix first"
```

### Template 3: Verification Agent (Sonnet 4.5)

```
## Objective
Verify that [specific check] passes for branch [branch-name].

## Context
- Repo root: /Users/daniilsolopov/claude-code-repos/onemo-next
- Branch: [branch-name]
- What to check: [typecheck/lint/build/specific test]

## Scope
- DO: Checkout the branch, run the specified checks, capture full output
- DO NOT: Fix anything. Report only.

## Return Format
1. **Status** -- PASS or FAIL
2. **Output** -- if FAIL, the relevant error messages (trimmed, not full log)
3. **Affected files** -- which files have errors
4. **Suggested fixes** -- one-line description of what each error needs (if obvious)
```

### Template 4: Bulk Operation Agent (Sonnet 4.5)

```
## Objective
[Specific bulk operation: rename, scan, update, generate].

## Context
- Repo root: /Users/daniilsolopov/claude-code-repos/onemo-next
- Target: [files, patterns, directories]
- Rules: [naming conventions, patterns to follow]

## Scope
- DO: [exactly what operations to perform]
- DO NOT: [boundaries -- e.g., don't touch test files, don't modify types]

## Return Format
1. **Changes made** -- list of files modified with one-line description each
2. **Skipped** -- files that matched but were intentionally skipped (with reason)
3. **Verification** -- did `npm run typecheck && npm run lint` pass after changes? Output if not.
```

### Template 5: Linear Board Audit (Sonnet 4.5)

```
## Objective
Audit the [ONEMO/APM] Linear board for hygiene issues.

## Context
- ONEMO team: product work (ONE-XX)
- APM team: agent operations (APM-XX)
- Required fields: milestone, labels, priority on every issue
- No Done parents with open children
- No stale In Progress without recent comments

## Scope
- DO: Query issues, check for missing fields, find inconsistencies
- DO NOT: Update any issues. Report only.
- IMPORTANT: Use limit=5 on all list queries. Paginate if needed. Never fetch all issues at once.

## Return Format
1. **Issues missing milestones** -- list of issue IDs and titles
2. **Issues missing labels** -- list
3. **Issues missing priority** -- list
4. **Done parents with open children** -- list
5. **Stale In Progress** -- issues with no comment in 7+ days
6. **Duplicates suspected** -- pairs of similar titles
7. **Total issues checked** -- count
```

---

## Parallel Execution Patterns

### When to Parallelize

Launch multiple sub-agents in a single message when tasks are **independent** -- they don't need each other's output.

**Good parallel patterns:**

```
# Research + Verification (independent)
Sub-agent 1: "Research how auth middleware works in this codebase"
Sub-agent 2: "Run typecheck and lint, report any failures"

# Multi-file review (independent sections)
Sub-agent 1: "Review the API route changes in this diff"
Sub-agent 2: "Review the UI component changes in this diff"

# Board audit + Codebase scan (independent)
Sub-agent 1: "Audit Linear board hygiene"
Sub-agent 2: "Scan codebase for stale 'mod' references"
```

**Bad parallel patterns (must be sequential):**

```
# Research THEN review (dependent)
Sub-agent 1: "Research how the upload flow works"  <-- need this first
Sub-agent 2: "Review the upload flow changes"      <-- depends on ^

# Build THEN deploy check (dependent)
Sub-agent 1: "Run build"                           <-- need pass/fail first
Sub-agent 2: "Check deployment status"             <-- only if build passes
```

### Maximum Concurrent Agents

**Recommended: 2-3 parallel sub-agents.** More than 3 means Kai is juggling too many result summaries at once. If you have 5 tasks, batch them as 3 + 2 sequential groups.

### Dependency Chains

For dependent tasks, use sequential spawning:

```
Message 1: Spawn research agent
           --> Wait for result
Message 2: Use research result to spawn review agent
           --> Wait for result
Message 3: Synthesize for Dan
```

---

## Context Budget Management

### Keeping Kai Lean

| Action | Context Cost | Rule |
|--------|-------------|------|
| Sub-agent spawn prompt | ~500 tokens | Keep prompts minimal. Don't paste file contents -- give paths. |
| Sub-agent result summary | ~500-2000 tokens | Require structured return format. Summaries, not dumps. |
| Single file read (< 100 lines) | ~300-500 tokens | OK to do directly |
| Single file read (> 100 lines) | ~500-5000 tokens | Delegate to sub-agent |
| Git diff (small PR) | ~500-2000 tokens | OK to do directly if < 200 lines |
| Git diff (large PR) | ~2000-10000 tokens | Always delegate |
| Linear list query | ~500-3000 tokens | Always use limit=5. Paginate if needed. |
| Web research | ~2000-10000 tokens | Always delegate |

### What to Extract from Sub-Agent Results

**Take:** The structured summary. Bullet points. Pass/fail verdicts. Issue IDs. File paths.
**Leave:** Full code snippets (ask Dan to look in the file). Full command output. Verbose explanations.

If a sub-agent returns 2000 tokens of summary when you only need 200, that's a prompt problem. Tighten the return format in your next spawn.

### When to Compact vs When to Spawn

**Compact** (context window compression) when:
- You're mid-conversation with Dan and context is getting heavy
- The conversation has shifted topics and old context is irrelevant
- You've accumulated results from multiple sub-agents

**Spawn** when:
- New work arrives that doesn't need conversation history
- You need to process large amounts of data
- The task is self-contained with clear inputs and outputs

**Prefer spawning over compacting.** Compacting loses nuance. Spawning preserves Kai's conversation fidelity while offloading mechanical work.

---

## Model Selection

| Model | Token Cost | Use For |
|-------|-----------|---------|
| **Opus 4.6** | High | Research that feeds decisions, code review, architecture analysis, anything Dan acts on |
| **Sonnet 4.5** | Medium | File scanning, bulk ops, verification (typecheck/lint/build), board audits, boilerplate generation |

**Decision rule:** "Will the quality of this output directly influence a product decision or code merge?"
- YES --> Opus 4.6
- NO --> Sonnet 4.5

**Never use Haiku.** Dan explicitly prohibited it.

---

## Anti-Patterns

### 1. Spawning for Trivial Tasks
BAD: Spawning a sub-agent to read a 20-line config file.
WHY: Spawn overhead (~500 tokens prompt + ~500 tokens result + latency) exceeds the cost of just reading the file (~100 tokens).
RULE: If the task takes < 30 seconds and consumes < 1K tokens, do it directly.

### 2. Passing Too Much Context
BAD: Pasting entire file contents into the sub-agent prompt.
WHY: The sub-agent can read files itself. You're paying twice.
RULE: Pass file PATHS, not file CONTENTS. Pass issue IDs, not issue descriptions (sub-agent can query Linear).

### 3. Not Specifying Return Format
BAD: "Research how auth works and tell me what you find."
WHY: Sub-agent returns 3000 tokens of prose. You needed 200 tokens of structured findings.
RULE: Always include a `## Return Format` section with numbered items and expected brevity.

### 4. Sequential When Parallel Is Possible
BAD: Spawning agent A, waiting, then spawning agent B, when A and B are independent.
WHY: Doubles wall-clock time for no reason.
RULE: If tasks don't depend on each other's output, spawn them in the same message.

### 5. Re-reading Sub-Agent Output Files
BAD: Sub-agent says "I found the issue in src/lib/auth.ts line 42." Kai then reads src/lib/auth.ts to verify.
WHY: Duplicates the context cost. Trust the sub-agent or spawn another to verify.
RULE: Trust structured results from Opus sub-agents. For Sonnet results on critical paths, spawn an Opus verification agent instead of reading yourself.

### 6. Forgetting to Delegate Research Before Decisions
BAD: Dan asks "should we use middleware or API route for auth?" Kai reads 8 files to understand the current setup, burning 5K tokens of context.
WHY: This is textbook research delegation.
RULE: Spawn a research agent first. Get the structured summary. Then think with Dan using just the summary.

### 7. Accumulating Sub-Agent Results Without Synthesis
BAD: Three sub-agents return results. Kai pastes all three into the conversation without summarizing.
WHY: Dan gets 2000 tokens of raw output instead of 200 tokens of synthesis.
RULE: After receiving sub-agent results, synthesize into 3-5 bullet points for Dan. Keep the raw results in your own context only if needed for follow-up.

---

## Session Lifecycle

### Session Start
Kai handles directly (lean -- 3 Linear queries max):
1. Read APM-2 handoff
2. List ONEMO In Progress + Todo
3. Orient and propose focus

### During Session
Delegate aggressively. Common patterns:
- Dan asks "what does X do?" --> spawn research agent
- Dan says "review the PR" --> spawn code review agent
- Dan says "check if the build passes" --> spawn verification agent
- Dan says "update all references to Y" --> spawn bulk operation agent
- Dan says "audit the board" --> spawn board audit agent

### Session End
Kai handles directly:
1. Update APM-2 with handoff notes
2. Comment on in-progress issues
3. 3-5 line summary to Dan

---

## Quick Reference Card

```
TASK TYPE          | DELEGATE? | MODEL      | PARALLEL OK?
-------------------|-----------|------------|-------------
Strategy/decisions | NO        | --         | --
Dan conversation   | NO        | --         | --
Single Linear query| NO        | --         | --
Quick file read    | NO        | --         | --
Research (multi)   | YES       | Opus 4.6   | YES (if independent)
Code review        | YES       | Opus 4.6   | YES (split by area)
Verification       | YES       | Sonnet 4.5 | YES
Bulk file ops      | YES       | Sonnet 4.5 | DEPENDS
Board audit        | YES       | Sonnet 4.5 | YES
Web research       | YES       | Opus 4.6   | YES
Design review      | YES       | @design-review agent | NO (one at a time)
Large file analysis| YES       | Opus/Sonnet| YES
```
