# KAI-9778 builder ledger

## Authority

- Brain OS task `KAI-9778`, read in full on 2026-07-28.
- Evidence-only task. Frozen T1 scripts remain untouched.
- Starting commit: `a0312d6e4e2d4de8e156529724fd6c591ea6d20b`.

## Full-read notes

- `grid-worker-client.ts` (445 lines): cache hits return before any
  `postMessage`; an active cached hit pre-empts stale work and explicitly
  resumes queued background work. Seed values are key-checked before atomic
  insertion. The wrong-result key path terminates the worker. Scheduler code
  is evidence scope only and stays untouched.
- `page.tsx` (470 lines): the visible ladder job carries the complete current
  `planOptions`, while `gridJobKey` deliberately excludes those options for a
  ladder. Plan jobs use the same complete options. Non-rectangle
  `preparedDesign` can publish with `rung: null`; rectangles still return null
  until `rectRungs` exists. `__GRID_LAB_PROOF__` exposes runtime, intended, and
  renderer-committed keys.
- `GridWorkbenchPanel.tsx` (307), `GridWorkbenchRenderer.tsx` (204), and
  `useGridWorkerJob.ts` (57): size buttons call `setSizeMM`; every slider marks
  transient interaction and the hook coalesces transient requests for 80ms,
  flushing the exact settled job. The renderer publishes its committed plan
  key from `useLayoutEffect`.
- `grid.ts` (98) and `grid-client.ts` (145), read before compaction and
  rehydrated from the tracked prior ledger: ladder keys are
  recipe+law+mode-only; the worker emits exact plan seeds under their own full
  plan keys; the client validates all attachments, exact keys/bytes/budgets,
  then inserts atomically.
- Browser and seed proof code read in full:
  `grid-worker-browser-oracle.ts` (178) and `grid-cache-seed.test.ts` (248).
  The oracle proves actual-worker bytes and seeded cache availability, but not
  that the Grid Lab page calls the seeded path at runtime.
- Device tooling read in full:
  `scripts/device-performance/run.mjs`, `fixture.tsx`, `README.md`,
  `core/browser-provider.mjs`, `core/report.mjs`, `baselines.json`, and
  `suite.config.json`. It measures fixture-level worker cold/warm timing; it
  does not drive the Grid Lab interactions required by Gate A.
- Confirmation sources read in full:
  `t2-literal-parity.ts`, `t2-lattice.ts`, their 281-line shared
  `t1-contract.ts`, `grid-boundary.test.ts`, and the worker-oracle HTML.
  Frozen T1 scripts remain immutable.

## Gate inventory — builder executes every item

1. Literal parity: 960/960, zero differences, SHA `c60f4d78…`.
2. Surviving lattice: 672 cases, 412 pass, zero violations, 36
   single-anchor and 224 no-grid exclusions, SHA `3047c1cd…`.
3. Browser Worker oracle: PASS 6/6.
4. Suite 408/10, typecheck, lint, build, grid audit.
5. Deleted-symbol sweep: zero across all 13 names.
6. Runtime seeded size click: zero worker dispatch for magnetic, twin-fix, and
   Velcro; slider does not repeat the ladder solve.
7. Browsertime cold/warm interaction numbers against the weekly baseline.
8. Clean `:3980` bench visual: one panel, controls live, non-rectangle paint
   before ladder, rectangle still gated; Chrome first, Playwright fallback.

## Confirmation gates

All confirmations were run against `a0312d6e4e2d4de8e156529724fd6c591ea6d20b`.
No frozen T1 script was edited.

- Literal full-JSON parity against pre-split `399adf`, with no
  normalisation: **PASS 960/960**, zero differences, corpus SHA
  `c60f4d789eaf4acd7ff3d3fc3b00ecbf0c3355ad3da9236756539882931953fb`.
- Surviving-engine lattice: **PASS 672 cases**; 412 multi-anchor plans,
  zero violations, 36 single-anchor exclusions, 224 no-grid exclusions;
  corpus SHA
  `3047c1cd152ab24f43022b0c0059a46b187f23d7129d0d9b47a8d5058d540e45`.
- Real Worker browser oracle on Vite `:3981`, driven by Playwright Chromium:
  **PASS 6/6** — standard ladder, holed plan, diamond ladder,
  signed-margin Velcro, seeded hits for all three attachments, and physical
  pre-emption.
- Full Vitest: **408 passed / 10 skipped** across 45 passed and one skipped
  file. Typecheck exit 0. Lint exit 0 with zero errors and 213 pre-existing
  warnings. Production build exit 0. Grid audit: **ALL LAWS PASS**.
- Deleted-symbol sweep across `src/**`: zero occurrences for all 13 names:
  `grid-user`, `grid-admin`, `resolveUserGridPlan`,
  `resolveAdminGridPlan`, `ResolverPolicy`, `rescueCoverage`,
  `rescueAnchors`, `flapRegions`, `deepestSafePointForRegion`,
  `panelEntry`, `nearestUserSemanticRung`, `nearestUserWorkbenchRung`,
  and `GridWorkbenchUserPanel`.

## Gate A — runtime cache and performance

The production build is served from this worktree on
`http://localhost:3980/effect-creator/grid-lab`.

### Direct runtime observation

In a fresh Playwright Chromium session, `Worker` was wrapped before application
code loaded so every real `postMessage` could be counted. Each attachment was
made active when a **fresh ladder identity was first requested**: magnetic on
Square, twin-fix on Circle, and Velcro on Triangle. After that ladder settled,
a size was clicked:

| attachment | interaction | matching-render commit | worker dispatch delta |
| --- | --- | ---: | ---: |
| magnetic | Square → ONE | 44 ms | **0** |
| twin-fix | Circle → S | 21 ms | **0** |
| Velcro | Triangle → L | 19 ms | **0** |

All three are observed cache hits under that first-request protocol, not
inferred hits. This does **not** mean an attachment switch on an already-seeded
ladder identity is warm: that switch is cold until a fresh ladder identity is
requested under the new attachment.

A real pointer drag across the design-size slider caused one settled **plan**
dispatch and **zero ladder dispatches**. The transient window therefore
coalesces the drag and does not repeat the 5–8 second ladder solve. A keyboard
ArrowRight loop was not used as the gate because separate key presses
legitimately close separate transient windows.

### Browsertime

Browsertime `28.2.0`, Chrome Headless `150`, `--cpu`, three iterations, clean
production `:3980`. The custom metric is page-timestamped
`matching-render-commit proxy`: a `MutationObserver` opens at the click and
closes on the changed renderer-owned committed plan key. It excludes driver
round-trip latency.

| scenario | samples | median | mean | SD | RSD |
| --- | --- | ---: | ---: | ---: | ---: |
| cold Circle | 55.26 / 58.47 / 57.13 ms | **57.13 ms** | 56.95 ms | 1.32 ms | 2.31% |
| warm seeded ONE | 14.79 / 15.40 / 15.34 ms | **15.34 ms** | 15.18 ms | 0.28 ms | 1.82% |

The warm result remains in the same order as this week's approximate 10 ms
baseline; the cold result remains below the provisional 150 ms reference
surface bar. This is not presented as a universal device threshold.

Supporting page-load results: load / DOMContentLoaded median 250 ms,
FCP/LCP 265 ms, CLS 0.0517, TBT 0. CPU benchmark samples were 48/49/48 ms
for the cold measurement and 45/46/47 ms for the warm measurement.

Evidence:

- tracked harness:
  `scripts/grid-remediation/browsertime-grid-cache.mjs`;
- tracked compact result:
  `docs/s59-grid-remediation/s59-KAI-9778-browsertime-summary.json`;
- regenerable raw run artifacts:
  `output/browsertime/kai-9778-final/browsertime.json` and
  `output/browsertime/kai-9778-final/browsertime.har`.

The raw Browsertime JSON/HAR remain local run output rather than source
artifacts. The committed harness and compact result retain the method,
command, samples, statistics, environment, and regeneration paths needed to
reproduce them. A one-iteration smoke run from the tracked path completed with
exit 0 and emitted both custom metrics (`55.29 ms` cold and `16.92 ms` warm);
those smoke values do not replace the three-iteration result above.

### Honest residual

Seeds are produced for the option set that first requests a ladder identity.
A later request with different options can hit the cached ladder without
receiving fresh seeds. A mid-session attachment switch on that identity is
therefore cold until the ladder identity changes. That causes a missed warm-up
only; the seed is committed under its own complete plan key, so it cannot
return a wrong plan. This matches the pre-existing coverage property and was
not changed in T3.

## Gate B — visual

The Chrome extension connection was attempted twice, with the prescribed retry,
and returned `Browser is not available: extension` both times. Per the task's
fallback rule, the visual gate was executed in Playwright Chromium and the
fallback is explicit here.

The clean production bench on `:3980` was observed and captured:

- one page and one `GridWorkbenchPanel`; no Admin/User toggle;
- zero disabled controls;
- attachment, pattern/auto, pitch/auto, density, padding, plan, centre,
  signed base margin, max grow, front overlay, size, shape source, and
  rectangle orientation controls all present;
- non-rectangle Circle: status `resolving-sizes`, rendered stage SVG present,
  and size metadata still resolving — KAI-9690's stage-first behaviour;
- rectangle after a fresh ladder key: status `resolving-sizes`, no stage SVG,
  and the stage reads `Resolving sizes…` — the rectangle exception remains
  ladder-gated;
- final rectangle reached ready state with a 120×72 mm recipe and six anchors.

Screenshots:

- `output/playwright/kai-9778/nonrect-before-ladder.png`
- `output/playwright/kai-9778/rect-ladder-gated.png`
- `output/playwright/kai-9778/clean-bench-final.png`

## Outcome

Every named KAI-9778 gate was executed by the builder. The post-remediation
product remains byte-identical to the pre-split engine on the pinned corpus,
the lattice law remains green, the real Worker fast path remains green, all
three attachments produced zero-dispatch warm hits when each was the active
option set for a freshly requested ladder identity, the slider does not repeat
ladder work, and the clean one-panel bench is live on `:3980`. Switching the
attachment on an already-seeded identity remains cold until a fresh identity
is requested. No product code changed in this task; the ledger, reproducible
Browsertime harness, and compact result are the only tracked artifacts.
