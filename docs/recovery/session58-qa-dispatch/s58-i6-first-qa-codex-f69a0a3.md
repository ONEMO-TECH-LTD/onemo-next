# s58-qa I6 structural variants first QA — f69a0a3

Verdict: FAIL-with-finding.

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- Frozen commit verified locally: `f69a0a3`
- Component library repo checked separately: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Source/diff read:
- `git log` confirmed I6 commits: `7064b83` structural variants, `f69a0a3` F-I6-1 validation.
- `git diff 99a9ea2..f69a0a3` read for I6 footprint.
- Server route/read paths read:
  - `src/app/api/dev/editor/lib.ts:268-285` WriteOp union
  - `src/app/api/dev/editor/lib.ts:322-334` exact line/col `findJsxAt`
  - `src/app/api/dev/editor/lib.ts:1204-1358` `StructureNode`, guard parsing, `setVariantStructure`, structure readback
  - `src/app/api/dev/editor/lib.ts:1400-1496` props/variantAxes/rules/structure model read
  - `src/app/api/dev/editor/lib.ts:2220-2231` applyWrite dispatch
  - `src/app/api/dev/editor-write/route.ts:1-22`
  - `src/app/api/dev/editor-component-model/route.ts:1-20`
  - `src/app/api/dev/editor-components/route.ts:1-90`
- Board/render paths read:
  - `src/app/(dev)/react-figma/components-canvas/page.tsx` I5 axis/state frame rendering diff
  - `src/app/(dev)/react-figma/page.tsx` edit board/iframe diff

Probe artifacts:
- Script: `/tmp/s58-i6-structural-probe.mjs`
- Result JSON: `/tmp/s58-i6-structural-probe-results.json`
- Fixtures were project-only under `src/app/(dev)/react-figma-components/qa-i6-struct/`.

Finding — BLOCKING: aliased axis validation passes, but emitted guard uses the out-of-scope public name
- Repro fixture:
  - `I6AliasCase({ size: sizeProp = 'sm' }: { size?: 'sm' | 'lg' })`
  - Target: `alias-target`
  - POST `set-variant-structure` with `{axis:'size', value:'lg'}` and `add after`.
- Actual:
  - HTTP 200.
  - File was changed to:
    - `{size === 'lg' && (...)}`
  - But `size` is not in scope; only `sizeProp` is in scope.
  - `npm run typecheck` fails:
    - `src/app/(dev)/react-figma-components/qa-i6-struct/I6AliasCase.tsx(5,8): error TS2304: Cannot find name 'size'.`
  - Browser components-canvas snapshot also showed runtime failure:
    - `default failed: size is not defined`.
- Why this blocks:
  - The dispatch explicitly says F-I6-1 handles I4 switch-connector aliasing via public-name resolution.
  - The validator resolves the public prop name, but the writer still emits the public name instead of the local binding identifier.
  - This violates generated-code-must-typecheck gate 8 and the new F-I6-1 alias claim.
- Expected:
  - Either emit the local binding guard (`sizeProp === 'lg'`) after resolving `{ size: sizeProp }`, or refuse aliased-axis structural guards with a named 422. Given the dispatch claims aliasing is supported, emitting the local binding is the likely fix.

Passing evidence before blocker:
- F-I6-1 bogus axis:
  - `missingAxis` returned 422 `axis "missingAxis" is not a prop on this component`.
  - File byte-unchanged.
- F-I6-1 non-string-union prop:
  - boolean `loading` prop returned 422 `isn't a config variant axis`.
  - File byte-unchanged.
- F-I6-1 bogus value:
  - `size=xl` returned 422 `not one of`.
  - File byte-unchanged.
- Add:
  - Wrote flat `{size === 'lg' && (...)}` around the added subtree.
  - Model readback includes `condVariant:{axis:'size',value:'lg'}` for added node.
  - Note: one probe assertion falsely failed because it searched for any `?` and caught TypeScript optional prop syntax; the source output itself is flat `&&`.
- Remove:
  - Wrote `{size !== 'lg' && (...)}` around the original node.
  - Original node remains in source.
  - Model readback includes `condVariant:{axis:'size',value:'lg',negated:true}`.
- Swap:
  - Wrote one single-level ternary `{size === 'lg' ? (...) : (...)}`.
  - Model readback includes true-branch and negated false-branch `condVariant`.
- Refusals:
  - Deep reparent into self-closing `img` returned named 422 and byte-unchanged.
  - Target-not-found returned 404 and byte-unchanged.
  - Cross-axis nested guard returned named 422 and byte-unchanged.
- Inventory read:
  - `/api/dev/editor-components` read variant axes for the I6 fixtures correctly.

Live/browser notes:
- Opened `http://localhost:3035/react-figma/components-canvas?...` via Playwright.
- Browser snapshot showed the alias component runtime failure (`size is not defined`), corroborating the typecheck blocker.
- The default-export shape of my fixtures did not produce useful axis-value gallery frame evidence in the snapshot, despite inventory reading axes correctly, so I am not counting live frame presence/absence as pass evidence for this failed gate.

Cleanup:
- QA fixtures removed after verification.
- Final repo clean checks run for both `onemo-next` QA checkout and `onemo-component-library`.
