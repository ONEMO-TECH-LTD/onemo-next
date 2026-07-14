# S58 Framer hard-contract synthesis ledger

**State:** ACTIVE
**Owner:** s58-qa, evidence synthesis only
**Final single writer:** s58-lead when reachable
**Build authorization:** NOT YET CONFIRMED - package assembly/verification approved only
**Latest QA gate:** source architecture `PASS`; Designer Meta `PASS`; Expert G0 second pass closed 2/3 live blockers; Expert C5 corrected; current-editor Chrome click-through completed; own-artifacts self-review completed; awaiting explicit Dan authorization before G1-Foundation build starts.

## Required inputs

- [x] `@s58-engineer`: revised 636-line source architecture fully read; SHA-256 `a28638e60be900ee4feb5b2b4c0594a5aa0f3e5978c10fb48534a16a071fc183`; source claims checked against clean baseline `804ffe7`; QA verdict is `PASS`.
- [x] `@s58-expert`: updated 135-line domain contract fully read/reconciled; Reset Override, typed source-property membership, Hover/Pressed implicit state wire, connector drag-pickup, remaining asset-insert blocker, and phase map received.
- [x] `@s58-designer`: 79-line design/behavior acceptance layer and 130-line Meta reconciliation fully read; V1-V10/S1-S9 PASS against passed architecture; M1-M4 recommended folds; C5 identified and now corrected.
- [x] `@s58-qa`: authenticated Playwright ledger, full source review, solution proposal, file/test impact map.
- [x] Hard contract draft: `s58-framer-component-authoring-HARD-CONTRACT-v0.md`, 468/468 lines, SHA-256 `52bd1c5b8b924907e3a6cf9ad2c32181fe143233bd04f45b9fbbe21ab7f048fd`; architecture PASS, Designer Meta PASS, Expert G0 second-pass evidence, Expert C5 correction, and live seven-tab state-board precision fix integrated. Dan's package-assembly approval is recorded; explicit build-start authorization remains pending.
- [x] `@s58-expert`: C5 corrected — semantic variant/compiler assertions moved from Expert §E G1 row to G2.
- [x] `@s58-qa`: current pre-rebuild editor click-through completed in live Chrome/Playwright. Crash-on-select was not reproduced on Project `Component` or Global `DemoButton`; console stayed at one baseline React hydration mismatch with no new select-action errors/warnings; live UI confirmed fixed hardcoded state board and narrow drag-to-wire model.
- [x] `@s58-qa`: own-artifacts self-review completed in `s58-framer-own-artifacts-self-review-qa.md`; no stale hard-build authorization overclaim found; architecture PASS still holds after C5, Designer Meta PASS, Expert G0 closures, and live click-through.
- [ ] `@s58-lead`: finish no-slop package assembly, verify current Chrome/live-editor state, run artifact deslop classification, then obtain explicit Dan build authorization before any G1 handoff.

## Binding source evidence

- Current source-review checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Current live runtime surface verified 2026-07-11: `http://localhost:3025/react-figma` served from `/Users/daniilsolopov/Dev/onemo-dev/onemo-next`
- Independent QA evidence: `s58-framer-extraction-qa-ledger.md`
- QA architecture/code review: `s58-framer-clone-adversarial-qa.md`, sections 10-13
- Expert Framer evidence: `s58-framer-extraction-ledger.md`
- Designer evidence: `s58-framer-extraction-designer-ledger.md`

## Conflict rules

1. Current source beats summaries and prior blueprint claims.
2. Directly operated Framer behavior beats familiarity or inference.
3. Unverified Framer behavior stays an evidence gate or explicit ONEMO product decision.
4. No lane may close its own finding without QA/Meta verification.
5. No implementation phase starts without its named model, test, behavior, and recovery gates.

## Pending synthesis sections

### A. Canonical model and source authority

Engineer candidate corrections to QA proposal:

- One graph store per editable source root, merged only at API read time.
- Source preconditions are per-file raw-byte SHA-256 maps, not one component hash.
- Inherited interaction removal is an `InteractionOverride` tombstone, not a runtime Reset action.
- Detach removes `ComponentInstance` identity; undo journal preserves its prior state.
- Preview sessions are transient runtime state, not persisted graph entities.
- Source positions are accelerators only; identity re-resolves through structural fingerprints and refuses ambiguity.

Engineer correction set is accepted. The prior four QA blockers are now resolved:

- Tracked sidecars persist logical root identity only; root paths resolve at runtime through `RuntimeRootRegistry`.
- Variant override membership is typed stable `SourcePropertyRef` membership; values remain source-owned.
- G1 excludes semantic create/rename/duplicate/delete variant commands until G2 compiler proof exists.
- Crash-consistency now has a `DurableFileInstaller` and bounded failure model.

### B. Framer behavior contract

Expert contract received and reconciled. Latest correction: override MEMBERSHIP is typed stable `SourcePropertyRef` membership plus detached state; override VALUES stay TSX/CSS-owned. Reset Override is UI-observed behavior modeled as an `InteractionOverride` tombstone plus `reset-interaction-override` command, not a runtime edge action. Expert second pass closed Hover/Pressed creation+auto-wire and connector drag-pickup. Hover/Pressed wire is implicit state lineage, not a phantom explicit `InteractionEdge`. Remaining v1 G0 blocker is asset-to-canvas insert end to end for G4, plus Dan decision on drag-insert parity.

### C. ONEMO/Figma interaction and visual contract

Designer input received: `s58-team-contract-design-acceptance-designer.md`.

- V1-V10: zero Framer tokens, one ONEMO accent, approved icon sources, Option B segmented controls, chip/ghost/selection/wire/type semantic parity.
- S1-S9: selection ladder, overlay visibility, inspector structure, interaction anatomy, context menus, wire geometry, real preview, variant lifecycle, delete guard.
- U1-U8: New Event, badge rule, connect gesture, state creation, Spring surface, wire overlap, handle count, drag feel.
- Meta requires execution-backed geometry/DOM/computed-style evidence, both-state probing, byte round trips, clean repos, per-phase screenshots, and U-item closure.

Designer Meta reconciliation is complete and PASS. P0-P6 are mapped to G0-G5; old P0 board stabilization is superseded by G1 Foundation/G2 replacement; straight-wire law supersedes older corridor-routing criteria.

### D. Commands, transactions, migration, and undo

Engineer candidate protocol received: deterministic multi-root locks; immutable snapshots; pure command validation; staged filesystem; parse/semantic/projection assertions; prepared journal with byte preimages; sibling temp-file renames; sidecars last; rollback verification; restart recovery; revisioned undo/redo; content-addressed history blobs.

Engineer protocol fully read. Cross-root coordinator, Git lifecycle, instance override removal, deterministic anchors, Cycle block, quota state, and durable install semantics are now accepted by QA.

### E. Exact file and test map

Engineer confirmed QA's main boundaries and expanded the backend into types/schema/store/migrations/projection/commands/compiler/transaction/history. Source/route/test conventions and the corrected low-level operation mapping were verified against baseline `804ffe7`.

### F. Phase gates and quota-safe handoff

Engineer reports less than 10% of the 5-hour quota remaining and no callable quota value. Durable architecture and resume protocol exist. QA accepts G1-Foundation only as graph/store/transaction/classification work; semantic create/rename/duplicate/delete variant commands wait for G2 compiler/round-trip proof. G2/G3 no longer block on Hover/Pressed creation or connector pickup evidence.

G1-Foundation build is not yet authorized. If Dan explicitly authorizes build, only G1-Foundation may start; no bulk multi-phase build.

### G. Open decisions for Dan

Open Dan decisions before build/later phases: explicit G1 build authorization and proposed Engineer ownership, asset-to-canvas insert manual Chrome/Framer verification vs product decision, drag-insert parity, legacy multi-axis conversion UX, later-phase expansion beyond G1, and performance budgets.

## Delivery state

- Engineer: proposed Builder for G1-Foundation only after explicit Dan authorization; formal architecture QA `PASS` is in `s58-framer-source-architecture-qa-verdict.md`.
- Expert: final contract input delivered and reconciled; C5 corrected; no product edits.
- Designer: acceptance input complete; Meta reconciliation `PASS` in `s58-framer-hard-contract-input-designer.md`.
- Lead: architecture PASS and Designer Meta PASS received; package assembly/verification approved; explicit Dan build authorization still pending.

## Build quality requirements

- Every phase must run Builder self-review, independent QA, Meta/design-fidelity review, then Dan gate.
- `/o-deslop` is required at phase/milestone boundaries as a whole-tree cemetery sweep/review, not a per-diff simplifier. Candidate removals need evidence; destructive cleanup needs Dan-approved kill list.
- UI behavior requires Chrome visual/clickthrough evidence plus code/source parity. Screenshots, DOM/geometry/computed-style probes, console/network checks, tests, and two-repo cleanliness are required before any Dan-facing done claim.
