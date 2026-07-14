# Framer Components completion contract v1.4 - Chief-QA re-gate 2

**Reviewer:** `@s58-qa` (Chief QA)  
**Date:** 2026-07-13  
**Exact artifact:** 75 lines; SHA-256 `77f4118e8bd35b307c2e058fb9b08dace3db78e1340951a184fa7670dc56fb89`  
**Acceptance authority:** AC-3; 335 rows; SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`  
**Verdict:** **REWORK - one hold-set precision defect remains. No build.**

## Closed

- Paid Convert is no longer dropped by fiat: `AC-I-011` only blocks misrepresentation as Event-variable UI; the capability remains held under `AC-J-045`.
- The predecessor is bound by exact path/hash, restricted to §§1-10 as reference, and its stale G2 authorization is explicitly superseded by v1.4.
- Every owning Linear issue uses its full `KAI-*` ID.
- Superseded contract artifacts are preserved and may be reversibly archived only after Dan signs.
- AC-3 binding, census closure, 335-row allocation, P0 dependency placement, stamps, owners, and no-build-before-sign law are unchanged and valid.

## Remaining Finding

### P1 - the explicit non-marker hold set is still incomplete

Line 67 declares the explicit non-marker holds but omits three bound rows whose own acceptance text requires evidence or a decision before dispatch:

- `AC-A-008`: contract line 24 itself declares breadcrumb prominence a pending Dan call.
- `AC-F-019`: transition ownership must be frozen from Framer evidence before schema change.
- `AC-H-031`: New Folder dispatches only after measured folder-creation acceptance is frozen.

The marker-set-by-reference fix is correct, but replacing one drifting long list with an incomplete short exception list still leaves a dispatch-law gap.

**Required fix:** make the non-marker rule semantic and exhaustive: every AC-3 row whose acceptance text requires prior evidence or Dan disposition is held regardless of marker. Retain the current examples, explicitly name `AC-A-008`, `AC-F-019`, and `AC-H-031`, and state that omission from the examples never waives the row's own prerequisite. This is contract-only; AC-3 does not change.

## Self-Audit

- New contract read `75/75`; exact contract, AC-3, and predecessor hashes verified.
- Focused `/o-deslop` reconciliation covered every literal marker plus every `before dispatch`, `frozen from evidence`, `dispatches only after`, and pending-Dan clause in AC-3/v1.4.
- No contract, AC, Linear, product code, or build worktree was edited; this QA report and the required tooling-failure entry in `kai-solo-brain/ERRORS.md` were added.
