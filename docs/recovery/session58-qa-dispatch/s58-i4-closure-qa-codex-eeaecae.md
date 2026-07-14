# s58-qa I4 closure re-verify @ eeaecae

Verdict: PASS

Target: `session58-task/react-figma-engine` at `eeaecae`, verified from isolated checkout `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`.

## Scope

Closure for prior I4 findings:

- F1 cycle connector generated TypeScript failed `tsc`.
- F2 state connector comment lost `trigger` / `to.state` on read-back.
- Narrow regressions: switch connector round-trip, D3 controlled/uncontrolled runtime, old-format transition comment compatibility.

Observed diff from I4 gated target:

- `git diff --name-only 7239646..eeaecae` => `src/app/api/dev/editor/lib.ts`
- `git diff --stat 7239646..eeaecae` => `1 file changed, 14 insertions(+), 7 deletions(-)`
- No `page.tsx` / authoring button client diff in this closure.

## Evidence

### F1 cycle-tsc

Source-read:

- `src/app/api/dev/editor/lib.ts:1097-1101` emits `const vals: (${unionType})[] = [...]`.

Generated-fixture proof:

- Created throwaway project component `src/app/(dev)/react-figma-components/qa-i4-closure/ClosureCard.tsx`.
- Ran `promote-element`, `add-variant-axis variant primary|secondary`, and switch connector cycle through `/api/dev/editor-write`.
- Generated TSX contained:

```tsx
const vals: ('primary' | 'secondary')[] = ['primary', 'secondary']
```

Typecheck with generated component present:

```text
> onemo-next-temp@0.1.0 typecheck
> tsc --noEmit
```

Exit code: `0`.

### F2 state round-trip

Source-read:

- `src/app/api/dev/editor/lib.ts:1051-1056` writes `@fc-transition: <trigger> <to.state> spring <s> <d> <m>`.
- `src/app/api/dev/editor/lib.ts:1279-1284` reads the new format and keeps old spring-only compatibility.

API proof:

Final `ComponentModel.connectors` after writing `hover -> hover` spring `260/20/1`:

```json
[
  {
    "mode": "state",
    "trigger": "hover",
    "to": { "state": "hover" },
    "transition": { "kind": "spring", "stiffness": 260, "damping": 20, "mass": 1 }
  },
  {
    "mode": "switch",
    "trigger": "tap",
    "to": { "axis": "variant", "value": "secondary" },
    "cycle": true
  }
]
```

Generated CSS contained:

```css
/* @fc-transition: hover hover spring 260 20 1 */
.base {
  transition: all 0.733s linear(...);
}
```

Old-format compatibility proof:

- Replaced the generated comment temporarily with `/* @fc-transition: spring 260 20 1 */`.
- `ComponentModel` read did not crash and returned placeholder state connector:

```json
{
  "mode": "state",
  "trigger": "state",
  "to": {},
  "transition": { "kind": "spring", "stiffness": 260, "damping": 20, "mass": 1 }
}
```

The script restored the new-format comment before typecheck.

### Runtime regression

Playwright route: `http://localhost:3035/qa-i4-closure`.

Computed transition after render:

- `transition-property`: `all`
- `transition-duration`: `0.733s`
- `transition-timing-function`: `linear(...)`

D3 switch behavior:

- Uncontrolled card before click: base class only, `rgb(17, 17, 17)`.
- Uncontrolled card after click + full transition: class included `variant_secondary`, color `rgb(34, 170, 102)`.
- Controlled card passed `variant="primary"`: click did not add `variant_secondary`, color stayed `rgb(17, 17, 17)`.

Authoring button path:

- This closure diff is server-only; the client buttons were not changed.
- Source check at `src/app/(dev)/react-figma/page.tsx:4020` still POSTs the state connector op.
- Source check at `src/app/(dev)/react-figma/page.tsx:4032` still POSTs the switch connector op.
- The same server route and payload shape were exercised by the API proof above.

## Cleanup

- Deleted throwaway source route/component/CSS fixture.
- Removed only stale generated cache `.next/dev/types/app/(dev)/qa-i4-closure` after cleanup, because it referenced the deleted probe route and made post-clean typecheck fail.
- Post-clean `npm run typecheck`: exit `0`.
- `git status --short` in `onemo-next-qa-i1-6e5e757`: clean.
- `git status --short` in `onemo-component-library`: clean.
