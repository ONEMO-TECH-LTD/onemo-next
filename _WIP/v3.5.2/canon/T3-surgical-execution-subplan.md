# v3.5.2 execution sub-plan — final state

Status: execution authority, 2026-08-23. Authority is the master v3.5.2-3 only (`v3.5.2-master-contract.md`); this file sequences it. R0 (the recovery to `2c043257`) and G1 are history, recorded in `../_audits/`.

## Operating contract

- One builder, one fresh clean worktree at product `2c043257`. Every step below is one rollback commit; compile, focused tests and the live tab after each.
- No amend, rebase, reset, push or merge without Dan.
- QA and Meta review each step on the same branch and deliver paste-ready fixes (Dan's rule); no finding-only handoffs.
- Master §9 stop rules are a hard stop.

## Steps

| # | Step | Master | Gate |
|---|---|---|---|
| W1 | Wrap on the ruler: all-seated legality over outer+holes + belt air on the ruler, one verdict for Free/manual/Auto/band | §5.2 `measureWrap`, §5.3 `evaluateWrap`, §5.1 types | fixture 2 (seat/Wrap opposite bounds on one measurement; square 24/26, squircle 72 all modes, diamond 34/36, 0.5 reads 1, holed cutout, Auto minimum, Free = rung) |
| W2 | Delete the exact layer, integer seat kernel, circle path, dead float Wrap helpers; rename `contact-root.ts` → `wrap-measurement.ts`; guard asserts absence | §3 table | fixture 4; all remaining tests green; Centre fixture 1 unchanged |
| S1 | Even sizes, four bands, slider snaps to 2 mm; delete sub-mm constants, `seatMarginMM`, B5 | §5.1 values | tab shows four bands, even sizes only |
| S2 | `computeGrid` returns all four placements; concessions measured | §5.4 | Free shows concessions; `candidates` length 4 |
| S3 | `bandWalk` walks every even size; every candidate to Logic; bisection and `below` deleted | §5.4 | no sub-2 mm size anywhere |
| S4 | `reduceBandLadders` | §5.3 | fixture 3 |
| S5 | Worker stores the ladder; chips select; honesty note | §5.5 | fixture 6 |
| F1 | Full-system gate on the live tab | §7 | all six fixtures; fixture 5 timing |
| F2 | Conditional Centre check | §8 | only on a measured material rung change; separate amendment |

## Allowed files

`src/lib/magnetic-grid/{spec,compute,logic,engine}.ts`, `src/lib/magnetic-grid/compute/{seat,centre-evidence,contact-root→wrap-measurement,identity}.ts`, `src/lib/magnetic-grid/__tests__/*`, and from S5: `law.worker.ts`, `LawPanel.tsx`, `magnetic-grid-bridge.ts`. Nothing else; no new files.

## Closure

Builder self-audit → QA → Meta on one clean immutable HEAD; Dan reviews the tab. Engineering closes on the Meta verdict.
