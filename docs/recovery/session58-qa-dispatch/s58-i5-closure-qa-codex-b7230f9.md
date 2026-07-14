# s58-qa I5 closure re-verify @ b7230f9

Verdict: FAIL-with-findings

Target:
- Repo checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- SHA: `b7230f93fbeb40d32d987ce793d60e3eb49c7131`
- Branch source: `origin/session58-task/react-figma-engine`
- Component library: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Scope from lead:
- F-I5-1: `mintUnionProp` must detect public prop names after I4 switch aliasing.
- Same-class collisions in `addBooleanPropToComponent` and `addStringParam`.
- Follow-on: `addVariantValue` must sync only the target axis switch-cycle array.
- Regression: non-switched `+Value` still extends normally.

Source hydration:
- Full read: `src/app/api/dev/editor/lib.ts` lines 1-2124, chunked and self-audited in `/tmp/s58-i5-closure-lib-read-ledger.md`.
- Diff read: `9b0c327..b7230f9 -- src/app/api/dev/editor/lib.ts`, surgical only, +29/-4.
- The requested public-name fix is present in `mintUnionProp`, `addBooleanPropToComponent`, and `addStringParam`.
- `addVariantValue` syncs cycle arrays by the specific setter regex `set<Axis>Internal`, which is the correct scoping shape.

Execution artifacts:
- Setup/probe script: `/tmp/s58-i5-closure-probe.mjs`
- Raw first-run probe output: `/tmp/s58-i5-closure-probe-results.json`
- Corrected final source/API check: `/tmp/s58-i5-closure-final-check.mjs`
- Corrected final check output: `/tmp/s58-i5-closure-final-check.json`
- Dev server: `localhost:3035`

PASS evidence:
- Original repro core, API path:
  - `ClosureMain` promoted, axes `size` + `tone` added, both switch-cycled.
  - `add-variant-value size=md` after switch aliasing produced one public aliased binding: `{ size: sizeProp, tone: toneProp }`.
  - `size?: 'sm' | 'lg' | 'md'` exists once.
  - Size cycle array updated to `('sm' | 'lg' | 'md')[] = ['sm', 'lg', 'md']`.
  - Tone cycle array stayed `('cool' | 'warm')[] = ['cool', 'warm']`; no `md` leaked into `setToneInternal`.
  - ComponentModel reads axes as `size=[sm,lg,md]`, `tone=[cool,warm]`.
- Deferred F-M10 remained contained:
  - Re-running `set-connector` on already-switched `size` refused with 422, did not write or corrupt.
- `expose-as-prop` collision:
  - Switch-connected aliased `tone` axis then `expose-as-prop propName=tone` returned 409 `prop "tone" already exists`.
  - Source stayed at one public aliased `tone: toneProp`; no duplicate prop.
- Non-switched axis regression:
  - `PlainValue` `flavor` axis extended to `'vanilla' | 'chocolate' | 'mint'`.
  - No `setFlavorInternal` cycle path appeared.
- Gates:
  - `npm run typecheck` with generated fixtures present: 0.
  - `GET /react-figma`: 200.
  - `GET /react-figma/components-canvas?edit=<ClosureMain>`: 200.
  - Temporary direct QA route: 200 after marking the harness page client-side.

Finding:

1. HIGH — `add-state` collision with a switch-connected semantic-name axis returns 200 instead of the required 409.

   Repro:
   - Promote `CollisionState`.
   - Add variant axis `loading` with values `idle | busy`.
   - Add switch connector on `loading`, which aliases the public prop as `{ loading: loadingProp }`.
   - Call `add-state` with `state: "loading"`.

   Actual:
   - API returned 200:
     `{"ok":true,"newValueText":"semantic state \"loading\" already present (re-targeted)"}`
   - Source remained a string-union axis:
     `export function CollisionState({ loading: loadingProp }: { loading?: 'idle' | 'busy' })`
   - No boolean state prop/default was created.
   - No `data-loading={loading || undefined}` toggle was created.

   Expected from the closure brief:
   - 409 collision, not duplicate write and not silent "already present".

   Root cause:
   - `src/app/api/dev/editor/lib.ts:674` uses `model.props.some((p) => p.name === op.state)` as semantic-state idempotency.
   - That only checks name, not that the existing prop is the semantic boolean state prop.
   - A config axis named `loading` is therefore treated as an existing semantic state, bypassing `addBooleanPropToComponent` and bypassing the new public-name collision guard.

Unverified:
- I did not certify the live board-click path as PASS. Source shows the I5 board button posts the same `add-variant-value` op and sends `fc-board-refresh`, and the components-canvas route served 200, but the gate already fails on the add-state collision. I stopped short of presenting a false PASS for board UI.

Cleanup:
- QA fixtures were isolated under `src/app/(dev)/react-figma-components/qa-i5-closure` plus a temporary route under `src/app/(dev)/qa-i5-closure`.
- Cleanup was run after this ledger was written; final git status is reported in the DM.
