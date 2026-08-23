# KAI-10285 shared execution goal

Authority: canonical V1 production contract SHA-256 `c63f70e86597e7be93b6e042be4c7fa6df86356f36a9777b`, plus Dan's later Paint corrections recorded in this file.

## Goal

Repair Paint from the exact `e8cf49b9d3c0f7719c84bda7bfe84c2756e396eb` product/test baseline. This commit is the clean pre-experiment base, not the finished fix.

## Required change

1. Keep the entire later `982504db…b2734220` experimental eraser architecture absent.
2. Correct the inherited Paint erase at the mask layer:
   - erase uses an open Autotuned stroke;
   - subtract it from the exact accepted mask;
   - apply the existing Paint Mask smoothing/normalization only inside the newly cut boundary's affected band;
   - preserve binary and soft-alpha mask bytes outside that band;
   - reject/no-op new holes, splits, detached fragments, empty/destructive results, and internal strokes that do not make a valid boundary carve.
3. The first successful Paint operation over any source selects named shared Vector `ZERO` and visibly shows exact Detail/Offset/Simplify/Smooth/Radius `0/0/0/0/0`.
4. The resulting Paint mask uses the existing shared Vector resolver. Later deliberate Vector control, named-preset, or custom-setting changes recalculate Paint through that resolver exactly as they do AI/GrabCut.
5. After Paint ownership is established, later Paint add, erase, and Paint calibration replay retain the current selected Paint Vector recipe. Upload, Clear, Detect, standalone GrabCut, and GrabCut refine end Paint ownership; the next successful Paint operation selects `ZERO` again.

## Forbidden scope

- No vector splice or curve-intersection kernel.
- No resolved-shape override.
- No new history model or transaction redesign.
- No Paint-specific Vector resolver, fitter, vectorizer, geometry engine, smoothing owner, compatibility layer, framework, provider, or UI redesign.
- No exact-global-Vector-geometry locality requirement after normal shared Vector resolution. Locality applies to the accepted mask edit; Vector presets remain intentionally global.
- No unrelated cleanup or behavior change.

## Builder responsibility

Implement only the required change from this file and the canonical contract. Remove every orphan created by the deleted experimental paths. Verify focused mask/flow behavior, full tests, typecheck, lint, diff check, build, Chromium/WebKit journeys, and the exact current route. Commit and push one rollback snapshot for QA. Do not build from memory or superseded plans.

## QA responsibility

Review the exact pushed snapshot against this file and the canonical contract. Verify mask locality, topology/no-op safety, truthful first-Paint `ZERO`, later shared-Vector behavior, recipe lifecycle, Undo/Redo, original-resolution output, and unchanged GrabCut. Reject any scope expansion or reintroduced experimental mechanism. QA does not design another implementation during review.

## Acceptance

- Ordinary boundary erase produces one smooth local notch.
- Internal, near-loop, split, fragmenting, empty, or destructive erase is exact no-op.
- Accepted mask binary and soft alpha outside the affected boundary band are exact.
- Fresh/first Paint visibly uses shared `ZERO 0/0/0/0/0`.
- Each of the five Vector controls and named/custom presets deliberately affects Paint through the existing shared resolver.
- Later Paint operations retain the chosen Paint recipe; lifecycle resets make the next Paint operation select `ZERO`.
- Undo/Redo, original-resolution Preview/Save, AI, and GrabCut remain correct.

Necessity: delete the failed experimental architecture; add only the mask-local erase correction and Paint ownership wiring.

Sufficiency: delivers Dan's complete KAI-10285 correction without changing scope.
