# AC-X-001 / AC-X-002 / AC-X-003 Chief-QA atomic gates

| Row | Chief-QA verdict | Remaining stamp |
|---|---|---|
| `AC-X-001` | PASS at exact target | Meta `AC-J-008`; Dan final `AC-J-009` |
| `AC-X-002` | PASS at exact target | Meta `AC-J-008`; Dan final `AC-J-009` |
| `AC-X-003` | PASS at exact target | Meta `AC-J-008`; Dan final `AC-J-009` |

**Exact target:** `0ad89f957866a530d3c52caa1320644c381246c1`  
**Canonicalization source fix:** `71394ebfbef67b633666b7b2697435976d4f83ef`  
**Refusal/durability coverage:** `1a2194a`  
**Row state:** pre-Dan Meta stamp pending; Dan final stamp also pending; no P0 or product-completion claim

## Authority and clauses

- Completion Contract v1.4 SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`, especially binding law, stamp law, layer discipline, P0 allocation, and isolated-proof process.
- AC-3 SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`, exact rows `AC-X-001`, `AC-X-002`, and `AC-X-003`.
- Hard Contract v0 SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`: §1 law 6; §4 source authority; §8 steps 1-12; §11/G2 one bounded import-bootstrap reload.
- Source Architecture SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`: §§5.1.1, 5.2, 6.2, 6.3, 6.5, and 10.
- P0 gate matrix SHA-256 `02ac3a0c4bae4e79653bf13bb6967eff760f6f5cbc8aa16609391099a55d8c9e`, rows `AC-X-001..003` and dependency order.

## Source proof

`parseComponentModelSnapshot()` now sends relative module-CSS imports through `canonicalCssModulePath(file, specifier)`. The helper normalizes slashes, joins against the owning TSX directory, and collapses lawful `.`/`..` aliases before dependency lookup. It does not resolve or weaken the root jail.

The canonical store-relative result then passes through the existing `RuntimeRootRegistry` containment, exact-file symlink refusal, and byte-hash path. A canonical target outside the root remains `../...` and refuses; an in-root symlink remains an exact canonical path and refuses at the no-follow jail. The production import tests call `importSourceFileToAuthoringStore`, not classify alone, and assert `{kind:'unsupported'}` plus absent sidecar, history, and transaction evidence.

## Independent row verdicts

### AC-X-001 — PASS

The committed route is installed before server start, imports a real CSS module, renders the target with the expected computed background, and exposes an exact `data-src` source anchor. Headed Chrome selects that element, submits create-from-selection, crosses exactly one bootstrap reload, and visibly resolves `AuthoringE2ECanonical` in the component canvas. This is the real dependency-bearing path, not the old dependency-free laboratory fixture.

### AC-X-002 — PASS

The extracted component retains `from '../authoring-e2e/AuthoringE2ECard.module.css'`, while the persisted sidecar key is canonical `src/app/(dev)/authoring-e2e/AuthoringE2ECard.module.css`. Its value equals SHA-256 of the exact CSS bytes and no persisted key contains `/../`. Out-of-root and symlink probes named-refuse through the production import API with zero durable evidence.

### AC-X-003 — PASS

The acceptance fixture is committed as a TSX + module-CSS dependency graph, installed by the marker-backed fixture wrapper before Next starts, selected through the real page/layer bridge, and exercised by a standalone atomic headed test. The broad create-to-undo scenario is supporting regression evidence only; it is not this row's certificate.

## Independent verification

- Isolated detached worktree: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb` pinned to exact `0ad89f9`.
- Atomic committed headed Chrome proof: PASS `1/1` in 36.3s on isolated port 3071.
- Independent screenshot-headed repeat: PASS `1/1` in 38.7s on isolated port 3072.
- Source screenshot: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb/.playwright-cli/ac-x002-0ad89f9-real-css-selection.png`.
- Result screenshot: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb/.playwright-cli/ac-x002-0ad89f9-canonical-authoring.png`.
- Focused source/import suite: 2 files, 59/59 passed.
- Default full Vitest rerun: 53 passed + 1 declared-skipped files; 458 passed + 10 declared-skipped tests in 33.26s.
- One earlier full run hit the unrelated V1 migration test's 20s contention timeout; the exact test passed alone in 3.7s and the clean default full rerun passed in 11.7s for that test. This is recorded rather than hidden.
- Typecheck: clean. Scoped row lint: zero errors, two unchanged `lib.ts` warnings. Full `page.tsx` lint retains 12 pre-existing React-rule errors outside the one-line dependency-array diff; no clean full-page lint claim.
- Cleanup: route, extracted files, sidecar fixture, marker, and generated route types absent after each run; exact QA checkout clean.

## Mutation and deslop

Reverting only `71394eb` made 3/59 intent tests fail: the lawful parent-relative component became `unsupported`, its CSS identity disappeared, and the symlink case stopped reaching the exact-file jail. Restoring the fix returned the checkout clean.

The repository `o-deslop --sweep` discipline was applied to the complete row scope. `canonicalCssModulePath` is a single-use helper but KEEP: it names the security/identity boundary and prevents the old parser expression from mixing canonicalization with lookup. The standalone E2E intentionally repeats browser telemetry/setup rather than sharing the broad-flow state machine; this preserves atomic traceability and failure isolation. No TODO/HACK/FIXME, hidden timeout fallback, duplicate parser, second jail, stale artifact, or dead new symbol was found. The pre-existing legacy `WriteOp` implementations remain `KEEP-FLAGGED` under `AC-J-030..032`; this row neither revives nor deletes them.

## Gate consequence

Chief QA stamps `AC-J-005` source proof, `AC-J-006` human-visible proof, and `AC-J-007` QA independently for `AC-X-001`, `AC-X-002`, and `AC-X-003` at exact `0ad89f9`. `AC-J-008` Meta remains required. No other row, P0 phase, or product completion is stamped.
