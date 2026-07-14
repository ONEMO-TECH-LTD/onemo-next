# AC-A-006 Chief-QA Gate — Bounded PASS

**Date:** 2026-07-13  
**Chief QA:** `@s58-qa`  
**Row:** `AC-A-006` only  
**Verdict:** **PASS** for pre-Dan stamps `AC-J-005`, `AC-J-006`, `AC-J-007`; Meta `AC-J-008` and final Dan `AC-J-009` remain pending.

## Exact authority

- Product commit gated: `94e69f77d590649b0e410e378602a2614e585632` (`feat(react-figma): recover from empty component inventory`).
- Handoff correction: the routed string `94e69f7b03cca340523fcbb343b2d33fca8edb5d` does not resolve. Git history contains one unique `94e69f7` commit, the full SHA above. This gate binds only that real immutable commit.
- Completion Contract v1.4: `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`, lines 26–30 (five-stamp law), 49–51 (P0 allocation), and 71–72 (isolated proof/cleanliness).
- AC-3: `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`.
- Binding row: `AC-A-006` — “Shipped inventory always exposes at least one valid, reachable authoring path.”
- Continuous gates applied: `AC-J-005` source proof, `AC-J-006` human-visible browser proof, `AC-J-007` independent QA.

## Source proof — AC-J-005 PASS

Exact diff: two files, `48` insertions and `6` deletions.

- `src/app/(dev)/react-figma/page.tsx:2264-2289` turns the zero-component rail from explanatory text into an explicit empty state. With a selected design-canvas element it exposes `Create component from selection`; without one it exposes the disabled instruction `Select a page element first`.
- `src/app/(dev)/react-figma/page.tsx:3954` passes the existing `openCreateComponentDialog` callback and the existing selection/design-mode predicate into `ComponentsRail`.
- The new control therefore reuses the canonical selection-extraction dialog and its existing request path. It adds no blank-create state, command, route, component-status lookup, or legacy writer.
- `tests/e2e/react-figma-authoring.spec.ts:158-193` forces an empty component inventory, requires the enabled CTA, opens the existing `Create component` dialog, verifies the existing default name, cancels, and requires zero component-status requests, page errors, or console errors.
- The exact diff adds no `editor-write` call and no new backend file. Existing unrelated legacy writer calls elsewhere in the monolithic page remain outside this row and are not treated as A006 capability.

## Human-visible proof — AC-J-006 PASS

Isolated worktree:

`/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a006-94e69f7`

Committed headed certificate:

```text
EDITOR_FS_ROOT=/Users/daniilsolopov/Dev/onemo-dev PLAYWRIGHT_PORT=3085 \
npx playwright test tests/e2e/react-figma-authoring.spec.ts \
  --grep 'offers canonical extraction when the project component inventory is empty' \
  --headed --workers=1 --reporter=line

1 passed (30.5s)
```

Observed visible sequence: Components rail with no components → actionable `Create component from selection` CTA → existing `Create component` selection dialog → Cancel → dialog closes. No dead-end or fallback gallery appeared.

Dan-openable artifact:

`/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a006-94e69f7/.playwright-cli/ac-a006-94e69f7-empty-inventory-dialog.png`

SHA-256: `e7ceb54d04b0bbfa5a6e5f5d1b8d034b7cb89163205ff6935712d6a0aaadeae3`.

An additional QA-instrumented headed run on port `3086` passed `1/1` in `16.4s` and proved Cancel caused zero non-GET `/api/dev/editor-authoring` requests and zero `/api/dev/editor-write` requests. Those temporary assertions and screenshot hooks were removed with `apply_patch`; the product checkout returned clean.

## Mutation proof

QA temporarily changed only the empty-state button from `onClick={onEmptyExtract}` to `onClick={undefined}` and reran the same headed certificate on port `3087`.

Observed result: **FAIL**. The CTA remained visible but `getByRole('dialog', {name:'Create component'})` timed out because the canonical dialog never opened. This proves the row depends on the intended new reachability seam rather than a proxy assertion.

The mutation was reversed with `apply_patch`. Failure artifacts were moved reversibly to:

`/Users/daniilsolopov/Dev/onemo-dev/.codex-quarantine/s58-chiefqa-a006-mutation-2026-07-13/`

## Static and regression evidence

- `npm run typecheck`: PASS.
- Full Vitest from the exact clean SHA: `54` passed files + `1` declared-skipped file; `461` passed tests + `10` declared-skipped tests; `0` failed.
- `npx eslint tests/e2e/react-figma-authoring.spec.ts`: PASS.
- `git diff HEAD^ HEAD --check`: PASS.
- Product worktree `git status --short`: clean after every temporary probe was reversed.
- Honest lint boundary: whole-file lint on pre-existing `page.tsx` remains red at `12` errors and `11` warnings. None is on an A006-added line; this row does not claim the inherited monolith clean.

## `/o-deslop` judgment

- **KEEP:** the explicit empty-inventory CTA. It directly closes the reachable-entry dead-end required by `AC-A-006`.
- **KEEP:** `onEmptyExtract` and `canExtract` as thin rail inputs. They pass one existing page-owned state transition; they do not create a second owner or abstraction.
- **KEEP:** the committed atomic E2E. It tests the real user entry and absence of component-status fallback, not merely rendered text.
- No new TODO/FIXME/HACK marker, duplicate command path, dead helper, blank-create backend, or legacy writer was introduced.
- No unrelated cleanup is included. Pre-existing page-wide legacy writer cemetery and lint debt remain flagged elsewhere, not silently folded into A006.

## Bounded verdict

**PASS — `AC-A-006` satisfies `AC-J-005`, `AC-J-006`, and `AC-J-007` at exact SHA `94e69f77d590649b0e410e378602a2614e585632`.**

This does **not** stamp `AC-A-008`, `AC-B-021`, `AC-B-022`, `AC-H-012`, `AC-H-030`, any broader P0 phase, Meta, or final completion.
