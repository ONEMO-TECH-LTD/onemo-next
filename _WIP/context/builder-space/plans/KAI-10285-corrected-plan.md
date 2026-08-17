# KAI-10285 corrected plan

## Frozen current-diff inventory

Builder-owned tracked files only; QA-space is excluded:

- `flow.ts`: +56/-173.
- `mask-tools/index.ts`: +120/-53.
- `paint-smoothing.test.ts`: +54/-43.
- GrabCut oracle: +244/-27.
- Preservation fixture: +3/-3.
- `finish.ts`: -24.
- Paper kernel: -40.
- Paper kernel test: +2/-35.
- Characterization dependency map: -2.
- Generated closure: +23/-23.

Before plan approval, Builder improperly added `firstPaintAcceptance = outlineSource !== 'paint'`, passed it as `resetPaintVector`, changed the corresponding oracle expectations, then ran typecheck, lint, build, and one failing oracle. Those bytes remain frozen. No cleanup, revert, commit, or further run occurred after QA STOP.

## Governing directive set

Authority: canonical contract SHA-256 `c63f70e86597e7be93b6e042be4c7fa6df86356f36a9777b`, plus the chronological later owner corrections below where they refine it.

1. Paint erase is inverse Paint: Autotune the open negative, subtract it, apply Paint Mask smoothing only to the new cut boundary, and forbid new holes, gaps, splits, fragments, or destructive loss. Preserve accepted mask and soft-alpha bytes outside the affected band.
2. First Paint ownership of any accepted source switches the same shared Vector resolver to named ZERO: Detail/Offset/Simplify/Smooth/Radius `0/0/0/0/0`. This ownership transition may legitimately change the prior AI/GrabCut CLASSIC contour.
3. Judge a subsequent Paint erase against that ZERO-resolved pre-erase baseline. Only the new cut boundary may change; the ownership transition does not excuse global movement caused by the erase itself.
4. Later deliberate Detail/Offset/Simplify/Smooth/Radius changes use the one shared resolver. Custom settings or a selected Paint preset persist through later Paint add, erase, Paint-config replay, Undo, and Redo.
5. Upload, Clear, successful new Detect, and successful standalone GrabCut end/reset Paint ownership. A subsequent first accepted Paint operation switches to ZERO. A successful GrabCut refine is also Cutout ownership, so a later Paint operation switches to ZERO.
6. Preserve original-resolution output, current UI, GrabCut provider/algorithm, FIFO, and existing history owner.

## Minimal deletion/edit list

### A. Keep the local mask erase owner

Keep `erasePaintMask` and reuse `subtractMasks`, `polishMask`, and `paintSmoothingRadius`. Paint creation/add may loop-close; erase forces `closeFrac: 0`, so its negative is the open Autotuned swath. Hole/component/destructive-loss checks validate the result; they do not shape it.

New helpers and justification:

- `exteriorBackground`: distinguishes exterior background from erase-created holes.
- `healNewEraseHoles`: forbids new holes without filling pre-existing holes.
- `expandInfluenceBand`: matches `smoothMask`'s full influence radius so off-band bytes remain exact.
- `foregroundComponents`: rejects erase-created splits.
- `cloneMask`/`masksEqual`: returns exact no-op state.

No second smoother.

### B. Keep the rejected-path deletions

Delete and do not restore the named rejected mechanisms and their orphans; this is not a blanket range-revert of every sanctioned change between `982…b273`:

- `resolvePaintMask`.
- `finishMask`.
- `subtractShapePaper`.
- `finishResolved` flags/state.
- `solidBase`, `baseShape`, `acceptedShape`, and `visibleShape` derivations.
- `maskWithinTopology` and `retainPrimaryMaskBlob`.
- Erase-specific Vector recalculation.
- Associated imports, tests, comments, and closure dependencies.

Paint begins from the exact accepted mask.

### C. Correct source ownership

- First accepted Paint operation where `outlineSource !== 'paint'` selects shared named ZERO. With no accepted base, prepare/resolve the new Paint mask once at ZERO and use it directly. For first Paint ADD over an accepted AI/GrabCut base, prepare/resolve the changed canonical mask once at ZERO and use it directly; the whole CLASSIC-to-ZERO ownership movement is allowed. For first Paint ERASE, prepare both old and changed canonical masks through the same mask-derived prepare path, resolve each once at ZERO, then splice. Never compare a native-preseg old result with a rebuilt-mask changed result.
- Erase locality is judged only between that ZERO-resolved old-mask baseline and the final splice. For later ZERO, CUSTOM, or named-preset erases, the baseline is the current resolved display shape and the changed-mask candidate resolves once through the same active settings.
- Subsequent Paint add/erase/config replay retains current Paint Vector settings and preset.
- Upload/Clear call the existing `activateOutlineSource('cutout')` transition owner before clearing the shape and resolved override. This persists current Paint settings, restores saved Cutout settings/preset into refs and visible state, and prevents the next Detect from early-returning with stale Paint controls.
- Successful Detect/standalone GrabCut/refine already calls Cutout acceptance through the same transition owner. It restores truthful Cutout settings/preset if the current owner is Paint; the next accepted Paint operation calls the transition owner with a ZERO reset.
- No new lifecycle owner or unowned state is introduced.

### D. One generic splice of two shared-resolver outputs

Current source has no local VShape interval-replacement kernel. The only proposed seam is `spliceResolvedPathBand(baselineResolved, candidateResolved, band)` in existing vector-core ops. Both shape inputs are already produced by the existing shared `resolveTraceOutline` path at the active truthful settings. The seam performs no tracing, smoothing, resolution, or fitting.

Existing primitives reused:

- `flattenPath` supplies only the line-segment brackets for mutual baseline-candidate curve intersections restricted to the band; rectangle-boundary crossings are not used.
- `nearestOnPath` seeds both existing curves inside each bracket, then both parameters are refined on those curves. It is exact for lines but sampled-plus-ternary approximate for cubics.
- Existing internal `insertAnchorAt` splits each crossing segment exactly with de Casteljau.
- `segments` assembles the exact baseline outside arc with the exact candidate inside arc.

The seam:

1. Accepts one outer path from each shared-resolver result.
2. Finds exactly two ordered mutual baseline-candidate curve intersections inside the supplied band.
3. Requires the independently evaluated baseline/candidate endpoints to coincide within the focused gate's empirically proved numerical bound, then splits both curves geometry-exactly at the refined parameters. Only the de Casteljau split is exact; flattening and numerical refinement are not.
4. Copies every baseline outside anchor and handle byte-for-byte, except the two split crossing segments whose de Casteljau split is geometry-identical.
5. Copies the candidate's already-resolved inside anchors and handles without refitting.
6. Rejects missing, extra, ambiguous, multi-crossing, out-of-band, self-splitting, or destructive results.

Rough delta: 70–100 vector-core lines, one barrel export, and 80–110 focused test lines. No `fitCubicsOpen`, normalized-mask contour, Paper boolean, second resolver, or Paint-specific vectorizer. If these existing primitives cannot produce a continuous exact splice without another fitter or owner, the task remains GAP/BLOCKED; Builder must not build an alternative.

Mandatory execution gate before any Flow/history wiring:

1. Implement/probe only `spliceResolvedPathBand` and its focused fixtures.
2. Build fixtures from actual existing shared-resolver baseline/candidate outputs for a real Paint boundary erase at ZERO and at one named or CUSTOM recipe. Synthetic rectangles are insufficient.
3. First prove whether each real pair has exactly two usable in-band intersections. Independently resolved contours are not assumed to intersect twice.
4. If the real pair lacks coincident usable endpoints after deterministic `nearestOnPath` projection and exact `insertAnchorAt` splits, stop GAP/BLOCKED. No fitted bridge, endpoint bridge, Paper boolean, mask tracing, resolver, or geometry outside the band.
5. Prove the result is continuous and closed, baseline geometry is exact outside the band, the candidate segment remains inside the band, and ambiguous/multiple endpoint choices reject.
6. If continuity cannot be achieved with the named existing primitives entirely inside the band, stop GAP/BLOCKED. Do not edit Flow/history or improvise another geometry path.

Execution correction locked by QA:

- Paint add/creation may use loop close. Paint erase always sets `closeFrac: 0`; the open Autotuned swath is its negative, and topology/destruction checks only validate the result.
- First Paint ADD with no base resolves the new canonical mask once at ZERO. First Paint ADD over an accepted base resolves the changed canonical mask once at ZERO and uses that whole result; only first ERASE needs old-mask and changed-mask resolved pairs plus the local splice.
- `nearestOnPath` is exact only for lines and approximate for cubics. The feasibility fixture must prove its numerical endpoint bound before the exact de Casteljau split; the seam cannot bridge a genuine gap.
- Final acceptance is transactional: all preparation, resolution, splice, topology/locality, generation, and cancellation checks remain local until one final no-await publish block.
- Every `VShape` crossing history is deep-cloned, including existing `drawn` state and the resolved override.
- Delete only the named rejected mechanisms and temporary probes, preserving sanctioned unrelated changes.

### E. Canonical source plus resolved display override

- Add one `resolvedOverrideRef: VShape | null` beside the canonical mask/prepared and display-shape refs.
- The canonical accepted state remains the exact mask plus its prepared source. The override is only the current resolved display result.
- Extend existing `Snap` with `resolvedOverride`; exact mask, settings, preset, and Paint config already travel there. Deep-clone every VShape crossing history, including existing `drawn` and the new override; current `Snap`/restore share `drawn` by reference and must stop doing so. Acceptance and restore may display the override directly by serialization/bounds without running the resolver again.
- Never store a final resolved output in `drawnRef` and then pass it with the same settings through `finishDrawn`. `drawnRef` retains its existing raw edited-shape meaning.
- First Paint ownership resolves old and changed canonical sources once at ZERO, splices those two results, and stores the final splice as the override.
- A later Paint erase starts from the current resolved display baseline, resolves the changed canonical source once through current ZERO/CUSTOM/named settings, splices those two resolved outputs, and replaces the override.
- A deliberate Vector control or preset change clears/replaces the override and resolves the canonical prepared source once through the existing shared resolver. The resulting truthful settings/preset and display state replace the current history snapshot.
- `PaintCalibrationSource` retains the exact pre-stroke canonical mask as replay truth. It may cache a pre-stroke resolved baseline only with an exact settings-identity key.
- Deliberate Vector changes do not invalidate Paint replay. On every Paint-config replay, resolve the stored pre-stroke canonical mask and the newly recomputed changed mask once each through the CURRENT shared settings, splice those current-setting outputs, and replace mask/override/current history. Reuse a cached resolved baseline only when its settings identity exactly equals current settings; otherwise discard/recompute it.
- Replay never starts from the prior replay result, so repeated calibration does not compound. Current CUSTOM/named settings and visible preset remain unchanged and truthful.

Rough additional flow delta from the frozen diff: 45–70 lines for the override, Snap field, lifecycle reset, and single-resolution orchestration, with roughly 20 lines of superseded acceptance/re-resolution logic removed.

`acceptMask` currently validates preparation before publishing the mask, but it is not an atomic transaction: it installs `preparedRef`/`nativePresegRef` before ownership, mask, visible shape, and history. The correction computes every prepared/resolved/spliced candidate plus topology/locality/generation checks in locals. `installPrepared` and every live ref/state/history write move into one final no-await commit block. Failure before that block leaves all accepted state byte/state-identical.

### F. Full local mask normalization

- Keep `erasePaintMask`, `subtractMasks`, `polishMask`, `paintSmoothingRadius`, and the justified topology/influence-band helpers.
- Inside the actual subtraction delta expanded by the full smoothing-influence radius, copy the full `polishMask(healedRaw)` result, including allowed additions and removals. Do not use `healedRaw && polished` and do not require every raw-negative pixel to remain erased.
- Outside the band, preserve accepted binary and soft-alpha bytes exactly.
- Inside the band, selected foreground owns soft alpha `255`; removed background owns `0`.
- Reject exact no-op, newly created hole, changed component count, empty/destructive result, or an erase that produces no real local carve.

### G. Proof cleanup

- Delete temporary viewport-mask approximation, Nodes-count, and rendered-RGBA locality proof.
- Retain the exact `Path2D` sampled-contour proof only if required after focused exact kernel tests.
- Regenerate the preservation fixture and closure only after final bytes settle.

## Proof matrix

- ZERO transition: AI/GrabCut CLASSIC to first Paint acceptance becomes visible named ZERO. Prove the old-mask baseline and changed-mask candidate each pass through the existing shared resolver at ZERO once. Capture the ZERO-resolved pre-erase baseline only after that transition; do not count CLASSIC-to-ZERO movement as erase drift.
- First Paint ADD ownership: from an uploaded image with no accepted cut, first Paint add creates its mask with Paint controls, prepares/resolves it once, and displays named shared ZERO. From an accepted AI/GrabCut CLASSIC base, first Paint add prepares/resolves the changed canonical mask once at ZERO and uses it directly; the whole ownership transition is allowed. Both cases prove visible `0/0/0/0/0` and no hidden CLASSIC/Simplify value.
- Generic splice: use two real shared-resolver outputs; baseline outside anchors/handles remain byte-exact; split crossing segments are geometry-identical; candidate arc is confined to the band; ambiguous/multi-crossing/split is exact no-op. Static/source trace or a focused spy proves candidate resolution occurs once and override display bypasses re-resolution.
- Mask: full polished additions/removals are allowed only inside the full smoothing-influence band; binary and soft alpha remain exact outside; inside soft truth is `255/0`; a real carve survives; no new hole; component count stable; internal/split/destructive cases are exact no-op.
- Named/CUSTOM continuity: choose a named preset and a CUSTOM setting, then perform Paint add, Paint erase, and Paint-config replay. Controls/preset remain truthful; replay resolves the exact stored pre-stroke canonical mask and recomputed candidate once each under current settings; resolved contour remains exact outside the erase band; repeated replay does not compound.
- Post-Vector replay: create a Paint stroke, deliberately change to CUSTOM, then change Paint calibration. Prove replay remains available, resolves base and candidate once each with current CUSTOM, retains truthful controls, and is identical when repeated with the same value.
- Lifecycle/UI truth: Paint CUSTOM -> Clear restores visible saved Cutout preset/settings; Detect remains truthful Cutout rather than early-returning on stale source. Paint CUSTOM -> Upload also restores Cutout preset/settings before the next Detect. After either path, the next accepted Paint add/erase switches to named ZERO.
- Detect/standalone GrabCut/refine from Paint ownership use the existing Cutout transition and restore truthful Cutout settings/preset; next Paint acceptance selects ZERO.
- History: exact mask, deep-cloned drawn shape, deep-cloned resolved override, settings, preset, Undo, and Redo restoration; restore displays the override without invoking the resolver and shares no mutable VShape with live state.
- Regression: preservation, detector, flow, output, GrabCut Chromium/WebKit, full suite, typecheck, scoped lint, build, closure, and current real-route visual observation.

Necessity: no unnecessary elements if the single generic splice succeeds using only the named existing primitives; otherwise GAP/BLOCKED.

Sufficiency: covers full local normalization, ZERO transition separately from erase locality, named/CUSTOM persistence, post-Vector non-compounding replay from canonical mask truth, truthful lifecycle UI restoration through the existing transition owner, resolved-state/history behavior, and the one shared resolver.
