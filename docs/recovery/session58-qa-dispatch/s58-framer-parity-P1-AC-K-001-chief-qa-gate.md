# AC-K-001 Chief-QA Gate — REWORK

**Exact product SHA:** `71df05b74102fe5de331ef6a43ca527b0c30e2f6`  
**Scope:** AC-K-001 only; no AC-K-002/003 claim  
**Verdict:** **REWORK — source identity can be silently attached to the wrong runtime node**

## Binding clauses

- AC-3 `AC-K-001`: inner component nodes/layers are selectable with stable source identity.
- AC-3 `AC-J-005/006/007`: named-commit source proof, Dan-openable human-browser proof, independent QA.
- Completion Contract v1.4 §Build-order: all `AC-K-*` are P1 atomic rows.
- Hard Contract §1 law 6 and §10: unsupported/ambiguous mappings named-refuse without writing; SourceAnchor formatting/line drift and ambiguity tests are required.
- Architecture §7.1: line/column are not identity; current-source resolution accepts exact identity and never falls back to a guessed location.

Authoritative hashes reverified:

- v1.4: `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`
- AC-3: `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`
- Hard Contract: `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`
- Architecture: `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`

## Blocking finding

### K001-F1 — tag-only runtime binding silently misidentifies a source node

`bindSourceContent` skips an unmatchable source child but keeps the same DOM cursor, then greedily binds the next same-tag intrinsic source layer to the first matching rendered DOM descendant. The resulting DOM gets the later layer's valid anchor ID even when that DOM was emitted by the skipped custom component.

Exact adversarial fixture:

```tsx
function NestedLabel() {
  return <span data-name="Nested">Nested</span>
}

export function AuthoringE2EButton() {
  return <button><NestedLabel /><span data-name="Label">Primary</span></button>
}
```

Independent headed Chrome result:

- Expected the node carrying the Label anchor to have `data-name="Label"`.
- Received `data-name="Nested"`.
- The wrong Nested DOM carried `data-authoring-node-line="3"`, `data-authoring-node-col="47"`, `data-authoring-node-tag="span"`, and the Label anchor ID `2d5dea…:0`.
- The committed E2E stayed structurally capable of passing because it checks the assigned node's tag/file/export, not that the assigned DOM is the actual source-owned Label.

This is not a missing cosmetic selector. It makes the source identity false, so later K-002/K-003 edits could target the wrong source node.

Relevant source:

- `ComponentCanvas.tsx:50-63` — greedy tag matcher and skipped-child cursor behavior.
- `ComponentCanvas.tsx:195-223` — guessed bindings become authoritative DOM attributes.
- `content-selection.ts:16-49` — stable composite layer ID and projection-side exact anchor join.
- `react-figma-authoring.spec.ts:196-264` — direct-child-only browser fixture coverage.

## Required rework

1. Replace tag-only DOM traversal with exact current-source provenance matching. The rendered DOM already exposes `data-src`; match its jailed file + current line/column to one projection anchor, then expose the formatting-stable fingerprint/ordinal ID.
2. Missing, duplicate, cross-file, custom-component-emitted, or ambiguous runtime provenance must leave the node unbound or named-refuse. Never skip-and-guess by tag.
3. Extract the runtime binder into a directly testable helper.
4. Commit the exact nested-custom-component regression above. Assert Nested receives no Label identity, the real Label receives it, reload preserves it, and both writer routes remain untouched.
5. Add missing/ambiguous runtime-provenance refusals plus the existing formatting-drift and identical-sibling cases.

## Passing evidence

- Full changed-source and immediate-authority read completed; exact 5-file diff fully read.
- Focused committed K-001 unit suite: **3/3 PASS**.
- Independent correct-root headed run: **1/1 PASS**, 24.986s, port 3079; same Label ID after reload; zero `/editor-authoring` POST and zero `/editor-write`; zero page/console/failed-response errors.
- Dan-openable screenshot: `/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-k001-71df05b/.playwright-cli/ac-k001-71df05b-selected-after-reload.png`.
- Negative control made line position part of the ID: formatting-drift/ID tests failed **2/3** as expected; mutation restored.
- Typecheck: PASS.
- Changed-file ESLint: PASS.
- Full Vitest: **463 passed / 10 declared skipped / 1 unrelated timeout**. The timed-out V1 migration assertion passed focused **1/1 in 4.039s**; no assertion failure.
- Worktree restored clean at exact SHA; fixture marker/store cleanup confirmed.

## Deslop

- No duplicate K-001 parser or second content-selection state owner.
- No K-002/K-003 content mutation/compiler path landed.
- No legacy writer call landed.
- No dead helper/TODO/HACK surface in the slice.
- `bindSourceContent` is active, single-use code and must be **REWORKED**, not archived or deleted as cemetery code.

## Stamp disposition

- `AC-J-005` source proof: present at exact SHA.
- `AC-J-006` human-visible proof: supporting happy-path evidence exists, but the row cannot pass while source identity is false on the adversarial shape.
- `AC-J-007` Chief-QA: **REWORK**.
- Do not route AC-K-001 to Meta and do not stamp AC-J-008.
