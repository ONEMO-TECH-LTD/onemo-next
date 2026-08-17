# Builder errors

## 2026-08-12 — resolved-path splice feasibility

- Failed: the first seam draft required byte-identical independently projected crossing coordinates; ZERO resolver fixtures returned `null` despite sharing the same mathematical boundary.
- Failed: a diagnostic Vitest run printed complete resolved shapes and overflowed the useful command output.
- Correction: keep diagnostics bounded, prove a numerical coincidence bound explicitly, and stop the gate if real named/CUSTOM resolver outputs do not meet it. Do not bridge or fit mismatched contours.
- Command typo: `verify:cutout-v1-grabcut` does not exist; the package script is `test:cutout-v1-grabcut`.
- Actual route falsification: the current real ZERO old/candidate pair moves 10 off-band samples with a `1.688545px` maximum gap. This is a real geometric mismatch, not the seam's `3.26e-9px` projection noise, so no endpoint bridge is allowed.

## 2026-08-12 — golden-lock oracle literals were stale

- Failed: the first de-slop GrabCut runs retained pre-golden output hashes, Paint ZERO, and mask-smoothing expectations; each stopped on accepted `c4f17f47` behavior even though product source was unchanged.
- Worked: observe the fixed-viewport current golden results, update literals only, and rerun the unchanged oracle to completion in Chromium and WebKit.
- Remember: during a behavior-locked cleanup, stale frozen literals may be corrected to the already-running golden state, but the harness and product behavior must remain unchanged.
