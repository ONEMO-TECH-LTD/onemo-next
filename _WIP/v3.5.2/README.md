# v3.5.2 documentation map

## Canonical authority

Execute in this order:

1. [`canon/v3.5.2-master-contract.md`](./canon/v3.5.2-master-contract.md) — master v3.5.2-1 and highest contract authority, 855 lines, SHA-256 `2074974b35ab86b4347030bb409d6e8688f5feb9a33e082b0197770750f14ee8`.
2. [`canon/T1-full-isolated-vertical-clone.md`](./canon/T1-full-isolated-vertical-clone.md) — T1 packet (regenerated from the revised master, 2026-08-22).
3. [`canon/T2-re-room-cloned-engine.md`](./canon/T2-re-room-cloned-engine.md) — T2 packet (regenerated, 2026-08-22).
4. [`canon/T3-build-three-laws.md`](./canon/T3-build-three-laws.md) — T3 packet regenerated from the revised master (2026-08-22), 661 lines, SHA-256 `df7b8c7b9502425074ccc944bed69382430ef6e660531bb4581612eb665f9b11`.
5. [`canon/T3-surgical-execution-subplan.md`](./canon/T3-surgical-execution-subplan.md) — execution authority: R0 CLEAR, G1 superseded, B1 = exact adapter + bounded scaling, SHA-256 `eac73b70d4058b8adf5fc4e0764b68a99745506549cf82c434a14751cf446e08`.
6. [`canon/T4-finalize-worker-bridge-tab.md`](./canon/T4-finalize-worker-bridge-tab.md) — T4 packet (regenerated, 2026-08-22); optional later finalization, not active.

The rejected 611-line post-`a65added` T3 expansion is absent from the visible contract. Git history retains it as evidence only.

The superseded v3.5.1 contract is archived at [`../v3.5.1/_archive/v3.5.1-engine-rebuild-contract.md`](../v3.5.1/_archive/v3.5.1-engine-rebuild-contract.md).

## Supporting evidence

- [`supporting/T3-execution-matrix.md`](./supporting/T3-execution-matrix.md) — five-surface current-code delivery map.
- [`supporting/T3-post-wrap-commit-audit.md`](./supporting/T3-post-wrap-commit-audit.md) — joint KEEP/REWORK/REVERT ledger.
- [`supporting/optional-later-source-and-proof-audit.md`](./supporting/optional-later-source-and-proof-audit.md) — optional later proof reference; not a build phase or gate.

## Current gate

R0 is QA/Meta CLEAR. G1 is superseded by the 2026-08-22 canon revision (bounded exact adapter, proved in `_audits/T3-exact-adapter-bounded-proof.md`). B1 (exact adapter + scaling) is the released build scope from product `2c043257`; B2 remains gated on B1 QA and Meta CLEAR.
