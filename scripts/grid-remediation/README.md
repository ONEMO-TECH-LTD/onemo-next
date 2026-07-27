# T1 engine-remediation evidence

Evidence only. These commands do not modify the engine, workers, UI, caches, or product output.

## Commands

```sh
npx vite-node --script scripts/grid-remediation/t1-parity.ts
npx vite-node --script scripts/grid-remediation/t1-lattice.ts
npx vite-node --script scripts/grid-remediation/t1-expected-red.ts
```

Every command prints a JSON `PASS` record and exits `0`, or prints a JSON `FAIL` record and exits
non-zero. No command updates its expected artifact.

## Frozen proof contract

- `t1-expected.json` contains the exact expected counts and SHA-256 hashes.
- `t1-contract.ts` is the input generator. Its parity `rect` deliberately calls
  `stdShapeContour('rect', sizeMM)` with one size argument, preserving the measured square-height
  default.
- The sole pre-split normalisation deletes `grid.rescueAnchors` from the current plan. The field must
  exist empty across all 960 generic cases. Remaining JSON key order is preserved; no sorting,
  rounding, resampling, or other rewriting is permitted.
- `t1-lattice.ts` first reproduces the historical bounded 448-case measurement exactly. It then runs
  the corrected classified oracle: Velcro/no-grid and single-anchor plans are exclusions, never
  passes; the User door is not duplicated under a density input it does not accept; canonical origin
  candidates come from every anchor and must round-trip every anchor within the
  `MANUFACTURING_TOLERANCE_MM` value read from `geometry-truth.ts`.
- `door-consumers.manifest.json` is the migration authority. Its path set, not a remembered count, is
  checked against the source tree.
- `t1-gate-config.json` freezes the consumer-discovery inputs, transport/tooling classifications,
  quarantine symbols, acceptance-bypass source guard, and the only expected-red paths.
- `fixtures/*.json` preserve the two known drift reproductions. `t1-expected-red.ts` is intentionally
  isolated from the normal test suite and fails if either defect stops reproducing before its planned
  removal.

## Frozen references

- Current evidence base: `719b86c4e634a37adaef08343a4b6fc8de2c8703`
- Pre-split worktree commit: `399adf435003f19ee48cde6fd30c17c52727cc74`
- Pre-split engine file: `src/lib/effect/grid.ts`
- Current engine file: `src/lib/effect/grid-core.ts`
