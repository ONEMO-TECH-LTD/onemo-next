# S58 Framer Parity P0 - AC-X-005 Chief-QA Gate

**Verdict:** PASS - bounded to `AC-X-005` at exact clean SHA `edbf1feb3dfcb8b54e96ed4001ae285993152d7b`.

**Not claimed:** no broad X-cluster/P0/product PASS; no Meta (`AC-J-008`) or Dan-final (`AC-J-009`) stamp.

## 1. Binding authority

- Completion Contract v1.4: 75 lines, SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`.
  - Completion Law: every atomic row needs named source, human-visible browser, Chief-QA, Meta, and Dan-final stamps; only the first four gate per-slice progress.
  - Build order: `AC-X-001..006` are P0 rows; `AC-J-*` gates continuously.
- AC-3: SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`.
  - `AC-X-005`: after any recoverable create-from-selection refusal, pressing Create again dispatches a fresh request and the dialog remains usable without Cancel/reopen.
  - `AC-J-005/006/007`: named-commit source proof, Dan-openable human-browser proof, independent QA verdict.
- P0 Chief-QA gate matrix: SHA-256 `02ac3a0c4bae4e79653bf13bb6967eff760f6f5cbc8aa16609391099a55d8c9e`.
  - Row law: force one lawful refusal, press Create again without Cancel/reopen, observe a new request and usable dialog; no wedged pending state or stale response reuse.
- Hard Contract v0: SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`.
  - Section 1 law 6: unsupported/stale mappings named-refuse without writing.
  - Section 8: transaction/refusal state must not be mistaken for commit success.
  - Section 11-G2 reload-marker law: recoverable pre-commit refusal cleans its marker; the one bootstrap marker cannot become a retry mechanism.
- Source Architecture: SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`.
  - Sections 6.3 and 6.5: each execution has fresh transaction evidence; invalid/live marker reuse refuses; recoverable refusal cannot strand marker state.

## 2. Exact source proof - AC-J-005

Range `79c72bf9d68e743f95ddd46a8a8833f4f6f92d95..edbf1feb3dfcb8b54e96ed4001ae285993152d7b` is test-only:

- `4980ea1`: adds the atomic preview-422 and execute-409 retry proof.
- `edbf1fe`: separates the two different refusal families with explicit Cancel/reopen. This does not weaken the row: each same-stage refusal is retried twice inside one preserved dialog without Cancel/reopen.
- No production source changed. Existing behavior is the intended result, so no speculative UI mutation was added.

Production dataflow rechecked at the exact SHA:

1. Every Create call rejects only while `busy`; otherwise it creates a new `commandId` and `transactionId`.
2. Every call performs a new preview GET carrying that fresh command ID before any execute POST.
3. A recoverable execute 4xx cancels the exact transaction marker and resets the resume target/phase.
4. The catch retains the current dialog, installs product error state, and resets `busy=false`.
5. The rendered Create button is disabled only while busy or when the name is empty.

The committed test proves:

- Preview: two 422 responses in one preserved dialog, two nonempty distinct command IDs, Create re-enabled after each refusal.
- Execute: two 409 responses in one preserved dialog, two nonempty distinct command IDs and transaction IDs, Create re-enabled after each refusal.
- Resume marker is `null` after each execute refusal.
- A test-only `data-retry-proof` sentinel survives each retry pair, proving the same dialog DOM node was not replaced.
- Exactly four intentional browser transport-console errors occur (`2x422`, `2x409`); page errors and failed requests remain empty.

## 3. Human-visible Chrome proof - AC-J-006

Independent system-Chrome headed runs in the isolated QA worktree:

- Exact committed test: `1/1 PASS`, `24.3s`, port `3075`.
- Independent screenshot-headed repeat: `1/1 PASS`, `24.9s`, port `3076`.

Dan-openable screenshots:

- Preview retry ready: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb/.playwright-cli/ac-x005-edbf1fe-preview-retry-ready.png`
  - SHA-256 `1424e7a4c46dd656bd595922c8c7a9660fb3f04297f182542208312840bfcda1`
- Execute retry ready: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb/.playwright-cli/ac-x005-edbf1fe-execute-retry-ready.png`
  - SHA-256 `804d47c59d3b26b8215b9e9797a51c374c374bf4dfebd2c07521f47a5473f274`

Both show the real selected page behind the modal, product-language refusal copy, the dialog still open, and Create visibly enabled for a retry.

## 4. Adversarial checks

- Identity: preview command IDs are unique; execute command IDs and transaction IDs are unique.
- Stale response: the second action cannot reuse the first response because the observed request identity changes.
- Dialog usability: same-node sentinel survives; Create is enabled after both first and second refusals.
- Marker lifecycle: recoverable execute refusals leave no resume marker.
- Console/network: only the four deliberately fulfilled HTTP errors appear; zero page errors and zero request failures.
- Scenario isolation: Cancel occurs only between preview-family and execute-family proofs, never between the two retries being certified in either family.

Mutation-direction note: a temporary `busy=false -> true` catch mutation was structurally correct, but two headed mutation runs failed earlier during an unrelated cold `/authoring-e2e` page-list read and never reached the refusal seam. Those reds are excluded from evidence; the source was restored exactly. Test sensitivity is instead established by the committed assertions on enabled state, same-node identity, distinct request IDs, and cleared marker, plus the direct source chain from catch `busy=false` to the button's `disabled` expression. This limitation does not weaken the two independent exact-SHA headed passes.

## 5. Static and deslop gates

- `npm run typecheck`: PASS.
- Full default Vitest: `54 passed / 1 declared-skipped files`; `461 passed / 10 declared-skipped tests`.
- Scoped ESLint on `tests/e2e/react-figma-authoring.spec.ts`: PASS, zero findings.
- `git diff --check`: PASS.
- Exact checkout remained Git-clean at `edbf1feb`.

`o-deslop --sweep` judgment after a full `653/653` E2E read:

- KEEP the two isolated refusal scenarios: deliberate atomic evidence, not a parallel product implementation.
- KEEP the test-only same-node sentinel: no production attribute or state owner was added.
- KEEP the exact four transport-console assertions: they prove no extra browser error escaped the intentional refusals.
- Zero new dead, zombie, dormant, duplicate, over-abstracted, stale-doc, TODO/HACK/FIXME, or production-facing residue findings.
- Pre-existing legacy `WriteOp` cemetery remains outside this row and `KEEP-FLAGGED` under `AC-J-030..032`; nothing was deleted.

One earlier ignored undo-transaction residue was preserved, not deleted, in reversible quarantine:
`/Users/daniilsolopov/Dev/onemo-dev/.qa-quarantine/s58-chiefqa-edbf1feb-20260713/`.
The authoritative worktree has no runtime files under the component `.onemo` directory after cleanup.

## 6. Stamp disposition

- `AC-J-005` source proof: PASS at exact `edbf1feb3dfcb8b54e96ed4001ae285993152d7b`.
- `AC-J-006` human-visible browser proof: PASS, two headed Chrome runs plus two openable screenshots.
- `AC-J-007` Chief-QA: PASS, bounded to `AC-X-005`.
- `AC-J-008` Meta: PENDING designer verdict.
- `AC-J-009` Dan final: PENDING final-product sign-off.

**Final bounded verdict: PASS `AC-X-005`; route to Meta.**
