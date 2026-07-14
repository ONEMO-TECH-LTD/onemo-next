# s58-qa I1 Implementation Gate

Target:
- Branch: `session58-task/react-figma-engine`
- Frozen HEAD: `6e5e757392a2ca2cbe3a3135d8a028cf54adef91`
- QA checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Temp source checkout: `/tmp/s58-i1-qa-6e5e757`
- API probe: `/tmp/s58-i1-api-probe.mjs`

Verdict: FAIL with finding. HOLD Meta / no I2 dependency on this gate.

## Evidence Run

- Full-read relevant blueprint sections and changed source.
- Installed dependencies in isolated sibling checkout with `npm install --package-lock=false --no-audit --no-fund` because `npm ci` fails: lockfile is missing `onemo-component-library@0.1.0`.
- Started isolated dev server:
  - `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run dev -- --webpack -p 3035`
- Created a project-only fixture:
  - `src/app/(dev)/react-figma-components/qa-i1-codex/QaI1CodexProbe.tsx`
- Ran API probe against real `/api/dev/editor-write` and `/api/dev/editor-component-model`.
- Probe result: `I1 API PROBE: 12/14 PASS`.

## PASS Evidence

- Auto-promote substrate works through real API:
  - Initial model returned root `{line:3,col:5}` and no CSS module.
  - `promote-element` created `QaI1CodexProbe.module.css`, `styles.base`, import, and lifted declarations.
- Interaction scoped write works:
  - `write-scoped-declaration` for Hover wrote exact selector:
    - `.base:hover, :global([data-fc-preview="hover"]) .base`
  - ComponentModel read-back listed `hover` as `kind:"interaction"` with `opacity:"0.4"`.
- UI source confirms the redirect path is before the old live override engine:
  - `page.tsx:2885-2904` checks non-base `editTarget`, POSTs `write-scoped-declaration`, applies inline preview, then `return`s before `ov.current!.set(...)`.
- Six chips are present in source and live snapshot:
  - Source: `page.tsx:3940-3952`.
  - Live snapshot showed Base, Hover, Pressed, Focus, Disabled, Loading, Error after real double-click into component edit mode.
- Write queue exists:
  - `lib.ts:1424-1431`.
  - Four concurrent scoped writes to `.base[data-error]` all landed.

## FAIL Finding

### HIGH — `add-state` semantic state is not model-visible until a later scoped edit, and repeat-select can 409

Contract:
- I1 requires semantic state selection to create a real `loading?: boolean` prop, root `data-loading={loading || undefined}`, and a model-visible semantic state immediately.
- Re-selecting the same semantic state should be idempotent. It must not retry prop creation and 409.

Source evidence:
- `addState` semantic branch adds the prop/data attr and writes only a base transition:
  - `lib.ts:603-615`
- It does not create `.base[data-loading]` / `.base[data-error]` at add-state time.
- `parseComponentModel` only lists semantic states from CSS selectors:
  - `classifyScopedSelector` recognizes `.base[data-*]` at `lib.ts:636-642`.
  - state collection happens from CSS rules at `lib.ts:699-718`.
- UI decides whether to call `add-state` using `em.states.includes(t.state)`:
  - `page.tsx:2367-2373`.
- Because `states` omits `loading` until a CSS rule exists, a second click calls `add-state` again and hits duplicate prop guard:
  - `addBooleanPropToComponent` duplicate check at `lib.ts:579-581`.

Execution evidence:
- After `add-state loading`, TSX had:
  - `loading = false`
  - `loading?: boolean`
  - `data-loading={loading || undefined}`
- But immediate ComponentModel states were only:
  - `[{"state":"hover","kind":"interaction","selector":".base:hover, :global([data-fc-preview=\"hover\"]) .base","decls":{"opacity":"0.4"}}]`
- Probe failure:
  - `FAIL loading visible in model immediately after add-state`
  - `FAIL repeated loading add-state before scoped edit is idempotent/no-error — status=409 body={"error":"prop \"loading\" already exists"}`
- After manually writing `.base[data-loading]`, read-back succeeds. That proves the READ parser can see semantic states, but `add-state` does not establish the state model entry by itself.

Impact:
- Semantic state read-after-write drifts immediately after `add-state`.
- UI can repeatedly call `add-state` for an already-added semantic prop until a scoped edit creates the CSS selector.
- This violates the I1 model round-trip and idempotency requirements.

Required fix:
- Make `add-state loading/error` create an empty or transition-only `.base[data-loading]` / `.base[data-error]` rule immediately, or make ComponentModel derive semantic state presence from the boolean prop + root data attr even before declarations exist.
- Re-selecting Loading/Error must be idempotent and return success/no-op, not 409.
- Add gates:
  - `add-state loading` → immediate model includes semantic loading before any property edit.
  - repeated `add-state loading` → no-op success.
  - same for `error`.

## Cleanup / Notes

- Probe changes were confined to my isolated QA checkout and project-only fixture, not the component library.
- The component library repo remained clean during the gate.
- I will clean the QA fixture after verdict delivery.
