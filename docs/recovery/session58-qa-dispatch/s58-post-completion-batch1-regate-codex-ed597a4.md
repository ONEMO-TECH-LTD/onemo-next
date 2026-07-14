# s58-qa Post-Completion Audit Batch-1 Re-Gate — ed597a4

Verdict: PASS

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- SHA verified: `ed597a4`
- Base of batch: `5099f12`
- Component library clean at start: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Diff/source review:
- Changed files only: `src/app/(dev)/react-figma/page.tsx`, `src/app/api/dev/editor/lib.ts`.
- D-1 confirmed in source: `setConnector` lookup now resolves public prop name via `propertyName ?? name`; already-aliased connector reaches the 409 idempotency path.
- D-2 confirmed in source: page-side `EditTarget` removed dead `{kind:'variant', name}` and the scope branch; axis/state/base remain. Server-side legacy `ScopedTarget {kind:'variant'}` remains intentionally in `lib.ts`, not page edit-target UI.
- D-4 confirmed in source: `addBooleanPropToComponent` uses shared `findComponentFn`.
- D-5 confirmed by repo grep: `DecomposedRule` appears only as an internal type in `lib.ts` and the local `decomposeRule` return type.
- F-A1 confirmed in source: shared `engineWrite()` checks `response.ok`, reads JSON `{error}`, toasts the server message, retries once only for HTML 404, and only reloads/refreshes board state when the write succeeds.

API/source probes:
- Probe script: `/tmp/s58-post-completion-batch1-api-probe.mjs`
- Result: 17/17 PASS.
- D-1 repro: switch-connect axis once -> 200; switch-connect same axis again -> 409 with `axis "size" is already a switch connector (already controllable)`; file byte-unchanged.
- D-2 regression: axis-scoped write produced `.base.size_lg { padding: 24px }`; semantic state-scoped write produced `.base[data-loading] { background-color: #eef2ff }`.
- D-4 regression: fresh `add-state loading` returned 200, wrote `loading?: boolean` plus `data-loading={loading || undefined}`, and model listed `loading` immediately.
- F-A1 setup: board fixture promoted and model had size axis.

Browser/client probes:
- Browser target: `http://localhost:3035/react-figma` from isolated checkout.
- Entered Components rail and double-clicked project fixture `BatchBoard`; component edit board opened with Base, `size=sm`, `size=lg`, state chips, `+ value`, and connector buttons.
- Failure path: typed invalid value `bad value` and clicked real `+ value` button. The visible toast rendered exact server message: `invalid value: bad value`. The request logged expected 422 resource error; no silent no-op.
- Success path: typed valid value `xl` and clicked real `+ value`; source updated to `size?: 'sm' | 'lg' | 'xl'`, model showed values `[sm, lg, xl]`, and board UI showed `size=xl` plus `sm, lg, xl`.
- Retry-once path: intercepted one `add-variant-value` request for `xxl` as HTML 404, then let retry hit the real server. Source/model/UI showed `xxl` exactly once (`'xxl'` count = 1); this covers the double-write edge for a non-idempotent write.

Typecheck:
- `npm run typecheck` with generated fixtures present -> 0.

Known noise / caveats:
- Baseline browser console includes the known React hydration mismatch for `data-eng-id` on `mother-v2`; not introduced by this batch.
- Negative/retry probes produce expected browser resource errors for 422 and the synthetic HTML 404.
- Dev-server terminal printed stale require-context warnings for older deleted `qa-i6-round3/*` QA fixture names during components-canvas compile. The current batch fixture rendered and was cleaned; final git/typecheck checks were clean.
- Playwright wrapper `~/.codex/skills/playwright/scripts/playwright_cli.sh` hit npm `ETARGET @playwright/cli@0.1.17` mid-run; using pinned `npx --package @playwright/cli@0.1.16 playwright-cli` worked. No product impact.

Cleanup:
- Throwaway fixtures created under `src/app/(dev)/react-figma-components/qa-audit-batch1/`.
- Throwaway fixtures removed after proof.
- Post-clean `npm run typecheck` -> 0.
- Post-clean `git status --short` -> empty in both `onemo-next-qa-i1-6e5e757` and `onemo-component-library`.
