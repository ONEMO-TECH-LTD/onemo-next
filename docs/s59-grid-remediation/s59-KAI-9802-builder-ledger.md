# KAI-9802 builder ledger

## Authority

- Brain OS task body read in full on 2026-07-28.
- Dan's binding method: clone `GridWorkbenchPanel.tsx`; delete non-admin controls from
  the clone and admin controls from the original.
- No abstraction, redesign, restyle, second engine path, or later-task behaviour.
- This slice starts from landed staging commit
  `272d4de59592a3011a5b0f573cfc79285a8bd2a1`.

## Full reads before writing

- `page.tsx` — all control state already lives in the page. One neutral worker lane
  remains sufficient for both panels.
- `GridWorkbenchPanel.tsx` — its first card is product-facing; its second card mixed
  product and admin controls.
- `GridWorkbenchRenderer.tsx` — stage/readouts only; untouched.
- `grid-boundary.test.ts` — the neutral-lane, UI-law, KAI-9690 render-gate,
  cancellation, and coalescing guards had to remain.
- `ERRORS.md` — use `localhost`, never disturb Dan's persistent server, and prove
  before/after swaps rather than relying on a post-commit stash.

All affected files and this ledger were read back in full after the implementation.

## Control ownership

### Right / product

- Shape source and shape-specific controls.
- Geometry, preset, generator, and AI input.
- Attachment.
- Size tiers and rectangle long/short/orientation.
- Existing design-size slider. KAI-9792 owns its later narrowing; this slice does
  not absorb that task.
- Total-effect readout.

### Left / admin-diagnostic

- Untested `†` tier buttons.
- Density.
- Grid pitch.
- Magnet padding.
- Base margin.
- Max auto-margin.
- Grid pattern override.
- Grid centring.
- Magnet plan.
- Front-face overlay.

Max auto-margin is a solver search limit, not a customer preference. Magnet plan is
a BOM/placement strategy. Both therefore belong to the admin panel.

## Hidden-rung decision

META rejected the interim visibility toggle because it introduced page state and
could render admin-only buttons inside the product panel. The final split is
state-independent and follows the clone/delete method literally:

- the product panel clones retain only `r.visible` buttons;
- the admin panel clones retain only `!r.visible` buttons;
- standard, rectangle-long, and rectangle-short groups are covered separately;
- each rung button renders exactly once across the two panels;
- clicking either panel still drives the same existing size state;
- there is no visibility boolean, prop, setter, store, or second engine path.

## Minimal implementation

1. Added `GridWorkbenchAdminPanel.tsx` as a clone-subset of the existing panel.
2. Reduced `GridWorkbenchPanel.tsx` to the product subset.
3. Split the existing page props by deletion and rendered admin / stage / product
   in the existing grid.
4. Extended `grid-boundary.test.ts` for two panels, exact-once ownership, one neutral
   engine lane, and the retained guards.
5. Touched no engine, renderer, worker, client, or product-law module.

## Verification

- RED first: the boundary suite failed four assertions while the admin clone was
  absent.
- Targeted boundary suite: 9/9 passed.
- Mutation: renamed the admin `Show untested rungs` label to collide with
  `Attachment`; the exact-once ownership test failed and named the missing admin
  control. Restored: 9/9 passed.
- QA rework F1 added a render-level regression across standard, rectangle-long, and
  rectangle-short groups.
- META rework replaced the rejected toggle design. The regression now proves visible
  rungs render only in the product panel and untested rungs only in the admin panel.
- Product short-side mutation: removed its `r.visible` filter. The structural guard
  fell from three filters to two and the render test exposed `HIDDEN_SHORT` on the
  product panel.
- Admin short-side mutation: removed its `!r.visible` filter. The structural guard
  fell from three filters to two and the render test exposed `VISIBLE_SHORT` on the
  admin panel.
- Both mutations were restored; targeted boundary suite passed 10/10.
- TypeScript: exit 0.
- Full Vitest suite: 419 passed, 10 skipped after the F1 regression was added.
- ESLint: exit 0, 0 errors; 214 pre-existing warnings.
- Production build: exit 0.
- `git diff --check`: clean.

## Live gate

- Required surface: `http://localhost:3970/effect-creator/grid-lab`.
- Profiled Chrome was attempted first but no browser backend was available. Per the
  escalation rule, the gate ran in Playwright Chromium.
- The live dev server was verified by process cwd to be this worktree. Dan's `:3980`
  verification screen remains isolated on the landed `edge-registration` worktree.
- Playwright exercised 52 interactions across both panels:
  - every admin mode and slider;
  - admin-only untested square and rectangle rung selection;
  - zero untested rung buttons in the product panel;
  - zero visible rung buttons duplicated in the admin panel;
  - every product source, generator, geometry, attachment, visible tier, rectangle
    orientation/tier group, and design-size slider;
  - AI upload control presence;
  - front overlay on/off.
- Every engine-affecting interaction returned to
  `data-grid-runtime-status="ready"`.
- `data-grid-slider-transient` returned to `false` after every slider interaction.
- Browser page errors: 0. Console errors: 0.
- Screenshot:
  `output/playwright/kai-9802/kai-9802-two-panels.png`.

## Operational note

The two work screens must never share one worktree. `:3970` is the live task tree;
`:3980` is the frozen landed tree. Under Next 16 this repo's dev server also requires
the explicit existing bundler choice:

`npx next dev -p <port> --webpack`

This is operational evidence only; no config change belongs to KAI-9802.

## Outcome

KAI-9802 changes only control placement. Engine and ladder output are unchanged, so
there is no count/ladder re-baseline for this slice.
