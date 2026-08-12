# MagFit reference package — read, built, run (s62-lead, 2026-08-12)

Source: `_WIP/CHAT GPT/` — transcript (6,131 lines) + `magfit-reference/` (13 files, 3,269 lines).
Read in full. Transcript lines 1–3086 are byte-identical to the 11:22 export already read; new material is
five further rounds (lines 3088–6131).

## Verification performed here (not quoted from the package)

Built with Apple clang (C++20, macOS SDK libc++) in the scratchpad, out of tree:

```
all magfit tests passed          # 15 fixtures incl. 100-shape invariance corpus
all magfit C ABI tests passed
vertices=1000 hot_mean_us=1665.35 cold_mean_us=4328.04
```

Faster than the package claims (1.67 ms hot vs 3.3 ms; 4.33 ms cold vs 8.9 ms) on this machine.

## Run against our seven real canonical traces (scale 20000, sparse ANY, min 1 active node)

| shape | band 2 | band 3 |
|---|---|---|
| DUCK | no fit | no fit |
| BAT-WOMAN | 108 mm, vertical pair | no fit |
| BUTTERFLY | no fit | no fit |
| POKE1 | 84 mm, vertical pair | 132 mm, 3-node vertical run |
| BOT | 108 mm, vertical pair | no fit |
| PILL | no fit | 132 mm, 4 nodes / 3 links (3×2 parent) |
| POKE2 | 84 mm, vertical pair | 132 mm, 3-node vertical run |

Cross-check against our sealed first-coupled table (POKE2 168 · POKE1 172 · BAT-WOMAN 176 · BOT 180 ·
PILL 192 · DUCK 204 · BUTTERFLY 216): DUCK and BUTTERFLY exceeding bands 2–3 entirely is **consistent**
with our own numbers (204/216 > 156). Where magfit returns a smaller size than our table, the cause is a
product-rule difference, not disagreement on geometry: magfit's default sparse rule needs only ONE active
96 mm node, whereas our engine required a coupled pair on both densities.

## What the new transcript rounds added beyond the 11:22 export

1. **Known-geometry hierarchy** — bbox/aspect prunes impossible templates before any contour work
   (a 72×30 shape cannot host a 2×2, provable from proportions alone).
2. **Inner-safe geometry withdrawn** — Dan's cove/butterfly objection accepted in full: no global inner
   rectangle; support is a per-node field so wings survive a narrow waist. Invariant added: no derived
   simplified geometry may reject a magnet or approve flap unless the exact contour agrees.
3. **Dan's quadrant method formalised** — quadrants are *responsibility regions*, each contributing one
   disc constraint; the worst quadrant sets one shared uniform scale. "Flush, no more no less" becomes
   step-tight: `G(s) ≥ 0` and `G(s−12) < 0`.
4. **Link capsule** — the real new mathematics. Two magnets count as linked only when the full 24 mm-wide
   corridor between them is inside the fabric; grid adjacency alone is not a fabric connection. This is
   what makes an L layout exact and what answers the butterfly question geometrically.
5. **Working code** — exact 128/256-bit integer core, C/Wasm ABI, tests, benchmark, MIT, plus a 935-line
   normative contract and an anti-slop implementation brief.

## Open product decisions the package will not make

- Selection policy: size-first (its implementation, matching Dan's normalisation) vs quality-first.
- Sparse phase per SKU: FIXED / ANY / ALL — changes which sizes exist.
- Pair placement: centred-only, or edge pairs from the parent template (butterfly upper-wing pair).
- Manufacturing tolerance above the nominal 12 mm.
- Structural web width for "one product or two".
