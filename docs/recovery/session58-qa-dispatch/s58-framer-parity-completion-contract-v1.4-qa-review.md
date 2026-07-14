# Framer Components completion contract v1.4 - Chief-QA review

**Reviewer:** `@s58-qa` (Chief QA)  
**Date:** 2026-07-13  
**Artifact:** `s58-framer-parity-COMPLETION-CONTRACT-v1.4.md`  
**Exact artifact:** 72 lines; SHA-256 `55a1f6e016d3c62626ab094af8676eb04a33400afbec513bf802330527cc4529`  
**Acceptance authority:** AC-3; 335 rows; 428 lines; SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`  
**Verdict:** **REWORK - do not send v1.4 to Dan for sign-off yet. No build.**

## Verified Closed

- The AC-3 path, revision, row count, line count, and hash are exact. AC-1/AC-2 provenance is retained without a self-rebind.
- Census closure is honestly enumeration-only; product completion and every unresolved hold remain open.
- All 335 AC-3 rows are mechanically allocated once: P0 16, P1 51, P2 66, P3 30, P4 48, P5 53, P6 26, continuous J 45.
- The false per-row phase-field claim is gone. `AC-A-009` is co-phased with `AC-A-005`; no P0-to-P1 inversion remains.
- Four pre-Dan stamps govern slices; Dan alone signs the final product. Product build remains prohibited before Dan signs.

## Blocking Findings

### P0 - paid Trigger receives an unauthorized permanent waiver

Contract line 16 and `AC-J-045` require every paid-gated capability to retain a final hold until live evidence or Dan explicitly accepts, defers, or drops it. The expert census records instance `Trigger` as a paid Convert add-on that was not operable, not as a capability Dan dropped. Yet contract line 57 says `AC-I-011` is "never built."

That wording converts an access limitation into an agent-authored parity waiver and contradicts the full-functionality-wins law. `AC-I-011` only prevents misrepresenting the paid Trigger as component Event-variable UI; it does not authorize dropping the paid Convert behavior.

**Required fix:** remove "never built." State that it is never implemented or counted *as Event-variable UI*, while the actual paid Convert capability remains held under `AC-J-045` until live evidence or Dan's explicit clone/defer/drop disposition. Add that disposition to the pending Dan calls if needed. This is a contract-only correction; AC-3 need not change if its scoped wording is preserved.

### P0 - inherited v0 authority is not immutable or unambiguous

Contract line 3 says only "v0 architecture §1-§10 stands." It names no path or hash and does not say whether it means `s58-framer-component-authoring-HARD-CONTRACT-v0.md` or `s58-framer-source-architecture-codex.md`. Both exist. The current Hard Contract header still says G2 is authorized and active, while v1.4 line 72 says no product build begins before Dan signs.

An immutable sign contract cannot inherit mutable authority through an ambiguous label, especially where the inherited package contains stale build authorization.

**Required fix:** bind each intended predecessor by exact path, line count, and SHA-256, state precisely which sections survive, and state that v1.4 overrides predecessor status/build-authorization/phase language wherever they conflict. If only one artifact is intended, name only that artifact.

## Deslop Findings

- Line 66 says "do not re-list-and-drift" and immediately copies a long "at minimum" hold list. It already mixes 51 literal-marker rows with unmarked gate rows (`AC-C-012`, `AC-F-002`) while the explicit Dan hold `AC-A-008` lives elsewhere. Bind the literal marker set by reference and name only non-marker exceptions (`AC-A-008`, `AC-C-012`, `AC-F-002`, paid `AC-I-011`/`AC-J-045`).
- Line 41 abbreviates Linear IDs (`9438`, etc.). Use exact `KAI-*` IDs in a signable traceability contract.
- Superseded v1.1-v1.3 files are valid audit evidence, not deletion candidates. After Dan signs a corrected successor, archive them reversibly out of the live-package root; do not delete them.

## Self-Audit

- Contract read `72/72`; AC-3 read `428/428`; reconciliation read `56/56`; expert census read `85/85`. All four hashes were independently verified.
- The initial Style-Transition sequencing concern was rejected: `AC-L-018` can consume the already-binding `VariantFrame.transition` foundation, and `AC-L-034` is co-phased with it.
- Continuous `AC-J-*` is a cross-cutting allocation bucket, not a missing-row defect; the 335-row allocation remains complete.
- Actual `/o-deslop` judgment sweep covered v1.4, AC-3, both census artifacts, and the v1.3-to-v1.4 diff. No product-state, implementation, or Linear claim was inferred from prose.
- Contract, AC, Linear, product code, and build worktrees were untouched.
