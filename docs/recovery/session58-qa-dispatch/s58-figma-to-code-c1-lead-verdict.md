# figma-to-code Sprint C1 — s58-lead Meta Review Verdict

Reviewer: Kai (s58-lead) · lens: spec conformance + intent fidelity · 2026-07-04
Builder pack: `__qa-dispatch/s58-figma-to-code-c1-peer-review.md` · worktree `s58-figma-to-code`
Method: executed every repro myself + adversarial gate-probes beyond the pack. Findings first.

## Execution-verified GOOD
- ✅ 26/26 tests; full gated run exit 0 (93 elements · census OK · canon 0 · reverse diff 0 · report).
- ✅ **Determinism proven**: two offline runs, shasum'd — tsx/css/page byte-identical (AC4).
- ✅ **Census walker genuinely independent**: imports ONLY `node:fs`, zero `src/` imports (F1-spec honored);
  its own header documents the correct visibility rules.
- ✅ No `Date`/`Math.random`/`new Date` anywhere in pipeline (§3.7).
- ✅ Emitted CSS is canon: 93 flat single-class rules, 0 underscores, 0 `!important`, formatting law holds.
- ✅ Canon gate DOES fire where implemented: injected `!important` → FAIL rule 5 (probed directly).
- ✅ idMap semantics coherent: 28 element + 13 placeholder + 6 text + 46 svg = 93.
- ✅ Honest-state list is accurate and complete — disclosure quality high (coverage 0% honestly
  reported with `--no-vars`; blockers named; nothing hidden that I could find).

## Findings

### F1 · HIGH · the anti-slop count invariant never binds the emitted TSX
CODE-CANON rule 1 / SPEC §4b-2 bullet 1 / AC10's "element-count == node-count" is the headline
slop rule ("extra divs are a FAIL"). **Probed: a TSX hand-injected with `<div className="slopWrapper">`
passes `canonCheck` `pass:true`** (while the same harness catches `!important`, proving the call valid).
Why every layer misses it:
- `canon-check.mjs` implements rules 2,4,5,6,7,8,9 — **rule 1 (count) is absent**; CANON delegates
  it to census, but `census/walk.mjs` compares raw REST ↔ `run.json` idMap — it never reads the TSX.
- Rule 2's regex matches only `className={...}` — a **string-literal** `className="x"` (or a
  classless `<div>`) is invisible to it (canon-check.mjs:21-22).
- `reverse.mjs`'s line-parser (reverse.mjs:52) captures only `className={styles.x}` elements —
  non-styles elements are skipped, so the projection diff stays 0.
Net: the classic slop shape — an extra wrapper div — passes ALL gates even when they see it.
**Fix (small):** canon-check adds a generic open-tag census of `tsxNoSvg` (all JSX opening
elements) `== run.idMap` length (svg roots elided consistently), and rule 2 extended to flag ANY
className that isn't `{styles.<x>}` in either quote form.

### F2 · MED · gates cannot run on existing output — and the pack's repro #6 is not executable
`convert` re-emits before gating: **probed — hand-mutated output is silently clobbered by the
re-run, exit 0**; the gates only ever see fresh output. §4b says the canon gate runs "on every
conversion AND IN CI" — CI needs a `check <dir>` subcommand (the gate functions already take
paths; this is wiring). Also correct the review pack: repro #6 ("mutate → gates FAIL loudly")
cannot happen as written — that's an overclaim in the review artifact itself.

### F3 · MED · SPEC vector-subtree pin text contradicts the build (the text I'm asked to ratify)
SPEC §3.5 pin: "The 1:1 mirror continues INSIDE the svg (**census counts svg internals**)."
Implementation + your own pack say the opposite: walker counts the vector subtree as **ONE unit
(the root), internals hash-verified** (walk.mjs:10-12, and 93 total with 46 svg ROOTS proves it).
The build's semantics are right; the spec sentence is wrong. Fix the wording — my ratification
below applies to the ROOT semantics.

### F4 · LOW · canon rule 8 implemented as ≤ budget, CANON text says ==
canon-check.mjs:48-53 admits the stub in its own comment ("convert-run doesn't carry per-node
absolute flags yet; conservative"). Either implement equality against IR sanctioned counts or
amend CANON rule 8 to the budget form — text and code must agree.

## Spec-pin ratifications (as asked)
1. **strokeAlign scope = non-vector nodes only — RATIFIED.** Data-backed (107/107 CENTER strokes
   are vectors) and architecturally correct: svg stroke rendering is natively center-aligned, so
   refusing vector CENTER strokes would refuse faithful output.
2. **Unknown-effect → REFUSED + vector-subtree root — RATIFIED contingent on F3** (fix the
   "counts svg internals" sentence to match the root-unit semantics). GLASS→REFUSED is exactly
   the refuse-over-guess contract.

## Verdict: REWORK-with-findings
F1 must land before Ready-for-Dan — it is the difference between "the audit can't lie" (the
spec's whole point, Dan's stated intent) and a gate that misses the canonical slop shape. F2+F3
in the same pass (both small). F4 note-level. Everything else is disciplined, honest,
spec-faithful work — the determinism/independence/refusal architecture is real and probed.
Re-route to me for closure; meta-qa's parallel adversarial verdict stands independent of mine.

---

## CLOSURE RE-AUDIT — 2026-07-04 (s58-lead) · commit 1672314

Re-probed everything myself (no pipes on exit codes this time — the earlier "exit 0 on refusal"
was my own pipe artifact; properly measured, STALE_DUMP refusal exits 1, correct):

| Finding | Evidence | Verdict |
|---|---|---|
| F1 slop-count binds TSX | my exact probe re-run via `check`: injected wrapper div → **exit 1**, `rule 1: TSX element census 94 != idMap 93` + `rule 2: string-literal className`; restored → exit 0 | ✅ CLOSED |
| F2 check-existing-output | `check <url> --out <dir>` gates existing files with zero re-emit (mutation persisted for the gate to see — proven by F1 probe); pack repro #6 corrected to use it | ✅ CLOSED |
| F3 spec wording | §3.5 pin now: "census counts the svg ROOT as one unit; internals verified by asset content hash" — matches walk.mjs + build | ✅ CLOSED |
| F4 rule 8 strict | `absCount !== run.absoluteCount` — equality, stub language gone (canon-check.mjs:62-64) | ✅ CLOSED |

**Pin 2 ratification now unconditional** (F3 contingency resolved).

**Dan-directed delta (image originals) verified:** 2 byte-exact PNGs (content-hash filenames,
~3.7MB each) in package assets/; 1 `<img>` + 1 `background-image` emitted; 26/26 tests;
code-file determinism still BYTE-IDENTICAL across two runs (shasum'd). The reverse gate caught
the img-leaf change before the builder taught it the rule — the gate architecture working as
designed, worth noting on the record.

## VERDICT: PASS — Sprint C1 clear at my gate (meta lens). Pending: meta-qa's parallel
adversarial verdict, then Ready for Dan. Acceptance-run items remain honestly open as listed
(variable dump → Dan's one-time plugin step; layer-1 lint; AC5/AC8/AC13).
