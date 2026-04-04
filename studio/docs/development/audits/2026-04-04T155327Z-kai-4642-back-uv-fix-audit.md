# Session 43 Back-Face UV Fix Audit — KAI-4642

## Why This Exists

After the earlier "clean pass" claim, Dan manually verified that the Effect back side still showed stretched horizontal lines instead of the intended suede texture response.

That meant the prior close was wrong.

This audit records the reopened investigation, the actual root cause, the fix, and the final visual revalidation.

## Root Cause

The defect was not a vague material-quality disagreement.

It was a concrete UV-range problem on the imported back mesh:

- mesh: `BACK`
- observed in the live shell runtime
- imported UV bounds:
  - `u`: approximately `0.002 -> 0.998`
  - `v`: approximately `-0.992 -> -0.008`

The front print surface was clean at `0..1`.

Because the back role reused the suede `normalMap`, `roughnessMap`, and `bumpMap`, those negative V coordinates caused the texture data to sample outside the intended range and collapse into stretched horizontal lines.

## Fix

Implemented in:

- `src/app/(dev)/prototype/core/EffectModel.tsx`

Change:

- added `normalizeUvRangeIfNeeded(...)`
- for non-artwork textured roles, the model path now:
  - preserves valid imported UVs when already in-range
  - normalizes the UV set into `0..1` when the imported UV range falls outside the valid texture range

This keeps the golden scene contract untouched while correcting the runtime interpretation of the broken imported back-face UVs.

## Verification

Builds:

- `cd studio && npm run build` — PASS
- `cd onemo-next && npm run build` — PASS

Static production gates:

- `cd studio && npm run type:check` — PASS
- `cd studio && npm run lint` — PASS

Visual proof:

- shell back-face screenshot after fix:
  - `/tmp/studio-shell-rotated-back-fixed.png`
- prototype back-face screenshot after fix on restarted app runtime:
  - `/tmp/prototype-rotated-back-fixed-restarted.png`

Observed result:

- shell back surface now shows a coherent suede-like texture response instead of stretched horizontal bands
- prototype back surface now matches the corrected shell result

## Verdict

**PASS**

The back-side suede/material stretching bug reported by Dan was real and is now fixed in the active runtime on both the Studio shell and the prototype path.
