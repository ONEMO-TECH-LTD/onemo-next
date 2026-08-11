# Grid Engine scaffolding — independent review of lead audit

**Reviewed state:** `033762fc567693cd4d0c5731e45427ff4fa4ef72`  
**Scope:** the current Grid Engine admin instrument and its modular boundaries. The contour-driven manufacturing solver is intentionally not built yet; its absence and its skipped future acceptance suite are not defects in this review.

## Verdict

The lead audit is directionally correct but cannot be executed verbatim.

- Confirmed: N1, N2, N3, D1, D2, D3, D6, D8.
- Revised: D4.
- Rejected as stated: D5, D9, D10.
- Correctly retained: D7.
- Independent review found six additional defects plus one product-law conflict that must be held.

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

### __D5 — REJECTED: the “Plain view scale” comment is not orphaned__

The comment at `page.tsx:102-106` describes the still-live `launchZoom` calculation directly below it. N2 makes the calculation incorrect, but the comment is not dead merely because manual zoom controls were removed.

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

### P3 — registration write bypasses the one guard

`page.tsx:166` directly calls `setSpec` to mutate `registration`. This contradicts the page contract that every law-value write passes through the spec guard. Registration must be an explicit guarded input or a bridge/engine answer; the shell must not open a second write route.

### P4 — released 12mm grid atom is hardcoded in the canvas

`GridCanvas.tsx:44-46` declares `RULE_FINE_MM = 12`. This is a grid-law number in UI code, outside the guarded spec/bridge path. The canvas may own pixel visibility thresholds; it must not own released millimetre law values.

### P5 — bridge computes geometry despite its wiring-only contract

`bridge.ts:70` derives `anchorMM` by adding offset and pan. That is a manufacturing coordinate. The engine should return it; the bridge should assemble calls and results only.

### P6 — stylesheet residue

`page.module.css:421-431` duplicates `.spacer` and `.fieldReadout` inside the dark-theme block with malformed indentation. `.field`, `.label` and `.value` at lines 127-152 have no Grid shell consumers.

### P7 — HOLD: 96mm thinning and even-registration symmetry conflict

The latest fix correctly makes the 96mm population a strict subset of the 48mm lattice. `engine.ts:58-64` also records that an even gap-registered match is then asymmetric and currently relies on manual pan. This conflicts with the standing even-population symmetry rule and the no-manual-fitting mission. It is a product/law decision, not a cleanup implementation choice. Do not silently resolve it in this fix set.

## 3. Consolidated accepted fix set

If Lead and Meta agree, implement only this set:

1. Remove dead zoom exports, the unused page import, `syncSizeFromBox`, dead bridge whitespace and unused/duplicated CSS.
2. Remove the inert shape-size-to-field coupling or replace it with a truthful field-owned input; do not invent solver behavior.
3. Derive camera framing entirely from the same live spec.
4. Make separation traversal recursive and make import checks cover nested unit paths.
5. Fix the React ref/render lint error and the stale `spec` closure.
6. Route registration through one authoritative guarded/engine path.
7. Move the 12mm atom out of the canvas into the guarded value path.
8. Return `anchorMM` from engine computation rather than deriving it in the bridge.
9. Consolidate only the genuinely stale comments named above.

Do not include:

- the unbuilt contour solver;
- activation of its future acceptance suite;
- a ruling on 96mm parity/registration;
- deletion of 6/8mm magnet-body values;
- deletion of camera `Box`;
- renaming the intentional shell-owned `ui/` headers;
- any ceiling change;
- adjacent refactors or UI redesign.

## 4. Verification evidence

- Worktree clean at review start; HEAD matched its task remote and preview branch.
- Independent N1/N2 runtime-math probe reproduced the defects above.
- Focused separation suite: 11/11 passed, demonstrating N3 is a test-coverage gap rather than a current red test.
- Full Vitest run before the final one-line lattice-anchor commit: 547 passed, 22 skipped.
- TypeScript passes at current HEAD.
- Focused ESLint fails with one error and three warnings: P1, D2, D3 and P2.
- Live port 4200 was proven to serve this worktree. A real RGBA cut-out loaded in outline mode; dragging over the shape moved magnet coordinates while polygon coordinates stayed identical. This validates the instrument interaction only.

## 5. Recommended ownership and gate

Pixel should implement the accepted internal cleanup in a fresh worktree after Lead confirms intent and Meta agrees with this disposition. The independent reviewer found omissions and rejected false-positive deletions, so returning implementation to the original builder would weaken the adversarial gate.

After implementation:

1. Lead verifies the intended instrument behavior was preserved.
2. Meta independently reruns source, tests, lint and live-surface checks.
3. The 96mm parity conflict remains separately held for Dan.
