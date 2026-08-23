# v3.5.2-1 — Simplify the contract and complete the three-law engine

Author: s62-kai-lead · 2026-08-22 · status: proposal for Dan
Base: product tree `2c043257` (T1 clone, T2 re-room, T3 Wrap — all proven live, 27/27 green). Evidence: `../../_audits/T3-contract-vs-brief-audit.md`.

## 1. The deliverable (Dan's brief, unchanged)

Centre (existing, 6 modes + governors, admin-selected) → Wrap (0 = tangency, fixed refuses, auto grants the minimum) → Scaling per magnet count: in each band, every count N at the first size where N is centred and wrapped; +1 magnet per rung; no count repeats across bands; vertical beats horizontal. Third tab, old tabs untouched, compute/logic/spec/ui split.

## 2. One decision for Dan

**Touch quantum.** Seat legality already judges "touch" at 0.001 mm (the donor's integer quantum). Wrap judges at raw float bits. At tangency they disagree by ~1e-15 and the tab refuses lawful layouts (Weight mode squircle 72; square 25 at pitch 24). Proposal: one spec constant `TOUCH_QUANTUM_MM = 0.001`, applied to anchor and contour coordinates before both seat legality and Wrap. Contract clauses forbidding any quantum are struck (§4 below).

Ruling needed: **0.001 mm — yes / other value.**

## 3. Build — from `2c043257`, in this order, one rollback commit each, live tab observed after each

| # | Step | Files | Size | Gate |
|---|---|---|---|---|
| S3 | Touch quantum (after ruling) | `spec.ts`, `compute/contact-root.ts` | ~10 lines | Weight-mode squircle 72 and square 25 @ pitch 24 lawful at flap 0; `wrap.test` 8/8 unchanged |
| S1 | Scaling law in the existing walk: per band, per count N, bisect to the first size where N seats **and** parity holds **and** Wrap is lawful; a count is owned by the band where it first becomes lawful; list every qualifying count; delete the seat-based "below" exclusion | `engine.ts bandWalk` | ~80–150 lines | square 1/4/8/12 @ 24/72/120/168; squircle B4 shows 8 @ 168; no count repeats |
| S2 | Exact touch-solve per rung: at the refined layout, for each belt disc solve the size where its distance to the binding segment = 12 + allowance (quadratic; kernel exists); rung size = binding root, stored exact, shown rounded; the contact witness is the certificate; re-check count/parity at that size | `compute/contact-root.ts`, `engine.ts` | ~60–100 lines | diamond B1 returns 1 @ 24√2 (33.94) at flap 0; circle returns rungs in every band |
| S4 | Walk cost: float prescreen per sampled size, exact Wrap only at candidate rungs | `engine.ts bandWalk` | ~30 lines | squircle B3–B4 < 2 s per band (today 53–86 s) |
| S5 | Gravity: among equal count and equal required flap, vertical eliminates horizontal; remaining ties returned, not collapsed | `logic.ts` | ~15 lines | pill/ellipse pair is vertical |
| S6 | Manual inspection concessions: forced phase reports parityTrue, centreErrorMM, CENTRE/WRAP concessions; tab shows them | `engine.ts`, `LawPanel.tsx` | ~30 lines | dragged grid shows concession text |
| S7 | Bands B1–B4: remove B5 | `spec.ts` | 1 line | tab shows four band chips |
| S8 | Honesty note → three laws | `LawPanel.tsx` | 2 lines | after S1–S2 observed live |

Total ≈ 250–350 lines, all in files that already exist. No new module, no Support B, no G1, no Centre change, no T4 migration.

Gates: builder self-audit → Grid-QA → Grid-Meta per step; Dan sees the tab after S2 and at the end. Rollback target between steps: the previous step's commit.

## 4. Contract edits (master `canon/v3.5.2-master-contract.md`)

Strike:
- §1 "Scale is solved from the contact equation, never searched on a millimetre grid" → "Each rung is the first size where the count is centred and wrapped; the rung size is solved exactly from the binding contact at that layout."
- §6.2 "never decimated, capped or replaced by a mesh inside compute … No internal MAXV, sampling step, guard or distance multiplier" → replace with the touch-quantum rule (§2).
- §7.1b, §7.2 as requirements → keep as reference, marked "not required by v3.5.2".
- 10A Support B and the G1 block → removed.
- Untangle row "`bandWalk` … never its sampled scan/gate/refinement body" → "T3 scaling reuses `bandWalk`; only its gate changes (count-seated → count-lawful) and the rung size is solved exactly."
- §6.1 `BANDS` stays 1–4; code follows.

Add:
- §13 "Open decisions — Dan only": touch quantum (§2).

## 5. Necessity / sufficiency

Necessity — no unnecessary elements: every step maps to one brief clause (S1–S2 scaling, S3 Wrap truth, S4 usability of S1, S5 gravity, S6 "every control true", S7 B1–B4, S8 honesty). Removed from the contract: exact-scaling doctrine, mesh ban, Support B, G1, walk no-reuse.

Sufficiency — delivers the brief in full: Centre kept, Wrap proven, scaling per magnet count with exact touch, gravity, truthful controls, B1–B4, clean split, third tab beside the frozen comparators.
