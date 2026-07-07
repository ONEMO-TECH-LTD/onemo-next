# ONEMO Code Canon — generated React/CSS-Modules (SPEC §4b layer 2)

> The rules generic linters can't express, each mechanically checked by `canon-check` on every
> conversion. A violation is a **converter bug and fails the run** — never "done with notes".
> Sources: React docs (component/JSX law) · MDN/W3C CSS (cascade, custom properties) ·
> typescript-eslint strict + eslint-plugin-react/jsx-a11y (layer-1 executable canon, pinned in
> the app's lint config) · CSS Modules conventions · WAI-ARIA landmark semantics (§3.6).

## Structure
1. **No slop elements** — emitted element count == independent raw census (census/walk.mjs, §4b.4).
   Every wrapper corresponds to a Figma node; extra divs are a FAIL, not a style choice.
2. **One class per element**, `className={styles.x}` — no string concat, no conditional class logic
   in generated output (generated screens are static; behavior comes later, by hand or editor).
3. **Semantic tags only from the pinned §3.6 tables** — no invented semantics.

## CSS
4. **Flat selectors only**: `.class { }` — no nesting, no descendant/child/sibling combinators,
   no id/tag selectors, no pseudo-selectors in generated css. Keeps specificity uniform (0,1,0)
   so the react-figma byte-splice write path composes safely.
5. **No `!important`** — the staging layer (editor overrides) must always be able to win.
6. **No inline styles in emitted TSX.** Exception (pinned): **Figma-exported svg internals** —
   presentation attrs/styles inside `<svg>` subtrees are asset content (Figma's renderer output,
   hash-verified), not authored style. The exception applies INSIDE `<svg>…</svg>` only.
7. **No dead code**: every `.class` in the module.css is referenced by the TSX exactly once;
   no empty rules; no duplicate properties within a rule.
8. **Absolute-position budget**: `position: absolute` only on `layoutPositioning: ABSOLUTE` children
   and children of non-auto-layout frames (faithful Figma coords, §3.3) — count must equal the run
   record's `absoluteCount`, else FAIL. (No placeholders — structure always converts.)
9. **Formatting law** (byte-splice contract): one declaration per line, `  prop: value;`,
   property order layout → box → visual → typography; rule shape `.class {\n … \n}`.

## Tokens
10. **Bound = var(), never approximated** (§3.4). Raw values allowed but ALWAYS visible in the
    conformance report with candidates; **unresolved var names fail the run** (§4b.5).

## Layer-1 executable canon (industry bible, pinned versions)
`tsc --noEmit` strict + the app's ESLint (react/hooks/a11y) + Stylelint — run via the target app's
own pinned configs at acceptance (C1.5); zero warnings.
