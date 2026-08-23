# v3.5.3 — final agreed state (sole active authority)

Dan's ruling (2026-08-23): the final agreed state is versioned **v3.5.3** so what we build cannot be confused with prior work; `../v3.5.2/` stays exactly as prior history.

## Authority

1. [`v3.5.3-master-contract.md`](./v3.5.3-master-contract.md) — the only contract, 203 lines, SHA-256 `0a3003da6a359508879c9faaa8586bd6f1e71585ba9bd9130457a6e581d14952`.
2. [`v3.5.3-execution-plan.md`](./v3.5.3-execution-plan.md) — build order W1 → W2 → S1–S5 → F1, 33 lines, SHA-256 `2c410d679838ff8c3b04773442c64cabdbdbf14ccf16835eb0ebeb7ea084123d`.

Product base: a fresh clean worktree at `2c043257`. Visible tab label stays `v3.5.1`, `engineId 'v351-centre-clone'` and the `compare.v1` namespace are preserved (product identities are Dan's; the document version is not a rename).

Open on Dan: §1 rounding — nearest (as written) or up. Locking it deletes one parenthetical.

## Evidence (non-authoritative)

- `../v3.5.2/_audits/v3.5.2-3-corrections-reconciliation-ledger.md` — every correction from every lane, its disposition, cross-signed by Grid-QA and Grid-Meta.
- `../v3.5.2/_proposals/v3.5.2-1 simplify and complete proposal/` — the cross-reviews and the three-way reconciliation.
- `../v3.5.2/_audits/Centre-Wrap-necessity-and-deslop-audit.md` — Meta's deslop audit of the engine at `2c043257`.
