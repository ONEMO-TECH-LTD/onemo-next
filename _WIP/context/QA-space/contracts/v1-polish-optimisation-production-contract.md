# S62 Cutout Lab v1 — production polish contract

Status: **final `@s62-pixel-qa` proposal; planning evidence only.** It does not clear implementation or runtime.

Authority: [`../transcripts/directive-ledger.md`](../transcripts/directive-ledger.md), especially the V1 production-plan extension and current contract obligations. Source-matched evidence: [`../source/v1-production-readiness-ledger.md`](../source/v1-production-readiness-ledger.md). V1 denominator: `050d557e2ddbe99520c008e2090c202c554f03f8`.

## Decision

Fix v1. Do not rebuild the lab or copy v2.

Polish v1 in `onemo-next`, then finish this sprint with one portable product-owned package. Do not relocate the current mixed React/DOM seven-file unit wholesale into `onemo-next/src/lib/` before its behavior, defects, and layer boundary are settled. Relocation is required when it creates the final package: existing production owners are moved or re-exported—not rewritten—into a headless engine layer plus an explicit browser/React studio module, preserving the existing UI-facing API and removing dev-route dependency. That cleared package is the unit later adopted into `onemo-effects-engine`.

The current Cutout UI is preserved unchanged and remains the behavior/calibration harness. This sprint fixes and packages V1; it performs no Figma, UI redesign, UI replacement, or new interface-design work. Packaging preserves the current UI-facing API, changing it only if an actual relocation coupling is reproduced and the existing UI behavior remains identical. The package publishes the shaped Cutout result through a deterministic output boundary for later Grid/manufacturing consumers. The replacement Grid engine is still in flight, so this sprint does not import it, bind to the legacy Grid interface, invent its request shape, or claim Grid compatibility. It also does not claim that later UI work, clean-repository population, Grid integration, or manufacturing/order wiring is delivered.

## Preserve

- Eight-grip Frame behavior and its opposite-side/corner anchoring.
- Collective Detail, Simplify, Smooth, Radius, and Offset controls at current product ranges.
- Paint, Nodes, and exact OpenCV GrabCut interaction except the named defects below.
- Exact GrabCut seeds, three iterations, corridor, standalone/refine, add/erase/no-change, and never-destroy behavior.
- u2netp primary detection with lazy Silueta fallback and the existing visible flood-fill degradation.
- The sibling `{state, actions}` flow, current `HistoryStack`, v5.3.1 engine/vector operations, and canonical engine compositor.
- `bakeStickerEngine` as the Cutout clip/crop/coordinate adapter around the canonical compositor.
- Display-resolution editing, lazy OpenCV loading, the neutral/in-frame/matted Blend 0 bypass, Clamp-only fill, and the current capped transparent Preview/Save output.

Do not add Cutline, raw natural-resolution Save, a replacement store/history/compositor/detector framework, or a second OpenCV provider.

## Proven problems

1. Cutout is dev-owned and has five live import edges through three dev-owned surfaces: `PerfHUD`, outline producers, and v5.3.1 primitives. Its seven-file unit mixes React/DOM studio, browser flow/adapters, and pure state, so a wholesale move into `onemo-next/src/lib/` would violate the clean engine repository's headless-library boundary. The working UI is not a defect; only route-specific calibration/debug UI stays outside the portable engine closure.
2. Removed detector experiments and query fallbacks remain reachable; current Detect/preload, worker, bitmap, bounded-source, and cache ownership is incomplete.
3. Upload can inherit old work; the one-slot tool queue drops gestures; restore is non-atomic; waiters/statuses do not settle on every exit; Paint, Nodes, pointer cancellation, and GrabCut have named defects.
4. The necessary Cutout output adapter still contains Mirror and dormant product glue, may pay material cost for outputs Cutout does not consume, can leave image/SVG work unsettled, and can show checkerboard substitute pixels.
5. GrabCut uses a broad compiled OpenCV runtime for one narrow operation. Its real footprint and responsiveness are unmeasured; one current no-op loads OpenCV and leaks Mats.
6. The verifier and architecture text are stale; no portable product-owned Cutout package exists, and the actual closure, integrated desktop/WebKit/iPhone behavior, historical phone-crash cause/non-recurrence, and stable downstream result boundary are unproven. V1 retains the editable `VShape` and mm context internally but exposes no stable production handoff record.

## Minimal diff

1. Freeze the working behavior in place, cut the three dev surfaces, preserve the current UI and its existing flow/view API unchanged, and prove the direct `onemo-effects-engine` destination without rewriting reusable code.
2. Remove the full detector/query residue and make one bounded inference/resource lifetime explicit while preserving u2netp → lazy Silueta → visible flood-fill.
3. Repair the existing flow, history, FIFO, and tools in place.
4. Keep the Cutout output adapter; remove its stale paths, measure Cutout-only preparation waste, and make capped Preview/Save truthful.
5. Fix the current GrabCut no-op before loading, then retain one measured provider that passes exactness, responsiveness, and device gates.
6. Prove the integrated V1 candidate and historical phone risk, cut over from the dev-owned unit to one portable product package, and emit its generated copy-ready closure record including the preserved UI-facing API and deterministic downstream result contract.

There is no separate cleanup phase. Each cutover deletes the paths it makes obsolete.

## Increment 1 — freeze behavior and prove the adoption boundary

### Change

- Add preservation tests for Frame, collective controls, Paint, Nodes, exact GrabCut, Detect u2netp/Silueta/flood-fill degradation, Clamp, Preview/Save, Clear, Undo/Redo, replacement, and cancellation. Known defects remain explicit failing cases for their owning increments.
- Keep the route component, flow, finish adapter, overlay, history, UI config, and segmentation adapter in place during this sprint. Map each current file and dependency to its direct `onemo-effects-engine` destination: headless core under `src/lib/`, browser adapter/flow outside the headless core, or studio shell under `src/app/`. Do not create an intermediate `onemo-next/src/lib/cutout-lab/` copy.
- Move or re-export only the existing reusable v5.3.1 primitive and outline-producer owners from product-owned library paths. Delete Cutout's `PerfHUD` mount and every `perfGesture` import/call; keep HUD, eruda, and temporary phone diagnostics outside the lifted product.
- Keep the existing route UI and paint-calibration behavior unchanged as the oracle. Characterize and preserve the existing flow `state`/`actions`/`view` API; do not design a replacement interface. Change that boundary only if relocation later reproduces concrete coupling, and then make the smallest behavior-preserving correction. Do no final-UI work and add no intermediate dev-slot framework.
- Delete dead `lastFileRef`.

### Proof and rollback

- Preserved behavior is unchanged except for named failing cases. The adoption map has zero future `/(dev)/` imports, excludes debug sinks, classifies every file/dependency once, preserves the current UI-facing API, and proves that no target headless module imports React, Next, or DOM owners. No product file is relocated, no interface is redesigned, and no final-UI work is performed in this increment.
- Targeted tests, typecheck, scoped lint, and one current-code Upload → Detect → edit → Preview/Save journey pass.
- The characterization/dev-edge cutover is independently revertible; no intermediate duplicate product tree exists.

## Increment 2 — detector and resource ownership

### Change

- Delete EdgeSAM/SAM and the whole comparison/query tail after re-export, dynamic/string-consumer, asset, and tracked-tree proof: `segParam` forwarding/preload, BEN2/RMBG/BiRefNet Transformers models, the `ML_ADAPTER_ID = ben2-onnx` fallback, stale `?seg` stripping/comments/tests, the orphaned `@huggingface/transformers` dependency/lockfile closure, and any proven experiment-only assets.
- Preserve u2netp primary, lazy Silueta fallback, visible flood-fill degradation, and only their required production assets. Keep warm-up only if measurement proves a real first-Detect benefit without unacceptable steady-state pressure.
- Use one already-bounded working source for inference; do not decode it twice or fall back to the raw original URL after a bounded-source failure.
- Cancel and settle the current Detect/preload owner once on replacement, timeout, worker death, Clear, and unmount; stale completion cannot publish. Do not add another serializer without a reproduced concurrent-Detect path.
- Close every created bitmap on every success/throw exit after creation; terminate the owning worker and settle pending requests on owner exit; clear/zero Cutout raster and preseg caches on artwork replacement and unmount. Release sessions/tensors only where a current trace proves they outlive their owner and the installed ORT 1.21.0 API supplies the matching disposal method; intentional warm sessions remain owned by the worker.

### Proof and rollback

- No removed detector route or asset is reachable from the product.
- Primary success, forced lazy Silueta, forced visible flood-fill, replacement, cancellation, timeout, and worker death settle once without publishing old artwork or retaining unowned resources.
- Desktop/WebKit plus physical-iPhone cold, warm, repeat, replacement, and cancellation checks pass.
- The detector/resource cutover is independently revertible; no disabled comparison/query branch or parallel detector remains.

## Increment 3 — flow, history, queue, and tools

### Change

- Keep the sibling flow, `HistoryStack`, and existing prepare/bake generations. Add only the minimum artwork identity/invalidation needed to stop prior artwork or stale derived work publishing.
- Decode and prepare a replacement upload locally. A corrupt/failed upload leaves the accepted artwork, URL, history, and derived state unchanged; publish the replacement and revoke the old URL only after success.
- Replace the one-slot pending tool with one FIFO so every accepted Paint/GrabCut gesture runs once in capture order.
- Reset history on successful Upload. Preserve current semantics: the first accepted cut—Detect, standalone GrabCut, or Paint—is snapshot 0 and non-undoable; later accepted cut/tool/vector/Frame changes and Clear append snapshots; Clear stays undoable; Undo/Redo add no entries.
- Prepare a restore locally, then publish snapshot and prepared result together. Failure leaves current state unchanged.
- Settle queues, timers, `fullBakeWaiters`, status, and busy state on success, failure, staleness, cancellation, replacement, Clear, and unmount.
- Fix one-point Paint truth, rebase the selected-node adjustment base after committed geometry, and own pointer cancel/leave settlement without adding another gesture system. Preserve current exact node insertion, deletion, and selection unless a failing product journey proves a separate defect.

### Proof and rollback

- New artwork receives no old cut, cache, history, status, or output; corrupt replacement changes nothing; burst gestures are lossless and ordered; stale derived work cannot publish.
- Upload starts clean history; all three first-cut paths and Clear keep current semantics; failed restore changes nothing.
- Targeted flow/history/tool tests and one current-code long-edit → Clear → Undo journey pass.
- The flow/history/tool cutover is independently revertible; replaced paths do not coexist.

## Increment 4 — output adapter and truthful output

### Change

- Keep `bakeStickerEngine`; do not move its Cutout clip/crop/coordinate policy into the shared compositor unless implementation proves a smaller shared edit.
- Profile the Cutout cost of `prepareEffect` outputs it does not consume. Add a Cutout-specific skip only if the measured cost is material and the shared default/output contract remains unchanged; otherwise leave shared preparation untouched.
- Remove Mirror and Cutout fill-choice/mosaic glue so Clamp is the only Cutout fill. Preserve shared Tile and every non-Cutout fill caller unchanged.
- After the final caller trace, delete Cutout-only dormant preset/vignette/tint/scale/pan settings, ranges, and transform path.
- Preserve Blend 0 bypass only for neutral, in-frame, matted output; outgrown Clamp and matteless degradation still use the current necessary composition path. Preserve the current engine/mobile output cap.
- Preview and Save return the requested capped transparent pixels or a visible failure—never checkerboard or stale substitutes. Fix image/SVG load rejection, timeout, cancellation, and resource settlement on this path.

### Proof and rollback

- One canonical compositor plus one necessary Cutout adapter remain; Clamp is the only Cutout fill. The profile records whether a Cutout-only preparation skip is justified; if it is not, shared `prepareEffect` stays unchanged.
- Display preserves current geometry/content at display resolution; Preview and Save share full-mode geometry, settings, pixels, and dimensions at the current cap; all failure exits settle.
- Targeted output tests and current-code desktop/WebKit output journeys pass. If shared image/SVG loading or preparation changes, existing Grid, Creator, and 3D callers receive regression coverage.
- The output cutover is independently revertible; removed Cutout paths do not survive beside it and shared callers remain intact.

## Increment 5 — exact measured OpenCV provider

### Change

- Decide scratch+erase before `loadCv()` and before every Mat allocation; return without loading OpenCV.
- Freeze exact current GrabCut masks and interaction.
- Measure the installed official OpenCV 5.0.0 provider against one reproducible same-version official `core + imgproc`-only binding without prescribing its execution mechanism.
- Compare emitted and transferred bytes, peak memory, first-stroke latency, main-thread responsiveness, repeat stability, and physical-iPhone behavior.
- Retain only a provider with identical masks that passes the frozen responsiveness/device gate. If the selected provider fails on the caller thread, put that same provider behind one lazy worker and re-run the gates; if neither candidate passes, the increment remains uncleared. Cut to the narrow binding only when the real product improvement is material; otherwise delete the probe and retain the hardened current provider.

### Proof and rollback

- Upload/Detect and scratch+erase do not load OpenCV; exact GrabCut behavior is unchanged; all allocations and any worker termination path have one owner.
- The retained provider has reproducible provenance and measured desktop/WebKit/iPhone evidence.
- The provider cutover is independently revertible; two providers never ship.

## Increment 6 — V1 closure and adoption handoff

### Change

- Run the production build/analyzer and record source, emitted, compressed-transfer, and available runtime/heap evidence without conflating them.
- Prove one owner each for flow, history, queue, scheduler, compositor, Cutout adapter, detector, and GrabCut provider; remove remaining orphans only with the full deletion evidence bar.
- After Increments 1–5 clear, move or re-export the cleared existing owners into one product-owned portable closure using the repository's real layer conventions: pure/headless owners under `src/lib/`; browser/React orchestration under a product-owned studio-module path outside the headless layer. Preserve the existing UI-facing `state`/`actions`/`view` API as the public boundary; alter it only where the move proves concrete coupling. The current dev route may remain only as a thin test mount importing that package. Delete the old in-route production owners in the same cutover; no duplicate package survives.
- Keep extensibility concrete: preserve the existing UI-facing API and publish the final Cutout result for downstream Grid/manufacturing consumers. Do not import or adapt to either the legacy Grid interface or the unfinished replacement Grid contract. Do not add a new interface project, generic plugin framework, service container, or speculative provider abstraction.
- Keep temporary route-level phone/crash diagnostics through final physical proof, then exclude them from the lifted product together with the calibration panel and debug sinks.
- Replace the stale upload-only verifier once with the final Upload → Detect → edit → Preview/Save journey.
- Delete the stale `ARCHITECTURE.md`; do not replace it with narrative prose. Emit one generated/hashable analyzer record of the actual product files, imports, assets, dependencies, licenses, tests, fixtures, preserved UI-facing API, and exact destination layer/path in the existing `onemo-effects-engine` repository. Do not include route-only calibration/debug UI in the portable engine closure or create/populate a second production repository in this sprint.
- Emit one Cutout result contract from the existing final vector truth and its scale context: final `VShape`, mask dimensions/`mmPerPx`, derived exact manufacturing `Contour`, artwork/mask identity, and versioned inputs required for deterministic regeneration. Reuse `geometry-truth.ts`; do not create another contour producer.
- Stop at the exact final Cutout result boundary. The replacement Grid engine is still in flight; do not bind this package to `src/lib/effect/grid.ts`, guess the future Grid request, copy Grid Lab UI/math, or add size/magnet policy to Cutout. After the new Grid contract freezes, a downstream adapter may consume the recorded result without changing the Cutout engine. Browser output is a preview; later production/order tooling must regenerate from recorded inputs before manufacturing authority clears.
- Inspect any retained Safari/WebContent/Jetsam evidence. Record the physical iPhone model, iOS/Safari versions, input/output caps, and Low Power state; run the complete integrated journey on current Chromium, WebKit, and that iPhone with Low Power off/on.

### Proof and rollback

- The portable package imports through product-owned paths only, its dev route is a thin consumer, and no old route-owned production copy remains. Its generated closure record can adopt that exact implementation directly into the existing `onemo-effects-engine` repository—with headless core and browser adapter/flow separated while preserving the current UI-facing API—and carries all required dependencies/assets with no route-only calibration/debug UI, v2, SAM/query/Transformers residue, or `onemo-next` history.
- Contract tests prove the final edited free shape publishes its exact manufacturing `Contour`, scale, artwork/mask identity, and versioned regeneration inputs without Grid approximation or size/magnet ownership. Grid binding waits for the replacement Grid contract to freeze; later final-UI work, clean-repository population, Grid integration, and the production regeneration gate remain downstream and are not declared complete by this sprint.
- The full product journey passes on the declared surfaces. If the old termination recurs, capture device evidence before assigning a cause; if no causal log or reproduction exists, record the original cause as unproven and claim only bounded non-recurrence/risk reduction.
- Roll back to the last cleared increment; no catch-all patch.

## Governing gate

Necessity Law applies to every task and diff: every changed line must solve its named problem or a direct owner requirement. Sufficiency applies in reverse: every named outcome must be delivered before that increment clears.

Each increment ends at its named proof and rollback point. The existing Builder → QA → Meta workflow governs review; this contract does not duplicate it. Run the complete static and desktop/WebKit/iPhone denominator once more on the integrated candidate. Implementation and runtime remain uncleared until those observations exist.

## Linear map

- KAI-10216 — freeze behavior and prove the adoption boundary.
- KAI-10217 — detector and resource ownership.
- KAI-10218 — flow, history, FIFO, and tools.
- KAI-10219 — output adapter and truthful capped output.
- KAI-10220 — exact measured OpenCV provider.
- KAI-10221 — V1 closure and adoption handoff.

The six tasks stay dependency-ordered. No seventh task is justified.

## Verdict

Necessity — **no unnecessary elements.** Every increment owns one proven problem/cutover; probes do not survive unless they win; replacement deletes the old path.

Sufficiency — **delivers the owner-authorised V1 fix and portable-package stage in full.** It preserves current product behavior, removes only source-proven residue, measures OpenCV before replacement, and produces the one cleared product package that can move directly into `onemo-effects-engine` without prototype history or a throwaway intermediate copy. It does not mislabel later final-UI work, clean-repository population, Grid studio/order integration, or manufacturing regeneration as delivered.
