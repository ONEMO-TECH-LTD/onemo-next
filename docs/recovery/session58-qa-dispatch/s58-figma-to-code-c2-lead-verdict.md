# figma-to-code C2 (kill structural refusals) — s58-lead Meta Review Verdict

Reviewer: Kai (s58-lead). Requested by @s58-expert. Commits `a5c867b` + `b40e48f`, base `64071a4`.
Method: re-derived all evidence (didn't trust), read the refactored ir/emit/reverse/canon, probed
the NEW geometry paths + ran the check-command gates adversarially. Findings → @s58-expert.

## Re-derived evidence (matches the brief)
- 27/27 tests. Golden `4084-25997`: 55 elements, **0 structural refusals**, 1 property refusal,
  census OK, canon 0, coverage 77%, unresolved 0, exit 0. Determinism byte-identical. absoluteCount
  4 == CSS `position:absolute` count 4.
- **Generality proven**: 2nd screen `518:5279` → 70 elements, census OK, canon 0, reverse diff 0,
  ZERO code change. Conformance FAIL is correct (1% bound WIP + 1 unresolved `--branding-col-…`
  token — a real DS gap the resolution gate surfaced, verified not a converter bug).

## Findings

### F1 · HIGH · the `check` command's reverse gate false-positives on the converter's OWN pristine output
`convert` reports `reverse round-trip: OK (diff 0)`; `check` on the **same untouched output** reports
`reverse round-trip: FAIL ×1 [/topSection/titleAndControls/effect.tag: ir="span" code="h4"]` —
reproducible on a fresh convert.
**Root cause (pinned):** `check` builds its reverse-comparison IR with `buildIr(r.document, null)`
(`bin/figma-to-code.mjs:143`) — **varMap hardcoded null** — while `convert` builds with the real
varMap (`bin:63-66`). §3.6 heading promotion is token-driven: `expectedTag` returns `h4` only when
the text node carries a `tokenPath` (`reverse.mjs:19-24`). With `varMap=null` the check-IR text node
has no tokenPath → `expectedTag` = `span`, but the on-disk code (emitted at convert with varMap) is
`h4` → guaranteed mismatch. This is a **regression exposed by `6234ada`** (typography tokenization
introduced heading promotion; before it, no promoted text, so no divergence).
**Impact — serious:** (a) any design with heading-bound text makes `check` reverse RED on correct
output; the golden frame already trips it. (b) §4b says the canon gate runs "in CI" — CI is
permanently red on reverse. (c) **The brief explicitly asks meta-qa to run the mutation battery on
the official `check` command** — but check-reverse is failing on baseline, so a real reverse
regression can't be distinguished from this noise (every mutation "fails reverse"). The gate is
uninformative until fixed.
**Fix:** `check` must load the variable map the same way `convert` does (staleness-guarded
`loadVariableMap`) and pass it to `buildIr`, so the reverse IR matches what was emitted.

### F2 · MED · reverse round-trip (AC7) does NOT verify geometry VALUES — only structure
`projectIr` (`reverse.mjs:31-45`) projects `kind / cls / tag / text / children` — **no `left/top/
width/height/transform`**. So AC7 proves STRUCTURAL fidelity (tree, tags, classes, text), not
GEOMETRIC fidelity. This C2 change's ENTIRE deliverable is faithful geometry (absolute coords from
Figma, `transform: rotate`), yet a wrong coordinate or rotation would pass census + canon + reverse
and be caught only by the human pixel-pass (AC5). For Dan's explicit "100% faithful reproduction, no
agent judgment" bar, the mechanical proof has a hole exactly on the dimension this refactor adds.
**Answers meta-ask #4 directly: yes — AC7 can pass while the geometric intent silently fails.**
**Fix (or explicit defer with Dan aware):** include resolved numeric geometry (the absolute
offset, size, rotation deg) in the reverse projection and diff it, so the geometry is mechanically
proven, not eyeballed.

## Meta asks answered
1. **No-refuse faithfully implemented?** Yes. Every visible layer → one element (55 golden / 70
   2nd-screen, census OK both). Absolute geometry is CORRECT — verified against raw Figma coords:
   the 4 CSS-absolute FRAMEs ("BG"/"Fill+Shadow") genuinely sit at parent origin (0,0), and the 115
   non-zero offsets are all VECTOR nodes → inline `<svg>` (offset baked into geometry, the right
   place). `offsetIn` (ir.mjs:216-219, `c.x-p.x`) is correct.
2. **SPEC == code?** Yes. No stale structural-refusal claims — §3.3 rewritten; the remaining
   "placeholder" refs are the legit missing-ASSET fallback (SPEC:152) + correctly-updated
   CODE-CANON:28 / SPEC:252 ("no placeholders — structure always converts").
3. **Deslop safe?** Yes. Placeholder removal didn't break the gates — reverse still catches a dropped
   element (×11) and census catches it (rule 1: 54≠55); canon rule 9 catches a reordered `transform`.
   The reverse gate's structural checking is intact (F1 is a separate varMap bug, not deslop damage).
4. **AC pass while intent fails?** Yes — see F2 (geometry) and F1 (the auditable check-gate
   disagrees with convert on correct output).

## Adversarial results (mine)
- drop an absolute child → **census FAIL** (rule 1) + reverse ×11 ✅
- reorder a `transform` decl → **canon rule 9 FAIL** ✅

## Verdict: REWORK-with-findings
F1 blocks — the auditable `check` gate (the one CI and meta-qa's battery use) is red on correct
output; it must agree with `convert` before the mutation battery or Dan sign-off means anything.
F2 is a real gap in the mechanical guarantee for this change's core dimension — fix it or defer it
with Dan explicitly aware that geometry is currently pixel-pass-only. Everything else — the no-refuse
model, absolute geometry correctness, determinism, SPEC sync, generality — is strong and verified.
Re-route to me for closure; I'll re-run check-reverse at the fixed HEAD. Codex's adversarial verdict
stands independent.

---

## LOCKED CLOSURE — 2026-07-04 (s58-lead) · frozen HEAD 23ba592

Re-ran every case at the frozen HEAD (worktree clean):

| Finding | Fix | Evidence @23ba592 | Verdict |
|---|---|---|---|
| F1 check-reverse false-positive | `check` now `loadVariableMap` + `buildIr(document, varMap)` (bin:147-148, mirrors convert) | fresh convert → `check` on pristine golden → **reverse diff 0** (was FAIL ×1) — check now agrees with convert | ✅ CLOSED |
| F2 geometry not in reverse | reverse projection carries `geom` (position/left/top/width/height/transform; `geomOf` resolves absolute x/y, rotation deg, size tokens) | golden diff 0; `left:0→77px` → **reverse FAIL** `.bg geometry left`; `rotate(1.57)→16.57` → **reverse FAIL** `.trailingButton geometry transform` | ✅ CLOSED |
| regressions intact | — | transform-reorder → canon rule 9 FAIL; census/drop still bite | ✅ |
| determinism | — | double-convert byte-identical; 29/29 tests (geometry tests added) | ✅ |

**Both findings execution-verified closed.** The mechanical fidelity proof now covers geometry —
the exact dimension this refactor added — so AC7 can no longer pass while a coordinate/rotation is
wrong. F1's fix makes the auditable `check` gate agree with `convert`, so CI and meta-qa's
mutation battery run against a green baseline. (meta-qa's unstyled-wrapper HIGH also folded here.)

## VERDICT: PASS — C2 (kill structural refusals) closed at named HEAD 23ba592. All findings verified.
