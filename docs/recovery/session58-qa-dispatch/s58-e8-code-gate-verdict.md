# Sprint E8 — code gate — s58-lead verdict

Reviewer: Kai (s58-lead). Requested by @s58-designer. FROZEN HEAD `583e221` (range `c93bab9..583e221`,
5 commits; diff = page.tsx + editor-engine/audit/{input-behavior,inspector-conformance}.mjs;
figma-spec.json is a pre-range contract artifact, reviewed as asked). Method: full diff read + audit-
tool line-by-line vs the expert harness laws + spec provenance trace + tsc. Tree is the working HEAD
so tsc ran in place. No code changes. @s58-qa runs the live gate in parallel.

## Verdict: **FAIL-with-findings** — one MED write-integrity bug (F-A) is the bounce; F-B/F-C/F-D are LOW hardening. Undo integrity, scrub, audit-harness laws, and spec provenance are all sound.

---

## PASS — verified

**Q2 · Undo integrity — sound.** (a) The draft refactor makes `onChange` fire **once per Enter**
(via `commitDraft`), not per keystroke → exactly one `applyOverride` → **one history entry per
commit** (this genuinely fixes item 10's per-keystroke pollution). (b) The `__frame__` special entry
is **poison-safe**: element ids come from `data-eng-id`, which can never equal the literal
`'__frame__'`, so the `if (c.id === '__frame__')` branch can't be hijacked by a normal override; the
JSON round-trip only ever parses `JSON.stringify(preset)` output (guarded `?? 'null' ?? ref` on undo;
`c.after` is always a stringified preset on redo, and non-frame entries never reach `JSON.parse`).
Each preset change pushes its own single-element step + clears redo. No poisoning.

**Q1 · Scrub stale-closure — correctly handled.** `scrubUp` commits from `scrub.current.lastVal`
(the ref), NOT the `draft` state — the code comments the exact reason ("state draft can lag a frame
behind the last pointermove"). Right call; the ref is the source of truth on release.

**Q3 · Audit tools obey the harness laws.** Both: read-the-MODEL (assert against the iframe
`#engine-overrides` staging sheet, not the input box), real Playwright keyboard/mouse, oracle-from-
contract (`figma-spec.json`), fail-closed (no-playwright → exit 1; empty census → fail; `measured:false`
contract entries → fail with PENDING; any failure → exit 1). **Census container-climb (the flagged
concern) does NOT greenwash:** the 4-level climb (`inspector-conformance.mjs:60-67`) only walks
`parentElement`, so it can never reach a sibling field's 24px/5px container; a wrong stop lands on a
section/panel ancestor whose height/radius *fail* the contract tolerance → a **loud false-FAIL**, not
a false pass. The behavior-gate regexes read the real model with precise substrings
(`/opacity: 0\.42/`, `/rotate\(20deg\)/`) — real oracles.

**Q4 · figma-spec.json provenance — sound.** `_provenance` states the discipline (measured live
2026-07-07; `measured:false` MUST fail until filled). Honest flags: `scrub.measured:"behavior-convention"`
openly marks the ew-resize cursor as a *platform equivalent*, not a false Figma measurement;
per-block `measured:true` with element-level `_provenance` pointers. Muted-state is documented
(`_mutedNote`) and encoded (`mutedAllowedFields` + `mutedInkColor`). Critically, `inputCommitSemantics.
blurWithoutEnterReverts` is **measured-proven** ("typed 50 into X, clicked canvas, node.x stayed 0 via
plugin API read") — so blur-revert is the real Figma contract, not an invention. That resolves any
"should blur commit?" question: OURS matches the measured spec, and F-A below is a separate bug.

**Q5 · Responsive minmax — low regression risk.** `88px 88px 24px` → `minmax(88px,1fr) minmax(88px,1fr)
24px` grows the two value columns symmetrically (equal 1fr, 88px floor) with the 24px icon column
fixed; `FigmaField`'s numeric-width→`{width:'100%', minWidth:n}` is the intended fill behavior (behavior
G7 asserts fields grow + never drop below 88). Panel clamp 232-440 → 241-480 matches the contract.
Pixel/visual confirmation is Codex's lane.

**tsc = 0** on `583e221`.

---

## FAIL

### F-A · MED · `LinkTargetField` Enter **double-fires** `onCommit` → two `wrap-jsx-link` writes (double-wrap / 422)
Of all field call sites, exactly one passes `onCommit`: `LinkTargetField → FigmaField onCommit={onCommit}`
(→ `applyLink`, page.tsx:3688). On Enter with a typed draft, the handler runs `onCommit` **twice**:
1. `onKeyDown` Enter: `commitDraft()` (fires `onChange`), then `onCommit?.(draft!)` → **applyLink #1**,
   then `e.currentTarget.blur()`.
2. `blur()` synchronously invokes `onBlur`: `if (onCommit && editing)` — but `setDraft(null)` from
   step 1 has NOT flushed (React batches inside the event handler), so the render-closure `editing`
   is still `true` and `draft!` still the old value → `onCommit(draft!)` → **applyLink #2**.

`applyLink` POSTs `wrap-jsx-link` (page.tsx:2461) at `target = linkTarget ?? sel` — the SAME
(file,line,col) both times (no re-selection between the two near-synchronous calls). The 2nd POST
wraps whatever the 1st already shifted at those coords → a nested `<a><a>…</a></a>` (valid TSX, so
`assertValidTsx` won't stop it → real source corruption) or a 422 on the 2nd. Either way every Enter
in the link field is a double server write. **(The 27 `onChange`-only fields are single-commit — Enter
fires `onChange` once and blur reverts the already-null draft — so they're clean; this is scoped to the
one `onCommit` field.)**

**Solution:** a ref guard defeats the stale-closure race:
```
const justCommitted = useRef(false)
// Enter branch: ...commit..., justCommitted.current = true, e.currentTarget.blur()
// onBlur: if (justCommitted.current) { justCommitted.current = false; return }  // Enter already committed
```
So Enter commits exactly once and the trailing blur no-ops. (Alternatively: Enter calls only
`e.currentTarget.blur()` and lets `onBlur` be the single commit path — but that reverts onChange-only
fields, so the ref guard is the clean uniform fix.)

---

## LOW / hardening

### F-B · LOW · Audit oracles partially decoupled from the contract (harness-law drift)
Two spots assert a real value but a **hardcoded literal**, not the contract — so a `figma-spec.json`
change wouldn't propagate (silent stale-pass against a new contract):
- `input-behavior.mjs`: expected literals `480/241` (clamp), `0.42` (opacity), `20deg` are inline, not
  read from `SPEC.panel.ourMaxWidth` / `ourMinWidth` etc.
- `inspector-conformance.mjs:162`: pill-font check hardcodes `(e,a) => a === '11px w400'` and ignores
  `pillSpec.font`; the `.replace('px w','px w')` is a no-op (dead). Displayed-expected is the contract,
  actual gate is a literal.
**Fix:** derive both from `SPEC` (`\`<=${SPEC.panel.ourMaxWidth}\``, compare pill font to `pillSpec.font`).
Not a greenwash today (values match), but it's exactly the oracle-from-contract law the harness claims.

### F-C · LOW · Behavior suite doesn't cover the `onCommit` field (where F-A lives)
G1-G3 exercise the `onChange`-only path (opacity: blur-reverts, Enter-commits-once) but no gate drives
`LinkTargetField`'s Enter — so the audit is green while F-A ships. **Fix:** add a link-field Enter gate
asserting a **single** `wrap-jsx-link` effect (network-request count === 1, or one resulting `<a>` not
`<a><a>`).

### F-D · LOW · Minor spec/code drifts (non-blocking)
- Panel min: spec `ourMinWidth:240` vs code clamp `241` (both gates tolerate; align one).
- Muted X/Y `inkColor` is effectively **un-gated** — `conformance:85-86` passes X/Y whether muted or
  normal ink (the audit can't know if the selected node is an auto-layout child). Acceptable, but a
  wrongly-muted non-child X/Y wouldn't be caught. Note in the contract.

## Bottom line
The structural spine is sound — undo is single-entry-per-commit with a poison-safe `__frame__` path,
scrub commits from the ref (no lag bug), the two audit tools genuinely read the model / fail closed /
take the oracle from the measured contract, and the spec's provenance discipline (incl. the measured-
proven blur-revert) is honest. The one real defect is F-A: the single `onCommit` field double-writes
`wrap-jsx-link` on Enter via a stale-closure blur re-commit — fold the ref guard (F-A), tighten the two
oracle literals (F-B), add the missing link-Enter gate (F-C), and the LOW drifts (F-D). I re-probe the
link-field Enter (single write) + F-A guard at the fixed HEAD for closure. Codex's live gate runs
independent.

---

# CLOSURE — re-audit @ `92688af` → **F-A/F-B/F-C/F-D CLOSED; one LOW residual (F-E) flagged**

One commit over target; diff = page.tsx + both audit tools + spec. Each fold re-verified.

**F-A · CLOSED — Enter fires `onCommit` exactly once.** `justCommitted` ref set at the top of the
Enter branch; `onBlur` consumes-and-returns (`if (justCommitted.current) { …=false; return }`) before
the commit block. Traced: Enter → guard=true → commitDraft (one onChange) → onCommit #1 → `blur()` →
onBlur sees guard=true → returns, **no 2nd applyLink**. Blur-without-Enter and the onChange-only fields
are unaffected (guard stays false → normal commit/revert). The double `wrap-jsx-link` is dead.

**F-C · CLOSED — G11 honestly proves it.** New gate `page.route('**/api/dev/editor-write')` counts
`wrap-jsx-link` POSTs, **fulfills with a 200 stub (no real source write)**, types + Enter on the link
field, asserts `linkWrites === 1`; missing field → fail; `page.unroute` cleanup. Real oracle, fail-
closed — it would read 2 pre-fix, 1 now.

**F-B · CLOSED.** Behavior clamps read `SPEC.panel.ourMaxWidth`/`ourMinWidth`, min-field reads
`SPEC.valueField.containerWidth`; conformance pill-font now `(e,a)=>a===String(e)` against
`pillSpec.font` (no-op `.replace` removed). Oracle-from-contract restored on both.

**F-D · CLOSED.** Spec `ourMinWidth` 240→241, consistent with the code clamp (241) and both gates.

**tsc = 0** @ `92688af`.

### F-E · LOW · Escape on an `onCommit` field (link) COMMITS instead of reverting — same class, guard is Enter-only
The `justCommitted` guard is set in the Enter branch only. Escape does `revertDraft(); e.currentTarget.blur()`
— the trailing synchronous `onBlur` sees `justCommitted=false` and `editing` still `true` (setDraft(null)
unflushed) → `onCommit(draft!)` **commits the typed value**. So pressing Escape in the Link field applies
the link instead of discarding it (and `applyLink` isn't in `historyRef`, so it's not Ctrl+Z-undoable).
**Pre-existing** — identical `onBlur`/Escape structure at `583e221`, NOT introduced by the F-A fix — and
LOW (link field only; onChange-only fields correctly revert via `onBlur`'s else, which is why behavior
G3 stays green). The audit doesn't catch it because G3 tests opacity (onChange-only), not the link field.
**Solution:** set `justCommitted.current = true` in the Escape branch too (Escape also programmatically
blurs), so the trailing blur no-ops and the draft is genuinely discarded. Optionally add a G12 gate:
Escape on the link field → zero `wrap-jsx-link` writes.

**Verdict: the four findings I filed are CLOSED and execution-verified; F-A proven single-write by
G11.** F-E is a pre-existing LOW of the same stale-closure class, surfaced by the closure trace —
recommend folding the one-token Escape guard, but it doesn't reopen the E8 code gate. **E8 code gate:
PASS on my lens @ `92688af`** (F-E tracked as a LOW follow-up). Codex's live gate independent.

---

# F-E DELTA-CONFIRM @ `6111a8d` → **CLOSED**

Diff = 1 token (page.tsx) + G12 gate (input-behavior.mjs). Escape branch now sets
`justCommitted.current = true` **before** `revertDraft(); e.currentTarget.blur()`, so the trailing
synchronous `onBlur` hits `if (justCommitted.current) { …=false; return }` and short-circuits
**before** the commit block — the `onCommit(draft!)` mis-commit is gone; the draft is genuinely
discarded. The guard is consumed by its own trailing blur in the same call stack, so it never lingers
to a later event. **G12 proves it honestly:** reuses the G11 route-stub, types into the link field,
presses Escape, asserts `linkWrites - beforeCount === 0` (would be 1 pre-fold). tsc 0.

**Every E8 code-gate finding (F-A/B/C/D + F-E) is now CLOSED and execution-verified on my lens @
`6111a8d`.** Note: @s58-qa's parallel live gate is NOT yet concluded — it hit a usage cap mid-run and
mentioned "one real manual failure" before stalling (verdict pending its return). Both gates must land
for Dan's Done; my (code/write-safety/harness-law) gate is green, Codex's is outstanding.
