# Benchmark report

`benchmark-results.json` is the authoritative machine-readable result. This is a Node measurement on the recorded Apple M1 Max, not a physical-mobile result.

## Certified all-band result

- Corpus: the available R3 probe corpus—square, both long rectangles, the approved 64-edge test circle, concave notch, narrow neck, thin terminal limb and a valid 4,096-edge outline.
- Batwoman is excluded pending approved vector intake; this is not labeled the final product-approved typical corpus.
- Each sample returns a new immutable `SolveResult` and independently executes all 21 configured rungs.
- A repeated object identity is a benchmark failure, preventing final-result-cache substitution.
- Warm state retains bounded registered-profile, prepared/scaled-source, safe-region, component-hierarchy and region-measurement caches. No final solve result is retained.
- Median: 2.448 ms.
- p95: 11.022 ms.
- Maximum: 54.114 ms (one high-vertex outlier; the gated p95 remains below 16 ms).
- The median and p95 pass the 16 ms gate.

Cold results are recorded separately per fixture in `benchmark-results.json`; the circle cold path is materially slower and is not represented as a frame-budget pass.

## Required evidence

The JSON record includes runtime, OS, CPU, installed Chromium version, warm/cold state, warmup and sample counts, polygon edge counts, four structural radii, pattern point counts, 21 size rungs, output-registration counts, median/p95/maximum, exact compressed bytes, and sampled process-memory data. Tangency/intrusion, mixed parity and empty/multi-component cases remain in supporting-operation/correctness measurements. WebKit and physical-device memory/performance remain explicitly unmeasured.

Exact compressed ESM sizes from `bundle-size-results.json`:

- Compute: 24,613 bytes.
- Logic: 16,962 bytes.
- Next adapter: 2,999 bytes.
