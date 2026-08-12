# MagFit proposal @ 41f239e4 — audit, resolution, and the one open decision

Two independent lanes (s62-lead, s62-pixel-grid-pixel) built, ran and probed the committed snapshot in
separate isolated copies. Every claim below was reproduced by both. The original tree was not modified by
either lane; all experiments ran in `/tmp` copies.

## Fixed and verified (lead's four findings from the working-tree review)

| Finding | Resolution in 41f239e4 |
|---|---|
| Circle flap assertion was the tautology `any \|\| !all` | Replaced with two real assertions: side midpoint proves a tongue, corners fail. |
| A plain circle was flagged as a narrow-limb exception on all four sides | Fixed and pinned by `require(!narrow_limb_exception_12, "a smooth circle must not be classified as a narrow limb")`. Tongue witnesses moved from corner nodes to side points — the correct geometric fix. |
| VALIDATION.md claimed a GNU build, sanitizer passes and GPT's performance numbers | Rewritten honestly: Apple Clang only; sanitizer/GCC/Wasm/device runs explicitly *not* claimed; measured 6.88 / 7.33 ms; `ERRORS.md` records the sanitizer hang and unsupported `detect_leaks=1`. |
| EC-09 (12/24 as MAXIMUM permitted overhang) had been deleted for GPT's neutral evidence | Restored as `coverage_within_12/24`, `<=` conjoined across all four sides (`src/magfit.cpp:1106`) — matches EC-09 exactly. Neutral kernel evidence retained alongside. |

Also verified by probe, not by reading: circle band 2 → **96 mm, four discs** (layout-quality-first works and
reproduces Dan's quadrant calibration — the pair-at-72 defect is gone); square → 72 mm full; band-2 results
carry no sparse phase (not engaged, per Dan's ruling); band-3 square reports four connected sparse nodes.

## The one open item — a product decision, not an engineering defect

**The contract describes a selection model the code does not implement.**

`contract/MAGFIT_ENGINE_CONTRACT.md:130` states the order `FULL_2X2 → LINKED_L3 → ADJACENT_PAIR`. The code
carries a fourth, undocumented tier `ConnectedFallback` (`include/magfit/magfit.hpp:41`) ranked **second**, and
it is the dominant band-3 outcome:

```
L-shape band2:  72mm LinkedThree        3 nodes
L-shape band3: 120mm ConnectedFallback  5 nodes
plus    band3: 120mm ConnectedFallback  5 nodes
T-shape band3: 120mm ConnectedFallback  5 nodes
circle  band3: 120mm ConnectedFallback  5 nodes
circle  band2:  96mm Full               4 nodes
square  band2:  72mm Full               4 nodes
```

Root cause, confirmed by both lanes from source: `best_candidate_at_size` forms **maximal connected
components** and creates one candidate per component. The tier function only *labels* that component. It never
enumerates approved sub-layouts, so the "approved catalogue" is absent, and a 3-node L can never be a candidate
when 5 nodes hold.

Consequently two of the three obvious dispositions are non-viable — both tested in isolated copies:

- **Demote the catch-all below the named tiers:** output byte-identical. Reordering labels cannot change an
  answer when only one candidate per component exists.
- **Reject the catch-all from public results:** L loses band 3 entirely (`NO FIT`); plus/T/circle drop to three
  magnets at 120 mm with `coverage_within_12 = 0` **and** `coverage_within_24 = 0` — i.e. layouts that breach
  Dan's own EC-09 flap law, because a smaller magnet box increases the overhang.

The remaining route is to **name these layouts and give them approved status**. The actual node sets:

```
circle band3: (-48,0) (0,-48) (0,0) (0,48) (48,0)     cross / plus
T     band3: (-48,-48) (0,-48) (0,0) (0,48) (48,-48)  cross with two corners
L     band3: (-48,-48) (-48,0) (-48,48) (0,-48) (48,-48)  five-magnet L
```

All pass the 12 mm coverage limit. They are what band 3 *is* for non-square artwork, not fallbacks.

**Held for Dan:** is a five-magnet cross (and its relatives) a product? If yes, they are named and approved and
band 3 works for round and irregular artwork. If no, band 3 exists only for square-ish artwork and round shapes
stop at band 2.

## Open items not blocking that decision

- Performance: 6.46–6.88 ms hot versus 1.665 ms for the unmodified core on the same machine (~4×), caused by the
  local-tongue witnesses. Now honestly reported; still unattributed and without an 8,100-point p95 gate.
- Straight-capsule links remain conservative by design; the curved-corridor case (GPT's U counterexample) is
  reported, not solved.
- `selection_mode` defaults to `LayoutQualityFirst` — the right default, but it is Dan's decision and should be
  noted as such rather than shipped silently.
