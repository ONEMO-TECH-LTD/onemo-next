# KAI-10220 independent QA verdict — CLEAR

Snapshot: `fee76892b7661cfd3da095c29aa79d3f232b052d`  
Contract: `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 5  
Disposition: **QA CLEAR to Meta.** KAI-10221 remains blocked until Meta closes KAI-10220.

## Verdict

The owner-locked release behavior is present on the exact pushed snapshot:

- u2net and GrabCut retain one shared post-mask edge/contour/matte/compose owner with default `8`.
- Blend remains `0` through Frame outgrowth unless the user changes it.
- Paint exposes swath `0..12x`, smoothing `0..100%` with true zero-off, and loop-close `0..1` in the existing admin panel.
- Moving each Paint control visibly recalculates the latest accepted Paint shape or erase from its cloned pre-stroke mask. Work is debounced, generation-invalidated, and replaces the current history entry. A calibrated standalone Paint result remains non-undoable; a calibrated erase returns to the prior result in exactly one Undo.
- Raw GrabCut masks, provider, refinement, shared edge implementation, global Grid/Creator configuration, packages and downstream KAI-10221 code are unchanged from the prior source-clean snapshot. No second history, provider, smoother, framework or panel exists.

Dan's physical-phone observation established that the edge control is visibly effective and selected `8` as the release default. That closes the prior calibration HOLD.

## Independent proof

- Full-read nine-file superseding diff: 2,806 lines; tracked snapshot equals origin.
- Vitest: 57 files pass, one declared skipped; 534 tests pass, 10 declared skipped.
- Typecheck, changed-scope zero-warning lint, full lint with zero errors, production build and diff check pass.
- Current-build production server was proven to serve this worktree and commit. Preservation, detector, flow, output and GrabCut oracles pass; Chromium and WebKit preserve raw masks, one provider, provider-cold Upload/scratch+erase, capped truthful output, Paint recalculation and Blend-zero behavior.
- QA-owned real-route visual journey independently exercised Paint shape and erase across all three controls, zero smoothing, Undo/Redo cardinality, and Frame outgrowth. Console warnings/errors: zero.
- Visual evidence:
  - `KAI-10220-fee76892-evidence/qa-paint-shape-live.png` — SHA-256 `cec1b9f64948dda48d9d465e698be52d0744041282e97e2eb9c1cca1d1e2966b`
  - `KAI-10220-fee76892-evidence/qa-paint-erase-live.png` — SHA-256 `ec4fb8b9c4821b03bb089f3d7a304ad8c6429f0c9a3ac8c6085a0699fa324778`
  - `KAI-10220-fee76892-evidence/qa-blend-zero-outgrown.png` — SHA-256 `aece8ba2e726b7c81afa27d6205f772daff34f9160057de62305129a4593d402`
- Vercel deployment `dpl_EuDNun9Fw7vaHht8dFXVU98hUvHV` independently resolves to the audited branch/commit, successful build and Ready; authenticated Cutout fetch returns HTTP 200.

Necessity — **no unnecessary product elements.** Every added helper/ref/timer/stack edit directly owns latest-Paint replay or its required invalidation; the Blend change is a deletion; no losing or parallel path survives.

Sufficiency — **delivers Increment 5 plus the accumulated owner directives in full.** Provider/raw-mask proof remains intact, the phone-selected shared default is locked, the complete Paint calibration behavior is live, and no KAI-10221 work is built ahead.
