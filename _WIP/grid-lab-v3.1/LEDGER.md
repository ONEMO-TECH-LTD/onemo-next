# Grid Lab v3.1 — rolling ledger

Read this file plus the latest transcript segment after every compaction before touching code.

## 2026-08-13 — plan correction

- Clean worktree: `session62-task/s62-grid-lab-v3.1`, based on clean scaffold head `9cc65867`.
- Lead's engine branch is archived donor-only; do not repair or cherry-pick it.
- Necessity review killed the 25-task decomposition.
- Active plan has three deliverables: T1 Engine, T2 Proof, T3 Integration.
- Execution starts with T2 fixture encoding to freeze the canon before engine implementation.
- Current increment: T2.1 Band 1 machine-readable fixtures and integrity check.
- Cadence: measured evidence → ledger → commit → push → Lead QA → next increment.
- No engine or UI implementation has started in this worktree.

### Source recovery

- Original analysis and rejected plan: `/Users/daniilsolopov/Dev/onemo-dev/__TRANSCRIPT VAULT/codex/s62/pixel-grid-pixel/2026-08-13/6-s62-pixel-grid-pixel--12-13.md`.
- Lead's rebuild failure and completed selection walkthrough: `/Users/daniilsolopov/Dev/onemo-dev/__TRANSCRIPT VAULT/claude/s62/lead/2026-08-13/_day.md`.
- Selection canon donor: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s62-grid-canvas/_WIP/grid-engine-v3/selection-examples/` plus `grid-laws.md` L20 and `grid-brief.md`.

### Next action

Stop at the T2.1 gate and wait for `@s62-lead` QA. Do not encode Band 2 until QA clears this increment.

## 2026-08-13 — T2.1 Band 1 fixture increment

### Changed

- Replaced the rejected 25-task plan with the governing three-task plan.
- Added six Band 1 machine-readable cases: five expected membership cases across five shapes and one duck counterexample.
- Copied the six canon screenshots into the fixture package and recorded SHA-256 provenance.
- Added an integrity checker for unique IDs, source files, image hashes, Band 1 predicates, canon-grounded site constraints, and counterexample references.
- Kept selection facts outside neutral-engine membership: gravity/tight-wrap/availability are fixture annotations for the later selection layer.

### Measured evidence

Command:

```text
node --check _WIP/grid-lab-v3.1/fixtures/selection/check-fixtures.mjs
node _WIP/grid-lab-v3.1/fixtures/selection/check-fixtures.mjs
git diff --check
```

Output:

```text
Band 1 fixture cases: 6
Expected membership cases: 5
Counterexamples: 1
Unique shapes: 5
Verified screenshots: 6
Verified outlines: 6
Band 1 fixture integrity: PASS
```

### Correction during the increment

- The first checker run found all outline paths were one directory short. Corrected the fixture paths and reran to PASS.
- Removed guessed normalized coordinate boxes before commit. Fixtures now use only canon-grounded semantic site constraints (`top-half`, `maximum-clearance-region`, `shape-centre-region`) rather than invented tolerances.

### Untouched

- No engine code.
- No scaffold/UI code.
- No archived Lead branch changes.
- No Band 2–4 fixtures.
