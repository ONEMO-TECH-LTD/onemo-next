# KAI-10284 QA verdict — REVISE

Snapshot: `1cc2afd2b31373bf9322491bff27fdd1c6a01043`

## Finding

The product correction is source-clean, but the existing preservation oracle was not reconciled with the intentional brush-diameter normalization. Two independent exact-current runs fail at `scripts/verify-cutout-v1-preservation.mjs:168` with the same current output:

- expected: `1793x763` RGBA, SHA-256 `0ef4108a9f900efe4c25753bea2baa66b6131a7b4860ec83dfb1d124193342eb`
- actual, twice: `1782x763` RGBA, SHA-256 `25b52791c10e237d89868f1d1464e2afc8594aead7f4f0122948ba242ef3254c`

The GrabCut oracle already freezes the new raw masks and output bytes, so this is a stale proof fixture, not evidence for another product implementation.

## Smallest correction

Update only the preservation oracle's fixed-viewport post-GrabCut expected PNG to the deterministic current bytes above, rerun the full preservation oracle, then rerun the normal static/oracle gate set. If the next assertion exposes another stale normalization-dependent fixture, reconcile only that fixture. Do not change product code.

## Independent evidence

- Full-read the six changed files, exact diff and production callers. Paint smoothing has no brush input; it derives from accepted occupied area and bounds. Zero clones exact bytes. The one display brush value reaches Paint and GrabCut through the same scale; GrabCut seed radius is half the diameter and retains its 3x halo and 2.5x corridor.
- Focused tests `3/3`; full serialized suite `539 passed / 10 declared skipped`; typecheck, scoped lint, diff hygiene and production build pass.
- Detector, flow, output and GrabCut Chromium/WebKit oracles pass. Only the preservation oracle fails as described.
- QA-owned production route on port `3234`, proven serving this snapshot: Paint smoothing `0%` created the accepted shape; changing to `100%` visibly recalculated it through the live path. Paint and GrabCut both showed the same `15px` cursor diameter. Console: zero errors and zero warnings.
- QA visual evidence: `../evidence/KAI-10284-1cc2afd2/paint-smoothing-0.png`, `paint-smoothing-100.png`, `paint-cursor-diameter-15.png`, `grabcut-cursor-diameter-15.png`.

Necessity — no unnecessary product elements; correction should be proof-only.

Sufficiency — partial: the owner behavior is implemented, but the required existing preservation gate is red until its stale expected output is reconciled and the oracle passes.
