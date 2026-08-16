# Grid v3.2 Codex execution brief

## Role and outcome

`@s62-grid-exec` is the sole builder. `@s62-grid-meta-qa` is QA. Redeem v3.2 independently from
the first working engine. v3.3 is donor/example only when a named task proves a mechanism is
necessary and v3.2 lacks it.

This worktree begins from exact code commit `60656152e3af1469bb0cab889f880e50e4e762aa`.
Do not copy, cherry-pick or reproduce the dirty Claude `judgement.ts` edit.

## Authority order

1. Dan's captured direct words.
2. The two Dan-designated briefs below.
3. Compatible R3 mathematics as technical reference only.
4. Prior plans, reports, frames and engine output as evidence only.

Never turn an inference, observed engine answer, adjudication frame or Claude restatement into a
product rule. No questionnaire. A reversible technical choice is engineering-owned and proved by
execution; it is not attributed to Dan.

## Mandatory full hydration — no edits before completion

Read each named file completely. For any file over 200 lines, read in chunks and keep a temporary
finding ledger. Then read the complete code surfaces listed below, including every export,
immediate caller and test.

### Exact conversation context

- `/Users/daniilsolopov/Dev/onemo-dev/__TRANSCRIPT VAULT/codex/s62/grid-meta-qa/2026-08-16/_day.md`
- `/Users/daniilsolopov/Dev/onemo-dev/__TRANSCRIPT VAULT/codex/s62/grid-qa/2026-08-16/6-s62-grid-qa--12-13.md`
- `/Users/daniilsolopov/Dev/onemo-dev/__TRANSCRIPT VAULT/codex/s62/grid-qa/2026-08-16/7-s62-grid-qa--13-14.md`

### Product authority — read first and govern from these

- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/logic-spec-optimum.md`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/gpt-pro/ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture.md`

### Execution contract

- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-grid-meta-qa-be3df7f9/_WIP/grid-engine-v3.2/FINAL-CONSOLIDATED-PROPOSAL.md`
  - binding plan revision: `2e6bd212`;
  - read T0–T9 in full;
  - execute only T1 in this block.

### Required adversarial evidence

- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/qa-v3.2-code-logic-audit.md`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/qa-v3.2-final-conformance-verdict.md`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/qa-v3.3.1-adversarial-audit.md`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/T0-AUTHORITY-LEDGER.md`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.2/_WIP/grid-engine-v3.2/T0b-CODE-vs-LEDGER-AUDIT.md`
- `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-engine-v3.3/_WIP/v3.3/ASSEMBLY/AUDIT/R9/round9-meta-T0-close.md`

The last three files are untrusted evidence, not authority. The halted Meta draft found that
ledger rows 3.1 and 6.7a cite Dan turns absent from the vault. Do not repair or extend that ledger
in this worktree and do not use those two citations as direct rulings. Resolve T1 from the two
designated briefs and the governing plan.

### Code — read completely at this worktree's base

- `AGENTS.md` and `OWNER.md`;
- `src/lib/grid-engine/` — every source file and every test;
- `src/app/(dev)/grid-engine/GridCanvas.tsx`;
- `src/app/(dev)/grid-engine/page.tsx`;
- `src/app/(dev)/grid-engine/page.module.css`;
- relevant scripts in `package.json` and any config those scripts load.

Read the baseline code before using any report's description of it. Reports are claims; current
bytes are evidence.

## Current task — T1 only

The worktree already satisfies the restore boundary: it was created directly at `60656152`, so
there is no dirty edit to discard and no checkout-forward operation to perform here.

Minimal diff:

1. Run and record the relevant baseline suite before editing.
2. In one bounded code change, remove only the condemned policy present at this base:
   - `targetMagnets` and its ranking use;
   - sparse-spread ranking;
   - count-direction flip and fullest-per-footprint preference;
   - `sizeFloorMM` / `prevCount` cross-band pruning;
   - `maxOffered` and `maxTestedMM` policy;
   - old out-counting policy;
   - assertion-free probe/debug residue named by the plan.
3. Remove only imports/helpers made dead by that subtraction.
4. Do not change the exact geometry kernel, bridge, guards, fixtures, expected answers or UI.
5. Run the same suite. Record every changed answer; do not bless or re-pin it.
6. Self-audit the diff against T1, commit one local snapshot, and stop for QA.

If a condemned symbol is absent at this base, record that fact; do not create replacement code.
If removing an item requires changing preserved geometry/bridge/UI, stop and report the exact
dependency instead of widening the diff.

## T1 acceptance

- Worktree provenance names exact base `60656152` and current branch.
- Only the bounded selector-policy subtraction and its direct orphans changed.
- Preserved geometry, bridge, guards, fixtures and UI are byte-unchanged.
- Source search finds no remaining condemned symbol/path that exists at this base.
- Baseline and post-change suite outputs are recorded honestly, including failures and moved
  answers.
- One local implementation commit; no push, merge, T2 work, new plan or new authority document.

## Required handoff

Send QA:

- commit SHA;
- changed-file list;
- exact baseline/post-suite commands and outputs;
- changed-answer list;
- preserved-surface byte/diff proof;
- any unresolved dependency.

Then stop. QA independently inspects the code and execution. Meta follows only after QA clear.

## Explicitly forbidden

- Claude as builder or closing authority;
- importing any dirty/superseded Claude code;
- a new proposal, questionnaire or T0 rewrite;
- v3.3 architecture adoption or package transfer;
- parallel/new selector beside the existing one;
- eleven commits for eleven findings;
- fixture repinning, fallback manufacture or calling T1 conformant;
- push, merge, deletion outside the bounded T1 diff, or build-ahead.
