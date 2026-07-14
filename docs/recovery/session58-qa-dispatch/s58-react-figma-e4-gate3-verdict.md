# react-figma E4 Gate-3 — s58-lead Adversarial Code/Write-Safety Audit

Reviewer: Kai (s58-lead). Requested by s58-designer (Dan's production-readiness mandate). HEAD `82305be`.
Parallel: Codex runs the UI/visual matrix. This is the code + write-safety + deslop gate.
Method: read the new ops/routes, execution-probed every guard live on :3025 (scratch files removed,
tree clean). Findings → s58-designer.

## Execution-verified GOOD
- ✅ **insert-component guards**: text-bearing container → 422, self-closing → 422, invalid-name
  `"1 2"` → 422 "invalid code (6 parse errors)" file UNWRITTEN, valid → 200 + import added +
  `<Card/>` inserted. `assertValidTsx` on output is wired.
- ✅ **editor-source**: dev-only guard; read-jail `resolve`+startsWith(src/|storybook/) + `.tsx/.ts/.css`
  only. Probed: `../../../../etc/passwd` → 403, absolute `/etc/passwd` → 403, valid `src/…/lib.ts` → 200.
- ✅ **editor-components**: dev-only, read-only, lists `react-figma-components/*.tsx`, missing-dir handled.
- ✅ **editor-image**: `.svg` still excluded from `OK_EXT` (E3-F2 stays fixed).
- ✅ **Deslop**: all 3 de-exports still referenced internally — `INHERITABLE` (engine.ts:16→330),
  `layerLabel` (:130→145,336), `splitSlots` (:161→176,186). Nothing external broke.
- ✅ **Regression battery**: gradient-alias (E3-F1) gradient PRESERVED on set-background-color; CSS
  write-jail `lib.ts` → 403 ".tsx only"; tsc 0 real errors (only stale `.next` types for deleted
  scratch pages); tree clean.

## Findings

### F1 · HIGH (security / production-readiness) · insert-component injects arbitrary code via unvalidated `importPath`/`name`
`insertComponent` (lib.ts:614-618) splices `op.name` and `op.importPath` **raw** into executable
positions — `<${op.name} />` and `import { ${op.name} } from '${op.importPath}'` — with NO input
validation. The only gate is `assertValidTsx`, which checks *syntax*, not *intent* — so a crafted,
syntactically-valid payload injects a statement past it.
**PROVEN live:** `importPath = "x'; export const PWNED = 1 //"` → 200, source became
`import { Card } from 'x'; export const PWNED = 1 //'` — the injected `export const PWNED = 1`
landed as real executable code. (My first payload 422'd only because it left an unbalanced paren;
the comment-terminated balanced one lands.)
**Threat model:** the write API is dev-only + same-origin, and `importPath` is normally server-derived
(editor-components emits `@/app/(dev)/react-figma-components/${name}`). BUT a malicious site open in the
dev's browser can fire a no-cors POST to `localhost:3025/api/dev/editor-write` — the write side-effect
still executes → code injected into the dev's source → runs on next compile. Dev-only caps the blast
radius, but for a *production-readiness* audit, injecting executable code into source through an
unvalidated field is a real hole. Note: `make-component` is NOT affected — it sanitizes name via
`replace(/[^a-z0-9]/gi,'')` (strips quotes/semicolons); `insert-component` uses raw inputs.
**Fix (small, standard):** validate before splicing — `op.name` against `/^[A-Z][A-Za-z0-9]*$/`
(component identifier), `op.importPath` against a safe module-specifier pattern
(`/^[@\w./-]+$/`, no quotes/semicolons/whitespace) → 422 otherwise. Closes it independent of
assertValidTsx. (Same one-line guard worth adding to any future op that splices identifiers/paths.)

## Battery results (Dan's 4 asks)
1. insert-component parse-guard — **covered**, but input-injection gap (F1).
2. new dev routes + .svg — **PASS** (jails, dev-guards, traversal 403, .svg excluded).
3. deslop de-exports — **PASS** (all 3 still referenced).
4. prior write-safety regression — **PASS** (gradient alias, jail, tsc, no pollution).

## Verdict: FAIL-with-findings (one HIGH)
Everything structural is clean — the guards, jails, dev-gates, deslop, and regression all hold. The
single blocker is F1: insert-component's raw `name`/`importPath` inject executable code past
`assertValidTsx` (proven). Small fix (two input-pattern validators). Re-route for closure; I re-probe
the balanced injection at a named HEAD. Codex's UI/visual verdict stands independent.

---

## LOCKED CLOSURE — 2026-07-05 (s58-lead) · frozen HEAD 0d61348

F1 re-probed at the named HEAD (validators at lib.ts:605-609, BEFORE splice):

| Case | @0d61348 | Verdict |
|---|---|---|
| Balanced injection `importPath = x'; export const PWNED=1 //` | **422** "invalid import path"; no PWNED in source | ✅ CLOSED |
| Malicious name `"a b"` | **422** "must be a PascalCase identifier" | ✅ |
| Injection-char name `Card/><script` | **422** | ✅ |
| Valid `@/app/(dev)/react-figma-components/Card` (parens) | **200** clean insert+import — no over-refusal | ✅ no regression |
| tsc / tree | 0 real errors; clean | ✅ |

**Fix quality:** input validated (`name` /^[A-Z][A-Za-z0-9]*$/, `importPath` /^[@\w./()-]+$/ — parens
allowed for the (dev) route-group, no quotes/semicolons/whitespace) BEFORE any splice, so the vector
is sealed independent of `assertValidTsx`. The syntax-only guard is no longer the sole defense on
identifier/path fields.

## VERDICT: PASS — E4 Gate-3 (code/write-safety) closed at named HEAD 0d61348. Injection vector
sealed, all guards/jails/deslop/regression verified. Codex's UI/visual verdict stands independent
(both gates needed for Dan).
