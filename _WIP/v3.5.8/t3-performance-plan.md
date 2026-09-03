# T3 — Performance: measurement and the one fix it justifies (v3, for QA then Dan's lock)

Roadmap v3 task 3. Baseline: staging `f093e673` (T1+T2 merged). Everything below is measured on the
headless call `solveGrid` in Node (no browser), four cutouts × bands 1–5, pitch 48 mm, rim 12 mm,
Belt on, protector padding 24 mm. Probes were read-only; nothing was committed from them.

## 1 · Cold solve, per stage (ms)

| shape | band | total | warm | bake | classify | search | deliver | protect | windows | seat tests | memo hits |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| DUCK | B1 | 308 | 81 | 42 | 14.1 | 114 | 1.5 | 2.1 | 0 | 0 | 0 |
| DUCK | B2 | 655 | 66 | 48 | 7.2 | 582 | 4.0 | 1.5 | 0 | 0 | 0 |
| DUCK | B3 | 1710 | 71 | 48 | 5.1 | 1706 | 9.9 | 2.6 | 90655 | 647022 | 0 |
| DUCK | B4 | 3160 | 82 | 43 | 4.7 | 3050 | 16.6 | 2.8 | 313564 | 1148223 | 0 |
| DUCK | B5 | 4653 | 82 | 42 | 4.3 | 4312 | 23.9 | 3.3 | 556631 | 1791706 | 0 |
| BOT | B1 | 293 | 85 | 48 | 18.0 | 140 | 1.7 | 0.5 | 0 | 0 | 0 |
| BOT | B2 | 551 | 82 | 56 | 9.5 | 475 | 7.2 | 1.3 | 0 | 0 | 0 |
| BOT | B3 | 180 | 86 | 49 | 7.2 | 93 | 9.3 | 1.3 | 0 | 0 | 0 |
| BOT | B4 | 3343 | 92 | 48 | 5.9 | 3270 | 19.8 | 2.1 | 276567 | 1311290 | 0 |
| BOT | B5 | 5157 | 96 | 48 | 4.9 | 5046 | 26.7 | 2.4 | 119540 | 2046878 | 0 |
| BAT-WOMAN | B1 | 176 | 44 | 69 | 6.6 | 50 | 1.8 | 1.0 | 0 | 0 | 0 |
| BAT-WOMAN | B2 | 1201 | 47 | 76 | 5.1 | 1170 | 8.2 | 1.2 | 971619 | 429555 | 0 |
| BAT-WOMAN | B3 | 2345 | 52 | 76 | 3.9 | 2308 | 13.9 | 1.4 | 166840 | 958114 | 0 |
| BAT-WOMAN | B4 | 4067 | 62 | 76 | 3.3 | 4084 | 21.2 | 2.2 | 248610 | 1699809 | 0 |
| BAT-WOMAN | B5 | 6497 | 70 | 68 | 2.9 | 6413 | 33.0 | 2.3 | 338165 | 2652691 | 0 |
| BUTTERFLY | B1 | 547 | 81 | 53 | 15.2 | 390 | 3.6 | 1.7 | 0 | 0 | 0 |
| BUTTERFLY | B2 | 791 | 83 | 53 | 10.5 | 711 | 8.3 | 2.4 | 0 | 0 | 0 |
| BUTTERFLY | B3 | 2449 | 85 | 61 | 7.4 | 2521 | 9.6 | 2.5 | 133841 | 818453 | 0 |
| BUTTERFLY | B4 | 3773 | 94 | 58 | 6.2 | 3428 | 18.4 | 2.4 | 254534 | 1451798 | 0 |
| BUTTERFLY | B5 | 11843 | 145 | 68 | 5.7 | 10975 | 39.4 | 2.4 | 7058623 | 2265775 | 0 |
**Stage share of all 20 cold solves:** search **97.0 %** · bake 2.2 % · deliver 0.5 % · classify 0.3 % ·
protect 0.1 %. Warm (same request again, caches hot) is 45–145 ms everywhere — the cache works; the cost
is the first solve of a band.

**Inside the search** (one reveal, largest of 48, B5): seat tests are 37–74 % of the enumeration —
Butterfly 100 ms of 273, Batwoman 116 of 163, BOT 85 of 116. A band solve walks 48 reveals × 2 304 phase
pairs; every lattice point is tested once per phase, so the tests are distinct work, not repetition.

## 2 · The finding, and the fix it justifies

**The seat-test memo never hits.** `units/layout.ts` wraps the seat predicate in a `Map<string, boolean>`
keyed by rounded micron coordinates. Across all twenty solves its hit count is **0** — every measured
point is distinct, because each phase offsets the lattice by 1 mm. The memo therefore adds a template
string and a Map write to each of ~2.6 M calls and returns nothing.

**Measured, offers byte-identical (four cutouts × five bands, `rungs` compared as JSON):**

| variant | total of 20 cold solves | vs baseline |
|---|---:|---:|
| baseline | 59 103 ms | — |
| **memo deleted** | **45 292 ms** | **−23.4 %** |
| memo deleted + count-before-allocate in the window loop | 52 218 ms | −11.6 % |

So the second idea is **rejected by measurement**: counting held seats before building the window's arrays
costs more than the allocation it avoids. T3 takes the first change only.

**Scope:** delete the memo in both enumerators (`enumerateCanonPhaseWindows`, `enumerateFreePhaseMax`) and
delete `cacheHits` with it — from both search result types, their empty/default returns,
`CanonExperimentTrace`, its initializer, and both trace accumulations. Keep `fitsCalls`. Proof includes no
production `cacheHits` reference after the move; no timing threshold is invented.

## 3 · What is NOT fixed here, stated

Butterfly B5 stays the worst case at ~11 s: it is window-loop bound (7.06 M windows across 48 reveals for
3 candidates). Making that cheaper means changing the search itself — a new prune with an equivalence
proof — which is invention inside a task whose brief is "optimise only a measured bottleneck". Recorded
for Dan as its own decision, not folded in.

## 4 · The run-where question this measurement answers (Dan's ruling)

Cold first solve of a band is **0.2–13 s** in Node on this machine; a phone is slower. Warm repeats are
45–145 ms. So: interactive re-solves are already fine, and it is the **first** solve per shape+band that
must not happen on the phone. T1 makes the honest options available — solve server-side and cache by
contour + settings + catalogue version, or precompute a shape's bands on upload. Dan rules; T3 delivers
the measurement and the one lawful speed-up.

## 5 · Proof (Done means)
1. `rungs` (offers, sizes, roles, landed band) identical before/after on four cutouts × bands 1–5.
2. Timing table re-run after the change and recorded here.
3. Full suite green (serial), tsc clean, strict lint on changed files.
4. Live 4065: the four bench cases unchanged, console 0.
5. `rg -n "\bcacheHits\b" src/lib/effect --glob "!__tests__/**"` returns no production reference.

## 6 · Necessity / sufficiency
No unnecessary elements: deletion of the two zero-hit maps and their now-dead trace plumbing, justified by
a measured 0 % hit rate and a measured −23 %; the second candidate is rejected by its own measurement. Delivers T3's brief in full: measured
first, fixed only where measured, offers unchanged, and the run-where decision handed to Dan with numbers.

## 7 · Execution record (2026-09-02, branch session62-task/v3.5.8-t3-perf)

Head `97206655` — I1 built exactly as §2: both memos deleted, `cacheHits` gone from both search result
types, their empty returns, `CanonExperimentTrace`, its initializer and both accumulations; `fitsCalls`
kept. Proofs: offers byte-identical vs the pre-change baseline on 4 cutouts × bands 1–5 (20/20) · full suite
836 pass / 10 skipped (serial) · tsc · strict lint on the three files · `cacheHits` has no production
reference · live 4065 bench unchanged (see addendum for the I2/I2′ retractions). Timing: −23 % quiet
(59.1 → 45.3 s), −7 to −13 % measured under concurrent load.
