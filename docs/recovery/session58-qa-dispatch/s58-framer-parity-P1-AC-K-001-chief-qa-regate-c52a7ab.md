# AC-K-001 Chief-QA Re-gate R2 — REWORK

**Exact product SHA:** `c52a7ab7ea463c9baf5eba7fd1d85d2f133c6af7`  
**Supersedes target:** `9887362914ce4aa50bfa690d6d7aedd4f8260a70`  
**Scope:** AC-K-001 only; no AC-K-002/003 claim  
**Verdict:** **REWORK — direct collisions are closed, but computed runtime provenance still bypasses the reservation boundary**

## Binding clauses

- AC-3 `AC-K-001`: inner component nodes/layers are selectable with stable source identity.
- AC-3 `AC-J-005/006/007`: exact source, Dan-openable human-browser, and independent QA evidence.
- Hard Contract §1 law 6 and §10: ambiguous or unsupported mappings named-refuse without writing; source-identity ambiguity is mandatory test coverage.
- Architecture §7.1: accept exact current-source identity; never guess or select another node.

Authoritative hashes reverified:

- v1.4: `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`
- AC-3: `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`
- Hard Contract: `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`
- Architecture: `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`

## Closed from the prior gate

- `ComponentCanvas` consumes only `data-onemo-source`; legacy `data-src` cannot bind a node.
- Loader output appends one reserved attribute after direct JSX attributes and spreads.
- Direct authored reserved attributes and literal object-spread keys named-refuse with 422.
- Direct reserved attributes in a discovered TSX dependency named-refuse.
- Explicit legacy `data-src` is not duplicated.
- The committed Nested-vs-Label fixture stays correct across reload; all four missing/unowned/ambiguous/tag-mismatch resolver cases remain green.

These are real fixes. They do not close the runtime authority boundary below.

## Blocking finding

### K001-R3-F1 — computed-key host creation bypasses reservation and disables valid selection

Both reservation checks are raw substring searches. The loader only instruments host JSX nodes. This source therefore passes classification and import:

```tsx
import { createElement } from 'react'

const key = ['data', 'onemo', 'source'].join('-')
function NestedLabel() {
  return createElement('span', {
    'data-name': 'Nested',
    [key]: 'src/app/(dev)/react-figma-components/AuthoringE2EButton.tsx:999:1',
  }, 'Nested')
}
```

The production probe proved `importSourceFileToAuthoringStore` returned `imported` and persisted the sidecar. The loader cannot append its last-write attribute to this `createElement` host. In headed Chrome, the forged Nested span and real Label both carried the exact Label provenance. Runtime binding then produced:

```text
Nested: SOURCE_CONTENT_PROVENANCE_AMBIGUOUS, id=null
Label:  SOURCE_CONTENT_PROVENANCE_AMBIGUOUS, id=null
```

The committed happy-path test's Label locator fell from one selectable node to zero. This is fail-closed at the final resolver, but too late: an accepted source persisted authoring evidence and a legitimate inner layer became unselectable. It violates AC-K-001 and the pre-write refusal law.

Relevant seams:

- `editor-engine/tagging-loader.cjs:45-84` — substring guard plus JSX-only instrumentation.
- `src/lib/editor-source-provenance.ts:4-18` — duplicated substring guard.
- `src/app/api/dev/editor/authoring-import.ts:51-63` — production gate that accepts the computed alias.
- `ComponentCanvas.tsx:190-218` — trusts any matching DOM value after render.

## Additional quality finding

### K001-R3-F2 — reservation scan rejects harmless source text

Both loader and production snapshot reject any occurrence of the spelling, not an authored attribute/key. These valid sources named-refuse:

```tsx
const documentation = 'data-onemo-source'
// data-onemo-source is loader-owned
```

This is a false unsupported classification for source with no provenance collision. It also shows the loader and production checks are duplicate lexical implementations rather than one syntax-aware authority.

## Required rework

1. Make runtime provenance non-forgeable by ordinary authored props/DOM creation. A loader-owned registry/WeakMap keyed by the actual DOM element is the clearest boundary; an equivalent design is acceptable, but a source-controlled DOM string alone is insufficient.
2. If a reserved-attribute refusal remains, detect semantic JSX/object-key use rather than arbitrary comments or text. Loader and production classification must share the same rule.
3. Commit the computed-key `createElement`/forwarded-prop regression through production import and headed canvas. It must refuse before sidecar/history/transaction evidence or leave the foreign node unowned without making the legitimate Label ambiguous.
4. Preserve direct/object-spread/dependency collision refusals, one-emission/legacy-dedupe behavior, the four resolver refusals, and the reload-stable happy path.
5. Prove zero durable evidence on every refused collision path.

## Independent evidence

- Full reads: eight changed files, **2,482/2,482 lines**, exact commit diff, content resolver/test, and loader wiring.
- Committed focused suites: **33/33 PASS**.
- Exact-SHA temporary four-refusal probe: **1/1 PASS**; missing, unowned, ambiguous, and tag-mismatch all returned their named codes.
- Committed headed Chrome: **1/1 PASS**, 32.2s; real Label stable across reload, Nested unowned, zero writer traffic.
- Adversarial headed Chrome: exact DOM assertion **1/1 PASS**, 28.5s; Nested and Label both ambiguous/id-null after accepted import.
- Adversarial production probes: **3/3 PASS** as assertions of current behavior — computed alias imported and wrote a sidecar; direct dependency collision refused; harmless text falsely refused.
- Full Vitest attempt: **470 passed / 10 declared skipped / 1 failed by the known V1 migration 20s timeout**. Exact focused rerun passed in 7.635s. No product failure was hidden.
- Typecheck: PASS. Changed-file ESLint: PASS.
- Exact worktree, fixture, route, and `.onemo` cleanup restored clean.

## Deslop

- The legacy-binding consumer is removed from component content selection; no K-002/K-003 or writer scope leaked in.
- No TODO/HACK/dead helper landed.
- Reservation logic is duplicated between CommonJS loader and TypeScript production code and is over-broad in both; this is the only new slop finding beyond the authority bug.

## Stamp disposition

- `AC-J-005`: source proof present.
- `AC-J-006`: committed human-visible happy path is supporting; adversarial human-visible proof fails the row.
- `AC-J-007`: **REWORK**.
- Do not route AC-K-001 to Meta and do not stamp `AC-J-008`.
