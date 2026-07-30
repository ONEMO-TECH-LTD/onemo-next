# KAI-9831 Builder Ledger

Status: Building
Base: `319a09f4681f78a5a77c5b44757b7d07069ec99c`

## Directive

Grid-size snapping is upward: the selected construction must never be smaller
than the requested surface. Numeric-nearest is not a legal product snap.

## Minimal change

- Keep `nearestSemanticRung` for non-snapping metadata.
- Reuse the existing `nextSemanticRung` at both rectangle axis selections.
- No page change: the admin test-size seam already uses `nextSemanticRung`.

## RED → green

- RED: rectangle `longMM=180` resolved to `166`; expected `214`.
- Green: `longMM=180 → 214`, `shortMM=80 → 118`.
- Orientation and the existing equal-axis rectangle case remain unchanged.

## Executed gates

- Targeted RED: 1 failed, received `166`, expected `214`.
- Targeted green: 1 passed.
- Short-axis mutation: restoring numeric-nearest at only the short-axis seam
  failed with `70`, expected `118`; restored upward selection.
- Full `grid.test.ts`: 34 passed.
- Full suite: 458 passed / 10 skipped.
- Typecheck: exit 0.
- Lint: exit 0, 0 errors / 214 pre-existing warnings.
- Production build: exit 0.
- Live `:3970` after the post-build dev restart: rectangle `118×70`,
  Standard/Light, 6 seated, no console errors. The arbitrary `180mm` engine
  input is not exposed by the current tier-only rectangle panel, so its
  `180→214` result is verified at the engine boundary rather than invented as a
  browser action.
- Screenshot: `output/playwright/kai-9831/rectangle-upward-snap.png`.
