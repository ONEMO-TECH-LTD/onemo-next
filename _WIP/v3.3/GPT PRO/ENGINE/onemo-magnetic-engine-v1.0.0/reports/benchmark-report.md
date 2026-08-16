# Benchmark report

Environment:

- Node 22.16.0
- Linux x64 container
- backend `dependency-free-fixed-point-typescript-v1`
- not a physical mobile device

Latest measured warm results are stored in `benchmark-results.json`.

## Current result

- Neutral single-point translation feasibility: sub-millisecond median.
- Low-node 12-vertex all-band preview solve: approximately 50 ms median in this container.
- Compiled ESM compressed as one concatenated gzip stream:
  - Compute: approximately 17 KB;
  - Logic: approximately 13 KB;
  - Next adapter: approximately 2 KB.

## Gate interpretation

The payload targets pass comfortably. The proposed 16 ms typical all-band target is **not met** by the current container benchmark. The workload still executes in milliseconds rather than seconds for low-node outlines, but higher-node rounded shapes are materially slower. No mobile Safari/Chrome number is claimed until measured on physical devices.

## Benchmark modes

- Preview benchmark measures the live editor path.
- Continuous selected-size certification is intentionally separate and may be slower or return `DECISION_INDETERMINATE` rather than guess.
