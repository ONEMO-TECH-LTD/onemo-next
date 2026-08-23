# KAI-10285 QA — REVISE

Snapshot: `95162cc8a0a2bc8166b9642c0d368f115354ea5e` (local/upstream exact).

## Blocking finding

The visible repair passes, but the accepted/exported mask can still contain a detached fragment that the published vector shape removes.

- `flow.ts:76-80` correctly reduces the solid proxy to `primaryCarved` and accepts small detached residuals only by dropping them from that proxy.
- `flow.ts:83` then ignores `primaryCarved` and returns `subtractMasks(source.base, negative)`, which retains the detached residual in the accepted mask.
- `acceptMask` prepares and stores that unfiltered mask at `flow.ts:366-385`; `exportResult` hashes it at `flow.ts:1029-1045`.
- The focused test already demonstrates the mismatch: `paint-smoothing.test.ts:70-74` proves the primary result drops the narrow detached strip, but there is no wiring assertion that the accepted mask uses that result.

This violates the one-solid-blob/no-detached-fragment rule and leaves the portable result's mask different from its one-blob vector/output truth.

## Smallest correction

After the solid-proxy legality check, preserve original accepted mask/soft pixels only where the retained primary topology is present. Reject a destructive split as now; accept a local shave with one mask component. Do not add an engine, provider, UI, route, or GrabCut change. Extend the existing proof with the small-residual case through the accepted-mask path and assert one connected accepted/exported mask.

## Independent positive evidence

- Exact default-CLASSIC near-loop: zero changed canvas pixels, zero loop-interior changes, no history, CLASSIC retained.
- Valid shallow boundary carve: visibly local; Chromium/WebKit route oracle passes with at most 128 display pixels outside the narrow region.
- Undo restores the pre-erase backing canvas exactly. Redo's backing canvas differs by 396 antialias pixels, but the original-resolution saved PNG is byte-exact before/after Redo (`f07385ee…`), so no output blocker remains there.
- Raw GrabCut hashes unchanged in Chromium/WebKit.
- 59 test files pass, 551 tests pass, 10 declared skips; typecheck, scoped lint, diff check, production build, five Cutout oracles, and byte-exact closure regeneration pass.
- Visual gate: production build served from this worktree on port 4018 at the reviewed snapshot; real `/cutout-lab?admin=1` Upload → GrabCut → CLASSIC → rejected near-loop → valid boundary carve → Undo/Redo was observed. Evidence: `../evidence/KAI-10285-loop-rejected-95162cc8.png`, `../evidence/KAI-10285-boundary-erase-95162cc8.png`, and the matching JSON records.

Necessity — shrink only the accepted-mask topology mismatch and its missing proof; no new owner or product surface.

Sufficiency — partial: the visible/main-vector behavior is repaired, but the accepted/exported mask does not yet guarantee the required single blob.
