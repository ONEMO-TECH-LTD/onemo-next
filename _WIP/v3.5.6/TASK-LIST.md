# v3.5.6 · TASK LIST — every open directive, traced to Dan's words

Compiled 2026-08-31 12:40 on Dan's instruction ("read the scroll back identify all directives and
compile as brief sheet and task list now"). Source: `DIRECTIVES-VERBATIM.md` §3 plus the s62/lead
day-files for 08-30 and 08-31, both read in full.

Status vocabulary: **DONE** (built + evidence cited) · **IN FLIGHT** (uncommitted work exists) ·
**OPEN** (not started) · **BLOCKED** (needs Dan) · **REVERTED** (built, then withdrawn on his word).

Head at compile time: `1d324ecf`. Working tree dirty. **8 tests failing.** No QA verdict on any of
it. Nothing below is claimed as delivered.

---

## A · CORRECTNESS OF WHAT IS ALREADY THERE

| # | Task | Directive | Status |
|---|---|---|---|
| A1 | Protection reach default = **24mm**, driving material subtraction, boundary runs, span ends, gravity and the cache key | §3.3 | **IN FLIGHT** — constant + page default changed; 5 tests still assert 48 |
| A2 | Unprotected area measured on **material**, not the eroded legal region | §3.1 | **DONE** — committed `1d324ecf` |
| A3 | Unprotected evidence attached to **every** shipped offer, rules on or off | §3.1 | **DONE** — live: BOT B2 `451 mm² · 44 mm` with all toggles off |
| A4 | Red rings + unheld-mm readout drawn on canvas, matching the selected candidate's measured gaps | §3.1 | **DONE** — live, reach 48→24→72 moves it 451→2699→0 mm² |
| A5 | Free slider (manual calibration) shows real-time unprotected area | §3.2 | **IN FLIGHT** — measurement being routed through the sequencer so the worker gains no unit edge |
| A6 | Fix the 2 architecture-gate failures my A5 patch caused (worker pinned to `units/judge` + `units/centring` only) | house law | **IN FLIGHT** |
| A7 | Collapse the 3 duplicate copies of the unprotected measurement in `grid-magnet-wrap-compute.ts` into one | §3.5 (no dupes) | **IN FLIGHT** |
| A8 | Remove the dead `facts0` no-op I left in `factsOf` | own mess | **IN FLIGHT** |

## B · THE FILTERS MUST ACTUALLY SELECT

| # | Task | Directive | Status |
|---|---|---|---|
| B1 | Preferences must **choose the candidate for each role**, not reorder three already-chosen rows | §3.4 "your filters are not functional at all" | **OPEN** |
| B2 | The candidate pool must contain real positional alternatives. Today it dedupes by lattice pattern, so B2 holds exactly **2** candidates and B4's three roles are forced by count — there is no "next option" for a filter to reach | §3.4 "must actually provide the next option that covers all preferences" | **OPEN** — root cause, blocks B1 |
| B3 | Holding rules must apply on the **free-slider path** too — `holdingRules` is read only by the band ladder; `computeGrid` never sees it | §3.4 (both screenshots unfiltered) | **OPEN** |
| B4 | Detector **qualifies** each candidate before it may be named optimal/min/max; a role with no qualifier is absent, not filled by something worse | §3.1 | **PARTIAL** — enforcers run over the combined universe pre-role; preferences still only order |

## C · THE CANON

| # | Task | Directive | Status |
|---|---|---|---|
| C1 | Canon frame is **attempted to fit** across the sweep; the answer is the combination **closest to the canon layout**, missing seats and all. No all-or-nothing | §3.6 | **OPEN** — measured today: B4 canon is a 3×4 = 12-seat rectangle; the sweep already yields partial landings (8 seats ×1, 7 ×42, 6 ×126, 5 ×127, 4 ×93, 3 ×14, 2 ×29 across 48 sizes), but `optimal` is picked by **raw seat count**, not by closeness to the frame |
| C2 | Canon may step **down** a band when nothing in the requested band fits — never up | 08-31 09:57 ruling | **DONE** |
| C3 | Butterfly 3-point triangle / diamond-with-no-top alternative | 08-30 butterfly note | **OPEN / not actioned** — canon is square+rectangle by earlier ruling; recorded, flagged to QA as a possible narrowed scope |

## D · CENTRING — HANDS OFF

| # | Task | Directive | Status |
|---|---|---|---|
| D1 | No second centring implementation anywhere; baked centring governs | §3.5 | **REVERTED** — my `offCentre` measure in `judge.ts` is deleted, balance restored to committed behaviour |
| D2 | `wrap` and `centring` units not edited, not polluted | §3.5 + 08-30 "the wrap logic must not be touched" | **HOLDING** — `units/wrap.ts` byte-identical all session |
| D3 | Balance still does not reject the BOT left-lopsided answer | §3.2 "balance is not providing centering enforcement" | **OPEN** — the fix I had is withdrawn under D1; must be solved without a new centring measure |

## E · TESTS AND GATES

| # | Task | Directive | Status |
|---|---|---|---|
| E1 | Replace the two non-proving tests with Dan's exact BOT counterexamples — assert selected points and measured facts, never counts or non-empty | QA pin, 11:52 | **OPEN** — BOT/BAT-WOMAN contour fixture generated and verified faithful (reproduces 87.46 / 127.17 / 148.85 exactly) |
| E2 | Fix the 5 reach-default test failures (48 → 24) | §3.3 | **OPEN** |
| E3 | Live gate on the whole rule stack at one exact head | §2b visual law | **OPEN** |
| E4 | One-pass QA on one exact head, per `/o-qa` | "it is mandatory protocol" | **OPEN** — QA is waiting on a head |

---

## STANDING CONSTRAINTS ON ALL OF THE ABOVE

- Only what is asked. Nothing inferred, nothing extra.
- No inventions; no duplicate unit doing an existing unit's job.
- `wrap` and `centring` are untouchable.
- Read the code, not the notes.
- QA clearance is mandatory before anything is called done.
- Precision or stop.
