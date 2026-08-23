# T3 scaling rollback audit

## Verdict

Rollback boundary: product tree `2c043257a57bcc4184f90081f6b0f3c3e4706eb0`, the completed Centre + Wrap checkpoint before scaling work.

Do not continue from current product HEAD `df3b310099cf8bd346a518f1359868258fd7e89c` plus its dirty rework. It is not contract-faithful, not green and not a safe layered-repair base.

Do not treat `cc79cbe0ee50b39317413b22d49586a93e226026` as a cleared product boundary. It contains useful retained exact primitives, but they are dormant and its exact identity still serializes isolating-interval bytes.

No rollback was executed by this audit.

## Evidence binding

- Product worktree: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-v351-r15-t1-build`
- Audited product state: committed HEAD `df3b3100` plus six dirty tracked files.
- Builder self-review transcript:
  - `10-s62-grid-qa--13-14.md`, 241 lines, SHA-256 `d6fafe71c256c33531a56b00b2c87ebafccf93177b5c00683bd1538043db41cd`
  - `11-s62-grid-qa--14-14.md`, 39 lines, SHA-256 `7b0c562bc9a7d3b005871d587335daa347bb1e69b7088d24bd64dff0308c19c9`
- Current audit gates: typecheck failed; focused scaling/exact-real/SAFE_TOPOLOGY run produced 12 passes and 6 failures.

## Correctly delivered before scaling

The rollback boundary retains:

- T1 isolated versioned Law tab and worker clone.
- T2 package re-rooming and ownership separation.
- Exact fixed/Auto Wrap enforcement, typed refusals and witness-only dots.
- Frozen Centre behavior and no scaling claim.

Independent rollback-boundary gates passed: typecheck, focused magnetic-grid 27/27 and production build. The exact Centre + Wrap surface was observed running from the bound worktree and commit.

Bounded caveat: the live square-25, pitch-24, flap-0 inspection displayed a refusal with `requires -0.000000mm`; direct exact centred-square evaluation returns the expected positive 0.5mm requirement. This is a separate bridge/placement boundary seam. It does not justify retaining the scaling WIP.

## Current scaling blockers

1. **Public partial delivery.** Commit `304bf258` landed a 1,871-line public WIP engine slice. The surgical sub-plan forbids a public partial engine or stub between B1 commits.
2. **Policy-dependent Compute.** Engine selects full-outer versus mesh evidence from the chosen Centre policy. G1 requires one neutral all-mode branch record; Logic alone selects policy.
3. **Wrong module ownership.** Event discovery, mesh partitioning, neutral geometry measurement, Wrap orchestration and ad-hoc identity hashing live in Engine. Contract ownership assigns measurement to Compute, identities to Identity and Engine only orchestration/assembly.
4. **Exact input discarded.** The normalized exact boundary is validated and then the solve continues from number-valued contour data. Mesh dimensions use native number min/max before conversion back to Rational.
5. **Incomplete G1 evidence.** The implementation returns scales rather than complete branch records with adjacent exact dispositions and predecessor evidence. Unresolved Centre sites are silently skipped instead of returning typed unresolved.
6. **Incomplete event set.** Nonzero-clearance contact enumeration follows the locally nearest branch and returns before enumerating all binding/projection-class changes.
7. **Wrong manual inspection.** One seated node is treated as the phase. A lawful centred-gap two-anchor layout is therefore reported with a 24mm Centre error.
8. **Reducer violations.** Logic imports `compareExactToRational` although the contract permits only `compareExact`; comparison failure becomes a Wrap refusal; any vertical candidate deletes co-lawful non-vertical candidates; the first contact is chosen arbitrarily.
9. **Fake first-lawful proof.** `priorEvidenceIds` is only a bag of earlier IDs. It does not prove every earlier regime/root candidate for that count absent or unlawful.
10. **Silent candidate loss.** Candidates with no witnesses and unresolved Centre intervals are dropped instead of producing typed refusal evidence.
11. **Identity and schema drift.** Engine hashes incomplete ad-hoc JSON; canonical identity remains isolator-sensitive; public `CentreBranchMeasurement` exposes private frozen-mesh evidence.
12. **Unauthorized bounds.** Mesh construction stops at 10,000 and algebraic approximation uses a fixed 64 refinements. Neither execution bound is authorized.
13. **Dishonest gates.** The separation guard still represents the older T2 inventory. It does not enforce the B1 architecture.
14. **Contradictory RED tests.** The same square/config expects both `[[1],[2,4],[8],[12]]` and `[[1],[4],[8],[12]]`; diamond scaling times out; SAFE_TOPOLOGY imports a deleted function.

## Builder self-review agreement

The builder independently reached the same high-level verdict:

- current B1 is not contract-faithful or complete;
- necessary exact primitives were implemented, but ownership, policy independence, proof completeness and necessity were violated;
- earlier continuous offset/resultant/RUR work was scope creep and correctly removed;
- later recovery still optimized for speed by placing Compute work in Engine, selecting policy too early, adding public private-data schema, adding arbitrary constants and changing tests before the law proof existed.

Its own verdict was Necessity NOT-CLEAR and Sufficiency NOT-CLEAR.

## Documentation state at save

The transcript confirms the prior `v3.5.1/r15` folder mixed canonical contracts, phase packets, recovery authority, supporting evidence and a visible T3 file containing 611 rejected lines. Cleanup restored the approved 756-line T3 bytes, separated `canon/` from `supporting/` and removed the rejected expansion from the visible authority while retaining it in git history.

The evolved R15 contract materially differs from the original v3.5.1 contract: 175 additions and 284 deletions, including the T1-T4 code-first sequence and frozen-Centre scaling approach. The active cleanup therefore archives the original v3.5.1 contract and moves the evolved authority under `_WIP/v3.5.2/`. This audit follows that current hierarchy.

## Why the documentation did not make execution simple

The canonical T3 contract is a behavioral/module contract plus conditional algorithm reference, not paste-ready final code. It explicitly defines Section 7 mechanisms as approved options rather than an automatic construction programme.

The execution matrix identified the five live surfaces and missing consumers. The post-Wrap audit classified commits KEEP/REWORK/REVERT. The surgical sub-plan bounded cleanup and B1/B2 execution. Those documents were useful, but execution violated their central boundary by landing a large partial B1 and accepting shallow, contradictory evidence.

G1 also made the scaling problem intrinsically substantial: exact first-lawful proof was required while preserving the discontinuous 2mm/800-point Centre donor. That requires proving every mesh dimension, sample classification, component/mass and winner transition over scale. This complexity should have been surfaced as the governing product/engineering tradeoff before B1 code, not hidden inside incremental implementation.

## Smallest complete recovery

1. Restore the product tree to the `2c043257` Centre + Wrap boundary through a separately authorized, history-preserving recovery.
2. Do not carry the current scaling implementation wholesale.
3. Resolve the governing scaling requirement before rebuilding: either exact first-lawful proof across frozen mesh Centre modes remains required, or the contract is simplified. The implementation cannot honestly be both simple and satisfy the current G1 proof requirement.
4. If exact scaling remains required, reintroduce only exact primitives with their first live consumer and complete one engine-only `solveBands` delivery: policy-neutral sites, exact boundary/Wrap evaluation, typed unresolved, complete predecessor certificates, B1-B4 ownership and co-lawful ties.
5. Only after independent QA and Meta, atomically wire worker/UI and remove sampled scaling residue.

Necessity — shrink the current public WIP, unsupported schema, arbitrary bounds, stale fixtures and misplaced owner logic; retain only proven Centre + Wrap and exact primitives that enter with a live consumer.

Sufficiency — current scaling is partial: policy-neutral Centre sites, complete transition and predecessor proofs, correct inspection, reducer/tie semantics, canonical identity, honest gates and a verified vertical slice are missing.
