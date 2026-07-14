# s58-qa I2 Closure Re-Verify — 3ac7ecf

Verdict: PASS

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- HEAD: `3ac7ecf`
- Branch target: `session58-task/react-figma-engine`
- Global package repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Diff read:
- `3ac7ecf` is surgical: `src/app/api/dev/editor/lib.ts` + `src/app/(dev)/react-figma/page.tsx`.
- `ComponentModel` now returns unified `rules[]` instead of `variants[]` + `states[]`.
- `decomposeRule(sel, base, axisNames)` replaces the simple classifier and uses `variantAxes` context before CSS rule parse.
- `page.tsx` derives local state chip guard from `props + rules + structure`; no remaining consumer reads server `m.variants` or `m.states`.

Executed closure probe:
- Temporary project-only fixture under `src/app/(dev)/react-figma-components/qa-i2-closure/`.
- Isolated dev server: `http://localhost:3035`.
- Probe assertions: `PASS 13/13`.

Proof:
- Exact prior failing selector is now visible in `model.rules`:
  - Selector: `.base.size_lg.variant_primary[data-loading]:hover, :global([data-fc-preview="hover"]) .base.size_lg.variant_primary[data-loading]`
  - `axisValues`: `[{axis:"size",value:"lg"},{axis:"variant",value:"primary"}]`
  - `semantic`: `["loading"]`
  - `pseudo`: `"hover"`
  - `decls.padding`: `"24px"`
- Simple single-axis regression passed:
  - `.base.size_lg` decomposes to one `axisValues` entry and preserves `margin: 9px`.
- Interaction-only regression passed:
  - `.base:hover, :global([data-fc-preview="hover"]) .base` decomposes to `pseudo:"hover"` and preserves `background`.
- Old shape removed:
  - API model has `rules[]`.
  - API model does not expose `variants` or `states`.
- Previously closed fixes still hold:
  - Scrambled write payload `{variant=primary, size=lg}` still canonicalizes to `.base.size_lg.variant_primary...`.
  - Reversed caller order does not leak into CSS.
  - Model-unreadable fallback still returns 200 and preserves caller order instead of throwing.

Additional gates:
- `/react-figma` returned `200`.
- `/react-figma/components-canvas` returned `200`.
- `npm run typecheck` exited `0`.
- Both repos ended clean.

Cleanup:
- Temporary fixture removed.
- Temporary `/tmp/s58-i2-closure-probe.mjs` removed.
- Isolated dev server stopped.
