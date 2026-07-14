# s58-qa I1 Meta findings closure QA — HEAD e0bf6fb

Verdict: FAIL.

Scope: narrow re-verify of I1 Meta findings F-M1/F-M2 in isolated checkout
`/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757` at `e0bf6fb`.

## Finding

HIGH — F-M2 is fixed at the server API layer but still not closed in the editor UI path for non-form roots.

Evidence:
- Server `add-state disabled` on a `<div>` root adds `disabled = false`, `disabled?: boolean`, and `data-disabled={disabled || undefined}`.
- ComponentModel lists `disabled` immediately as semantic with selector `.base[data-disabled]`.
- A scoped disabled edit can create `.base[data-disabled] { ... }`.
- But the editor chip selection path only calls `add-state` for `loading`/`error`, not `disabled` on non-form roots: `src/app/(dev)/react-figma/page.tsx:2367-2375`.
- The forced-preview path still treats `disabled` as pseudo unconditionally and only treats `loading`/`error` as semantic: `src/app/(dev)/react-figma/page.tsx:2384-2390`.
- The redirect path is root-tag-aware (`:disabled` for form roots, `propClass:'disabled'` otherwise): `src/app/(dev)/react-figma/page.tsx:2891-2906`. That means the actual editor can write `.base[data-disabled]` for a div root without first adding the boolean prop/data attr that makes the selector reachable/toggleable.

Required fix:
- When selecting Disabled for a non-form root, route through `add-state` the same way `loading/error` do.
- In forced preview, treat Disabled on non-form roots as semantic: clear/set `data-disabled` on the rendered root instead of `data-fc-preview="disabled"`.
- Keep button/form roots on the `:disabled` pseudo path.

## Passed checks

Probe: `/tmp/s58-i1-meta-closure-probe.mjs`

Result: `I1 META CLOSURE PROBE: 17/18 PASS`.

Passed:
- F-M1: `add-state hover` then `loading` then `disabled` on a div root leaves exactly one base transition declaration.
- F-M1: the transition is canonical `transition: all .15s ease`.
- F-M2 server div path: disabled is semantic, has boolean prop + `data-disabled`, and no `:disabled` pseudo.
- F-M2 server div scoped edit: `.base[data-disabled]` rule is created.
- F-M2 server button path: disabled does not add a prop/data attr; no `[data-disabled]` rule on add-state.
- F-M2 server button scoped edit: `.base:disabled, :global([data-fc-preview="disabled"]) .base` rule is created and ComponentModel lists disabled as interaction after style.
- Regression: hover dual selector `.base:hover, :global([data-fc-preview="hover"]) .base` intact.
- Regression: redirect-not-override path still posts `write-scoped-declaration` and returns before live override.
- Regression: all six chip names still present in `EditTarget`.

Source refs:
- `src/app/api/dev/editor/lib.ts:599-618` — form-control set + idempotent `ensureBaseTransition`.
- `src/app/api/dev/editor/lib.ts:623-640` — disabled non-form roots route through semantic prop path.
- `src/app/api/dev/editor/lib.ts:769-777` — loading/error semantic model derivation from prop presence.
- `src/app/api/dev/editor/lib.ts:778-782` — disabled semantic model derivation from prop presence on non-form roots.
- `src/app/(dev)/react-figma/page.tsx:2367-2375` — missing disabled add-state path.
- `src/app/(dev)/react-figma/page.tsx:2384-2390` — preview still treats disabled as pseudo, not non-form semantic.
- `src/app/(dev)/react-figma/page.tsx:2891-2906` — redirect scope is root-tag-aware.

Gates:
- `npm run typecheck` exited 0.
- `GET /react-figma` returned 200.

Cleanup:
- Removed throwaway fixtures and generated CSS under `src/app/(dev)/react-figma-components/qa-i1-meta-closure/`.
- Stopped dev server.
- QA checkout tracked-clean; only ignored `.next/`, `.playwright-cli/`, `next-env.d.ts`, `node_modules/`, `tsconfig.tsbuildinfo`.
- `onemo-component-library` clean.
