# KAI-10284 Builder ledger

- Owner correction: brush size controls physical footprint only; Paint smoothing scales from completed shape area and bounds.
- Parent: KAI-10215. Blocks KAI-10221. QA owner: `s62-pixel-qa`.
- Rollback checkpoint: `5c32124b` on `session62-task/KAI-10221-portable-package`.
- Product snapshot: `34363d84`.
- Deterministic oracle snapshot: `3c59c4d6`.
- Current pushed snapshot: `1cc2afd2b31373bf9322491bff27fdd1c6a01043` on `session62-task/KAI-10284-paint-smoothing`.
- Delivery: one visible brush diameter; GrabCut seed radius is diameter/2 with existing halo/corridor multipliers; Paint smoothing radius is derived from occupied mask area and shorter bound; zero remains exact; live recalculation preserved.
- Gates: 539 pass / 10 declared skip; focused 3/3; typecheck; scoped lint; diff check; production build; Chromium/WebKit exact route oracle; visual witness `output/playwright/KAI-10284-shape-relative-paint-smoothing.png`.
- State: Ready for QA. QA dispatch delivered to `s62-pixel-qa`. KAI-10221 remains blocked.
