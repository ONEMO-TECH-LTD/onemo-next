# T2 — Seal the admin shell: plan (v1, for QA then Dan's lock · engine v3.5.7-2 → v3.5.8)

Roadmap v3 task 2. Baseline: staging `0315aabe` (T1 merged). Directive test: "delete `src/app/` — the
engine is whole; the page computes nothing." /o-build outcome · non-goals · files · proof below.

## 0 · Measured (full read of page, bridge, and every gate that binds them)

- **The one live compute in the page:** `page.tsx:151-153` — `safeSegments(libraryModel.contour,
  spotRadiusOf(RELEASED_PADDING_MM), 'full')`, drawn as the library record's legal area on the Library tab.
  Since `08fd49e7` (08-30). Everything else in the page is view math (camera, viewport, labels).
- **Why it landed in the page:** the library law pins `grid-magnet-library-bridge.ts` as a *type-only*
  adapter — `architecture-gates.test.ts::bridgeViolations` fails any non-type import from `./grid-magnet`
  or `./types`; `STEP 5` pins the page to call `libraryStageModel` exactly once. The bridge could not
  compute, so the page did. **The roadmap's wording "libraryStageModel returns the segments" is
  therefore not lawful as written** — corrected here, not worked around.
- **Other door value imports on the page:** `DEFAULT_PITCH_MM`, `bandOuterMM` (band → outline span for
  the manual-size control floor/range, 3 sites). `bandOuterMM` is a Spec-derived range, not a
  measurement of a shape; it stays and is recorded as an observation (a later Spec/adapter home is
  T-later, not T2 — no invented scope).
- Shell pins today: page unit edges `[]` (T1) · worker `[]` · zone 2 "page reaches module only through
  door / spec / bridge / library-bridge" — which is what let a door **barrel** export carry compute in.

## 1 · Minimal diff

| # | change | class |
|---|---|---|
| 1 | `src/lib/effect/adapters/libraryViewModel.ts` — `librarySegments(stage: { contour }): SafeSegment[]` = the two lines from the page, **moved**: `safeSegments(stage.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')`. Imports `safeSegments`, `spotRadiusOf` from the door and `RELEASED_PADDING_MM` from Spec. | MOVE (page → adapter) |
| 2 | `page.tsx` — `librarySegments` memo calls the adapter; `safeSegments`, `spotRadiusOf` imports deleted (orphans of the move). | MOVE |
| 3 | `grid-magnet-separation.test.ts` zone 2 — the page's door imports are pinned to an **exact allow-list**: values `DEFAULT_PITCH_MM`, `bandOuterMM`; types only otherwise. Any computational door export (`safeSegments`, `spotRadiusOf`, `computeGrid`, `classifyBands`, …) fails. Zone 2e — the new adapter is governed: its runtime edges are exactly `@/lib/effect/grid-magnet` (door) and `@/lib/effect/grid-magnet-spec`; it may not import units, pipeline, or the app. `gridViewModel.ts` stays type-only (unchanged rule). | GATE |

Nothing else. Bridge untouched (library law). Engine untouched. No new control, no behaviour change.

## 2 · Why the adapter and not the pipeline or the bridge — stated so QA can rule

- **Bridge:** forbidden by the library law (type-only). Not negotiable inside T2.
- **Pipeline:** L3 says the pipeline sequences units — segmenting a library record for display is a
  sequence of one call, and the page is forbidden (zone 2e, T1) from importing the pipeline directly;
  routing it through an adapter that re-exports pipeline code would make the adapter a runtime
  passthrough and add a module for one line. Two files for two lines fails necessity.
- **Adapter:** L5 — the shell reaches the engine only through adapters. A view adapter that asks the
  engine door for one measurement and hands the shell drawable segments is the adapter's stated job
  ("UI bridge"). It is **measurement requested by an adapter, executed by the engine**, not policy and
  not a rule. Pinned exactly so it cannot grow.

## 3 · Proof (Done means)

1. Page source: no `safeSegments`, `spotRadiusOf`, `computeGrid`, `classifyBands`, `measureProtection`,
   `solveGrid` anywhere; door imports equal the pinned allow-list; unit/foundation/pipeline edges `[]`.
2. `librarySegments(stage)` equals `safeSegments(stage.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')`
   for a canon record (structural equality) — the move changed nothing.
3. Mutation: re-adding `import { safeSegments } from '@/lib/effect/grid-magnet'` to the page fails zone 2;
   a unit import in the adapter fails zone 2e.
4. Existing library gates unchanged and green (`architecture-gates`, `grid-layout-library`).
5. Live (4065, exact head): Library tab, square 3×3 — legal box drawn as today; Bench unchanged on the
   four cutouts; console 0. Screenshot cited.
6. Full suite green (serial), tsc clean, strict changed-file lint clean.

## 4 · Non-goals (recorded, not dropped)
`bandOuterMM` on the page (Spec-derived range for a control) · `recog` readout · policy re-rooming out
of the pipeline · anything in `library/**`.

## 5 · Necessity / sufficiency
No unnecessary elements: one moved function, one adapter file (the law leaves no other home), one gate
tightening. Delivers T2 in full: the page computes nothing, and the gate now forbids the barrel path
that let it.
