# S58 Framer reset: teammate dispatch record

**State:** DISPATCHED from this reviewed draft on 2026-07-10 13:32 BST. Build remains held at the architecture gate.

**Authoritative artifacts:**

- `__qa-dispatch/s58-framer-extraction-qa-ledger.md`
- `__qa-dispatch/s58-framer-clone-adversarial-qa.md`
- Current expert blueprint: `__qa-dispatch/s58-framer-clone-BLUEPRINT.md`

## 1. To @s58-lead

```text
[S58-QA REWORK + SOLUTION PROPOSAL — HOLD BUILD]

Independent authenticated Playwright D1-D12 pass and current-source review are complete. Verdict on the 228-line expert blueprint: REWORK, not sign-ready, no build from it.

Decisive conflict: the blueprint says keep the whole engine/model and present free variants over the existing multi-axis shape. Current source cannot represent stable flat variants, authored X/Y, primary/override lineage, inherited interaction resets, generalized edges, folders, detach/replace, or preview sessions. Designer convergence does not override source evidence.

Read the full QA artifact, especially sections 10-12:
/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-clone-adversarial-qa.md

Proposed solution: AuthoringGraphV1 sidecar for editor-only identity/geometry/lineage/folders + SourceProjection parsed from TSX/CSS + guarded CompilerAdapter/transaction boundary. Keep byte-safe parsers/writers/guards; modify or replace the authoring model and high-level operations.

Proposed ownership after Dan approval: @s58-engineer (Codex) Architecture Owner + Builder in isolated worktree; @s58-qa independent QA; @s58-designer Meta behavior/visual gate; Dan final sign-off. @s58-expert contributes Framer evidence but is not the revision or implementation authority.

Do not transition to Building. Read back: (1) current gate, (2) canonical-model change, (3) proposed actor ownership, (4) any conflict you see. Report to Dan only.
```

## 2. To @s58-engineer

```text
[S58 CODEX ARCHITECTURE OWNER — HOLD PRODUCT EDITS]

You are the recommended Architecture Owner + Builder. Do not start product edits yet.

Read sections 10-12 in full:
/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-clone-adversarial-qa.md

First deliverable is a source-backed architecture revision:
1. Replace “whole engine/model stays” with a seam-by-seam Keep / Modify / Replace / Build audit.
2. Introduce a canonical flat-variant authoring graph with stable IDs, geometry, primary/override lineage, interactions, instances, and folders.
3. Correct the build map: make-component != create-component; folder/detach/replace ops do not exist; set-connector cannot express observed override semantics.
4. Add persistence, revision/hash conflict, atomic transaction, rollback, undo, migration, and compiler round-trip contracts.
5. Reorder to evidence -> model/compiler proof -> thin vertical slices.
6. Label drag insert, New Event, badge, state creation, and connector pickup as open evidence gates, not exact observed behavior.

Work only in your isolated worktree. Return the revised architecture plus a file/test impact map with every QA finding mapped to an exact section. No “sign-ready” claim and no code until QA, Meta, and Dan approve the architecture gate.
```

## 3. To @s58-expert

```text
[S58 EXPERT EVIDENCE HANDOFF — CODEX OWNS REVISION]

QA completed its own authenticated Framer pass and reviewed the 228-line blueprint plus all designer artifacts. Trigger/wire corrections are good, but the architecture remains REWORK.

Read sections 10-12:
/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-clone-adversarial-qa.md

@s58-engineer owns the architecture revision and later implementation. Your role is evidence/domain challenge: provide exact Framer observations, flag behavior the Codex revision misses, and correct any misreading of your evidence. Do not defend “multi-axis under the hood” against current source gaps, and do not independently declare the gate sign-ready.

Return a concise readback of which claims are observed, inferred, or still unverified. Route architecture conflicts to lead/Dan, not lateral closure.
```

## 4. To @s58-designer

```text
[S58 META GATE NOTICE — NO ACTION UNTIL BUILD SLICE]

QA independently confirmed your behavioral corrections but rejected the remaining “keep whole engine/model” architecture against current source.

When a Codex builder produces the first complete slice, your Meta gate is behavior and visual semantics only: Framer-recognizable interaction model rendered entirely in ONEMO/Figma language. Do not close architecture/source-model findings on visual convergence.

Reference sections 10-12:
/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-framer-clone-adversarial-qa.md
```

## Dispatch order after Dan approval

1. Send lead message and require readback.
2. Send Codex engineer the architecture assignment; hold product edits.
3. Send expert the evidence/advisory handoff.
4. QA reviews the Codex revision; designer performs Meta behavior/visual review; Dan signs the architecture gate.
5. Send Codex engineer build authorization only after that gate.
6. Verify each recipient through `kai-msg read`; no unverified “sent” claim.

## Delivery verification

- `@s58-lead`: delivered through Claude Remote Control. Lead identified the QA result as a substantive architecture conflict with the former designer sign-off and began independently checking the load-bearing source claims before reporting to Dan.
- `@s58-engineer`: first attempt was safely held because the active input field was occupied during transcript hydration. Second non-interrupting attempt delivered through tmux. Engineer recorded the explicit Architecture Owner remit, no-product-edit constraint, sections 10-13, canonical graph/compiler/transaction requirements, and file/test-map deliverable in its working ledger; full artifact reading is active.
- `@s58-expert`: delivered through Claude Remote Control. Expert explicitly accepted the evidence/domain-only role, the observed/inferred/unverified requirement, the instruction not to defend the old architecture, and the prohibition on declaring sign-ready; full sections 10-13 reading is active.
- `@s58-designer`: intentionally not dispatched yet. Its Meta gate begins only after the architecture passes QA and an executable slice exists.
- No product build authorization was sent. No teammate was told the architecture or implementation was complete.
