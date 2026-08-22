# R15 authority and current execution state

## Governing contract

- [`v3.5.1-engine-rebuild-contract-r15.md`](./v3.5.1-engine-rebuild-contract-r15.md) — 948 lines — SHA-256 `53f6a5c15a9a3268d89943315527876dbd6f0884184c9e0a2aca1ebcb6d3404a` — approved authority at plan commit `a65added`.
- Original approved T3 packet — `a65added:_WIP/v3.5.1/r15/T3-build-three-laws.md` — 756 lines — SHA-256 `36abad03fd946db98d1ba77729f838031f010095566b75c9098a5f58d3a036f9`.
- [`T3-execution-matrix.md`](./T3-execution-matrix.md) — 19 lines — SHA-256 `27bdb7b0d660e6c4e2f1158e0a9cf38b4129d4370502bd70f172204ec19323f7` — reconciled current-code execution map, independently accepted by Grid-QA.
- [`T3-post-wrap-commit-audit.md`](./T3-post-wrap-commit-audit.md) — joint 34-commit KEEP/REWORK/REVERT recovery ledger.

## Phase packets

- [`T1-full-isolated-vertical-clone.md`](./T1-full-isolated-vertical-clone.md)
- [`T2-re-room-cloned-engine.md`](./T2-re-room-cloned-engine.md)
- [`T3-build-three-laws.md`](./T3-build-three-laws.md) — current working file contains 611 post-`a65added` inserted lines. Those insertions are non-governing while recovery is active; do not execute them as contract authority.
- [`T4-finalize-worker-bridge-tab.md`](./T4-finalize-worker-bridge-tab.md)
- [`optional-later-source-and-proof-audit.md`](./optional-later-source-and-proof-audit.md)

## Current ruling

Building remains stopped. Resume only from the approved master, original T3 packet and reconciled execution matrix. Any missing mechanism must be added as one bounded, approved contract block before product code; conditional Support B is not an automatic phase.
