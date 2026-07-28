# KAI-9777 builder ledger

## Authority and scope

- Brain OS task `KAI-9777`, read in full on 2026-07-27.
- One surgical deletion/rename: remove the User engine path, rename the Admin path neutral, preserve the approved generic engine, seed optimisation, scheduler, controls, and four real guards.
- Kai rulings applied:
  - `resolveGridPlan` keeps its frozen default behaviour.
  - `signedBaseMargin` and `diagnosticVelcro` become explicit false-default `GridPlanOptions`; `resolveAdminGridPlan` is deleted.
  - Ladder `options` are seed input only. They cannot affect `semanticLadder`, so they are excluded from the ladder key.
  - Frozen T1 scripts remain immutable historical before-evidence at `0234f47`; post-removal proof uses new literal-parity and surviving-lattice runners.

## Full reads

Before editing:

- `ERRORS.md`, `eslint.config.mjs`, the frozen manifest and gate config.
- `grid-core.ts`, scheduler, cache, byte oracle, all six former door/client/worker files.
- Grid Lab page, both panels, renderer, worker hook, boundary test.
- Every path in `door-consumers.manifest.json`, including tooling and device-performance consumers.

After editing:

- Full current `grid-core.ts`, Grid Lab page, architecture, neutral entry/client/worker, seed validator/tests, browser oracle, every changed test/tooling consumer, and both new proof runners.
- Full diff self-audit confirmed the core changes are the named User/rescue/identity deletions plus the two explicit false-default capability flags. `deepestPoint` remains.

## Delivered

- Deleted `grid-user.ts`, `grid-user-client.ts`, `grid-user.worker.ts`, the User panel, and the two-door ESLint ringfence.
- Renamed the Admin entry/client/worker in place to `grid.ts`, `grid-client.ts`, and `grid.worker.ts`; symbols are neutral.
- Moved warm-plan cache seeding into the neutral lane:
  - all three attachments accepted;
  - no magnetic hardcode in generator or validator;
  - no `rescueAnchors` validator dependency;
  - plan seeds validated and committed atomically under their own exact plan keys;
  - scheduler wrong-key failure remains hard.
- Removed User-only policy/rescue/dedup code, caller-scoped keys, caller policy blocks, and the User `first` tie override. Canonical `higher` remains.
- Collapsed Grid Lab to one worker lane and one complete panel. No control was pruned. KAI-9690 render-before-ladder behavior remains guarded.
- Migrated active consumers, device fixture, profiler, audit, Creator primitive, tests, and documentation to the neutral entry.
- Added post-removal proof runners:
  - `scripts/grid-remediation/t2-literal-parity.ts`
  - `scripts/grid-remediation/t2-lattice.ts`

## Executed evidence

- Literal pre-split parity: **PASS**, 960/960 identical to `399adf435003f19ee48cde6fd30c17c52727cc74`, **no normalization**, corpus SHA-256 `c60f4d789eaf4acd7ff3d3fc3b00ecbf0c3355ad3da9236756539882931953fb`.
- Surviving-engine lattice oracle: **PASS**, 672 cases, 412 multi-anchor passes, **0 violations**, 36 single-anchor exclusions, 224 Velcro/no-grid exclusions, corpus SHA-256 `3047c1cd152ab24f43022b0c0059a46b187f23d7129d0d9b47a8d5058d540e45`.
- Standing grid audit: **PASS**, all laws.
- Targeted suites: **202/202 PASS**.
- Full suite: **408 PASS / 10 skipped** across 45 passed files / 1 skipped file. The removed count is retired User-drift evidence; neutral replacements are green.
- Typecheck: **PASS**.
- Lint: **PASS**, 0 errors; 213 pre-existing warnings outside this slice.
- Production build: **PASS**.
- Deleted-symbol sweep over active `src/**`: **zero** for all former door, caller-key, rescue, User-panel, and `panelEntry` symbols.
- Browser Worker oracle: profiled Chrome unavailable, so binding fallback Playwright Chromium used; **PASS 6/6** for ladder, holed plan, diamond ladder, signed-margin Velcro diagnostics, seeded cache hits for all attachments, and physical pre-emption.
- Browser falsification: changed the actual neutral ladder result to drop one rung, verified the source mutation landed, observed **FAIL** on Worker/direct byte parity, restored the line, then **PASS 6/6**.
- `git diff --check`: **PASS**.

## Honest limits and retired evidence

- Seed soundness is exact: a seed can only satisfy its own plan key. Seed coverage remains first-request-per-ladder-key, as before; later option changes can miss the warm seed but cannot receive wrong data.
- The three frozen T1 commands are not post-removal gates. Their failures are structurally forced because they assert the removed `rescueAnchors`, User resolver, and deleted paths. They remain untouched as the pinned before-record; expected-red is retired because its defects were deleted.
- The unrelated browsertime/package changes, `ERRORS.md`, and `output/` were not modified or staged by this slice.
