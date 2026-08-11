# Grid Engine scaffolding — independent review of lead audit

**Reviewed state:** `033762fc567693cd4d0c5731e45427ff4fa4ef72`  
**Scope:** the current Grid Engine admin instrument and its modular boundaries. The contour-driven manufacturing solver is intentionally not built yet; its absence and its skipped future acceptance suite are not defects in this review.

## Verdict

Lead, Pixel and Meta agree on the amended scaffolding-cleanup set compiled in section 3.

- Confirmed: N1, N2, N3, D1, D2, D3, D6, D8, P1–P6 and L1–L3.
- Revised: D4 and D5.
- Rejected: D9 and D10.
- Retained: D7.
- Ruled correct/no change: P7.
- Excluded: the ceiling row and the intentionally unbuilt manufacturing solver.

This is an approved audit scope, not authorization to implement it. Dan explicitly ruled that no code changes are authorized yet. No cleanup worktree, code edit or cleanup commit may be created until he authorizes implementation.

## 1. Lead findings — independently verified

### N1 — CONFIRMED: shape size is inert as a field input

`page.tsx:333` feeds `sizeMM` into `extentMM`. `engine.ts:84-103` floors both axes to the released 408mm field before magnet generation. An independent probe produced the same 408mm field and population for shape sizes 72, 120, 168 and 310mm.

The lead measured 64 magnets after cut-out load because that path selects gap registration. The independent RELEASED-state probe measured 81 under point registration. The count difference is state, not disagreement: the shape-size input is inert in both states.

### N2 — CONFIRMED: camera mixes released and live specifications

`page.tsx:105-106` computes the scale numerator from `RELEASED`; `GridCanvas` frames the field produced from the live `spec`. Independent reproduction with a 310mm shape:

```text
positions 9 → padded field 504mm → view 325.5mm
positions 5 → padded field 406mm → view 262.208mm
shape remains 310mm
```

Changing a live law input therefore causes the static shape to overflow the view.

### N3 — CONFIRMED: separation tests do not cover the new submodule

`separation.test.ts:21-24` reads one directory level only. `separation.test.ts:87-89` matches only `grid-engine/<single-name>`. Imports such as `grid-engine/ui/camera` and files below `ui/` escape the intended checks.

### D1 — CONFIRMED: dead zoom API

`camera.ts` exports `zoomIn`, `zoomOut`, `ZOOM_MAX` and `ZOOM_STEP`. None has a consumer outside that file.

### D2 — CONFIRMED: unused import

`page.tsx:35` imports `ZOOM_FIT` but never uses it. ESLint confirms it.

### D3 — CONFIRMED: unused function

`page.tsx:139-143` defines `syncSizeFromBox`; it has no caller. ESLint confirms it.

### D4 — REVISED: consolidate stale terminology; do not delete the behavior description

The `CLASSIC band` block at `page.tsx:54-61` is duplicated/stale terminology, but its band-3 behavior still exists through `DEFAULT_SIZE_BAND = 3`. Consolidate it with the current default-load documentation rather than deleting the whole explanation.

### D5 — REVISED: delete one false line; keep the live explanation

`page.tsx:103-104` documents the still-live `launchZoom` calculation and stays. Line 102, “Plain view scale. 1 is fit,” describes deleted zoom state and is false about the calculation below it: `launchZoom` is 2.222, not 1. Delete line 102 only.

### D6 — CONFIRMED: stale header claims

The page header says it “will import” a bridge it already imports and says the canvas is 402×402 while the implementation is a responsive square inside page gutters.

### D7 — RETAIN: dormant magnet-body values

`spec.ts:166-169` retains the 6mm and 8mm magnet bodies. They became dormant when inner-disc rendering was removed, but they are architecture-bearing future engine inputs. Do not delete them during scaffolding cleanup.

### D8 — CONFIRMED: dead whitespace

`bridge.ts:82-85` contains four orphan blank lines from deleted functions.

### __D9 — REJECTED: “shell-owned UI logic” is intentional architecture language__

`ui/README.md` explicitly defines `ui/` as the place where the shell’s necessary logic lives inside the logic-system module. The `camera.ts` and `trace-cutout.ts` headers match that distinction. Renaming them would obscure ownership rather than correct it.

### __D10 — REJECTED AS NECESSARY DELETION: `Box` is not proven slop__

`camera.ts:10-15` uses a minimal generic screen rectangle. It is structurally compatible with `RegionMM` but keeps camera math independent of manufacturing vocabulary. Sharing the type would add coupling. Do not change it without a stronger architectural reason.

### Ceiling row — EXCLUDED

Dan already ruled the millimetre ceiling row correct. Do not reopen it in this cleanup.

## 2. Independent findings missed by the lead audit

### P1 — ESLint error: ref read during render

`page.tsx:345` reads `panGrabbedAt.current` while rendering cursor style. React refs do not trigger render and the repository lint rule rejects this. Cursor state must be render state or static presentation driven outside render.

### P2 — stale specification closure during cut-out load

`page.tsx:163-184` reads `spec` inside `loadCutout` but declares an empty dependency list. Loading after an admin law edit can size the cut-out against an old spec. ESLint reports the missing dependency.

### P3 — registration has no guarded input

`page.tsx:166` directly calls `setSpec` to mutate `registration`. Registration is not a `GridKey` and is absent from `LIMITS`, `SEALED_IN_CODE` and `OPTIONS_ONLY`, so no guarded route currently exists. Add registration to the authoritative guarded input path. Its written value remains the parity consequence of the match count; do not promote the 6.5 gap value to a default.

### P4 — released 12mm grid atom is hardcoded in the canvas

`GridCanvas.tsx:44-46` declares `RULE_FINE_MM = 12`. This is a grid-law number in UI code, outside the guarded spec/bridge path. The canvas may own pixel visibility thresholds; it must not own released millimetre law values.

### P5 — bridge computes geometry despite its wiring-only contract

`bridge.ts:70` derives `anchorMM` by adding offset and pan. That is a manufacturing coordinate. The engine should return it; the bridge should assemble calls and results only.

### P6 — duplicated CSS changes the dark-mode rendering

`page.module.css:421-431` duplicates `.spacer` and `.fieldReadout` inside the dark-theme block. Braces balance, but the later duplicate wins at equal specificity: `.fieldReadout` renders `rgb(100,116,139)` instead of the intended dark-theme `rgb(148,163,184)`. Remove the duplicate rules. `.field`, `.label` and `.value` at lines 127-152 have no Grid shell consumers and should also be removed.

### P7 — CLOSED: 96mm thinning does not recenter the lattice

Dan ruled this behavior correct in law 9.3a: “no need force centering - the view remains same just some points are hidden to show sparse grid no complication.” At 96mm the population is a strict subset of the 48mm lattice; registration, camera and lattice position remain unchanged. The even-match offset is accepted. P7 requires no code change and must not become a cleanup task.

### L1 — CONFIRMED: shell and engine enforce different minimum shape sizes

The shell accepts `SHAPE_MIN_MM = 20`, while the engine floors the shape to `cellDiameterMM = 24`. Live measurement with a cut-out loaded produced 20→24, 22→24, 24→24 and 30→30: below 24mm the number field retains a value the engine did not produce. One minimum must be owned and exposed by the unit.

### L2 — CONFIRMED: the separation guards are pattern-shaped, not structural

N3, P3 and P4 share one root cause. The current checks anticipate particular spellings: one directory level, one import-path segment, a `grid` object write shape, or arithmetic involving a law value. They miss nested files/imports, sibling `GridSystemSpec` writes and bare released literals. The fix must close the structural classes, not only the three observed instances.

### L3 — CONFIRMED: camera numerator and frame use different spans even under RELEASED

`gridScale` divides `framedSpan(9) = 480mm`, while the rendered frame is `paddedField = 504mm`. A 310mm shape therefore occupies only 95% of the view even when every value is released. Camera scale and frame must use the same live-spec span.

### L4 — ACCEPTED SCOPE AMENDMENT: delete the inert field feed; do not replace it

The original alternative to replace `sizeMM → extentMM` with a new field-owned input would invent a control. `positionsPerAxis` already owns field extent. Remove the inert feed without substitution.

## 3. Final agreed cleanup audit

When Dan authorizes implementation, clean and fix exactly this set.

### A. Remove dead and stale scaffolding

1. Delete the unused `zoomIn`, `zoomOut`, `ZOOM_MAX` and `ZOOM_STEP` camera exports.
2. Delete the unused `ZOOM_FIT` page import.
3. Delete the unused `syncSizeFromBox` function.
4. Delete the orphan bridge whitespace.
5. Remove the duplicated `.spacer` and `.fieldReadout` CSS rules and the unconsumed `.field`, `.label` and `.value` selectors. Confirm the intended dark-mode field-readout colour wins afterward.
6. Consolidate the duplicated `CLASSIC band` terminology while retaining the true band-3 behavior and frozen-120 reasoning.
7. Delete only the false `page.tsx:102` “1 is fit” comment; retain lines 103-104.
8. Correct the stale page header claims: the bridge is already imported, and the canvas is responsive rather than fixed at 402×402.

### B. Restore one source of truth for field, camera and shape values

9. Remove the inert `sizeMM → extentMM` field coupling. Do not replace it with another field-size input; `positionsPerAxis` already owns field extent.
10. Make camera scale and the drawn frame use one identical span derived from the live spec. Do not mix `RELEASED`, `framedSpan` and `paddedField` denominators.
11. Use one minimum shape-size floor owned by the Grid Engine unit. The shell field and rendered shape must not disagree below 24mm; do not introduce a second literal.
12. Expose the existing 12mm padding atom from the unit through the bridge to the canvas. Do not create another released literal or a new spec entry.
13. Return `anchorMM` from the engine computation. The bridge must stop deriving manufacturing geometry.

### C. Close the guarded-write and module-separation classes

14. Create a guarded registration input; there is no existing route to reuse. Preserve registration as a parity consequence, not a promoted default.
15. Make separation-test file traversal recursive.
16. Make separation import checks cover nested paths such as `grid-engine/ui/camera`.
17. Add a structural check that fails any write to a `GridSystemSpec` field outside the authoritative guard.
18. Add a structural check that fails a bare shell literal equal to a released law value. This must catch the class represented by the canvas-owned `12`, not only arithmetic expressions.

### D. Fix current correctness and lint failures

19. Stop reading `panGrabbedAt.current` during render. Represent render-affecting cursor state with React state or an equivalent render-safe source.
20. Fix `loadCutout` so it cannot capture a stale `spec`; its callback dependencies and behavior must use the current specification.

### E. Required verification after authorization and implementation

21. Run focused Grid Engine ESLint with zero errors and zero warnings for the accepted set.
22. Run typecheck, focused separation tests and the full relevant test suite, reporting every skip rather than calling skipped coverage a pass.
23. Lead independently verifies the live instrument behavior: the shape stays static and fills the viewport; the lattice scales and pans beneath it; drag remains live over the shape in 1mm steps; cut-out load remains outline mode at band 3 with four centred points; 96mm hides points without moving them.
24. Meta independently reruns the source, lint, typecheck, tests and live-surface gate on the implementation checkout.

### Explicitly outside this cleanup

- the unbuilt contour solver;
- activation of its future acceptance suite;
- any change to 96mm parity, registration, camera or lattice position;
- deletion of 6/8mm magnet-body values;
- deletion of camera `Box`;
- renaming the intentional shell-owned `ui/` headers;
- any ceiling change;
- adjacent refactors or UI redesign.

P7 is closed by Dan's law 9.3a ruling. Sparse mode hides points only; it does not recenter or correct the accepted even-match offset.

## 4. Verification evidence

- Worktree clean at review start; HEAD matched its task remote and preview branch.
- Independent N1/N2 runtime-math probe reproduced the defects above.
- Focused separation suite: 11/11 passed, demonstrating N3 is a test-coverage gap rather than a current red test.
- Full Vitest run before the final one-line lattice-anchor commit: 547 passed, 22 skipped.
- TypeScript passes at current HEAD.
- Focused ESLint fails with one error and three warnings: P1, D2, D3 and P2.
- Live port 4200 was proven to serve this worktree. A real RGBA cut-out loaded in outline mode; dragging over the shape moved magnet coordinates while polygon coordinates stayed identical. This validates the instrument interaction only.

## 5. Ownership and authorization boundary

Lead and Meta agree that Pixel should implement in a fresh worktree, Lead should verify behavior preservation, and Meta should run the closing independent gate. That ownership agreement does not authorize implementation.

Current state: audit compiled; code untouched; Dan has now authorized filing and Lead implementation through the Grid Engine epic/sprint workflow.

Necessity — no unnecessary elements: every included edit removes a confirmed defect, stale claim, dead path or guard escape; no new module, field-size control, spec atom or solver behavior is included.

Sufficiency — delivers the scaffolding cleanup in full, but none of the standing manufacturing-solver build directive. The cleanup must never be reported as completing the engine mission.
