# Part 2 — the gate this lane runs when the package lands

Written before delivery so the bar cannot be adjusted to fit what arrives.

## 1. Same integrity checks as part 1

- Manifest hashes verify.
- Its own tests run here and pass, counts pasted.
- The kernel inside the package is byte-identical to `../part-1-geometry-kernel/delivery/kernel-v1.0.0`, and its 18 goldens still pass unchanged.

## 2. Neutrality

- Grep the enumerator source for ranking/preference/selection vocabulary — expected: zero hits.
- No floating point in any identity or validity path.
- No geometry computed outside the kernel: every held/clearance fact in a candidate traces to a kernel field, none recomputed.

## 3. Completeness against Dan's canon — textual, no screenshots

Each accepted placement below must be expressible as a candidate record and present in the
raw set for its shape and size. These are membership checks only; no ordering or preference
is asserted here (that is part 3).

| canon example | family the record must take |
|---|---|
| duck 60mm, disc in the head (band 1) | single |
| pill 79mm diagonal pair (band 2) | run, diagonal, 2 positions |
| pill 138mm diagonal chain (band 3) | run, diagonal, 3+ positions |
| duck 152mm, head pair + body pair, mid row skipped (band 3) | rectangle corners, sides spanning more than one step |
| bat-woman 144mm, three utmost corners (band 3) | corner triangle |
| butterfly 130mm / poke1 123mm, four corners with centre row and column unused (band 3) | rectangle corners on wider spans |
| bot 144mm narrow four, and 236mm longer narrow rectangle (band 3/4) | rectangle corners, unequal side spans |
| butterfly 214mm / poke1 217mm, four points on the sparse population (band 4) | rectangle corners, sparse population |

A family that cannot express one of these rows is a build defect, not a ranking gap.

## 4. Failure handling

If the package stops for a missing kernel fact instead of inventing one, that is correct
behaviour and the fact gets added to part 1 additively — never silently computed in this layer.
