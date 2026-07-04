# E2.4 — JSX inline-style writes (spec before build)

## Problem
The glass screen (Editor402) styles elements with inline `style={{ … }}` objects, not CSS
modules. E1.4's write path resolves module.css DeclRefs — it returns nothing for these elements
(no module.css import). So "Save to code" currently no-ops on the primary canvas. E2.4 adds the
JSX-object write path, same byte-splice discipline.

## Mechanism (server, editor/lib.ts — one authority)
New op `set-jsx-style { file, line, col, prop (CSS), value }`:
1. Read the component TSX. `ts.createSourceFile` (TSX).
2. Walk to the JSXOpeningElement / JSXSelfClosingElement whose start line/col === the data-src
   position (1-based line, 1-based col — the tagging loader's own numbers).
3. Find the `style` JSXAttribute → JSXExpressionContainer → ObjectLiteralExpression.
   - Element without a `style` attr → out of v1 scope (report; needs attribute insertion).
4. CSS prop → JS key: camelCase (`font-size`→`fontSize`, `border-top-left-radius`→`borderTopLeftRadius`).
5. Existing property in the object → **byte-splice its value initializer**:
   - numeric-px CSS value + existing initializer is a NumericLiteral → write the bare number.
   - else → write a single-quoted string literal.
   - concurrency guard: verify current initializer bytes === expected (client sends `expectRaw`).
6. Property absent → insert `key: value,` after the object's `{` (indentation-matched).

## Client routing (commitOverrides)
Per dirty element: call editor-resolve. If it returns a decl for the prop → CSS path (E1.4).
If NO decl AND the element's file is a component with inline style → `set-jsx-style` using the
element's `data-src` line:col + the override prop/value. Detection: resolver response carries
`inlineCandidate: true` when the component file has no matching module.css rule for the classes
(or no module.css import at all).

## Non-goals (v1)
- Adding a `style` attribute to an element that has none (needs JSX attribute insertion).
- Token binding on inline styles (var() in JS style values — later).
- Text CONTENT editing — separate op `set-jsx-text` (JSXText child splice); ships in this phase
  only if the style path lands with time; else E2.4b.

## AC
1. Select the glass dome (inline-styled) → edit border-radius → Save → git diff = one changed
   value in Editor402.tsx; HMR reflects; override dissolves.
2. Numeric px value edits a number literal as a number (no stray quotes); non-numeric as a string.
3. Concurrency: stale expectRaw → 409, no write.
4. Jail: only src/**/*.tsx writable; outside → 403.
5. Prettier idempotent on the touched line.
