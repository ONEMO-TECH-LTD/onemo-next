# S58 Framer parity completion contract v1.3 — Chief-QA review round 2

**Verdict:** REWORK  
**Contract reviewed:** `s58-framer-parity-COMPLETION-CONTRACT-v1.3.md` · 63 lines · SHA-256 `25fc9ac9546bea451baa9777e8e138acfc20c337030aa9e60dd5b5711665ab18`  
**Acceptance authority checked:** AC-2 · 333 lines · 264 stable rows · SHA-256 `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`

## Findings

### 1. P0 — the traceability census is numerically false

Contract line 41 claims `B=39`, `E=49`, `H=54`, and `I=14`. Mechanical unique-ID counting in the bound AC-2 gives `B=27`, `E=42`, `H=40`, and `I=11`; all other stated prefix counts match. The contract's stated prefix counts therefore total 300 while the bound authority contains 264 rows. This contradicts lines 7 and 37–38 (`264 stable rows`, `every row allocated`, stable-row traceability).

**Required correction:** use the exact AC-2 prefix counts: `A 8 · B 27 · C 12 · D 6 · E 42 · F 29 · G 4 · H 40 · I 11 · J 38 · K 13 · L 28 · X 6 = 264`.

### 2. P0 — P0 scheduling still does not use stable row IDs only

Contract line 45 schedules “the blank-create + breadcrumb rows in `AC-B-*`/`AC-A-*`” without identifying the rows. AC-2 has multiple distinct blank-create effects (`AC-B-003`, `AC-B-004`, `AC-B-021..027`, and the Assets entry `AC-H-030`) plus breadcrumb `AC-A-008`. Consequently “remaining `AC-A-*`” in P1 and all `AC-B-*` in P2 do not define a unique, non-overlapping allocation. This contradicts lines 37–38's stable-ID-only atomic traceability and the relay's stated residual fix.

**Required correction:** list every P0 row by exact stable ID and state where `AC-H-030` is scheduled; then define P1/P2 as explicit complements of that exact set.

### 3. P0 — the census honesty bound narrows Dan's full-parity target

Line 14 says any un-extracted/un-censused behavior blocks final. Line 16 then limits “exhaustive” to free-tier own-hands and says paid-gated or harness-limited flagged behavior is not a gap and does not block final. That permits unresolved Framer functionality to disappear from completion solely because the current account/harness cannot operate it, contradicting Product Law line 20 and Dan's governing requirement that the full UX/model/engine/functionality set wins.

**Required correction:** enumeration may honestly flag access limits, but each flagged capability remains SPEC-PENDING/decision-pending and blocks final until live evidence lands or Dan explicitly dispositions it. A paid gate or harness limitation is not itself an out-of-scope decision.

### 4. P1 — zero-gap census closure has no coherent immutable path

Line 9 permits AC-3 only when source-backed gaps exist. Lines 15 and 63 unconditionally require Chief QA to mint AC-3 and v1.4 after census closure, while line 14 requires every AC-3 row satisfied. These cannot all hold if the census proves zero gaps.

**Required correction:** define both paths: gaps found → AC-3 + immutable v1.4; zero gaps → durable zero-gap reconciliation/completeness PASS with no manufactured AC revision, while v1.3 remains the binding contract.

## Confirmed fixes

- v1.3 is permanently AC-2-bound; a successor contract, not self-mutation, binds any real AC-3.
- Four pre-Dan stamps gate slice progress; Dan's fifth stamp is final-only.
- Group K is allocated, A/X ownership is separated, and AC-J-005..009 are named correctly.
- SPEC-PENDING is bound to the complete AC-2 flagged-row set by reference.

## Scope

Contract/checklist QA only. No contract, AC, Linear, build, or product mutation. Expert census remains independent and is not pre-judged here.
