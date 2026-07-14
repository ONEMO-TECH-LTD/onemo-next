# AC-X-004 Chief-QA gate

**Verdict:** CHIEF-QA PASS · META STAMP PENDING · ROW NOT COMPLETE  
**Exact target:** `9d05613607d1e7c845a126cce4e223b78070c4b1`  
**Production fix:** `49b5ba4f9089df262b21b66014f22d05fdc4abe2`  
**Cold-proof stabilization:** `4f3b43fb0e3a0a0bce95274d488840dadcd328ac`  
**Evidence correction:** `9d05613607d1e7c845a126cce4e223b78070c4b1`

## Authority

- Completion Contract v1.4 SHA-256 `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`.
- AC-3 SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`.
- `AC-X-004`: a click or micro-drag on empty canvas cannot dereference a cleared pan gesture; pointer-up during a queued view update remains crash-free.
- P0 matrix SHA-256 `02ac3a0c4bae4e79653bf13bb6967eff760f6f5cbc8aa16609391099a55d8c9e`: zero console errors, reloads, crash overlays, or lost selection state.

## Source verdict

`page.tsx` snapshots `pan.current` plus pointer deltas before queueing `setView`. `onUp` may clear the ref without invalidating the queued calculation. There is no second pan-state owner or fallback path.

The committed E2E dispatches `pointerdown` → `pointermove` → `pointerup` synchronously in one browser task. Its cold-shell retry wraps the complete idempotent gesture, retains accumulated console/page errors, and accepts only a stable same-document transform update. It does not retry or clear a semantic error.

The initial `49b5ba4` test incorrectly required the always-mounted Next dev-tools portal to be absent. `9d05613` fixes the evidence boundary by checking the actual runtime-error surface. The portal remains present with `data-error="false"`, which is healthy Next dev behavior.

## Independent verification

- Isolated detached worktree: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x004-9d05613`.
- Typecheck: clean.
- Vitest: 53 passed + 1 declared-skipped files; 455 passed + 10 declared-skipped tests.
- Committed headed regression: 1/1 passed in 9.2s on isolated port 3063.
- Independent visible atomic gesture on isolated port 3065: same document `true`; navigation count `1 → 1`; canvas transform `300/70 → 302/71`; Next portal error `false`; blocking overlay `false`; console errors `[]`; page errors `[]`.
- Dan-openable screenshot: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-x004-9d05613/.playwright-cli/page-2026-07-13T10-29-20-885Z.png`.
- Mutation check: reverting only the production fix makes the committed regression fail; its captured page contains `Runtime TypeError`, `Cannot read properties of null (reading 'vx')`, and the application-error heading.
- Exact-SHA QA worktree restored clean after the mutation.

## Deslop

The production change is the minimum coherent fix: one immutable gesture snapshot, no new state, helper, abstraction, timeout, fallback, or adjacent cleanup. The browser retry exists only for observed cold Fast Refresh document replacement and preserves every captured error. No stale assertion or duplicate crash detector remains.

## Gate consequence

Chief-QA stamps `AC-J-005` source proof, `AC-J-006` human-visible proof, and `AC-J-007` QA for `AC-X-004` at this exact SHA. `AC-J-008` Meta remains required. This verdict does not stamp any other row, P0, or product completion.
