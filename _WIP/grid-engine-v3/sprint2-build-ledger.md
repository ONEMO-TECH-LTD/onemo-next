# Sprint 2 (KAI-10265) — build ledger

Builder: @s62-lead. QA: @s62-grid-pixel. Branch `session62-task/KAI-10261-grid-canvas`.
Appended as each item is established, not at the end.

## Done

| Task | What | Commit |
|---|---|---|
| KAI-10283 | P0 pinch cumulative + stable listener | `3d514ea8` — Ready for QA, evidence in Linear |

## Already satisfied before the sprint opened — verify, comment, close

These landed while building the instrument, before the sprint was cut. Each needs its evidence
recorded on the task rather than a fresh commit; re-doing them would be churn.

| Task | Claim | Check |
|---|---|---|
| KAI-10270 D2 | `ZOOM_FIT` page import gone | `grep -c ZOOM_FIT page.tsx` = 0 (`3d514ea8`) |
| KAI-10267 D5 | false "1 is fit" comment gone from page | absent; the one left in `camera.ts` documents the live `ZOOM_FIT` and is true there |
| KAI-10278 P2 | cut-out load reads the live spec | `loadCutout` is a plain function, no `[]` deps (`03ab30c2`); lint's exhaustive-deps warning gone |
| KAI-10273 N2/L3 | one live-spec span for scale and frame | `gridScale = fieldBlockSpan(spec) / sizeMM`, frame from `layout.padded` (`16aeb68e`) |

## Outstanding

D1 `KAI-10269` dead zoom API · D3 `KAI-10268` syncSizeFromBox · D4 `KAI-10271` CLASSIC-band doc ·
D6 `KAI-10266` page header · D8 `KAI-10272` bridge whitespace · P1 `KAI-10280` ref read in render ·
P6 `KAI-10281` CSS duplication · P4 `KAI-10276` padding atom · P5 `KAI-10275` anchorMM ·
P3 `KAI-10279` guarded registration · L1 `KAI-10274` one minimum size · N1 `KAI-10277` inert coupling ·
N3/L2 `KAI-10282` structural guards.

## Standing constraints

- Snapshot every change; one commit per task.
- Focused lint + typecheck + tests per change; live verification on `localhost:4200/grid-engine`.
- No jsdom/testing-library in this repo — DOM-level criteria are proven live, and that limit is
  stated on each task rather than implied.
- P7 (96mm parity) is closed by law 9.3a. No change.
- This sprint is scaffolding cleanup. It is NOT the manufacturing solver and must never be reported
  as such.
