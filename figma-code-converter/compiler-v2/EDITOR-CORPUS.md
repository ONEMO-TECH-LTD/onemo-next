# Compiler v2 — Editor Round-Trip Corpus (P0 pin · C11 v3 V16/G13)

> P0 deliverable: the pinned corpus of select→edit→save→recompile cases G13 must pass. The
> interface authority is the documented editor contract in `figma-code-converter/SPEC.md`
> (§3.1 class contract, §3.2 slot law, §4b formatting law, AC8 byte-splice round trip) and the
> ENGINE-PLAN §5 `boxSlots`/`editSlot` slot law those sections cite. NOTE: no active
> `react-figma/engine.ts` implementation exists in THIS worktree — the implementation seam is
> UNVERIFIED here and must be re-verified against the live editor at P5.
> Status: P0 SPECIFICATION ONLY — implementation and evidence are assigned to P5 (fixtures,
> adapters) and P6 (G13 gate runs).

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
| EC8a | post-edit build stability | any of EC1–EC7 after Save-to-code | rebuild/typecheck the EDITED package (no converter re-run) | build+typecheck green; identity/source-map/render-order hashes stable except the edited segment | edit breaks build or churns unrelated artifacts |
| EC8b | converter re-run truth | unchanged snapshot recompiled AFTER a code-only edit | full compile from the same sealed snapshot | regeneration is deterministic from source truth and MAY overwrite the code-only edit — this is CONTRACTED, LOUD behavior (the report names the overwritten segments); bidirectional persistence is explicitly NOT contracted in v3 | overwrite happens silently, non-deterministically, or corrupts identity/maps |

## Acceptance mechanics (P6)

- Every case runs headless against the versioned v2 sandbox package: select via source map →
  apply edit through the editor write path → **parsed-diff + byte-range assertions** prove
  locality (allowed file/segment inventory per case; the assertion parses the diff hunks and
  checks every changed byte range lies inside the case's owning declaration/expression
  segment). `git diff --numstat` may be attached as supporting evidence only — it cannot prove
  hunk/segment locality.
- Diff-locality bounds are part of the fixture (exact allowed files, segments, and byte ranges).
- The G13 mutation rows in v3 §14.3 map 1:1 onto the FAIL column above.

## Dependencies

- EC4/EC5 fixtures require plugin-origin component/mode evidence → blocked with G-1/G-2
  (joint route); EC1–EC3, EC6–EC8 are expressible on Shape-class evidence.
