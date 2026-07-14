# S58 Framer Parity P0 - AC-A-003/004 Chief-QA Gate

**Verdict:** PASS - bounded to `AC-A-003` and `AC-A-004` at exact clean SHA `4abe687a231b54b42dff7f35ebbc7326b46951ac`.

**Not claimed:** no `AC-A-006`, `AC-A-008`, dialog, broad P0, Meta, or final-product verdict.

## 1. Binding clauses

- Completion Contract v1.4 SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`:
  - Completion Law lines 26-30: each atomic row requires source, human-visible, Chief-QA, Meta, and Dan-final stamps; only four pre-Dan stamps gate slice progress.
  - Build order lines 45-51: `AC-A-003/004` are independent P0 rows; `AC-J-*` gates continuously.
- AC-3 SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`:
  - `AC-A-003`: project-component double-click enters that component's authoring context.
  - `AC-A-004`: project-component context-menu Edit enters the same authoring context.
  - `AC-J-005/006/007`: exact source, Dan-openable browser, independent QA evidence.
- Entry-seam baseline SHA-256 `76541a76f29586a1fabb9605ba5be3a9bdf9e29d2223860319050bbd0eea34d8`:
  - Existing project component, not created in the measured test.
  - Both entry gestures must resolve identical breadcrumb name/file and rendered component ID.
  - No editor reload, wrong-file status request, or legacy gallery fallback.
- Hard Contract v0 SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`:
  - Section 6: Edit Component enters the same infinite canvas scoped to one component.
  - Section 11/G2: selection -> named component -> same canvas; no fixed-board remount.
- Source Architecture SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`:
  - Section 5.1: exact project-sidecar identity remains source-root scoped.
  - Section 11/G2 one-canvas boundary: one persistent component context; no parallel fixed-board host.

## 2. Source proof - AC-J-005

Exact commit: three files, `87 insertions / 1 deletion`.

- `page.tsx`: adds `data-component-file={editingComponent.file}` to the existing breadcrumb. It exposes the sole page-owned identity; it creates no second state owner or alternate navigation path.
- E2E: adds one atomic preinstalled-component equivalence test.
- `ERRORS.md`: records cold-shell readiness failures and the accepted read-only setup retry boundary.

Full reads completed:

- `tests/e2e/react-figma-authoring.spec.ts`: `732/732`.
- `ComponentCanvas.tsx`: `321/321`.
- `ERRORS.md`: `157/157`.
- Entry baseline: `28/28`.
- Changed page seam plus its `ComponentsRail`, `editingComponent`, context-menu, breadcrumb, and `ComponentCanvas` callers rechecked at the exact SHA.

Identity chain:

1. `ComponentsRail` double-click passes the selected `DsComponent` to `onEdit`.
2. Context-menu Edit passes the same `DsComponent` to the same `setEditingComponent(c)` owner.
3. `editingComponent.file` drives both breadcrumb `data-component-file` and `ComponentCanvas.file`.
4. `ComponentCanvas` requests component status only for that file, resolves its exact export, and renders graph-owned `definition.id` as `data-component-id`.
5. No second component-entry state owner or legacy gallery render exists in this path.

Fixture boundary:

- `AuthoringE2EButton.tsx` is installed before Next starts; the measured test never creates a component.
- A setup-only source import establishes its sidecar authority, then Home returns to the rail.
- Document/status counters reset after setup and before the two single-shot entry gestures.

## 3. Human-visible Chrome - AC-J-006

Fresh detached worktree:
`/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a003-4abe`

Truthful jail root: `EDITOR_FS_ROOT=/Users/daniilsolopov/Dev/onemo-dev`.

- Untouched committed headed test: `1/1 PASS`, `31.9s`, port `3083`.
- QA exact-ID + screenshot headed pass: `1/1 PASS`, `18.8s`, port `3084`.

Both entry paths visibly render:

- breadcrumb name `AuthoringE2EButton`;
- file `src/app/(dev)/react-figma-components/AuthoringE2EButton.tsx`;
- component ID `component_d53ab341115000a4`;
- the same Primary/Secondary authoring frames;
- no legacy gallery.

Dan-openable screenshots:

- Double-click: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a003-4abe/.playwright-cli/ac-a003-4abe687-double-click.png`
  - SHA-256 `3805ad592152d8487163fae0d6532fb27dcf0b59f1a6c75b80dee95b5237d934`
- Context Edit: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a003-4abe/.playwright-cli/ac-a004-4abe687-context-edit.png`
  - SHA-256 `ef0cb58a54ea93bcbc05f85230273f35992feb050f0b11a8eb4092cd3a9e581a`

Measured assertions:

- zero `/react-figma` document reloads across both measured gestures;
- only the exact fixture file appears in component-status requests;
- zero page or console errors at the truthful root;
- zero `[data-components-canvas]` legacy fallback nodes.

Environment disclosure: two earlier runs in the reused QA checkout failed before admissible proof, and one fresh run reached both entries but logged four 403s because QA incorrectly set `EDITOR_FS_ROOT=/private/tmp` for a worktree under `/Users`. Those runs are excluded. Correcting the jail to the actual containing root produced two clean headed passes; the product jail was never weakened.

## 4. Mutation sensitivity

Temporary mutation: context-menu Edit changed from `setEditingComponent(c)` to `setEditingComponent(null)` while double-click remained unchanged.

Result: headed test failed exactly at the second path after `30s`: `[data-authoring-canvas]` was absent after context-menu Edit. Double-click setup still succeeded. The mutation was restored with `apply_patch`; exact Git status returned clean.

This proves the test detects entry divergence rather than accepting any already-visible component canvas.

## 5. Static, deslop, and cleanup

- Typecheck: PASS.
- Full default Vitest: `54 passed / 1 declared-skipped files`; `461 passed / 10 declared-skipped tests`.
- E2E ESLint: PASS, zero findings.
- `git diff --check`: PASS.
- Full `page.tsx` ESLint remains pre-existing red: `12 errors / 11 warnings`; none is on the changed line. No full-page lint-clean claim is made.
- Exact worktree clean at `4abe687a231b54b42dff7f35ebbc7326b46951ac`.
- Fixture baseline restored to only tracked `.gitkeep`; no sidecar/component/runtime residue.

`o-deslop --sweep` disposition:

- KEEP `data-component-file`: direct derivation from the sole state owner; useful exact identity evidence, no duplicated state.
- KEEP setup import: establishes authority for an already-installed component; it is not a hidden create path.
- KEEP Set-based status-file assertion: duplicates are irrelevant; any different file still fails.
- Non-blocking cleanup note: `tokenResponses.length = 0` after setup is redundant because that array is not read again in this test.
- Zero new production dead/zombie/dormant/parallel entry code, legacy writer revival, TODO/HACK/FIXME, or hidden gallery path.

Failure artifacts were moved intact, never deleted, to:
`/Users/daniilsolopov/Dev/onemo-dev/.qa-quarantine/s58-chiefqa-a003-4abe-20260713/`.

## 6. Stamp disposition

- `AC-A-003`: `AC-J-005/006/007` PASS.
- `AC-A-004`: `AC-J-005/006/007` PASS.
- `AC-J-008` Meta: PENDING.
- `AC-J-009` Dan final: PENDING final product.

**Final bounded verdict: PASS `AC-A-003` and `AC-A-004`; route both to Meta.**
