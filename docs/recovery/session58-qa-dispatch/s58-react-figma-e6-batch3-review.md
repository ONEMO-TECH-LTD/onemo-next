# s58 react-figma E6 batch-3 QA review

Target:
- Worktree: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine`
- Branch: `session58-task/react-figma-engine`
- HEAD: `1ead0f4`
- Route: `http://127.0.0.1:3025/react-figma`
- Scope: `set-layer-name`, `rename-component`, `wrap-jsx-link`, addendum draw-to-place write path, addendum live destructive page flow

Verdict: PASS.

## Source Review

- `src/app/api/dev/editor/lib.ts:238` through `src/app/api/dev/editor/lib.ts:240` adds the three server write op contracts.
- `src/app/api/dev/editor/lib.ts:466` through `src/app/api/dev/editor/lib.ts:490` implements `set-layer-name`: `.tsx` jail, bad-char validation, AST target lookup, existing `data-name` update or insertion, parse guard.
- `src/app/api/dev/editor/lib.ts:492` through `src/app/api/dev/editor/lib.ts:537` implements `wrap-jsx-link`: href whitelist, existing `<a>` or `<Link>` update path, wrapper path with `style={{ display: 'contents' }}`, parse guard.
- `src/app/api/dev/editor/lib.ts:543` through `src/app/api/dev/editor/lib.ts:623` implements `rename-component`: PascalCase validation, collision guard, component export rename, consumer import specifier/binding/JSX tag rewrite for unaliased imports, validate all pending output before writes.
- `src/app/(dev)/react-figma/engine.ts:140` through `src/app/(dev)/react-figma/engine.ts:143` makes `layerLabel()` prefer `data-name`.
- `src/app/(dev)/react-figma/page.tsx:2311` through `src/app/(dev)/react-figma/page.tsx:2324` wires Layers row rename to `set-layer-name`.
- `src/app/(dev)/react-figma/page.tsx:2655` through `src/app/(dev)/react-figma/page.tsx:2707` implements draw-to-place pointer handling and `insert-jsx-child`.
- `src/app/(dev)/react-figma/page.tsx:2942` through `src/app/(dev)/react-figma/page.tsx:2952` puts pointer events on the canvas host and disables iframe pointer events while drawing.

## Execution Evidence

`set-layer-name`:
- Real Playwright input on `:3025`: double-clicked a visible Layers row, accepted the prompt with `QA Layer One`.
- Source write landed at `src/app/(dev)/react-figma/canvas/page.tsx`, inserting `data-name="QA Layer One"` on the exact row element.
- Tree label updated after HMR; `document.body.innerText.includes('QA Layer One')` returned true.
- Re-renamed the same row to `QA Layer Two`; source contained exactly one `data-name` attr and no duplicate.
- Bad name `Bad"Name` returned 422 with `invalid layer name (max 60 chars, no quotes/brackets)`.
- Probe writes were reverted before final gates.

`rename-component`:
- Created temp component `QaMetaRenameA` via `create-component`.
- Created temp page `qa-meta-rename`, inserted `<QaMetaRenameA />`, then posted `rename-component` to `QaMetaRenameB`.
- Verified old component file was gone, new `QaMetaRenameB.tsx` existed, export function was renamed, consumer import specifier changed to `@/app/(dev)/react-figma-components/QaMetaRenameB`, and JSX changed to `<QaMetaRenameB />`.
- Collision probe returned 409 when renaming to existing `QaMetaCollision`.
- Bad name probe returned 422 for `bad-name`.
- `npm run typecheck` exited 0 while the temp component/page graph existed.
- Temp component files were removed before final gates.

`wrap-jsx-link`:
- On temp page root div, pre-wrap computed geometry was `x=0 y=0 w=402 h=871`.
- Wrapper path wrote `<a href="/qa-link" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>...`.
- After reload, anchor computed `display` was `contents`; child div remained `x=0 y=0 w=402 h=871`.
- Existing-anchor update path changed href to `https://example.com/path` and dropped stale `target` and `rel`.
- `javascript:alert(1)` returned 422 with `invalid href (http(s)://, /route, #anchor, mailto:, tel: only)`.
- Temp page was deleted through `delete-page` before final gates.

Addendum - draw-to-place write path:
- Real Playwright input on `:3025`: clicked the Text tool, confirmed armed drawing state, dragged on the frame host (`x=620 y=130` to `x=700 y=180`).
- Source write landed in `src/app/(dev)/react-figma/canvas/page.tsx` as an absolutely positioned child:

```tsx
<span style={{ position: 'absolute', left: 40, top: 73, fontSize: 14, color: '#000' }}>Text</span>
```

- Console had 0 warnings and 0 errors for the draw action.
- Probe write was reverted before final gates.

Addendum - live destructive page flow:
- Real Playwright input on `:3025`: clicked Add new page in the Pages rail.
- Source file appeared at `src/app/(dev)/react-figma-pages/new-page/page.tsx`.
- Navigated through the file browser by real clicks: `(dev)` -> `react-figma-pages`.
- Double-clicked `new-page`, accepted rename prompt with `qa-ui-renamed`; source moved to `src/app/(dev)/react-figma-pages/qa-ui-renamed/page.tsx`.
- Fetched `/react-figma-pages/qa-ui-renamed` and got HTTP 200 to force Next dev type generation.
- Clicked the visible minus/delete control for `qa-ui-renamed`, accepted confirmation, and verified source file was gone.
- Post-delete generated-stub scan had no `qa-ui-renamed` file under `.next/dev/types/app/(dev)/react-figma-pages` or `.next/types/app/(dev)/react-figma-pages`.
- `npm run typecheck` exited 0 after the live destructive flow.

## Final Gates

- `git rev-parse --short HEAD` -> `1ead0f4`.
- `git status --short` -> only `?? test-results/`.
- `find .next/dev/types/app -path '*react-figma-pages*' -type f -print` -> no output.
- `find .next/types/app -path '*react-figma-pages*' -type f -print` -> no output.
- `find src/app/(dev)/react-figma-components -maxdepth 1 -type f` -> no output.
- `find src/app/(dev)/react-figma-pages -maxdepth 2 -type f` -> no output.
- `npm run typecheck` -> exit 0.
- `curl -I http://127.0.0.1:3025/react-figma` -> `HTTP/1.1 200 OK`.

## Observation

- During the temporary page-create/rename/delete flow, Playwright captured one React hydration mismatch on the temporary `new-page` route involving `data-eng-id`. It was transient during dev HMR, did not persist after cleanup, did not affect source cleanliness, and final route/typecheck gates were green. Not treated as a batch-3 blocker.
