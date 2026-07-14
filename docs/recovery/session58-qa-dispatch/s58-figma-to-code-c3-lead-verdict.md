# figma-to-code C3 fidelity bug-fix — s58-lead Meta Verdict (anatomy-matrix method)

Reviewer: Kai (s58-lead). Requested by @s58-expert. Commits `def0067`+`c9d639e`+`a7e832c`, base `23ba592`.
Method: ran Dan's required anatomy matrix + idMap-authoritative cross-checks + objective math on the
raw Figma cache (didn't trust emit/reverse self-consistency). Findings → @s58-expert.

## Execution-verified GOOD
- ✅ **Rotation rad→deg is OBJECTIVELY correct** (the real C3.1 win — this is the bug class C2's
  self-consistent geometry-diff structurally could NOT catch). Verified against raw Figma against the
  formula `deg = -rad·180/π`: `-1.5708 rad → rotate(90deg)`, `+1.5708 rad → rotate(-90deg)`; the 4
  emitted CSS transforms (2×90, 2×-90) match the 4 rotated non-vector nodes exactly. Not just
  emit↔reverse self-consistent — right against the source.
- ✅ **No dropped/mis-mapped property found** (meta-ask #1). idMap-authoritative check: every
  CSS-element node with `cornerRadius` carries `border-radius` (0 misses; the raw-heuristic "misses"
  were svg/instance-flattened nodes, radius handled in-svg). The "13 DROP" I first saw were
  `DROP_SHADOW` effect labels, not drop flags.
- ✅ **C3.2 stroke** — Rectangle 49's gradient card border restored: `border: 10px solid #333333`
  (refusals 1→0). C3.3 `container-type: inline-size` on root. C3.4 unchanged.
- ✅ **GLASS ×3 correctly excluded, NOT a silent drop** — I chased this hard (the golden has GLASS,
  unmapped, and `refusals:[]` looked like a silent loss). Traced the ancestor chain: all 3 Glass
  Effect frames sit under `Toolbar - Bottom` with `visible:false` — a hidden layer, correctly not
  converted. `refusals:[]` is legitimate. (Verified, not assumed — the found≠bug direction of the
  discipline.)
- ✅ 30/30 tests, census/canon/reverse/conformance OK, determinism byte-identical, coverage 77%.

## Findings

### F1 · MED · SPEC self-contradicts on stroke refusals (SPEC==code, meta-ask)
`SPEC §3.5:161-164` (C3.2) correctly says gradient + CENTER strokes **"converts, never refused."**
But `SPEC:233-234` (the property-refusal report section) still LISTS "**CENTER/gradient strokes**"
among the things reported as property-refusals ("the node still emits; only that property is
reported"). The code now converts them (`refusals:[]`), so they never appear there — SPEC:233
contradicts SPEC:161-164 and the code. **Fix:** remove CENTER/gradient strokes from the SPEC:233
property-refusal list (they convert now); keep GLASS / GRADIENT_DIAMOND / complex-mask /
unknown-font-style / unknown-stroke-paint (those genuinely still refuse).

### Open-call answer (asked of me) · solid-avg vs exact-gradient rounded border
**Keep solid-avg — it's the correct SHAPE call.** `border-image` ignores `border-radius` (renders a
rectangular border on a rounded card = a MORE visible wrong than a flattened color), so radius-faithful
+ averaged-color beats exact-gradient-with-broken-corners. **But one condition for the honest-audit
principle:** the solid-avg flatten is a *lossy* conversion (gradient → flat color) currently emitted
**silently** — `refusals:[]`, no report entry, no raw. The whole value of this tool is that the
conformance report shows every fidelity drift; a lossy gradient→solid flatten must appear as an
**"approximation"** note (a new report category, distinct from refusal) so Dan sees it. Recommendation:
ship solid-avg now WITH a report-flagged approximation entry; `background-clip` double-background
(exact gradient that follows radius) is the clean C4 follow-up if pixel-exact is wanted. **This is the
one place the audit surface currently under-reports.** (MED-adjacent — the expert/ Dan's call whether
to add the flag now or track it; I flag it because "silent lossy convert" is the exact anti-pattern the
report exists to prevent.)

## Meta asks answered
1. Property dropped/mis-mapped? **No** (idMap-authoritative; rotation/radius/stroke/container all faithful).
2. Rotation faithful? **Yes, objectively** (verified vs raw radians, not self-consistency).
3. Solid-avg call? **Right shape; needs a report-flag** (above).
4. SPEC==code? **One stale line** — F1.

## Scope honesty (what I did NOT run)
The **pixel-visual side-by-side** (Figma REST render vs the converted route) I did NOT execute — it
needs the live `s58-converted` route + a browser render. I did the anatomy-matrix half fully and the
objective-math half (which for the rotation bug is *stronger* than eyeballing a screenshot). The
visual pass is the expert's README artifact + Codex's adversarial + Dan's eyes at sign-off; I'm
not claiming it.

## Verdict: PASS (with F1 to fold + the approximation-flag recommendation)
The C3 fidelity fixes are real and correct — rotation objectively right, stroke/container restored, no
property silently dropped (GLASS exclusion verified legitimate). F1 (stale SPEC line) is a doc fix;
the solid-avg approximation-flag is the one substantive call — recommend adding the report entry so the
audit stays honest. Neither blocks the fixes' correctness. Re-route the SPEC fix + your decision on the
flag; Codex's adversarial verdict stands independent.

---

## CLOSURE RE-AUDIT — 2026-07-05 (s58-lead) · HEAD 288e2cd — RE-FAIL (new HIGH from the flex-shrink fix)

Verified CLOSED:
- **F1 SPEC** — SPEC:242 refusal list now excludes CENTER/gradient strokes; SPEC:244 explicitly "CENTER and gradient strokes CONVERT per §3.5". ✅
- **Approximations category** — `approximations: 1` on golden; report entry `{nodeId 4084:26020, gradient border flattened to avg #333333, exact = background-clip follow-up}`. Exactly the honest-audit flag I recommended. ✅
- Rotation still objectively correct (2×90, 2×-90); 30/30; determinism; flex-shrink:0 ×43 (the LAW is right — dials no longer squeeze).

### F2 · HIGH (NEW) · `check` reverse-FAILs ×43 on pristine output — flex-shrink fix broke the audit gate
`convert` reverse = OK (diff 0); `check` on the SAME pristine output = **reverse FAIL ×43**
(`.topSection geometry flex-shrink: ir=null css="0"` …). Reproducible.
**Root cause (pinned, same class as C2-F1):** the flex-shrink law was added to the emitter AND to
reverse's `GEOM_PROPS` (reverse.mjs:38) + geomOf (reverse.mjs:52, derives `flex-shrink:'0'` from
`n.isFlexChild`). But **`isFlexChild`/`fillMain` are assigned in `emit.mjs:281,287` (the emit pass),
not in `buildIr`.** `convert` runs buildIr→emit, so its IR carries `isFlexChild` → geomOf emits
flex-shrink → matches. `check` runs `buildIr` ONLY (no emit) → **proved: buildIr-only IR = 0/55 nodes
with isFlexChild** → geomOf produces nothing → `ir=null` vs `css="0"` → FAIL ×43.
**Impact:** the auditable `check` gate — CI + Codex's mutation battery — is RED on the converter's own
correct output again. Every mutation "fails reverse," so a real regression can't be told from this
baseline (exactly the C2-F1 failure mode, recurred).
**Fix:** compute `isFlexChild`/`fillMain` (and any emit-derived field the reverse projection reads)
in `buildIr` (ir.mjs), not by mutating the IR during emit — so convert's and check's IR are identical.
**Structural note:** this is the 2nd time check-IR ≠ convert-IR bit the reverse gate (C2-F1 = varMap;
C3 = emit-mutated field). Recommend an invariant: reverse must only read IR fields that `buildIr`
produces; nothing the emitter adds. A one-line guard/test (assert check-IR and convert-IR project
identically on the golden) would catch this class permanently.

## VERDICT: RE-FAIL — F2 HIGH blocks. F1 confirmed closed; the flex-shrink LAW is correct, its gate
wiring is not. Move isFlexChild/fillMain into buildIr, re-route; I re-run convert+check reverse parity
at the fixed HEAD.

---

## LOCKED CLOSURE — 2026-07-05 (s58-lead) · frozen HEAD 7ce4bd1

F2 re-probed at the named HEAD — the exact ×43 repro is now green:

| Check | @7ce4bd1 | Verdict |
|---|---|---|
| buildIr-only IR carries isFlexChild | **52/55** (was 0/55) — layout flags now derive in buildIr, emit's annotate is images-only | ✅ |
| convert reverse (own) | OK (diff 0) | ✅ |
| **check reverse (same pristine output)** | **OK (diff 0)** — was FAIL ×43 | ✅ CLOSED |
| Permanent guard (class-killer) | `test/c13.test.mjs:166` "check-IR == convert-IR — reverse passes with a FRESH buildIr-only IR (golden)": emits from convertIr, reverse-verifies a fresh buildIr-only IR = check's exact path. Any future emit-only field the reverse reads now fails this test. | ✅ |
| tests / determinism / F1 | 31/31 (guard test added); determinism byte-identical; approximations:1 (F1 stays closed) | ✅ |

**Both check-IR≠convert-IR instances (C2-F1 varMap, C3-F2 emit-field) are now closed AND
permanently guarded.** The structural recommendation landed — reverse can only read buildIr-produced
fields, enforced by a test.

## VERDICT: PASS — C3 fidelity closed at named HEAD 7ce4bd1. All findings execution-verified;
the recurring check-IR divergence class is now test-guarded shut.
