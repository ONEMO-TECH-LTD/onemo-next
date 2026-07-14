# s58 react-figma E6 batch-2 QA review

Original target:
- Worktree: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine`
- Branch: `session58-task/react-figma-engine`
- HEAD: `87b26fa`
- Route: `http://127.0.0.1:3025/react-figma`
- Scope: KAI-9357, KAI-9363, KAI-9362, KAI-9358 pages half, FigmaField regression sweep

Closure re-run:
- Requested closure HEAD: `2b201e0`
- Worktree HEAD at start of closure: `2b201e0`
- Worktree HEAD after branch advanced during final gate: `0f49814`
- Scope re-run: prior HIGH only, page generated-type cleanup after create/rename/delete
- Note: `0f49814` is a new layer-rename commit on top of `2b201e0`; it was not part of the carried E6 batch-2 functional matrix.

Current verdict: PASS for the E6 batch-2 HIGH closure. The original blocker is fixed.

## Closure Evidence

- Source fix at current `0f49814` lines `src/app/api/dev/editor/lib.ts:497` through `src/app/api/dev/editor/lib.ts:504` adds `dropPageTypeStubs()` for both `.next/dev/types/app/(dev)/react-figma-pages/<slug>` and `.next/types/app/(dev)/react-figma-pages/<slug>`.
- `src/app/api/dev/editor/lib.ts:506` through `src/app/api/dev/editor/lib.ts:511` calls the cleanup after `delete-page`.
- `src/app/api/dev/editor/lib.ts:513` through `src/app/api/dev/editor/lib.ts:521` calls the cleanup for the old slug after `rename-page`.
- Rename repro: created `stub-probe`, fetched `/react-figma-pages/stub-probe`, got route status `200`, confirmed `.next/dev/types/.../stub-probe` existed, renamed to `stub-probe-renamed`, and confirmed the old `stub-probe` source dir and type stub were gone.
- Delete repro: created `stub-delete`, fetched `/react-figma-pages/stub-delete`, got route status `200`, confirmed `.next/dev/types/.../stub-delete` existed, deleted it, and confirmed both source dir and type stub were gone.
- Final generated-stub scan returned no `react-figma-pages` files under `.next/dev/types/app` or `.next/types/app`.
- Final `npm run typecheck` exited 0.
- Final route smoke: `curl -I http://127.0.0.1:3025/react-figma` returned `HTTP/1.1 200 OK`.
- Final source status: `git status --short` showed only `?? test-results/`.

## Original Finding - Closed

1. HIGH - Page add/rename/delete leaves stale Next dev type artifacts, making the standard typecheck gate fail after exercising the new pages flow. Closed by `2b201e0`.

Evidence:
- Live UI flow created `new-page`, renamed it to `s58qa-renamed-ui`, then deleted it through the Pages rail. Source tree returned to clean except expected untracked `test-results/`.
- At original failing HEAD `87b26fa`, `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-figma-engine/src/app/api/dev/editor/lib.ts:470` deleted the page directory with `fs.rm(dir, { recursive: true })`, but nothing invalidated the corresponding generated dev route type.
- Stale generated file remains at `.next/dev/types/app/(dev)/react-figma-pages/new-page/page.ts:2` importing `../../../../../../../src/app/(dev)/react-figma-pages/new-page/page.js`; line 7 imports the same missing module as a type.
- `npm run typecheck` exits 1:

```text
.next/dev/types/app/(dev)/react-figma-pages/new-page/page.ts(2,24): error TS2307: Cannot find module '../../../../../../../src/app/(dev)/react-figma-pages/new-page/page.js' or its corresponding type declarations.
.next/dev/types/app/(dev)/react-figma-pages/new-page/page.ts(7,29): error TS2307: Cannot find module '../../../../../../../src/app/(dev)/react-figma-pages/new-page/page.js' or its corresponding type declarations.
```

Impact:
- Functional Pages UI writes are jailed and source-clean, but the page lifecycle currently leaves the local QA/typecheck gate red after a normal add/rename/delete run.
- A 404 request to `/react-figma-pages/new-page` did not clear the stale generated type.

## Passed Checks

KAI-9357 - Variables SSOT:
- Variables rail auto-loaded `storybook/design-system/variables/figma-export.json` via `/api/dev/editor-tokens?figma=1`.
- Raw Figma export shape parsed as array-of-collections; 20 collections rendered.
- Headers rendered: `Variable`, `Light (figma)`, `Dark (figma)`, `CSS variable`, `Code value`.
- Sample rows showed original figma HEX values next to code equivalents, including `base / white` -> `#ffffff` / `oklch(100% 0 0)` and `base / brand-white` -> light `#fafafa`, dark `#111113`.
- Column resize worked: name column x moved from 527 to 605; double-click reset restored it to 527.
- Load-JSON accepted plugin, REST/meta, and variables2json shapes. Bad JSON shape failed loudly with the expected "Not a Figma variables export" message. The close button returned to the converter/token view.

KAI-9363 - Scoped token picker:
- `/api/dev/editor-tokens` returned 837 tokens, 523 with scopes, 523 with original values, 220 dark overrides.
- Gap/radius/font-size scope-filtered picker counts were 262, matching the claimed 358 -> 262 reduction for dimension fields.
- API-level leak probe found no scoped line-height, letter-spacing, font-size, font-weight, or font-family tokens in the gap bucket.
- UI gap picker displayed 262 rows. Some line-height/letter-spacing-named aliases still appeared, but they were unjoined pass-through tokens with no `$scopes`, matching the stated residual.

KAI-9362 - Text section:
- Selected a real text node and verified the rebuilt Text section.
- Weight dropdown displayed names (`Thin`, `Regular`, `Medium`, `SemiBold`, `Bold`, `ExtraBold`, `Black`); selecting `Bold` changed computed `font-weight` to `700`.
- Old glyph rows (`W`, `S`, vertical/horizontal arrow glyphs) were absent.
- Size is a plain field.
- Horizontal alignment buttons wrote real `text-align`; selecting right produced computed `text-align: right`.
- Vertical alignment buttons wrote real `align-content`; selecting middle produced computed `align-content: center`.
- Type settings popover contained Line height, Letter spacing, Decoration, Case, and Justify. Setting line height 30, letter spacing 2, underline, and uppercase reflected in computed styles.

KAI-9358 - Pages half:
- Server jail passed: delete `../canvas` returned 422; deleting a missing page returned 404.
- UI add page created `new-page` and switched canvas after compile delay.
- File browser/list refresh was eventual, not instant, but the row appeared after the refresh delay.
- Double-click row rename changed `new-page` to `s58qa-renamed-ui`.
- Delete with confirm removed the source. Final `git status --short` showed only `?? test-results/`.
- Layers rename was not evaluated because it is explicitly out of scope.

FigmaField consolidation regression:
- Representative fields rendered through the common control path: X, Y, Rotation, z-index, width, height, Gap, Horizontal padding, Vertical padding, Opacity, Corner radius.
- Token picker opened from Corner radius with 262 filtered dimension tokens.
- Picking `prim-dim-4` immediately rendered the token pill in the field and enabled Publish.
- Publish disabled zero-state style remained correct: disabled gray background, disabled text/icon color, 32px height.

## Source Evidence

- `src/app/api/dev/editor-tokens/route.ts:20` through `src/app/api/dev/editor-tokens/route.ts:52`: joins `$scopes` and original values from the Figma export.
- `src/app/api/dev/editor-tokens/route.ts:85` through `src/app/api/dev/editor-tokens/route.ts:114`: serves raw figma export under `?figma=1`, otherwise emits tokens with `scopes` and `original`.
- `src/app/(dev)/react-figma/page.tsx:204` through `src/app/(dev)/react-figma/page.tsx:217`: field-to-scope mapping.
- `src/app/(dev)/react-figma/page.tsx:270` through `src/app/(dev)/react-figma/page.tsx:274`: picker scope filtering.
- `src/app/(dev)/react-figma/page.tsx:740` through `src/app/(dev)/react-figma/page.tsx:792`: Figma JSON parser shapes.
- `src/app/(dev)/react-figma/page.tsx:799` through `src/app/(dev)/react-figma/page.tsx:806`: variables auto-load.
- `src/app/(dev)/react-figma/page.tsx:818` through `src/app/(dev)/react-figma/page.tsx:832`: column drag-resize and double-click reset.
- `src/app/(dev)/react-figma/page.tsx:1166` through `src/app/(dev)/react-figma/page.tsx:1198`: Type settings popover.
- `src/app/(dev)/react-figma/page.tsx:2113` through `src/app/(dev)/react-figma/page.tsx:2121`: text override write analogs.
- `src/app/(dev)/react-figma/page.tsx:2292` through `src/app/(dev)/react-figma/page.tsx:2316`: add/delete/rename page UI calls.
- `src/app/(dev)/react-figma/page.tsx:2798` through `src/app/(dev)/react-figma/page.tsx:2805`: page row rename/delete affordances.
- `src/app/(dev)/react-figma/page.tsx:3164` through `src/app/(dev)/react-figma/page.tsx:3183`: Text section controls.
- `src/app/(dev)/react-figma/page.tsx:443` through `src/app/(dev)/react-figma/page.tsx:497`: shared `FigmaField`, token pill, and picker trigger.
- `src/app/api/dev/editor/lib.ts:463` through `src/app/api/dev/editor/lib.ts:483`: pages jail, delete, and rename implementation.
