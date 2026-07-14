# s58-qa I3 Closure Re-Verify — 7d67ac4

Verdict: PASS

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- HEAD: `7d67ac4`
- Branch target: `session58-task/react-figma-engine`
- Global package repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Fix read:
- Diff from failing target is surgical: `src/app/api/dev/editor/lib.ts` only.
- `exposeStringPropOnRoot` now emits custom-property style objects as `{ ... } as CSSProperties`.
- It adds `import type { CSSProperties } from 'react'` only when needed.
- Existing cast path prepends new custom-property entries into the inner object, without re-casting or re-importing.

Executed repro:
- Fresh project-only inline component under `src/app/(dev)/react-figma-components/qa-i3-closure/`.
- Promoted root through real `/api/dev/editor-write`.
- Added `variant` axis and a secondary variant rule for both `color` and `background`.
- First `expose-as-prop`: `color` → `tone`.
- Second `expose-as-prop` on same component: `background` → `surface`.

Probe result:
- `/tmp/s58-i3-closure-probe.mjs`: `PASS 11/11`.
- Confirmed:
  - promote created `.module.css` and `.base`.
  - first expose added exactly one `CSSProperties` type import.
  - first expose emitted exactly one `as CSSProperties` cast.
  - first expose new-attr path generated `style={{ '--tone': tone } as CSSProperties}`.
  - first expose bridged base and variant color fallbacks.
  - second expose kept exactly one type import.
  - second expose kept exactly one cast.
  - no `as CSSProperties as CSSProperties`.
  - second expose merged into existing cast object.
  - second expose bridged base and variant background fallbacks.

Generated code after second expose:
```tsx
import type { CSSProperties } from 'react'
import styles from './QaI3Closure.module.css'
export function QaI3Closure({ variant = 'primary' , tone , surface }: { variant?: 'primary' | 'secondary' ; tone?: string ; surface?: string }) {
  return (
    <div style={{ '--surface': surface, '--tone': tone } as CSSProperties} data-name="QaI3Closure" className={[styles.base, styles[`variant_${variant}`]].filter(Boolean).join(' ')}>
      I3 closure
    </div>
  )
}
```

Typecheck:
- `npm run typecheck` exited `0` with generated component present after the first expose.
- `npm run typecheck` exited `0` with generated component and temporary live route present after the second expose.

Live computed-style precedence:
- Temporary route: `/qa-i3-closure-live`.
- Playwright computed styles:
  - base unset: color `rgb(17, 34, 51)`, background `rgb(255, 255, 255)`.
  - variant unset: color `rgb(68, 85, 102)`, background `rgb(221, 221, 221)`.
  - base `tone="#cc0000"`: color `rgb(204, 0, 0)`.
  - variant `tone="#00aa00"`: color `rgb(0, 170, 0)`.
  - base `surface="#ffeecc"`: background `rgb(255, 238, 204)`.
  - variant `surface="#ddeeff"`: background `rgb(221, 238, 255)`.
- This preserves the prior runtime precedence proof while fixing the TypeScript failure.

Additional checks:
- `/react-figma` returned `200`.
- `/react-figma/components-canvas` returned `200`.
- Browser console error filter returned `0`.

Cleanup:
- Temporary fixture removed.
- Temporary live route removed.
- Temporary probe script removed.
- Playwright session closed.
- `.playwright-cli` removed.
- Dev server stopped.
- `git status --short` empty in onemo-next QA checkout.
- `git status --short` empty in onemo-component-library.
