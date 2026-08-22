# v3.5.2 documentation map

## Canonical authority

Execute in this order:

1. [`canon/v3.5.2-master-contract.md`](./canon/v3.5.2-master-contract.md) — master v3.5.2-1 and highest contract authority, 899 lines, SHA-256 `625c8a16c50e9189bbc4a9cc060912e7f8cac77374a598e7d657d126d79d9765`.
2. [`canon/T1-full-isolated-vertical-clone.md`](./canon/T1-full-isolated-vertical-clone.md) — T1 packet (regenerated from the revised master, 2026-08-22).
3. [`canon/T2-re-room-cloned-engine.md`](./canon/T2-re-room-cloned-engine.md) — T2 packet (regenerated, 2026-08-22).
4. [`canon/T3-build-three-laws.md`](./canon/T3-build-three-laws.md) — T3 packet regenerated from the revised master (2026-08-22), 704 lines, SHA-256 `0e048f238419c5192d6d69923c86252fd61829b303187dc5b8382a3a363d3215`.
5. [`canon/T3-surgical-execution-subplan.md`](./canon/T3-surgical-execution-subplan.md) — execution authority: R0 CLEAR, G1 superseded, B1 = exact adapter + bounded scaling, SHA-256 `ff11504dae20e3e818c536119115325f1d8d04b78f33aba0acfc8eec15127ec0`.
6. [`canon/T4-finalize-worker-bridge-tab.md`](./canon/T4-finalize-worker-bridge-tab.md) — T4 packet (regenerated, 2026-08-22); optional later finalization, not active.

The rejected 611-line post-`a65added` T3 expansion is absent from the visible contract. Git history retains it as evidence only.

The superseded v3.5.1 contract is archived at [`../v3.5.1/_archive/v3.5.1-engine-rebuild-contract.md`](../v3.5.1/_archive/v3.5.1-engine-rebuild-contract.md).

## Supporting evidence

- [`supporting/T3-execution-matrix.md`](./supporting/T3-execution-matrix.md) — superseded 2026-08-22; historical evidence only (product `1ccba648`, pre-simplification mechanism).
- [`supporting/T3-post-wrap-commit-audit.md`](./supporting/T3-post-wrap-commit-audit.md) — joint KEEP/REWORK/REVERT ledger.
- [`supporting/optional-later-source-and-proof-audit.md`](./supporting/optional-later-source-and-proof-audit.md) — superseded 2026-08-22; historical evidence only.

## Current gate

R0 is QA/Meta CLEAR. G1 is superseded by the 2026-08-22 canon revision (bounded exact adapter, proved in `_audits/T3-exact-adapter-bounded-proof.md`). B1 (exact adapter + scaling) is the released build scope from a fresh clean worktree at product `2c043257`; B2 remains gated on B1 QA and Meta CLEAR.
