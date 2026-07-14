# AC-X-006 Chief-QA gate

**Verdict:** CHIEF-QA PASS · META STAMP PENDING · ROW NOT FINAL  
**Exact target:** `79c72bf9d68e743f95ddd46a8a8833f4f6f92d95`  
**Production mapping:** `71388ba497206c8ca222acd59b371628bb5c722a`  
**Evidence classification:** `79c72bf9d68e743f95ddd46a8a8833f4f6f92d95`

## Authority and clauses

- Completion Contract v1.4 SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`: product law, five-stamp law, layer discipline, P0 allocation, and isolated-proof process.
- AC-3 SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`: `AC-X-006` create-from-selection refusals use human product language and never expose raw internal codes as the primary message.
- Hard Contract v0 SHA-256 `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`: §1 law 6, §7 ONEMO/Figma presentation contract, §8 refusal/durability boundary, and §11/G2.
- Source Architecture SHA-256 `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`: §§6.2, 6.3, and 6.5.
- P0 gate matrix SHA-256 `02ac3a0c4bae4e79653bf13bb6967eff760f6f5cbc8aa16609391099a55d8c9e`: representative refusal, product-primary copy, diagnostics-only raw code.

## Source verdict

`presentCreateComponentFailure()` is the one presentation boundary for preview and execute failures. `CREATE_COMPONENT_SOURCE_UNSUPPORTED` and `SOURCE_PREIMAGE_STALE` map to explicit product copy. Unknown messages fall back by stage; backend detail is never promoted. A valid named code is retained separately as `diagnosticCode`.

`CreateComponentDialog` renders the product message in its `role=alert`. It renders the named code only inside a native, initially collapsed `details` element labelled `Technical details`. Name edits clear both message and diagnostic state. Preview and execute errors both pass through the same mapper; marker-issued uncertainty toasts also use product copy rather than the raw code.

## Independent visible proof

- Isolated detached worktree: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb`, pinned to exact `79c72bf`.
- Exact committed headed Chrome proof: PASS `1/1` in 20.1s on isolated port 3073.
- Independent screenshot-headed repeat: PASS `1/1` in 17.6s on isolated port 3074.
- Collapsed state: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb/.playwright-cli/ac-x006-79c72bf-product-copy-collapsed.png`.
- Expanded diagnostics: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x002-71394eb/.playwright-cli/ac-x006-79c72bf-technical-details-open.png`.
- The visible primary copy contains no raw code. Expanding Technical details reveals exactly `CREATE_COMPONENT_SOURCE_UNSUPPORTED`.
- Network evidence: exactly one preview request and one expected 422 response; the only console error is Chrome's expected 422 transport entry; zero page errors and zero failed requests.

## Static, mutation, and cleanup

- Mapping tests: 3/3 passed, covering both named codes and unknown raw detail.
- Default full Vitest: 54 passed + 1 declared-skipped files; 461 passed + 10 declared-skipped tests in 37.48s.
- Typecheck clean. Scoped new-file/E2E lint clean. Full `page.tsx` lint retains the known inherited errors outside this diff; no clean full-page lint claim.
- Mutation: forcing the primary message back to the raw code made both named-code intent tests fail with the received primary values `CREATE_COMPONENT_SOURCE_UNSUPPORTED` and `SOURCE_PREIMAGE_STALE`. Restoring the mapper returned the checkout clean.
- Marker-backed fixture cleanup removed the route and generated component/store evidence; exact QA checkout clean.

## Deslop

Repository `o-deslop --sweep` found no new cemetery candidate. The pure mapper is KEEP, not speculative abstraction: it is the single shared preview/execute trust boundary and is independently testable. The diagnostics state has one owner, all setters clear or populate it coherently, and the committed headed test is the only new visible refusal path. No raw-detail fallback, parallel mapper, dead state, TODO/HACK/FIXME, hidden retry, or stale artifact remains. Pre-existing legacy `WriteOp` cemetery stays `KEEP-FLAGGED` under `AC-J-030..032` and is untouched.

## Gate consequence

Chief QA stamps `AC-J-005` source proof, `AC-J-006` human-visible proof, and `AC-J-007` QA for `AC-X-006` at exact `79c72bf`. `AC-J-008` Meta and Dan-final `AC-J-009` remain pending. No other row, P0 phase, or product completion is stamped.
