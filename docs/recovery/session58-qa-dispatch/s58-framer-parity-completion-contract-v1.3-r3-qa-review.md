# Framer Components completion contract v1.3 - Chief-QA round-3 review

**Reviewer:** `@s58-qa` (Chief QA)  
**Date:** 2026-07-13  
**Artifact:** `s58-framer-parity-COMPLETION-CONTRACT-v1.3.md`  
**Exact artifact:** 64 lines; SHA-256 `7b21449486d1ea5eb5124b2752ea8b1f253b3a2254f6fc469707356c8b448d95`  
**Acceptance state:** AC-3; 335 rows; 428 lines; SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`  
**Verdict:** **REWORK - do not use v1.3 as build authority. Issue and review v1.4 against AC-3 first.**

## Prior blockers

The four round-2 blockers are closed in the reviewed bytes:

1. Per-group mention counts were removed; AC-2 is the sole 264-row count authority.
2. P0 uses exact AC-2 IDs and later phases use remaining group rows.
3. Flagged paid/harness-limited behavior blocks final until evidence or explicit Dan disposition.
4. The AC-3 rule is conditional in law and records that the completed census did produce gaps.

## Blocking findings

### P0 - the claimed per-row phase record does not exist

Contract line 52 says the definitive phase field lives on each AC-2/AC-3 row and its Linear issue. The bound checklist contains no per-row phase field; it contains IDs, criteria, and group ownership only. No evidence supplied in this gate proves the corresponding Linear record either.

This contradicts contract lines 38 and 45-52: rows are declared the atomic slices and each row must belong to exactly one phase, but the named record of that assignment is absent. AC-3's 71 new rows are therefore not phase-allocated by durable authority.

**Required fix:** v1.4 must either bind a real per-row phase map or state a deterministic stable-ID rule that allocates every AC-3 row without overlap. Do not claim a record exists when it does not.

### P0 - AC-2 P0 authorization is stale now that AC-3 is frozen

Contract line 46 schedules `AC-A-005` in P0, while line 17 says the census does not block P0 start. Frozen AC-3 now adds `AC-A-009`, which explicitly prevents `AC-A-005` from dispatching until global/library behavior is measured in Dan's library-enabled workspace. AC-3 also adds further source-backed and SPEC-PENDING dependencies that v1.3 cannot bind because line 9 permanently fixes it to AC-2.

The census is already closed and AC-3 already exists. Signing v1.3 now as build authority would knowingly permit execution under superseded acceptance criteria. Full-functionality-wins and the append-only authority law require the newer evidence to govern before dispatch.

**Required fix:** issue immutable v1.4 binding AC-3 exactly (`335` rows; SHA above), allocate the AC-3 rows, retain every SPEC-PENDING/Dan-decision hold, run one fresh QA/Expert review, then ask Dan to sign that current authority. Do not start P0 from v1.3.

## Self-audit / deslop

- Contract read end to end `64/64`; AC-3 read end to end `428/428` at the hashes above.
- AC-3 census reconciliation read end to end `56/56`; enumeration is closed, product/final remains open.
- Findings are contract-authority defects, not implementation claims; no build SHA or product status was changed.
- No duplicate count table, moving-status matrix, stale shorthand, speculative capability, or parallel acceptance authority was introduced.
- Contract, AC-3, Linear, product code, and build worktree were untouched.

