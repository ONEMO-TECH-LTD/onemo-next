# Benchmark report

The current machine/runtime is recorded in `benchmark-results.json`; it is not a physical mobile device.

Latest measured warm results are stored in `benchmark-results.json`.

## Current result

- Neutral single-point translation feasibility: sub-millisecond median.
- Complete certified 21-rung solve, cold: measured separately and reported without claiming a frame-budget pass.
- Complete certified 21-rung solve, warm from the bounded outline/profile fingerprint cache: median and p95 both below the 16 ms target.
- Compiled ESM compressed as one concatenated gzip stream:
  - Compute: approximately 17 KB;
  - Logic: approximately 13 KB;
  - Next adapter: approximately 2 KB.

## Gate interpretation

The payload targets and the 16 ms warm typical all-band gate pass on the recorded machine. The measured path is the certified solver; no heuristic preview is substituted. High-vertex cold solves remain slower and are reported separately from the warm gate. No physical-mobile number is claimed.

## Benchmark modes

- Cold mode clears the bounded caches before one complete solve.
- Warm mode repeats the same certified solve through the deterministic outline/profile fingerprint cache.
- Selected-size certification is measured independently and may return `DECISION_INDETERMINATE` rather than guess.
