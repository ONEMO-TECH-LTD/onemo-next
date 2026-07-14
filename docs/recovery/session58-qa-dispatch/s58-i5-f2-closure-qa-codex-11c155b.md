# s58-qa I5 F-I5-2 closure re-verify @ 11c155b

Verdict: PASS

Target:
- Repo checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- SHA: `11c155b`
- Component library: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Source read:
- Full file read: `src/app/api/dev/editor/lib.ts` lines 1-2131.
- Diff read: `b7230f9..11c155b`, only `src/app/api/dev/editor/lib.ts`, +10/-3.
- Temporary source-read ledger: `/tmp/s58-i5-f2-closure-lib-read-ledger.md`.

Execution artifacts:
- Probe script: `/tmp/s58-i5-f2-closure-probe.mjs`.
- Probe results: `/tmp/s58-i5-f2-closure-probe-results.json`.
- Dev server: `localhost:3035`.

Verified:
1. Collision repro is closed:
   - Promoted `CollisionState`.
   - Added variant axis `loading` values `idle|busy`.
   - Switch-connected `loading`.
   - `POST add-state loading` returned HTTP 422 with named message:
     `prop "loading" already exists as a config axis ... it can't also be a semantic state`.
   - Source was byte-identical before/after the refused add-state.
   - Source remains a string-axis only: `{ loading: loadingProp }: { loading?: 'idle' | 'busy' }`.
   - No boolean `loading = false` and no `data-loading={loading || undefined}` were written.

2. Boolean semantic-state idempotency is preserved:
   - Fresh `add-state loading` on `IdempotentLoading` returned 200 and created:
     `{ loading = false }: { loading?: boolean }`
     plus `data-loading={loading || undefined}`.
   - Re-running `add-state loading` returned 200 "already present".
   - No duplicate prop/type/toggle appeared.
   - ComponentModel reads `loading` as a boolean prop and no `loading` variant axis.

3. Normal free semantic state still works:
   - `add-state error` returned 200 and created boolean `error` plus `data-error`.

4. Interaction state path is unaffected:
   - `add-state hover` returned 200 interaction-state response.
   - No hover boolean prop or `data-hover` was added.
   - Base CSS transition was ensured.

5. Gates:
   - `npm run typecheck` with generated fixtures present: 0.
   - `GET /react-figma`: 200.

Cleanup:
- Temporary fixture files were removed after this ledger.
- Final cleanup status verified separately: target repo clean, component-library repo clean.
