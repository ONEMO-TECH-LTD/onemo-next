# s58-qa I5 Variant Board QA — 9b0c327

Verdict: FAIL-with-findings

Scope: I5 variant board UI gate at frozen SHA `9b0c327cdc890e6c417b521cc25de57a512ca7c1`.

Checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`

Component library: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

## Source / Diff

- Isolated QA checkout moved from I4 final `99a9ea2` to `9b0c327`.
- `git diff --name-only 99a9ea2..9b0c327`:
  - `src/app/(dev)/react-figma/components-canvas/page.tsx`
  - `src/app/(dev)/react-figma/page.tsx`
- Diff stat: `2 files changed, 118 insertions(+), 17 deletions(-)`.
- Read full `components-canvas/page.tsx` and main-page I5-relevant regions:
  - `components-canvas/page.tsx:78-136`: inventory grouping, axis frames, edited-file state ghosts.
  - `components-canvas/page.tsx:150-177`: `?edit=<file>`, inventory fetch, `fc-board-refresh`.
  - `components-canvas/page.tsx:203-238`: per-axis subgroups and state ghost rendering.
  - `page.tsx:2332-2405`: edit mode, edit model, board-authoring state, state target selection.
  - `page.tsx:2409-2428`: preview effect skips ghost frames.
  - `page.tsx:3973-4082`: component edit header, +Axis/+Value controls, `fc-board-refresh`, iframe `?edit=`.
  - `page.tsx:2216-2259` and `3863-3914`: ComponentsRail edit entry path.
- Dependency symlink checked: `node_modules/onemo-component-library -> ../../onemo-component-library`; no repair needed.

## Fixture

Created project-only throwaway fixture under `src/app/(dev)/react-figma-components/qa-i5/`:

- `QaI5BoardCard.tsx`
- `QaI5PlainCard.tsx`

Setup ran through `/api/dev/editor-write`:

- Promoted both components.
- Added `size` axis `sm|lg`, default `sm`.
- Added `tone` axis `cool|warm`, default `cool`.
- Added hover and loading scoped styles.
- Added `loading` boolean state.
- Added I4 state and switch connectors.

## PASS Evidence Before Blocker

Axis-grouped board:

- Direct route: `/react-figma/components-canvas?edit=src/app/(dev)/react-figma-components/qa-i5/QaI5BoardCard.tsx`.
- `QaI5BoardCard` rendered separate `data-axis-group` sections:
  - `size`: `size=sm`, `size=lg`
  - `tone`: `tone=cool`, `tone=warm`
- `QaI5PlainCard` rendered as a single plain frame with no `data-axis-group` and no `data-states-group`.

State ghost slots:

- Edited component rendered exactly 6 `data-component-state` frames in order: `hover,pressed,focus,disabled,loading,error`.
- Interaction ghost `hover` had `data-fc-preview="hover"` on the host figure and computed background `rgb(0, 170, 85)`, proving the ancestor dual-selector path.
- Semantic ghost `loading` had no `data-fc-preview`, the rendered component root had `data-loading`, and computed background `rgb(255, 204, 0)` / color `rgb(17, 17, 17)`, proving real boolean-prop preview.

Editor entry:

- Components rail listed the QA fixture.
- Context menu → `Edit component` entered component edit mode.
- Editor overlay showed axis chips, 6 state chips, `+ axis`, `+ value`, props panel, and connector buttons.

Live authoring partial:

- Filled `axis name=shape` and clicked `+ axis`.
- Without manual page reload, overlay and iframe board both updated:
  - New chip/axis: `shape`
  - New board group: `shape`
  - New frames: `shape=a`, `shape=b`

## BLOCKER Finding

### F-I5-1: `+ value` corrupts a switched axis and breaks the build

Severity: HIGH / blocker

Repro:

1. Use a component with an existing I4 switch connector on axis `size`.
2. Enter component edit mode.
3. In the I5 board authoring overlay, type `md` into the `size` value input.
4. Click `+ value`.

Observed:

- The click returns 200 from `/api/dev/editor-write`.
- The component source is corrupted with a duplicate destructured `size` binding and duplicate `size` type member:

```tsx
export function QaI5BoardCard({ label = 'QA I5' , size: sizeProp , tone = 'cool' , loading = false , shape = 'a' , size = 'sm' }: { label?: string ; size?: 'sm' | 'lg' ; tone?: 'cool' | 'warm' ; loading?: boolean ; shape?: 'a' | 'b' ; size?: 'sm' | 'lg' | 'md' }) {
  /* @fc-connector: tap size→lg cycle default=sm */
  const [sizeInternal, setSizeInternal] = useState(sizeProp ?? 'sm')
  const size = sizeProp ?? sizeInternal
```

Typecheck with the generated fixture present:

```text
src/app/(dev)/react-figma-components/qa-i5/QaI5BoardCard.tsx(3,116): error TS2300: Duplicate identifier 'size'.
src/app/(dev)/react-figma-components/qa-i5/QaI5BoardCard.tsx(3,150): error TS2300: Duplicate identifier 'size'.
src/app/(dev)/react-figma-components/qa-i5/QaI5BoardCard.tsx(3,236): error TS2300: Duplicate identifier 'size'.
src/app/(dev)/react-figma-components/qa-i5/QaI5BoardCard.tsx(3,236): error TS2717: Subsequent property declarations must have the same type.  Property 'size' must be of type '"sm" | "lg" | undefined', but here has type '"sm" | "lg" | "md" | undefined'.
src/app/(dev)/react-figma-components/qa-i5/QaI5BoardCard.tsx(6,9): error TS2300: Duplicate identifier 'size'.
```

Live route impact:

- Next build overlay showed `Module parse failed: Identifier 'size' has already been declared`.
- `/react-figma`, `/react-figma/components-canvas`, and `/api/dev/editor-components` returned 500 while the corrupted fixture existed.

Source-level root cause:

- `src/app/api/dev/editor/lib.ts:736` checks existing union props with `ts.isIdentifier(el.name) && el.name.text === propName`.
- After I4 switch connector, the axis binding is aliased as `{ size: sizeProp }`.
- For aliased bindings, `el.name.text` is `sizeProp`, while the public prop is in `el.propertyName`.
- `mintUnionProp` therefore misses the existing `size` prop on `add-variant-value`, enters the create path at `lib.ts:746-752`, and inserts a second `size`.

Fix direction:

- `mintUnionProp` must detect the public prop name the same way `parseComponentModel` does: `propertyName` when present, otherwise `name`.
- The extend path must preserve the aliased binding and update only the existing type member.
- Add a locking gate: add a switch connector on an axis, then add a value to that same axis via board `+ value`; generated component must typecheck and board must update live.

## Regression Coverage

Verified before blocker:

- I0 promotion still works.
- I1 hover/loading state rules still work in board ghosts.
- I2 axis frames render and `+ axis` live-refresh works.
- I4 connector state/switch setup still generated and read back for initial fixture.

Not fully completed after blocker:

- Full I0-I4 sweep after `+ value`, because the gate hit a generated build break and further live UI probing would be invalid.

## Cleanup

- Deleted all throwaway fixture files under `src/app/(dev)/react-figma-components/qa-i5/`.
- Stopped Playwright browser and local dev server.
- Post-clean `npm run typecheck`: exit 0.
- Final `git status --short` in onemo-next QA checkout: clean.
- Final `git status --short` in onemo-component-library: clean.

