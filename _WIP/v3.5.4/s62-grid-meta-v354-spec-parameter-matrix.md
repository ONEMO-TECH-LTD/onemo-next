# v3.5.4 spec ownership and admin-parameter matrix

Author: s62-grid-meta · 2026-08-23 · proposal correction, not product code.

## Governing rule

`src/lib/magnetic-grid/spec.ts` is the single owner of every solver specification: parameter names, types, defaults, bounds, allowed options, bands, search steps and stable identities/labels consumed by the solver. The active configured object is complete before it leaves the UI.

- `LawPanel.tsx` renders controls from spec definitions and forwards the selected values. It contains no solver number, bound, default, option set, band or policy decision.
- `law.worker.ts` and `magnetic-grid-bridge.ts` transport the complete typed configuration. They add no default, clamp, threshold or alternate interpretation.
- Compute receives complete typed inputs and returns neutral measurements. It owns geometry/math, never defaults, bounds or law.
- Logic receives measurements plus the complete typed law configuration. It owns Centre/Fit/Scale judgement and ordering, never geometry or fallback values.
- Engine only sequences Spec -> Compute -> Logic and assembles results. It does not supply missing values or clamp them.
- A value used only for rendering/performance and incapable of changing a solver result is not a solver parameter. UI viewport size, colours and cache capacities stay local.

## Required spec surface

The smallest complete public surface is:

- `SolverConfig`: every result-affecting calibration value, non-optional;
- `SolveInput`: per-request contour, requested size and optional manual registration;
- `SOLVER_DEFAULTS`: the one complete default configuration;
- `SOLVER_CONTROLS`: labels, bounds, steps and options used by the v3.5.4 admin panel;
- `validateSolverConfig(value)`: the one strict ingress validator.

All five live in `spec.ts`. UI starts from `SOLVER_DEFAULTS`; worker and direct callers must pass strict validation before Engine runs. Validation refuses missing, out-of-range, overlapping-band or unknown-option values. No downstream defaulting or clamping is permitted. Per-request values are inputs, not duplicated configuration fields.

| Parameter | Current source/control | v3.5.4 control | Typed field and single owner | Live consumer | Default / bounds or options |
|---|---|---|---|---|---|
| Bands | `spec.ts:BANDS`; B1-B4 buttons only select, cannot calibrate bounds | Four min/max rows plus B1-B4 selector | `bands: readonly Band[]` in Spec | Scale enumeration + band result ownership in Logic | Current B1-B4 values become defaults; bounds and non-overlap validation in Spec |
| Size scan step | hardcoded `SIZE_STEP_MM=2`; LawPanel slider step; Engine loop increment | **Size scan step**; reuse the existing legacy `Snap step` control pattern | `sizeStepMM` | Engine enumerates configured band sizes; Logic owns first-lawful ownership over that configured set | current 2 mm default; bounds from Spec |
| Registration step | current legacy `PHASE_STEP_MM=1` and `Placement step`; absent from v3.5.1 panel | **Placement step / grid slide** reused in v3.5.4 | `registrationStepMM` | Compute neutral registration enumeration | current 1 mm default; bounds from Spec |
| Grid pitch | existing 24/48/96 buttons | KEEP | `pitchMM`, options from Spec | Compute lattice and population adjacency | current options/default from Spec |
| Field span | hidden `FIELD_POSITIONS_PER_AXIS=9` | **Field positions per axis** | `fieldPositionsPerAxis` | Compute enumeration/display field | current 9 default; bounds from Spec |
| Padding / group half-extent | existing padding slider; proposal also wrote literal 12 mm | KEEP; one value | `paddingMM` | Compute seat legality and pair-region growth | current default/range from Spec; pair boxes derive from this value, never literal 12 |
| Shape size | Free size, manual band scale and min/max controls | KEEP | `requestedSizeMM`, `freeSizeMinMM`, `freeSizeMaxMM` | Bridge sizes contour; Engine fixed inspection | current values/bounds from Spec |
| Outline offset | existing slider with UI-local -15/15 | KEEP, but bounds move to Spec | `outlineOffsetMM` | Bridge prepares the supplied contour once | current 0 default, -15..15 defaults/bounds in Spec |
| Flap / outer-overhang limit | existing flap slider+enable; current semantics are per-disc | KEEP control, relabel to group outer-overhang limit | `flapLimitMM` and `flapEnabled` | Logic judges four measured group overhangs | current 0..48 UI range becomes Spec-owned; 12/24 are presets/options, not hardcoded law |
| Auto flap | existing toggle/cap | KEEP if retained; otherwise visibly INACTIVE with reason, never deleted from comparison tabs | `autoFlapEnabled`, `autoFlapCapMM` | Logic derives minimum group-overhang grant over measured layouts | default/bounds from Spec |
| Minimum touch | existing v3.5.1 slider; rejected method | INACTIVE in v3.5.4 with “not used: Fit judges the group region”; untouched in comparison surfaces | no v3.5.4 solver field | none | historical value stays only where another tab still consumes it |
| Centre mode | existing six buttons | KEEP | `centreMode` options from Spec | Logic selects governed Centre measurement | current six options/default from Spec |
| Mass governor | existing four buttons | KEEP | `governor` options from Spec | Logic selects the governing mass | current four options/default from Spec |
| Mass depth | existing slider | KEEP | `massDepthMM` | Compute neutral mass measurements | current default/range from Spec |
| Measurement ruler | currently hidden whole-mm conversions in Compute (`+0.5`, `floor`) | **Measurement step / ruler** | `measurementStepMM` | Compute reports quantized neutral measurements; Logic compares integers | current 1 mm default; no sub-mm default hidden elsewhere |
| Coverage | existing Full grid / Perimeter belt | KEEP | `coverage` enum/options in Spec | Logic chooses returned population after law measurement | current options/default from Spec |
| Magnet plan | existing All6/All8/Corners8 | KEEP | `magnetPlan` enum/options and diameters in Spec | Logic assigns returned magnet diameters | current options/default from Spec |
| Manual registration | canvas pan/double-click reset | KEEP | `forcedPhaseMM: Pt | null` | Compute measures exactly the requested registration | null default from Spec |
| Layout populations | current four-placement path omits ruled sub-layouts | **Layout populations** multi-select, always exposed | `enabledPopulationIds`, with stable finite template definitions/options in Spec | Compute enumerates only enabled ruled templates | complete ruled set selected by default |
| Recommendation order | currently embedded in Logic | **Recommendation order** control, always exposed | ordered `recommendationOrder` in Spec | Logic marks one recommendation without hiding alternatives | current gravity -> tightness -> corner order |

The population catalogue is finite and Spec-declared. It describes ruled lattice windows/sub-windows and population templates; it does not enumerate the arbitrary power set of seated nodes. Stable template IDs and registration ordinals are evidence and dedupe inputs.

## Current duplicates/hardcodes to remove or wire

| Current location | Duplicate/hardcode | Smallest correction |
|---|---|---|
| `LawPanel.tsx` | `IMG=1024`, `VP=640`, `FIT=.86`, colours | KEEP local: rendering/input-adapter only; cannot change solver verdict. |
| `LawPanel.tsx` | `offsetMM` bounds `-15..15` | MOVE bounds/default to Spec; render the slider from `SOLVER_CONTROLS.outlineOffsetMM`. |
| `LawPanel.tsx` | `evenMM` divides by imported `SIZE_STEP_MM` | DELETE local solver rule; use the configured `sizeStepMM` through a Spec-owned normalization helper or validated control value. |
| `LawPanel.tsx` | local option arrays for Coverage, MagnetPlan, Centre mode and Governor | MOVE option identities/defaults to Spec; UI maps Spec options to buttons. UI-only explanatory prose may stay UI. |
| `LawPanel.tsx` | v3.5.1 omits the existing Placement-step and Snap-step controls | REUSE the legacy controls in the v3.5.4 panel and wire them to `registrationStepMM` and `sizeStepMM`. Do not create parallel search constants. |
| `page.tsx` | legacy `phaseStep` and `snapStep` are correctly UI -> request wired | PRESERVE unchanged for Voting/Centre-rules; v3.5.4 reuses the control/spec definition, not their engine. |
| `law.worker.ts` | `FREE_CAP=400`, `SOLVE_CAP=6` | KEEP local: cache capacities do not alter solver answers. |
| `law.worker.ts` | fallback clamping of rung/layout indices | KEEP as transport/display safety; not a solver calibration. |
| `magnetic-grid-bridge.ts` | `FLATTEN_REF_MM=250`, `MAXV=600` | These change supplied geometry and therefore answers: MOVE to Spec and expose under an advanced **Contour preparation** control group, or remove the approximation. Do not leave hidden. |
| `spec.ts` | current `SIZE_STEP_MM`, `BANDS`, `FIELD_POSITIONS_PER_AXIS` are immutable constants | RETAIN only as defaults/control definitions; runtime uses the complete selected `SolverConfig`. |
| `spec.ts` + Engine/Logic | `MIN_TOUCH*` and `minTouch` policy | Remove from v3.5.4 config/judgement; leave comparison-tab ownership untouched. |
| `engine.ts` | `cfg.x ?? DEFAULT`, `Math.max` clamps, fixed `SIZE_STEP_MM`, global `BANDS` | DELETE all fallback/clamp/spec ownership. Engine accepts complete validated config and iterates `config.bands` by `config.sizeStepMM`. |
| `engine.ts` | default `plan='all6'`, `perimeterOnly=true` | MOVE defaults/options to Spec and require complete configured fields. |
| `compute/seat.ts` | `QUANTUM=.001`, `GUARD=.05`, `PARITY_LINE_QUANTUM_MM=.001` | Classify before build: if they can change a candidate/verdict, move to Spec and expose in advanced calibration; if proved identity/index acceleration only, rename/document and prove mutation-invariance. No silent threshold remains. |
| `compute/centre-evidence.ts` | `KEY_QUANTUM_MM=.01`, `MAXV=800`, fixed mesh behavior | Same rule: result-affecting values move to Spec + advanced controls; pure performance values require equivalence proof. |
| `compute/wrap-measurement.ts` | hardcoded nearest-whole-mm `Math.floor(raw+0.5)` | Replace with the configured Spec-owned `measurementStepMM`; Compute returns neutral measured integers/values, not policy. |
| Proposed v3.5.4 algorithm | literal 48 mm cell, 1 mm registration, 2 mm sizes, 12 mm growth, 12/24 flap switches, 24 mm scheduling buckets | Replace every literal with the corresponding configured field. The 24 mm scheduler and its forced fixture are deleted entirely. |

## Required wiring proof

For every row marked active:

1. change the admin control from its default;
2. assert the exact value appears in the worker request;
3. assert bridge transport preserves it;
4. assert the complete typed config reaches the named Compute or Logic consumer;
5. mutate any old duplicate constant and prove it no longer changes the answer;
6. prove Voting and Centre-rules retain their existing controls and results.
7. forged, incomplete and out-of-range configurations refuse at the single Spec validator; no Engine/Compute/Logic fallback repairs them;
8. fixed/Free inspection and band solving call the same candidate -> Centre -> Fit judgement; manual registration only changes candidate input.

The separation guard rejects duplicated `SolverConfig` field identities, defaults, bounds, bands, option identities and policy thresholds outside Spec. It does not ban ordinary numeric literals: geometry formula coefficients, loop/index constants, rendering values and cache capacities may remain local when they are not user calibration. Any local constant claimed incapable of changing a result needs a mutation/equivalence proof; otherwise it is a `SolverConfig` field and admin control.

**Necessity:** no new solver abstraction is required: one complete Spec-owned configuration and the existing controls are reused; only missing result-affecting controls are added.

**Sufficiency:** every current and proposed solver-affecting value has one Spec owner, an exposed v3.5.4 admin control, an exact transport path and one named consumer; no hidden 24 mm or other calibration decision remains.
