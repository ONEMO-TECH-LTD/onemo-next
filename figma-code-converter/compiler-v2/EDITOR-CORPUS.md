# Compiler v2 — Editor Round-Trip Corpus (P0 pin · C11 v3 V16/G13)

> P0 deliverable: the pinned corpus of select→edit→save→recompile cases G13 must pass, spec'd
> against the react-figma engine contract (onemo-next `src/app/(dev)/react-figma/engine.ts`:
> `splitSlots`/`boxSlots`/`editSlot` slot law; byte-splice writes; `DeclRef` resolution;
> `data-src` element tagging; default-import CSS-module resolver, no-underscore class law).
> Status: SPEC (no implementation authorization; fixtures are built in P5, gated in P6).

## Corpus cases (each = fixture + mutation pair)

| # | Case | Select | Edit | Required localized diff | Mutation that must FAIL G13 |
|---|---|---|---|---|---|
| EC1 | slot-preserving padding | semantic element by stable source id | one padding side via panel | exactly one declaration line changes; untouched slots keep verbatim text (1→2→4 minimal form preserved) | edit rewrites unrelated slots or reorders declarations |
| EC2 | slot-preserving radii | element with mixed corners | one corner | same slot law on `border-radius` | corner edit collapses mixed corners to shorthand-of-different-meaning |
| EC3 | token-expression segment | bound decl (e.g. `calc(var(--x)/100)`) | rebind token via picker | ONLY the `var(--…)` segment swaps; wrapper expression + segment index intact; source-map entry updates | rebind bakes the resolved literal or rewrites the whole declaration |
| EC4 | component prop | generated component instance | typed variant/BOOLEAN prop change | one JSX prop mutation; component identity/key unchanged | prop edit flattens the instance or renames the component symbol |
| EC5 | scoped-mode boundary | node inside a descendant mode scope | edit inside the scope | scope marker + `ModeContextId` untouched; edit lands within the scope | save drops/duplicates the mode-context marker |
| EC6 | auxiliary fragment ownership | render fragment by `fragmentId` in render-inspection mode | none (selection contract) | fragment resolves to its OWNING source node for semantic editing; cannot masquerade as a sibling semantic element | fragment selected as fake semantic element, or unselectable, or wrong owner |
| EC7 | text content | text node | character edit | escaped JSX children change only; ranges/bindings intact | edit merges styled ranges or unescapes |
| EC8 | save-recompile stability | any of EC1–EC7 after save | recompile from same snapshot + edited package | recompile is deterministic; identity/source-map/render-order hashes stable except the edited segment | recompile churns unrelated files (change-locality break) |

## Acceptance mechanics (P6)

- Every case runs headless against the versioned v2 sandbox package: select via source map →
  apply edit through the editor write path → `git diff --numstat` proves locality bounds →
  recompile → G2/G6/G9 re-verify on the edited package.
- Diff-locality bounds are part of the fixture (exact allowed line counts per case).
- The G13 mutation rows in v3 §14.3 map 1:1 onto the FAIL column above.

## Dependencies

- EC4/EC5 fixtures require plugin-origin component/mode evidence → blocked with G-1/G-2
  (joint route); EC1–EC3, EC6–EC8 are expressible on Shape-class evidence.
