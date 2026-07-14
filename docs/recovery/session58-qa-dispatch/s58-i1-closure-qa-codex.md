# s58-qa I1 closure QA — HEAD d671909

Verdict: PASS.

Scope: narrow closure only for the prior I1 failure at HEAD `d671909` in isolated checkout
`/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`.

## Evidence

Ran `/tmp/s58-i1-closure-probe.mjs` against dev server on `:3035`.

Result: `I1 CLOSURE PROBE: 15/15 PASS`.

Checks:
- `add-state loading` lists semantic `loading` immediately in ComponentModel before any `.base[data-loading]` CSS rule exists.
- Repeat `add-state loading` returns HTTP 200 no-op/re-targeted, not 409.
- `loading` remains exactly one destructured default, one `loading?: boolean`, one `data-loading` attr.
- `add-state error` lists semantic `error` immediately before any `.base[data-error]` CSS rule exists.
- Repeat `add-state error` returns HTTP 200 no-op/re-targeted, not 409.
- `error` remains exactly one destructured default, one `error?: boolean`, one `data-error` attr.
- Hover scoped edit writes exact selector: `.base:hover, :global([data-fc-preview="hover"]) .base`.
- Component scoped edit still routes to `write-scoped-declaration` and returns before the live override engine.

## Source refs

- `src/app/api/dev/editor/lib.ts:607-620` — semantic `addState` is idempotent via `propExists`; repeat returns re-targeted success.
- `src/app/api/dev/editor/lib.ts:746-753` — `parseComponentModel` derives semantic `loading`/`error` from boolean prop presence, with empty decls before scoped CSS exists.
- `src/app/api/dev/editor/lib.ts:511-516` — `scopedSelector` emits the ancestor preview half for pseudo states.
- `src/app/(dev)/react-figma/page.tsx:2891-2903` — active non-base component edits post `write-scoped-declaration`, apply immediate preview, then `return` before the live override path.

## Cleanup

- Removed throwaway fixture `src/app/(dev)/react-figma-components/qa-i1-closure/QaI1ClosureProbe.tsx`.
- Removed generated `QaI1ClosureProbe.module.css`.
- Stopped dev server.
- `onemo-next-qa-i1-6e5e757`: tracked tree clean; only ignored `.next/`, `.playwright-cli/`, `next-env.d.ts`, `node_modules/`.
- `onemo-component-library`: clean.
