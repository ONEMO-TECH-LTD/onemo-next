# S58 Framer Components completion contract v1.2 - Chief QA review

**Verdict:** REWORK - contract freeze blockers only; no build or product verdict.
**Auditor:** @s58-qa (Chief QA), independent of @s58-expert
**Date:** 2026-07-13
**Contract reviewed:** `s58-framer-parity-COMPLETION-CONTRACT-v1.2.md`, 55 rendered lines, SHA-256 `e70154f652fa9b914f704c8e6ecdcb1532cbd401abe707ac502c4461097ffcc6`
**Bound authority verified:** AC-2, 264 rows / 333 lines, SHA-256 `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`
**Build truth retained:** exact `8d64fd3ede947aa1275e7896238bb3ce6f3aee4f`; clean worktree; no implementation re-gate claimed here.

## Findings

### P0 - Full-parity completion is not closed by an exhaustive discovery law

Contract line 14 requires full Framer behavior/model/functionality, but then limits the target to what is already "extracted and in front of us." AC-2 has no independently provable Framer-Components capability-census closure row. The package can therefore satisfy all currently known rows while still omitting an undiscovered Framer capability, recreating the exact foundation-versus-full-product failure this contract exists to prevent.

Required correction: make full parity the precedence rule. No invention remains correct, but unextracted behavior is a blocker to final completion, not permission to omit it. Add AC-3 acceptance for a source-backed, human-visible full Components-module surface/command/state census and 1:1 mapping of every discovered capability into stable AC rows before final Dan sign-off.

### P0 - Build order does not allocate every binding AC-2 group/row

Contract lines 31-38 allocate K/L, B/H, C/D, E, F/G, and I. Group A is never allocated as a whole; only non-stable shorthand `A2b` and `A3` appears in P0. Cross-cutting group J is also not declared as an every-slice gate. `B2`, `A2b`, and `A3` are not stable AC-2 IDs, while AC-J-001 through AC-J-004 require atomic stable rows, mapping, and ownership.

This leaves AC-A-001/002/007/008 and other A rows without a reliable build-order home, and makes the KAI-9438 versus KAI-9450 owner/evidence record for the double-click dead-end ambiguous.

Required correction: allocate every AC-2 prefix and affected stable ID explicitly. State that each AC row is one atomic slice; phases are dependency groupings, not atomic slices. Apply AC-J-013 through AC-J-032 continuously to every slice. Resolve each A/X P0 row to exactly one Linear evidence record.

### P0 - Per-row Dan stamp sequencing contradicts Dan's final-only sign-off

Contract line 20 defines Dan sign-off as the fifth stamp per row. Line 38 then requires the full five stamps "before the next" slice. Lines 45 and 55 instead describe Dan as final sign-off after the package review. Dan's standing decision is continuous Builder -> QA -> Meta progress without interim Dan pauses; Dan signs the final product.

Required correction: four pre-Dan evidence stamps may gate movement slice-to-slice; Dan's fifth stamp is applied only during final product review unless Dan explicitly asks for an intermediate decision. Nothing becomes Done before that final stamp.

### P1 - The needs-manual register is incomplete relative to binding AC-2

Contract lines 47-49 present a finite "Still needs-manual" register, but omit binding `SPEC-PENDING` rows AC-D-006, AC-C-011, AC-E-042, AC-B-022, AC-H-027, AC-H-036, AC-H-037, AC-H-039, and AC-H-040. The prose also does not identify stable IDs, so it cannot be audited 1:1 against AC-2.

Required correction: declare all AC-2 `SPEC-PENDING` rows authoritative by stable ID, or list every one without omission. Keep AC-C-012 redo disposition separately decision-pending. No owning slice dispatches while its applicable spec row remains pending.

## Confirmed correct

- The AC-2 path, revision, row count, line count, SHA, append-only rule, and re-freeze process are exact.
- The 5-proof categories, schema/command/UI/runtime separation, semantic-command/lifecycle separation, exact `8d64fd3` true-state headline, Variables/Event corrections, paid Trigger correction, throwaway-worktree law, and no-build-before-contract-sign boundary agree with AC-2 and current source truth.
- No contract, checklist, Linear, product, or build file was changed by this review.

## Gate

**REWORK.** Correct the four items, produce a new immutable contract revision bound to AC-3 if the parity-census rows change acceptance authority, then run one fresh independent Chief-QA + Expert review before Dan signs.
