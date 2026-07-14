# s58-qa I3 QA Gate — 0e55ce7

Verdict: FAIL-with-findings

Target:
- Repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-qa-i1-6e5e757`
- HEAD: `0e55ce7`
- Branch target: `session58-task/react-figma-engine`
- Global package repo: `/Users/daniilsolopov/Dev/onemo-dev/onemo-component-library`

Diff/source read:
- Commit chain since I2 closure read: `a5b956a` → `9523737` → `0161941` → `523481e` → `0e55ce7`.
- Touched implementation surfaces match relay: `src/app/api/dev/editor/lib.ts` plus props panel in `src/app/(dev)/react-figma/page.tsx`.
- Relevant source:
  - `lib.ts:847-863` emits the root custom-property style object for module-css bridge.
  - `lib.ts:883-889` rewrites every component rule declaration to `var(--prop, literal)`.
  - `lib.ts:907-945` implements the four `expose-as-prop` routes.
  - `lib.ts:955-973` implements `set-instance-prop`.
  - `page.tsx:3987-4007` displays props after excluding axes and state names.

Execution setup:
- Temporary project-only fixtures under `src/app/(dev)/react-figma-components/qa-i3-codex/`.
- Temporary live route `/qa-i3-codex-live`.
- Isolated dev server on `http://localhost:3035`.
- Probe script: `/tmp/s58-i3-probe.mjs` (removed after run).

Primary probe result:
- API/refusal probe passed intended assertions:
  - Reserved `className` rejected at `add-variant-axis`.
  - Reserved `style` rejected at `expose-as-prop`.
  - Reserved `children` rejected at `set-instance-prop`.
  - Module-css bridge added optional `tone?: string` prop and root custom property.
  - Module-css bridge rewrote base and variant `color` declarations with own fallbacks.
  - `text` route succeeded on a single static text child and refused multi-child text.
  - `attr` route succeeded on string-literal `alt` and refused expression-bound `href`.
  - `inline-style` route succeeded on literal `opacity` and refused dynamic `backgroundColor`.
  - `set-instance-prop` inserted then updated without duplicate and refused host element + expression-needing value.
  - Component model props support the props-panel filter: exposed `tone` appears, variant axis prop is excluded by source logic.
  - I1 dual selector still emitted.
  - I2 `variantAxes` still read.

Live computed-style proof:
- `/qa-i3-codex-live` returned 200.
- Playwright computed styles for four rendered instances:
  - base, prop unset: `rgb(17, 34, 51)` (`#112233`)
  - variant, prop unset: `rgb(68, 85, 102)` (`#445566`)
  - base, prop set: `rgb(204, 0, 0)` (`#cc0000`)
  - variant, prop set: `rgb(0, 170, 0)` (`#00aa00`)
- This proves the runtime CSS precedence contract works.

Finding 1 — HIGH: module-css bridge emits TypeScript-invalid custom-property style objects.

Evidence:
- Successful `expose-as-prop` module-css bridge generated:
  ```tsx
  <div style={{ '--tone': tone }} className={[styles.base, styles[`variant_${variant}`]].filter(Boolean).join(' ')} data-name="QaI3Bridge">
  ```
- `npm run typecheck` failed on the generated fixture:
  ```text
  src/app/(dev)/react-figma-components/qa-i3-codex/QaI3Bridge.tsx(5,19): error TS2353: Object literal may only specify known properties, and ''--tone'' does not exist in type 'Properties<string | number, string & {}>'.
  ```
- Source cause:
  - `src/app/api/dev/editor/lib.ts:856` builds `cssVar = "'--${propName}': ${propName}"`.
  - `src/app/api/dev/editor/lib.ts:858` inserts `style={{ ${cssVar} }}` when no style attr exists.
  - `src/app/api/dev/editor/lib.ts:862` prepends the same custom property into an existing style object.

Why this blocks:
- The core §5 module-css bridge works in the browser but produces code that fails the repo’s TypeScript gate.
- Blueprint §10-I3 explicitly requires clean generated code / tsc0 for this increment.
- This is not fixture-specific; any successful module-css expose emits a custom CSS variable key into a React `style` object without a type-compatible cast/satisfies shape.

Non-blocking notes:
- Full lint was not run after the HIGH typecheck blocker.
- Runtime precedence is good; fix should preserve the same emitted CSS and live behavior while making the root style TS-valid.

Cleanup:
- Temporary fixtures removed.
- Temporary live route removed.
- Temporary probe script removed.
- Playwright session closed and `.playwright-cli` removed.
- Dev server stopped.
- `git status --short` empty in onemo-next QA checkout.
- `git status --short` empty in onemo-component-library.
