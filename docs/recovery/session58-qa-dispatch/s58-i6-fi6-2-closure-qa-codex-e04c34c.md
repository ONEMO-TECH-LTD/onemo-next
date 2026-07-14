# s58-qa I6 F-I6-2 closure re-verify — e04c34c

Verdict: FAIL-with-finding.

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Commit verified locally: `e04c34c`
- Component library repo checked separately: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Source/diff read:
- `git diff f69a0a3..e04c34c -- src/app/api/dev/editor/lib.ts`
- Relevant source:
  - `src/app/api/dev/editor/lib.ts:1254-1345` `setVariantStructure`
  - `src/app/api/dev/editor/lib.ts:1291-1298` guardId local/public resolution
  - `src/app/api/dev/editor/lib.ts:1210-1214` raw guard parse
  - `src/app/api/dev/editor/lib.ts:1368-1369` raw parsed guard stored as `condVariant`

Probe artifacts:
- Script: `/tmp/s58-i6-fi6-2-closure-probe.mjs`
- Results: `/tmp/s58-i6-fi6-2-closure-results.json`
- Fixtures: project-only under `src/app/(dev)/react-figma-components/qa-i6-fix/`

Finding — MED/BLOCKING for round-trip: bare-alias codegen is fixed, but ComponentModel READ returns the local binding as the axis
- Fixture:
  - `I6BareAliasGuard({ size: sizeProp = 'sm' }: { size?: 'sm' | 'lg' })`
- Op:
  - `set-variant-structure` remove target with `axisValue:{axis:'size',value:'lg'}`
- Actual source:
  - HTTP 200.
  - Correctly writes `{sizeProp !== 'lg' && (...)}`.
  - `npm run typecheck` with fixtures present exits 0.
  - Browser components-canvas renders `Alias target`; old `size is not defined` runtime failure is gone.
- Actual model readback:
  - `condVariant:{axis:'sizeProp',value:'lg',negated:true}`
- Expected:
  - `condVariant:{axis:'size',value:'lg',negated:true}`
- Why it blocks:
  - The dispatch explicitly says `axisValue.axis/value stay public for the op/model/validation`.
  - Board/editor consumers need the public axis (`size`) to match `variantAxes[]`; `sizeProp` is an implementation-local binding and is not a config axis.
  - The write side now maps public axis -> local guard identifier, but the read side does not map local guard identifier -> public axis.
- Likely fix:
  - During `buildStructure`/guard read, normalize parsed guard identifiers through the component prop binding map and resolved-const map:
    - local alias `sizeProp` -> public axis `size`
    - resolved const `size` -> public axis `size`
  - Keep emitted JSX guard using `guardId`; only normalize `condVariant.axis`.

Passing closure evidence:
- Plain destructure:
  - `{ shape = 'square' }` remove writes `{shape !== 'square' && (...)}`.
- Bare alias:
  - codegen uses `sizeProp`, not `size`.
  - typecheck 0.
  - browser renders instead of failing.
- Switch-const shape:
  - `{ size: sizeProp }` plus `const size = sizeProp ?? sizeInternal` writes `{size !== 'lg' && (...)}`.
  - readback returns public `condVariant.axis === 'size'`.
- Add regression:
  - still writes flat `&&`.
  - readback returns public `size`.
- Refusal regressions:
  - bogus axis -> 422 byte-unchanged.
  - bogus value -> 422 byte-unchanged.
  - non-string prop -> 422 byte-unchanged.
  - deep reparent -> 422 byte-unchanged.
  - cross-axis nested guard -> 422 byte-unchanged.
- `npm run typecheck` with generated fixtures present: 0.

Cleanup:
- QA fixtures removed after verification.
- Post-cleanup typecheck run.
- Both repos checked clean.
