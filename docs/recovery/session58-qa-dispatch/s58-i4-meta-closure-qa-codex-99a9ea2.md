# s58-qa I4 Meta Closure QA — 99a9ea2

Verdict: PASS

Scope: I4 Meta rework closure for F-M8 BLOCKING and F-M9 MED at frozen SHA `99a9ea2711f9c032ebd79650ba9baa5a6fa75ab5`.

Checkout: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`

Component library: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

## Source / Diff

- `git checkout 99a9ea2` in the isolated QA checkout.
- `git status --short` before probing: clean.
- Component-library `git status --short` before probing: clean.
- `git diff --name-only eeaecae..99a9ea2`: `src/app/api/dev/editor/lib.ts`.
- `git diff --stat eeaecae..99a9ea2`: `1 file changed, 24 insertions(+), 3 deletions(-)`.
- Read surgical diff and relevant source:
  - `src/app/api/dev/editor/lib.ts:1108-1111`: switch connector writes `default=<axisDefault>` into `@fc-connector`.
  - `src/app/api/dev/editor/lib.ts:1121-1130`: existing `onClick` is merged only if it is an inline block arrow; otherwise 422 refuse.
  - `src/app/api/dev/editor/lib.ts:1307-1311`: parser reads optional `default=<value>` and restores switched-axis `variantAxes[].defaultValue`.
  - `src/app/(dev)/react-figma/page.tsx:4020` and `4032`: UI buttons still call the same `set-connector` write op endpoint; page client code was not changed in this closure diff.

## Fixture

Created throwaway project-only fixture files, then deleted them:

- `src/app/(dev)/react-figma-components/qa-i4-meta/MetaSwitchCard.tsx`
- `src/app/(dev)/react-figma-components/qa-i4-meta/RefuseClickCard.tsx`
- `src/app/(dev)/qa-i4-meta/page.tsx`

The component library repo was not touched.

## F-M8 Merge Path

Probe path: `/api/dev/editor-write`.

Steps:

1. Promoted `MetaSwitchCard`.
2. Added axis `size` with values `['sm', 'lg']`, default `lg`.
3. Added axis `tone` with values `['cool', 'warm']`, default `warm`.
4. Added scoped style deltas for both axes.
5. Wrote switch connector for `size -> sm` cycle.
6. Wrote second switch connector for `tone -> cool` cycle on the same component.
7. Wrote state connector `hover -> hover` spring `260/20/1` as regression.

Generated source evidence:

```tsx
<div onClick={() => { if (sizeProp == null) setSizeInternal((v) => { const vals: ('sm' | 'lg')[] = ['sm', 'lg']; return vals[(vals.indexOf(v) + 1) % vals.length] }) ; if (toneProp == null) setToneInternal((v) => { const vals: ('cool' | 'warm')[] = ['cool', 'warm']; return vals[(vals.indexOf(v) + 1) % vals.length] }) }} data-testid="meta-switch-card" className={[styles.base, styles[`size_${size}`], styles[`tone_${tone}`]].filter(Boolean).join(' ')}>
```

Assertions:

- Exactly one `onClick` attribute.
- Both guards present: `if (sizeProp == null)` and `if (toneProp == null)`.
- No TS17001 duplicate-attribute class.
- Cycle arrays are typed unions for both axes.
- `npm run typecheck` with the generated fixture present: exit 0.

## F-M8 Refuse Path

Fixture root had `onClick={existingClick}` before connector write.

Attempted switch connector on axis `mode`; result:

- HTTP 422.
- Error contained `not an inline block handler`.
- File remained syntactically intact.
- Exactly one original `onClick={existingClick}` remained.
- No `@fc-connector` comment was written to the refused file.

## F-M9 Default Drift

Model after wiring two switches:

```json
[
  { "axis": "size", "values": ["sm", "lg"], "defaultValue": "lg" },
  { "axis": "tone", "values": ["cool", "warm"], "defaultValue": "warm" }
]
```

Generated connector comments:

```tsx
/* @fc-connector: tap size→sm cycle default=lg */
/* @fc-connector: tap tone→cool cycle default=warm */
```

Result: switched axes retain their own non-first defaults after READ; no fallback to `values[0]`.

## Runtime Browser Proof

Route: `http://localhost:3035/qa-i4-meta`

Browser automation: Playwright wrapper.

Assertions:

- Initial uncontrolled card: `size_lg` + `tone_warm`, background `rgb(204, 85, 0)`, padding `20px`.
- Uncontrolled click: classes become `size_sm` + `tone_cool`; background `rgb(0, 102, 204)`, padding `4px`.
- `size="lg"` controlled card click: stays `size_lg`, tone cycles to `tone_cool`; background `rgb(0, 102, 204)`, padding `20px`.
- `tone="warm"` controlled card click: size cycles to `size_sm`, stays `tone_warm`; background `rgb(204, 85, 0)`, padding `4px`.
- Computed transition remains `all 0.733s linear(...)`.

This proves both switches independently work through one merged handler, and a controlled prop locks only its own axis while the other axis still switches.

## Regression

- State connector still round-trips:

```json
{
  "mode": "state",
  "trigger": "hover",
  "to": { "state": "hover" },
  "transition": { "kind": "spring", "stiffness": 260, "damping": 20, "mass": 1 }
}
```

- CSS still carries `/* @fc-transition: hover hover spring 260 20 1 */`.
- CSS transition still compiles to `linear(...)`.
- F1 typed-union fix still present for both generated cycle arrays.

## Cleanup

- Deleted all throwaway fixture files.
- Removed stale generated `.next/dev/types/app/(dev)/qa-i4-meta/page.ts` after deleting the temporary route; this was a generated Next cache reference to the deleted QA route.
- `npm run typecheck` after cleanup: exit 0.
- Final `git status --short` in onemo-next QA checkout: clean.
- Final `git status --short` in onemo-component-library: clean.
- QA dev server and Playwright browser stopped.

## Caveat

I did not re-click the editor authoring buttons during this Meta closure. The closure diff is server-only (`lib.ts`), and the client button code at `page.tsx:4020` / `4032` is unchanged from the prior I4 gate; the server endpoint those buttons call was exercised directly, and runtime behavior was verified in the browser.

