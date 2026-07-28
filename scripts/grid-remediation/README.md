# Engine-remediation evidence

Evidence only. Nothing here modifies the engine, workers, UI, caches, or product output.

## ⚠ Two generations of evidence — read before running anything

**The `t1-*` scripts are the BEFORE record.** They are pinned to the drifted two-door tree at
`0234f47` and they **cannot pass after the remediation**. This is structural, not a regression:

- `t1-parity.ts` asserts the generic `rescueAnchors` field is **present** across all 960 cases — the
  remediation **deletes** that field.
- `t1-lattice.ts` hard-throws unless the engine exposes `resolveUserGridPlan` — **deleted**.
- `t1-expected-red.ts` asserts manifest paths including `GridWorkbenchUserPanel.tsx` — **deleted**.

**They are immutable. Do not edit them to make them green.** Their green run at `0234f47` is their
entire value; rewriting them to pass would destroy the before-record they exist to be.
`t1-expected-red.ts` is **retired** — it reproduced two defects that no longer exist.

## Current commands — run these

```sh
npx vite-node --config vitest.config.ts scripts/grid-remediation/t2-literal-parity.ts
npx vite-node --config vitest.config.ts scripts/grid-remediation/t2-lattice.ts
npx vite-node --config vitest.config.ts scripts/grid-remediation/t4-manufacturing-readiness.ts --verify
```

- **`t2-literal-parity.ts`** — LITERAL full-JSON parity against pre-split `399adf`, **no
  normalisation**. Supersedes `t1-parity.ts` and is strictly stronger: with `rescueAnchors` gone from
  the engine, the old normalisation crutch is unnecessary and byte-identity is directly testable.
- **`t2-lattice.ts`** — lattice oracle on the surviving engine.
- **`t4-manufacturing-readiness.ts`** — the mm-true spec projection; `--verify` also asserts the
  tracked artifact matches fresh engine output.

Each prints a JSON `PASS` record and exits `0`, or a JSON `FAIL` record and exits non-zero. No command
updates its own expected artifact.

*(`--config vitest.config.ts` is required — `vite-node --script` bypasses the alias configuration the
`geometry-truth` import needs.)*

## Frozen proof contract — describes the `t1-*` BEFORE record ONLY


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
- `door-consumers.manifest.json` was the migration authority DURING the remediation. Its entries are
  now drained; it is a historical record, not a live gate.
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
