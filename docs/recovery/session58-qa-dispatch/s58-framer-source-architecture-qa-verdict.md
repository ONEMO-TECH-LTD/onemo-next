# S58 Framer source architecture - QA gate verdict

**Reviewer:** `@s58-qa`  
**Artifact reviewed:** `s58-framer-source-architecture-codex.md`, 636/636 lines  
**Artifact SHA-256:** `a28638e60be900ee4feb5b2b4c0594a5aa0f3e5978c10fb48534a16a071fc183`  
**Baseline verified:** `804ffe76c1ec959efd579277518a001d58480370`, clean isolated worktree `session58-task/s58-framer-architecture`  
**Gate:** **PASS**  
**Scope:** architecture only; no product code authorization

## Plain-language result

The revised architecture now satisfies the QA gate. The Engineer kept the correct replacement direction - canonical `AuthoringGraphV1`, strict `SourceProjection`, staged `CompilerAdapter`, and durable transactions - while resolving the four source-of-truth and durability blockers from the prior review.

This PASS means the architecture can move to Meta/Designer/Dan reconciliation. It does **not** authorize implementation yet.

## Resolved blocking findings

### H1 - Portable roots and no tracked absolute path: PASS

Verified corrections:

- `AuthoringGraphV1.root` is now logical only: `{ kind: 'project' | 'global' }` at lines 192-205.
- The tracked sidecar persists `storeId` plus `root.kind`, never an absolute checkout path, worktree path, device ID, or inode at lines 349-355.
- Runtime path resolution is process-local through `RuntimeRootRegistry`, with realpath/jail re-checks before access at lines 349-355.
- Cross-root coordinator records use logical store IDs and store-relative transaction paths; absolute paths are forbidden in recovery records at lines 379-389.
- Relocation coverage is explicit at lines 349-355 and in the store tests at lines 568-579.

Verdict: the portable sidecar objection is closed.

### H2 - Stable typed property identity: PASS

Verified corrections:

- `sourceProperties: Record<PropertyId, SourcePropertyRef>` is part of the canonical graph at lines 192-205.
- `SourcePropertyRef` binds property membership to component, variant, source/export, owner anchor, lineage, and typed channel at lines 213-225.
- Variant inheritance stores override membership, not duplicated values, at lines 236-247.
- Lifecycle/refusal rules cover create/import, rename, duplicate, detach, Update Primary, Reset Overrides, missing bindings, missing anchors, and ambiguity at lines 414-422.
- The test map requires typed property ownership/lineage and missing/ambiguous refusal fixtures at lines 566-579.

Verdict: Update Primary / Reset Overrides can now be specified without creating a second value store.

### H3 - G1 no longer creates graph-only semantic variants: PASS

Verified corrections:

- The command catalog still lists semantic commands at lines 401-408, but the implementation gate prevents them from landing in G1.
- G1-Foundation is explicitly graph/store/transaction/classification only, with no persisted create/rename/duplicate/delete variant command before its compiler exists at lines 597-609.
- G2-Variant Compiler requires staged TSX/CSS output, strict SourceProjection reparse, type-aware semantic assertions, and round-trip fixtures at lines 597-609.
- Compiler law remains intact: staged outputs must parse, reproject, prove intended graph delta, and refuse unsupported cases at lines 424-448.

Verdict: the previous two-source-of-truth risk is closed, provided implementation follows the G1/G2 boundary exactly.

### H4 - Durable install semantics and bounded failure model: PASS

Verified corrections:

- `DurableFileInstaller` requires sibling temp files, exclusive/no-follow semantics, same-filesystem staging, temp file fsync, hash verification, atomic rename, directory fsync, installed-byte verification, tombstone deletes, and durable terminal cleanup at lines 467-478.
- Sidecars, participant records, and coordinator decisions use the same durable install sequence at lines 467-478.
- The supported guarantee is bounded to local filesystems that provide the probed atomic rename and fsync semantics, with `DURABILITY_UNSUPPORTED` refusal for unsupported storage at lines 467-478.
- Tests distinguish process/subprocess-kill recovery from physical power-loss claims at lines 578-589.

Verdict: the crash-consistency claim no longer overstates the install contract.

## Verified retained corrections

- **PASS:** per-file raw-byte SHA-256 preconditions are correct; one aggregate component hash is insufficient.
- **PASS:** inherited interaction removal is an `InteractionOverride` tombstone plus `reset-interaction-override`, not a runtime reset action.
- **PASS:** successful detach removes canonical instance identity; undo/history retains the former identity only as preimage.
- **PASS:** preview sessions are transient runtime/session state, not persisted graph state.
- **PASS:** strict SourceProjection failure becomes `unsupported`; it cannot masquerade as empty axes.
- **PASS:** line/column is only an accelerator. Source identity is structural fingerprint plus ambiguity refusal.
- **PASS:** generic instance overrides remain deferred pending evidence.
- **PASS:** `Cycle` is preserved as an observed authoring choice while runtime compilation remains blocked as unverified.
- **PASS:** cross-root coordinator, tracked/ignored `.onemo` lifecycle, and quota warning are explicit.

## Lead-requested code-claim verification

- **PASS - operation mapping:** current source defines `make-component` as selection extraction, `create-component` as blank scaffold, and `insert-component` as JSX instance insertion. Evidence: `editor/lib.ts:291-295`, `2080-2105`, `2107-2203`, `2251-2291`; UI callers at `page.tsx:2460-2468`, `3144-3152`, `3166-3176`.
- **PASS - half-commit windows:** parse validation happens before writes, but sequential real-file writes remain. `renameComponentOp` writes consumers, then the new component, then removes the old file (`editor/lib.ts:1869-1873`). Global create writes the component before barrel regeneration (`2080-2104`). Selection conversion writes the new component before replacing the source subtree (`2198-2203`). CSS/TSX bridging writes two real files sequentially (`514-516`, `960-967`).
- **PASS - queue limitation:** `editor/lib.ts:2294-2301` is one in-memory promise queue. It serializes only within one process and supplies no durable transaction, cross-process lock, or recovery decision.

## Remaining constraints for Meta/Dan

- Ease curve names remain `UNVERIFIED`; `easing: string` may preserve a raw observed value, but compiler validation remains blocked until the enum/custom-bezier surface is extracted.
- New Event remains excluded.
- Once/Cycle runtime semantics remain blocked until operated end to end.
- Instance property-override depth remains deferred; no generic escape hatch is allowed.
- G1 implementation must stay inside the architecture's Foundation boundary. Semantic variant creation/rename/duplicate belongs to G2 with compiler proof.

**Verdict: PASS.** Architecture gate clears for Meta/Designer/Dan reconciliation. Product implementation remains blocked until Dan signs the final hard contract.

## Post-fold self-review - 2026-07-11

PASS still holds after the later fold-ins:

- Expert C5 correction strengthens H3: G1 remains graph/store/transaction/classification only, while Update Primary, alias-map emission, semantic variant commands, and type-aware round-trip assertions are G2.
- Designer Meta reconciliation is compatible with the architecture: V1-V10 and S1-S9 have graph/projection/compiler homes, with M1-M4 as non-blocking folds.
- Expert G0 closures reduce later uncertainty: Hover/Pressed is implicit state lineage, not a phantom explicit edge; connector drag-pickup is observed. Asset-to-canvas insert remains a G4/Dan-decision blocker, not an architecture PASS blocker.
- Live Chrome click-through of the current pre-rebuild editor did not reproduce crash-on-select. It did confirm the current fixed hardcoded component board and narrow drag-to-wire model, plus one baseline React hydration mismatch unrelated to the select action.

No product implementation is authorized by this verdict.
