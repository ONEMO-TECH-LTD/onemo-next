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
| W1 | Wrap on the ruler: one signed material clearance per anchor over outer+holes, one conversion, seated iff ≥ 0, belt required flap, co-nearest witnesses; one verdict for Free/manual/Auto/band (`seat.ts` gains `pointInMaterial` and the all-ring nearest helper) | §5.2 `measureWrap`, §5.3 `evaluateWrap`, §5.1 types | fixture 2 (signed ruler; square 24/26, Weight squircle 72 residue reads 0, −0.49/−0.51, outside/hole anchor negative, diamond 34/36, 0.5 reads 1, holed cutout, Auto minimum, Free = rung, Coverage/MagnetPlan invariance) |
| W2 | Delete the exact layer, circle path, dead float Wrap helpers, `parityHolds` (Centre's integer seat prescreen stays); rename `contact-root.ts` → `wrap-measurement.ts`; guard asserts absence | §3 table | fixture 4; all remaining tests green; Centre fixture 1 unchanged |
| S1 | Even sizes, four bands, slider snaps to 2 mm; delete sub-mm constants, `seatMarginMM`, B5 | §5.1 values | tab shows four bands, even sizes only |
| S2 | `computeGrid` returns all four render-complete placements; concessions measured | §5.4 | Free shows concessions; `candidates` length 4 with phase + lattice |
| S3 | `bandWalk` walks every even size; every candidate to Logic; bisection and `below` deleted | §5.4 | no sub-2 mm size anywhere |
| S4 | `reduceBandLadders` → `LawfulLayout` | §5.3 | fixture 3 |
| S5 | `BandSolveResult` stored; `fitSizeInBand` overlays from storage; `solveCache` deleted; chips select; honesty note | §5.4, §5.5 | fixture 6 (zero compute calls on chip select) |
| F1 | Full-system gate on the live tab | §7 | all six fixtures; fixture 5 timing |

After F1: compare completed rungs against frozen Centre; a measured material Centre-caused change is a stop and a separate amendment — no repair is authorised here. Otherwise delivery closes at F1.

## Allowed files

`src/lib/magnetic-grid/{spec,compute,logic,engine}.ts`, `src/lib/magnetic-grid/compute/{seat,centre-evidence,contact-root→wrap-measurement,identity}.ts`, `src/lib/magnetic-grid/__tests__/*`, and from S5: `law.worker.ts`, `LawPanel.tsx`, `magnetic-grid-bridge.ts`. Nothing else; no new files.

## Closure

Builder self-audit → QA → Meta on one clean immutable HEAD; Dan reviews the tab. Engineering closes on the Meta verdict.
