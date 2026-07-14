# Compiler v2 P9 cutover boundary

This documents the built cutover kernel. It is not cutover authorization.

## Current truth

- Legacy remains production.
- Compiler v2 remains in the `compiler-v2-sandbox-v1` namespace.
- No production store/configuration, review private key, Dan private key, signed live proposal, or active v2 production pointer is checked in.
- G-1/G-2/G-4, P0 budgets, the live integration corpus, configured P8 integration, and P9 phase evidence remain open.
- Only Dan may authorize the production pointer switch after QA/Meta evidence is complete.

## Trust chain

The P9 kernel accepts only:

1. the exact current `PROMOTED` P8 sandbox generation;
2. its re-read package, registry, report, G0-G13, corpus, budget, environment, and promotion-receipt identities;
3. an immutable production trust root containing separate Ed25519 review and Dan public keys;
4. a review signature and Dan signature over the same exact cutover payload;
5. a rollback package pointing to the byte-verified current production generation;
6. a deterministic pointer-cycle exercise bound into the signed payload.

The production module contains verification keys only. Any private-key field is rejected.

## State model

```text
legacy production
      |
      | signed stage (no pointer movement)
      v
STAGED candidate -- Dan-authorized atomic activation --> ACTIVE v2
      |                                                |
      | failure/tamper: no pointer movement             | atomic rollback
      v                                                v
legacy unchanged                               exact prior generation
```

For later v2 releases, the prior active cutover becomes `SUPERSEDED` in the same transaction that
activates the new release. Rolling the new release back restores the prior cutover to `ACTIVE` in
the same transaction. There is never more than one active cutover authority.

## Atomicity and recovery

- Package, registry, report, source, and cutover records are copied to one immutable generation and
  flushed before the production database may reference it.
- One SQLite `BEGIN IMMEDIATE` transaction changes package and registry identity together.
- Injected failure after the pointer update rolls the whole transaction back.
- Activation/rollback perform no fallible generation writes after the pointer transaction begins.
- Restart re-verifies the active generation and every signed cutover.
- A complete generation left by a hard crash before row insertion may be adopted only with the
  identical sandbox source, proposal, review signature, and Dan signature. Unknown debris is
  reported and preserved; recovery does not guess or delete it.
- Real multi-process tests prove one staging owner and one activation winner.

## Actual cutover sequence — blocked until final approval

1. Complete P0-P8 phase evidence on the required live ONEMO corpus.
2. Freeze the exact `PROMOTED` sandbox generation and production legacy identity.
3. QA/Meta independently verifies the proposal, rollback generation, and oracle output, then signs
   the exact payload outside this repository.
4. Dan reviews the same payload and explicitly signs/authorizes it outside this repository.
5. Stage the signed generation. Confirm production still reports `activeLane: legacy`.
6. Exercise and inspect rollback evidence in the release environment.
7. Only after Dan's explicit in-session cutover instruction, call the activation boundary once.
8. Verify the production pointer, package, registry, Studio route, live Shape, required corpus, and
   independent oracle.
9. Exercise rollback and verify byte-identical prior identity before declaring the release ready.
10. Legacy cleanup is a separate Dan-authorized post-cutover change. This kernel deletes none of the
    seven truth-fixes, legacy code, or legacy artifacts.

## Evidence boundary

The checked-in P9 tests use temporary stores and ephemeral keys. They prove mechanics only. They do
not constitute a live signature, configured production store, corpus promotion, phase clearance,
cutover, or Done.
