# KAI-10235 contract-authority ledger

## Locked authority

- Canonical path: `_WIP/context/QA-space/contracts/v1-polish-optimisation-production-contract.md`
- Required length: 177 lines.
- Required SHA-256: `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`.
- Boundary: documentation/governance hygiene only; no product source.

## Transcript coverage

- Full-read QA segment 9/31 (15 lines), 10/31 (89 lines), and 11/31 (355 lines) for 2026-08-08.
- Segments 9–10 establish that the old lead plan was unsafe, the plan—not product code—was to be repaired, and the corrected plan needed independent Meta before Builder execution.
- Segment 11 pins Dan's source-first, necessity/de-slop, full-read, and QA-space ledger directives. It does not designate either stale short hash as final authority.
- Full-read Builder 2026-08-09 day file (870 lines).
- Builder lines 779–814 capture the actual conflict: Lead read a 170-line `c21dd1b3…` copy, while Builder/QA cited the 177-line `367e2d27…` authority and an earlier Meta brief cited `412e0edc…`.
- Builder lines 827–869 contain Dan's resolution: the latest contract in the active Builder worktree is authoritative; stale worktree copies and briefs must be reconciled; this hygiene is non-blocking; KAI-10216 advances and KAI-10217 starts.

## Minimal diff

1. Preserve the active 177-line canonical contract byte-for-byte.
2. Find every worktree-local stale contract copy or review/brief reference naming `c21dd1b3…` or `412e0edc…`.
3. Exact-copy the canonical bytes where the file is intended to be a live contract copy; otherwise mark the stale review/brief reference explicitly superseded by the canonical path and SHA.
4. Verify no product source changed and every live reference resolves to the same authority.

Necessity — **no extra process or contract rewrite is justified.** The task is exact-copy/supersession hygiene against the owner-designated bytes.

Sufficiency — **delivered.** The current authority is singular, the abandoned live-looking surfaces retire to that authority, and historical ledgers remain historical rather than being rewritten.

## Reconciliation result — 2026-08-09

- No daemon or editor process held the abandoned `cutout-lab-v2/_WIP/context/QA-space`; the stale contract and review brief still had 2026-08-08 mtimes. The collision was concurrent lane editing, not a background writer. `@s62-lead` was told to stop editing the QA-owned folder while KAI-10235 reconciled it.
- Replaced the abandoned 170-line contract with an 11-line retirement pointer to the active 177-line `367e2d27…` authority. It states the decisive semantic difference: Increment 1 keeps files in place and relocation belongs to sprint-end closure.
- Replaced the abandoned quick-rereview brief with an 11-line supersession pointer. `412e0edc…` and `c21dd1b3…` are named only as historical, non-governing bytes.
- Retired the abandoned `hydration/current-state.md` and `reviews/v1-contract-linear-audit.md` in the same form because both presented `c21dd1b3…` and old Linear states as current.
- Remaining old-hash occurrences in the abandoned QA-space are confined to the append-only source ledger and checkpoint history. They record what was believed at the time; they are not live authority surfaces and were not rewritten.
- Active canonical contract remained byte-identical at SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, 177 lines.
- Product source remained untouched.

## Meta closure

- `@s62-lead` independently full-read all four retirement pointers and the live authority, confirmed the two remaining old-hash files are append-only history, and returned `AGREE`.
- Necessity — no unnecessary elements.
- Sufficiency — delivers KAI-10235 in full.
- KAI-10235 closes at Meta. KAI-10217 remains Building and was not changed by this hygiene task.
