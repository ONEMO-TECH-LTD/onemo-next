# T2 — Seal the admin shell: plan (v2, for QA then Dan's lock · engine v3.5.7-2 → v3.5.8)

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
- **Other live page compute:** `bandOuterMM` at page lines 364, 452 and 551. It is `units/layout.ts:90-92`
  arithmetic, not a Spec value. `DEFAULT_PITCH_MM` and `GridResult`/`MagnetPlan`/`SafeSegment` are shared
  values/types and can come directly from Spec/types; only the range calculation needs an adapter.
- Shell pins today: page unit edges `[]` (T1) · worker `[]` · zone 2 "page reaches module only through
  door / spec / bridge / library-bridge" — which is what let a door **barrel** export carry compute in.

## 1 · Minimal diff

| # | change | class |
|---|---|---|
| 1 | `src/lib/effect/adapters/libraryViewModel.ts` — `librarySegments(stage: { contour }): SafeSegment[]` is the two moved page lines: `safeSegments(stage.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')`. Runtime imports are the door and Spec; `SafeSegment` is type-only. | MOVE |
| 2 | `src/lib/effect/adapters/gridViewModel.ts` — add `bandRangeForControl(band, paddingMM)`, a one-line delegate to `bandOuterMM`. `toPageModel` remains unchanged and projection-only. | MOVE |
| 3 | `page.tsx` — call `librarySegments(libraryModel)` and `bandRangeForControl(...)`; delete `safeSegments`, `spotRadiusOf`, `bandOuterMM`, and every `grid-magnet` barrel import. Import `DEFAULT_PITCH_MM` from Spec and `GridResult`, `MagnetPlan`, `SafeSegment` from shared types. | MOVE |
| 4 | `grid-magnet-separation.test.ts` — pin page runtime engine-barrel imports to `[]`; page type imports may only be shared types/adapters/Spec. Pin `libraryViewModel` runtime edges to door + Spec; pin `gridViewModel`'s sole runtime edge to the door's `bandOuterMM`, while `toPageModel` remains type-only/projection-only. | GATE |

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

1. Page source has no import from `@/lib/effect/grid-magnet` and no calls to `safeSegments`, `spotRadiusOf`,
   `bandOuterMM`, `computeGrid`, `classifyBands`, `measureProtection` or `solveGrid`. Page runtime engine
   input is adapters plus Spec only; shared types are type-only.
2. For one canon record, `librarySegments(stage)` structurally equals the former
   `safeSegments(stage.contour, spotRadiusOf(RELEASED_PADDING_MM), 'full')`. For every band and permitted
   padding, `bandRangeForControl(band, padding)` equals the former `bandOuterMM(band, padding)`.
3. Mutation: re-adding `import { safeSegments } from '@/lib/effect/grid-magnet'` to the page fails zone 2;
   a unit import in the adapter fails zone 2e.
4. Existing library gates unchanged and green (`architecture-gates`, `grid-layout-library`).
5. Live (4065, exact head): Library tab, square 3×3 — legal box drawn as today; Bench unchanged on the
   four cutouts; console 0. Screenshot cited.
6. Full suite green (serial), tsc clean, strict changed-file lint clean.

## 4 · Non-goals (recorded, not dropped)
`recog` readout · policy re-rooming out
of the pipeline · anything in `library/**`.

## 5 · Necessity / sufficiency
No unnecessary elements: one moved function, one adapter file (the law leaves no other home), one gate
tightening. Delivers T2 in full: the page computes nothing, and the gate now forbids the barrel path
that let it.
