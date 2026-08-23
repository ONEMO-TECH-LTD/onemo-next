# V1 production-readiness audit ledger

## Current directive — 2026-08-08 17:16 BST

Read the actual final v1 code again and answer, without duplicating or interrupting Meta's wider audit:

1. Which SAM, EdgeSAM, Wand, and removed-tool remnants still exist, and which are reachable in the lab.
2. Which v1 paths bypass or rebuild the canonical v5.3.1 flow bridge.
3. Which v1 compositing work duplicates the existing engine compositor.
4. What changed around SAM/Wand removal, real OpenCV GrabCut, and the reported mobile u2net crash; distinguish source proof, historical claims, and hypotheses.
5. Whether v1 can be surgically polished, optimised, and de-slopped into the stronger production base, compared with rebuilding v2.

## Evidence and action boundaries

- Current source and relevant git history are the evidence. Compaction summaries and prior delivery claims are locators only.
- Dan's fresh phone test did not reproduce the crash. Therefore the old statement "u2net crashes v1" is not accepted as a current fact or root cause without stronger evidence.
- This is a read-only audit and product discussion. No build, runtime QA, product-source edit, commit, or Linear mutation is authorised in this pass.
- Do not message, steer, or interrupt `@s62-pixel-meta` while its independent wider audit is running.
- Record each bounded source/history block here immediately before beginning the next block.

## Existing durable findings carried forward

- The earlier full-source ledger already proves v1 has the stronger Frame interaction, real OpenCV GrabCut, and the tuned lab control ranges.
- It also proves v1 uses a 1024-pixel working source, has a lab-side history stack, and does not prove natural-dimension Save or Cutline export.
- Those completed findings will not be re-derived. This ledger adds the missing residue, bypass, compositor-duplication, and crash-history evidence requested now.

## Next unread block

Read the current lab shell and its direct flow/segmentation callers in full to determine which residue is reachable from v1. Start with `page.tsx`, `v531seg.ts`, and `flow.ts`; ledger before reading engine internals.

## Block 1 — current-tree and history inventory

### Provenance and preservation boundary

- v1 remains on branch `session62/sam-probe-tool` at `050d557e2ddbe99520c008e2090c202c554f03f8`.
- The only worktree changes are four untracked `output/playwright/s62-meta-v1-*.png` screenshots from the independent Meta lane. This audit will not modify or remove them.
- The tracked cutout add-on inventory contains `src/lib/cutout-grabcut/index.ts`; no tracked `src/lib/cutout-ai` or `src/lib/cutout-wand` implementation remains.
- Tracked detector assets are `u2netp.onnx`, `silueta.onnx`, and the ORT runtime files. No tracked EdgeSAM encoder/decoder asset remains.

### Residue candidates found in current code

- `src/lib/effect/ben-chain.ts:28-39,61-62` still defines a live `SAM.edgesam` model pair and routes an explicit `edgesam` key through EdgeSAM first, then u2netp and Silueta. This is executable engine residue, not a comment.
- `src/lib/effect/ben.worker.ts:337` still describes the active fallback loop as EdgeSAM → u2netp → Silueta; whether the EdgeSAM branch is reachable from the v1 lab depends on the page/segmentation caller trace next.
- `src/app/(dev)/cutout-lab/page.tsx:21-25` explicitly strips every `?seg` parameter on mount because an old `?seg=edgesam` URL could route into the deleted model. This is cleanup/adaptation logic necessitated by the retained shared engine route.
- `src/lib/effect/segment-ml.ts:36-39` still reads `?seg` from `window.location`; the reusable v5.3.1 creator still intentionally exposes the comparison harness through injected `segPresent` and the worker route.
- `src/app/(dev)/cutout-lab/ARCHITECTURE.md` contains extensive superseded EdgeSAM/Wand contracts and names deleted `cutout-ai`/`cutout-wand` modules as current architecture. It marks some clauses historical but still presents many stale module, memory, and acceptance claims. This is confirmed stale documentation; it is not executable residue.
- `next.config.ts:49` retains an OpenCV comment naming `cutout-wand v2`. OpenCV is still required by real GrabCut, so the configuration may be live while the ownership comment is stale; full config/dependency tracing remains required before disposition.
- Lab source contains historical EdgeSAM/Wand comments in `finish.ts`, `flow.ts`, `page.tsx`, `ui-config.ts`, and `v531seg.ts`. Comments alone are not deletion evidence; each owning implementation will be read before classification.

### Relevant history sequence

- EdgeSAM and Wand were implemented through many incremental commits, including a separate `cutout-ai` stack, OpenCV Wand, model-session warm/swap/fault handling, tool queue, and a custom lab flow bridge.
- `7c34a771` is the named pivot commit: “u2net-only + GrabCut brush; delete EdgeSAM + wand”. Later commits added bounded erase, standalone/refine GrabCut, Detect robustness, a 1024 source cap, stale-`?seg` removal/EdgeSAM-weight deletion, a broad de-slop pass, and finally a crash-survivor breadcrumb.
- Commit subjects make several historical root-cause claims—source cap “fixes iOS u2net OOM” and stale `?seg`/weights are “the real iOS dead-u2net root”. These are claims to audit against their diffs; they are not yet accepted as causal proof.

## Block 2a — full read of the current lab shell

- Fully read `src/app/(dev)/cutout-lab/page.tsx` (451 lines).
- On mount, the same effect constructs the current URL, synchronously removes `?seg` with `history.replaceState`, and only then calls `flow.actions.warmup()` (`:18-31`). This establishes the intended stale-tab protection for the lab warmup path.
- All user-triggered segmentation enters the flow surface: upload, Detect, GrabCut, Paint, edit, Save, history, and Clear call `flow.actions.*` (`:232-267,305-312,326-364`). The shell does not directly import `segmentML`, `ben-chain`, the worker, or OpenCV.
- The shell is not truly presentation-only despite its header claim. It owns the working viewport/bounds calculation, output drawing/clipping/scrim, live-bake placement, mask-overlay raster canvas, pointer-to-image coordinate mapping, brush/comet behavior, tool availability, and control adaptation (`:70-240,267-294`). That is substantial lab-specific adapter and interaction logic outside the canonical v5.3.1 UI, but it is not by itself proof of bridge or compositor duplication.
- The shell consumes `liveBake` from the flow for both edit and Preview (`:75-117`), while falling back to `drawCutout` when no live bake exists (`:84-86`). The fallback is a second output-rendering path and must be traced through `finish.ts` before classification.
- No SAM, EdgeSAM, or Wand implementation is imported from the shell. Its active brush surface is only GrabCut add/erase plus pure Paint add/erase (`:237-240,326-348`). Remaining Wand/EdgeSAM mentions here are comments explaining the retired route.
- Exact next file: fully read `v531seg.ts`, then ledger its segmentation boundary before reading `flow.ts`.

## Block 2b — full read of the lab segmentation adapter

- Fully read `src/app/(dev)/cutout-lab/v531seg.ts` (70 lines).
- v1 does reuse the canonical core segmentation primitive `runCutout` (`:6,44-54`); it does not reimplement u2net inference, ORT, or worker execution.
- It does not enter segmentation through the canonical `useTwoDFirstFlow` bridge. Instead, the lab owns a second adapter around the primitive: source decode/downscale to 1024 (`:10-30`), crash breadcrumbs (`:32-42,50-55`), and conversion of the returned ML matte into a separate y-down binary UI mask at lab dimensions (`:56-69`). This is a bridge bypass with partial canonical-core reuse—not a wholly independent detector.
- The 1024 cap happens before `runCutout`, while the lab's main upload is also separately prepared at working resolution in `flow.ts` (to read next). The cap may be a legitimate mobile guard, but its placement duplicates resolution policy outside the canonical flow and needs comparison with canonical `prepareShaped`/mask sizing.
- Crash breadcrumbs record the last entered stage across a hard reload. They identify a stage boundary only; they cannot prove OOM, the failing allocation, or causality.
- `segmentV531` returns both canonical `preseg` and a lab-only `Mask`. This split representation is central to the custom flow: engine preparation can consume the canonical result while lab tools consume an independently derived binary mask.
- Exact next file: fully read `flow.ts` in chunks, then ledger the lab orchestration and canonical-boundary calls before opening `finish.ts` or v5.3.1 internals.

## Block 2c — full read of the custom v1 lab flow

- Fully read `src/app/(dev)/cutout-lab/flow.ts` (565 lines).

### What it reuses

- Segmentation delegates through `segmentV531` and ultimately canonical `runCutout`; OpenCV GrabCut stays in its add-on; vector operations stay in `finish.ts`/`vector-edit`; performance marks reuse v5.3.1 `PerfHUD` (`:16-29,297-322,350-403,405-473`).
- Native u2net output is passed as `preseg` into `prepareNative`; non-native Mask tools pass through `prepareAI` (`:219-270`). The exact engine preparation boundary remains to be read in `finish.ts` and canonical primitives.

### What it rebuilds outside the canonical v5.3.1 flow

- The file explicitly says `flows/flow-contract.ts` is only a pattern and “not an import” (`:3-10`). `useCutoutLabFlow` is a separate 565-line state/action bridge, not a configuration of `useTwoDFirstFlow`.
- It independently owns lab state, prepared/artwork/mask/shape representations, a custom snapshot type and `HistoryStack`, bake scheduling/cancellation, display/full resolution policy, auto-blend policy, model/tool orchestration, a latest-wins tool queue, edit re-preparation, Save/Preview, warmup, and status text (`:68-187,189-270,272-563`).
- The custom history snapshots clone whole pixel masks, including optional soft arrays, up to depth 30 (`:38,102-110`). Canonical AppSnap was previously proven lightweight. This is both duplicate transaction ownership and avoidable mobile memory pressure.
- Display/full scheduling creates and caches downscaled `PreparedEffect.frontSrc` canvases and calls `bakeStickerEngine` itself (`:112-187`). “Full” selects the already-prepared source (`:157`), whose lab artwork/geometry is still working-resolution; it does not recover the original natural dimensions.
- The flow has separate preview state from the shell (`:128,509-516`), another example of duplicated state ownership.

### Production-correctness risks visible in this file

- Upload resets the current refs but does not clear the history stack, cancel a pending Detect/tool/edit-prepare/bake, or issue a lab-wide generation token (`:273-295`). Old async work can therefore publish into a newer upload or after Clear.
- Clear removes current refs but does not cancel those in-flight operations or timers (`:494-500`). The bake has its own generation, and edit preparation has another generation, but there is no single intent token fencing all state/status publication.
- The “nothing is ever dropped” queue claim is false: while busy it holds one `pendingToolRef`, and every later input overwrites that closure (`:334-349`). It serializes at most the current operation plus the latest pending operation; intermediate edits are silently lost.
- `fullBakeWaiters` contains resolve-only callbacks. A cancelled or failed full bake leaves them pending until the caller's timeout, and the stale callbacks remain in the array for a later full bake (`:130,166-170,502-526`).
- Failed upload decode revokes the new URL but leaves `urlRef` pointing at it and does not reset `hasImage`/`imgCanvas`; the previous image can remain visible with an invalid active URL (`:273-293`).
- `lastFileRef` is assigned on upload but has no consumer in this fully read file (`:93,274`); repository trace is still required before a kill verdict.
- The flow schedules the bake after every accepted mask and every resolved vector change regardless of Blend value (`:214,263`). Whether Blend 0 still calls the engine compositor is determined by `bakeStickerEngine` in `finish.ts` next.

### Crash relevance

- Detect itself starts only one u2net call and catches surviving JS errors (`:297-322`). Real GrabCut/OpenCV is imported only from the brush path and invoked only in `grabCutStroke` (`:16,350-378`), so merely adding the lazy GrabCut module cannot explain a Detect crash unless the OpenCV chunk is loaded elsewhere or a prior first stroke left its heap resident.
- v1 holds multiple large representations after Detect: the 1024 artwork canvas, the binary lab mask, canonical preseg, prepared front canvases, live bake, optional display shims, plus whole-mask history snapshots. This establishes plausible aggregate memory pressure; it does not isolate the old crash.

### Next unread block

Fully read `finish.ts` to map custom preparation/compositing against canonical engine primitives and `composite.ts`; ledger before opening the canonical bridge files.

## Block 3a — full read of v1 finishing/compositing glue

- Fully read `src/app/(dev)/cutout-lab/finish.ts` (383 lines).

### Canonical reuse

- Vector resolution uses canonical v5.3.1 `resolveTraceOutline`; preparation uses the shared `prepareEffect`; native segmentation passes the unchanged `MLResult`; final colour/blur compositing calls the existing `composeEffectArtwork` operation (`:5-19,91-111,224-256,348-357`).
- Therefore v1 did not replace u2net inference, outline resolution, or the engine's inner blur/subject compositor wholesale.

### Parallel glue and duplicated compositor responsibilities

- The lab calls `prepareEffect` directly with its own `LAB_CFG` instead of calling a canonical flow action (`:213-234`). For non-native Paint/GrabCut masks it also builds a synthetic ML result through a module-global decode/canvas cache and `matteToMLResult` (`:158-211`). This is a useful add-on seam implemented outside the canonical flow, not an exact bridge reuse.
- `bakeStickerEngine` is a 119-line lab compositor wrapper (`:265-383`). Around `composeEffectArtwork` it owns artwork transform, subject transform, outgrowth decisions, the neutral fast path, mirror-mosaic generation, blur-pad sizing, output-bounds construction, coordinate registration, y-flip, vector clipping, and crop. The inner compositor is reused, but frame/fill/registration/output policy is duplicated or overridden in lab code.
- `transformArtwork` and `mirrorMosaicRegion` are lab-owned pixel operations (`:115-150`). The mirror mode exists only in this wrapper; the shared compositor already owns Clamp/Tile fill. Whether the remaining pad/registration/crop duplicates shared capabilities is decided by the full `composite.ts` comparison next.
- Blend 0 is not a universal no-compositor path. For a matteless fallback, the code forces Blend to 0 but excludes it from the neutral shortcut, so it still calls `composeEffectArtwork` even when the outline is inside the frame (`:281-309,291-297,347-357`).
- `drawCutout` is a second preview renderer and paints a checkerboard into the output canvas before clipping the raw image (`:58-70`). When used as the page's no-live-bake fallback, Preview is not actually transparent despite the shell's “pure cutout on transparency” claim.

### Memory/cleanup observations

- `buildPreseg` retains a module-global decoded source plus matte, alpha canvas, and ImageData cache keyed by URL (`:164-210`). It avoids per-stroke allocation but survives Clear and retains the previous upload until another non-native mask path replaces it.
- Every composed result also allocates transformed artwork/subject canvases as needed, optional mirror region canvases, engine output, a flipped canvas, a clipped canvas, and the final cropped canvas (`:117-150,314-382`). Cooperative cancellation drops later stages but cannot abort a draw already underway (`:269-273`). This is a credible memory-optimisation target on mobile.
- The lab comment says mirror is the default while `BLEND_DEFAULTS.fill` is Clamp (`:85,283-287`); this is stale documentation inside executable code.

### Next unread block

Fully read `src/lib/effect/composite.ts` and compare its exact ownership with `bakeStickerEngine`; immediately ledger the proven KEEP/COLLAPSE/KILL boundary before reading canonical primitives/flows.

## Block 3b — full engine-compositor comparison

- Fully read `src/lib/effect/composite.ts` (350 lines) and compared it with v1 `finish.ts:265-383`.

### Proven ownership overlap

- The shared engine operation already owns integer output-frame resolution, Clamp/Tile fill plans, filled-frame rasterization, physical blur, subject registration inside the expanded frame, colour effects, and the returned frame origin/size (`composite.ts:93-181,290-335`).
- V1's wrapper independently computes a padded requested frame, mirror-region coordinate system, output registration, flip origin, clipping origin, and final crop (`finish.ts:310-382`) before/after handing another frame to the shared operation. This is the duplicated compositor perimeter Dan suspected.
- The wrapper is not a complete second blur compositor: the cross-browser SVG blur, sharp-subject placement, tint, vignette, and preset bake still happen once inside `composeEffectArtwork` (`composite.ts:295-334`). The accurate description is “one canonical inner compositor wrapped by a second lab-owned frame/output compositor.”

### Disposition from current code

- **KEEP:** the shared `composeEffectArtwork`, its Clamp/Tile fill implementation, cross-browser SVG filtering, physical blend conversion, subject registration, and tests.
- **COLLAPSE into the shared operation:** blur-falloff padding and crop, resolved frame/origin, and the output registration needed to return the clipped cutout. Those responsibilities currently straddle both layers and cause extra canvases/coordinate conversions.
- **KEEP as thin bridge policy:** deciding when Blend is neutral, when outgrowth should commit a visible non-zero Blend value, and converting the resolved vector path/bounds into the engine request.
- **Product-choice dependent:** mirror fill and artwork scale/pan. Mirror is a custom pixel implementation outside the canonical fill engine; if Clamp remains the production rule, mirror and its mosaic path should die rather than be preserved as a second fill system. Scale/pan are absent from the current v1 surface despite still existing in `BlendSettings`, so their use trace is required.
- **KILL after cutover:** the checkerboard `drawCutout` fallback as a production Preview path. It contradicts transparency and is a second visual-output implementation.

### Next unread block

Fully read canonical `core/primitives.ts`, `flows/flow-contract.ts`, and `flows/twoDFirstFlow.ts` to establish what v1 could have configured/reused and what genuinely required a lab add-on. Ledger that bridge comparison before reading transactions.

## Block 4a — full canonical primitive read

- Fully read `src/app/(dev)/effect-creator/v5.3.1/core/primitives.ts` (108 lines).
- Canonical primitives are deliberately flow-blind single operations. They do not own history, sequencing, cache, notifications, or product cadence (`:3-18`). Those responsibilities belong to a flow and transaction services, so v1 did legitimately need lab-specific composition/policy somewhere.
- `runCutout` already chooses canonical mask/texture dimensions and delegates to `segmentML` (`:47-59`). V1's extra 1024 `cutSource` cap protects the worker's initial source decode, a concern not handled by this primitive's caller-visible interface. The need may be real; its placement outside the primitive/flow is the architectural debt.
- Canonical `prepareShaped` supplies the standard engine config and optional preseg (`:61-75`). V1 bypasses it because its lab contract changes `paddingMM` to 0. That is one configuration difference, not justification for replacing the whole flow.
- The primitive module directly re-exports `composeEffectArtwork` (`:27-28`). V1 could call it through the canonical perimeter; its duplicate frame/output wrapper remains the issue.
- Exact next file: fully read `flows/flow-contract.ts` and ledger the reusable surface before `twoDFirstFlow.ts`.

## Block 4b — full canonical flow-contract read

- Fully read `src/app/(dev)/effect-creator/v5.3.1/flows/flow-contract.ts` (82 lines).
- The canonical file explicitly says `CreatorFlow` is descriptive, not a mandatory common interface, and that a second flow may diverge with its own `{state, actions}` surface (`:3-19`). Therefore “v1 has a different flow surface” is not itself a defect or proof of slop.
- The real architectural invariant is the layer boundary: UI binds only to a flow `{state, actions}`, while engine operations remain stateless primitives (`:11-19,32-39`). V1 mostly respects this for user actions, although its page still contains substantial viewport/output policy and the flow bypasses shared transaction services.
- The original `CreatorFlow` surface lacks Paint, GrabCut, frame/node tools, display/full bake scheduling, and lab-specific state (`:43-76`). A distinct lab flow was reasonable. The audit question is whether it composed existing primitives/services cleanly and added only those missing modules—not whether it matched this interface byte-for-byte.
- Exact next file: fully read `flows/twoDFirstFlow.ts` and compare service composition, async fencing, and canonical state ownership with v1 `flow.ts`.

## Block 4c — full canonical 2D-first flow comparison

- Fully read `src/app/(dev)/effect-creator/v5.3.1/flows/twoDFirstFlow.ts` (249 lines).
- The canonical pattern for a new product pipeline is a sibling compose-function that re-sequences the same primitives and shared transaction/viewer services (`:3-24,26-35`). This supports a separate v1 lab flow while showing what it should have reused.
- `twoDFirstFlow` composes `useHistoryTransaction`, `useGenerationTask`, and `useSessions` (`:71-80`). Its Magic result is fenced by a generation run id on both success and failure (`:180-219`); its first-blur result rechecks current generation and live state immediately before publication (`:131-178`). V1 instead rebuilt history and used separate local generation counters for only some operations, leaving no global intent fence.
- Canonical flow history is coupled to registered generations and lightweight snapshots; v1's whole-mask `HistoryStack` is not required by the sibling-flow pattern.
- Canonical `?seg` behavior is injected by the page and only controls the harness (`:45-46,135-178`). V1's lab-local removal of `?seg` is a reasonable production adapter decision; deleting the entire shared comparison harness is a separate scope decision.
- Canonical code is not automatically defect-free: its upload-time `prepareStandard(url).then(...)` is not guarded by `useGenerationTask` before publishing (`:93-129`). Therefore v1 should adopt the transaction/generation services and their principles, but production hardening still requires auditing every async publication rather than copying the flow blindly.
- **Bridge verdict so far:** creating a new v1 lab flow was reasonable because the UI and tools diverged. Calling it the “true v5.3.1 bridge” was inaccurate. It is a sibling flow that reused primitives but duplicated shared transaction/scheduler/output responsibilities and kept too much pixel policy in lab glue.

### Next unread block

Fully read `core/transactions.ts` to compare canonical snapshot/generation semantics with v1. Then run tracked-tree use traces for v1 flow/finish residue before starting crash-history diffs.

## Block 4d — full canonical transaction-service comparison

- Fully read `src/app/(dev)/effect-creator/v5.3.1/core/transactions.ts` (408 lines).
- The canonical service stores lightweight recipes/state and keeps heavy prepared generations in a bounded six-entry LRU; it explicitly forbids canvas snapshots (`:3-16,30-58,88-178`). V1's 30 copied full-mask snapshots bypass this existing mobile-memory design.
- It provides the reusable pieces v1 recreated incompletely: baseline reset on upload, restore-before-stack-mutation, generation cancellation, stale upload publication guards checked immediately before mutation, bounded segmentation cache, and session-scoped history (`:173-280,283-314,350-408`).
- V1 could not adopt `AppSnap` unchanged: the canonical snapshot has no Paint/GrabCut mask recipe, and exact tool undo must preserve the subject matte—not merely the resolved vector (`:39-58`). A correct lab extension must add a bounded/re-derivable tool-state representation rather than either copying whole masks 30 times or pretending the current AppSnap is already sufficient.
- The existing `useGenerationTask` is a single monotonic token (`:283-290`) and `useUploadPublish` demonstrates publication-time rechecks across async gaps (`:293-314`). V1's separate bake/edit counters should converge on this pattern through a lab transaction extension.
- **Bridge conclusion:** v1's new sibling flow was justified; rebuilding transaction/history/generation services instead of extending these canonical services was not.

### Next unread block

Run complete tracked-tree import/re-export/string traces for current v1 residue and suspected dead fields/functions, including EdgeSAM route, `lastFileRef`, scale/pan/mirror, `drawCutout`, custom history, crash breadcrumbs, and OpenCV configuration. Record reachability/dispositions before git-history diffs.

## Block 5 — re-export-aware current-tree residue trace

### Method

- Ran complete tracked-tree symbol, import, dynamic-import, documentation, asset, and `git ls-files` traces without truncation.
- Fully read the 16-line `ui-config.ts` and 77-line `next.config.ts` because they determine control reachability and the OpenCV bundling configuration.

### Reachable executable residue

- **EdgeSAM engine path:** `ben-chain.ts` still exports the SAM types/helpers/config and `SAM.edgesam`; `ben.worker.ts` imports and executes the SAM-specific encoder/decoder path. This is a real shared-engine branch, not dead declarations. It remains reachable from creator/comparison URLs that pass `?seg=edgesam`.
- **V1 lab reachability:** the lab page synchronously deletes `?seg` before calling warmup, and its UI has no other model selector. On the normal mounted v1 lab path, EdgeSAM is not user-reachable. The retained engine branch is still code/maintenance surface and a stale URL can initiate failed EdgeSAM fetches anywhere the comparison harness remains exposed.
- **Missing runtime assets:** no EdgeSAM weights are tracked; only u2netp and Silueta are present. Explicit EdgeSAM routing therefore points at absent local files before falling through to the production models.
- **OpenCV:** `@techstark/opencv-js` is imported only by `cutout-grabcut/index.ts` and is a declared dependency. The browser `fs/path/crypto` fallbacks in `next.config.ts:49-53` remain necessary for that package. Only the ownership comment “cutout-wand v2” is stale; the configuration itself is not Wand trash.
- **Crash breadcrumbs and custom history:** both are live and imported only by the v1 lab. Their production value must be judged separately; they are not dead residue.
- **Mirror and checkerboard fallback:** both are live through the v1 page. They are duplicate/custom behavior, not cemetery code.

### Proven dead or dormant v1 lab code

- **KILL:** `lastFileRef` is declared and assigned only in `flow.ts`; no read, export, re-export, dynamic, or string consumer exists.
- **KILL/COLLAPSE:** `BlendSettings` retains preset, vignette, tint, scale, panX, and panY, but `BLEND_CHIPS` exposes only Blend and the page separately exposes only fill. No caller can change those retained fields from their defaults. Remove the dormant fields and `transformArtwork` path from the lab bridge unless the product deliberately restores those controls.
- **KILL:** `CHIP_RANGE` retains unreachable straighten, generic curve, vignette, scale, panX, and panY entries. It is imported only by the page and those keys are not selected by any current chip.
- **STALE DOCS:** the extensive pre-pivot EdgeSAM/Wand clauses and deleted-module map in lab `ARCHITECTURE.md`, plus the Wand ownership comment in `next.config.ts`, need correction in the same cleanup as their owning code.

### Keep/collapse boundary

- Keep real GrabCut and the OpenCV dependency until a measured lighter real-GrabCut package is proven; deleting the dependency because it once powered Wand would remove the current working brush.
- Keep lab-specific tools and interaction logic; collapse their transactions, generation fencing, and compositor frame/output work onto canonical services.
- EdgeSAM code can be deleted only after confirming the comparison harness no longer requires it. The current lab does not require it; the shared creator harness is the remaining consumer surface.

### Next unread block

Fully read current `ben-chain.ts`, `ben.worker.ts`, and `segment-ml.ts` to trace EdgeSAM/u2net memory and routing precisely. Then diff the pivot/crash commits.

## Block 6a — full detector-chain read

- Fully read `src/lib/effect/ben-chain.ts` (89 lines).
- EdgeSAM residue is a complete executable unit: spec type, branch guard, 1024 encoder/decoder config, candidate thresholds, seven prompts, and logits-to-soft-probability processing (`:24-52,71-89`). It is not just a roster string.
- The default no-parameter path is u2netp followed by Silueta, not u2netp alone (`:54-65`). If u2netp throws or yields a degenerate matte, the worker may load the 44MB Silueta fallback. A crash labelled “u2net” by the UI therefore was not necessarily produced by u2netp itself.
- An explicit `edgesam` route runs the missing EdgeSAM weights first and then both production models (`:60-64`). An unknown or old transformers key returns `null` and can route to BEN2 in the worker. The lab's all-`?seg` stripping is therefore a material safety adapter, not cosmetic URL cleanup.
- The retained EdgeSAM branch adds code and a dangerous stale-route surface but not tracked model bytes. Removing it will simplify worker logic; the larger mobile memory risk in the current default is the silent Silueta fallback after a u2netp failure.
- Exact next file: fully read `ben.worker.ts` to verify session lifetime, fallback cleanup, allocation sequence, and whether a failed model is disposed before the next one.

## Block 6b — full worker read

- Fully read `src/lib/effect/ben.worker.ts` (362 lines).

### Session and fallback truth

- Raw ONNX sessions are cached in a module-global `rembgSessions` map for the worker lifetime (`:113-127`). There is no session disposal or eviction on success. A u2netp failure followed by Silueta therefore leaves the u2netp session resident while loading/running Silueta.
- The preload path is not “download-only” for raw ONNX despite comments in the lab flow. It calls `getRembgSession`, which fetches weights and creates an ORT inference session (`:113-127,279-299`). Page-open warmup therefore makes u2netp runtime/session memory resident before Detect.
- A stale EdgeSAM preload creates at least its encoder session when assets exist; a Detect can then add the decoder and, on failure, u2netp and Silueta (`:199-269,288-299,322-340`). That is the old stack-risk pattern still present in code.
- Current missing EdgeSAM assets make its session creation fail and remove the rejected cache entry (`:113-125`), then the chain continues. The code does not check HTTP status before passing response bytes to ORT (`:120-121`), so a 404 becomes a model-create failure rather than a clean unavailable-route rejection.

### Failure cleanup and peak-memory risks

- The timeout helper uses `Promise.race` and does not cancel fetch, bitmap decode, or ONNX inference (`:129-131`). After a timeout the underlying operation may continue while the chain begins the next model, allowing overlapping work and memory.
- `ImageBitmap` is closed only inside the successful `finishMatte` tail, plus one explicit no-valid-SAM-candidate branch (`:171-197,258`). If preprocessing, encoder/decoder, or inference throws earlier, the bitmap is not closed before fallback.
- Successful matte construction temporarily holds model input/output, multiple full-size OffscreenCanvas/ImageData buffers, alpha and RGB readbacks, and a new RGBA transfer buffer (`:132-197`). V1's 1024 source cap lowers these from the worker's 1536 maximum, but does not remove the peak.
- The worker silently swallows each model error until the chain is exhausted (`:322-340`). UI status says “u2net” and success reports only the winning adapter; failure gives only the last error. Historical device observations therefore cannot identify whether u2netp, Silueta fallback, stale EdgeSAM, or overlapping timeout work caused the reload.

### Residue disposition

- The EdgeSAM runner and helpers are still fully integrated into preload and inference; remove them from the production worker if the comparison harness no longer needs EdgeSAM.
- Production u2netp-only means removing the automatic Silueta fallback, not just stripping `?seg`. If explicit comparison remains, its sessions must be isolated/terminated rather than accumulated in the production worker.
- Regardless of base choice, worker hardening needs abort/termination semantics at the caller boundary or a fresh-worker-per-run/fault policy, plus `ImageBitmap` cleanup in `finally`. A timeout without cancellation is not production-safe mobile behavior.

### Next unread block

Fully read `segment-ml.ts` to determine worker lifetime, request correlation, warmup semantics, URL routing, and whether termination exists above the worker.

## Block 6c — full main-thread segmentation adapter read

- Fully read `src/lib/effect/segment-ml.ts` (188 lines).
- The adapter owns one module-global worker and a pending-request map (`:42-90`). It terminates and rejects all pending calls only on a worker error or the 120-second watchdog (`:58-102`). It exports no cancel/terminate/supersede action for Upload, Clear, or a new Detect.
- The lab's 180-second wrapper does not add cancellation; the adapter's 120-second watchdog will normally fire first. Within the worker, however, each 60-second `Promise.race` can already fall through to another model while the timed-out inference continues. Only the later outer reset terminates the worker.
- `preloadBen` creates the worker and requests preload but its own timeout merely removes the pending entry; it does not terminate a hung preload (`:108-118`). Combined with the worker read, warmup initializes a persistent u2netp ORT session rather than only populating HTTP cache.
- Model selection is read from the live browser URL at every preload/inference call (`:36-40,104,117`). The v1 page's `replaceState` before warmup is therefore effective on the normal lab path.
- After the worker transfers its full RGBA matte, the main thread allocates another source canvas/ImageData, then two rasterized results and masks for contour and texture (`:120-184`). V1 then derives another y-down UI mask and prepares additional front canvases. This confirms stacked representation cost around Detect even with the 1024 source cap.
- Successful results retain the true adapter id (`:164-183`), but the active Detect label says u2net before success. The adapter's legacy comments/default identity still say BEN2 (`:36-44,132-168,186-188`); this is stale naming, not current routing.

### Crash conclusion at current-source stage

- Current code contains credible intermittent mobile-crash mechanisms: persistent warm u2netp session, automatic fallback session stacking, uncancelled timed-out work, incomplete worker-side bitmap cleanup, and several main-thread matte/canvas copies.
- OpenCV is not loaded by Detect. It can contribute only after the first GrabCut stroke because the module import is lazy; a clean page-open → Upload → Detect crash cannot be caused by resident OpenCV from this code path.
- No single mechanism is yet the historical root cause. Git diffs must show which were present before/after the pivot and claimed fixes.

### Next unread block

Inspect the exact diffs for the pivot and subsequent crash-related commits: `7c34a771`, `366f3a34`, `25d7402a`, `10da8c1b`, `3e1c55b4`, `a1c1d231`, and `050d557e`. Record each change sequence before drawing causality.

## Block 7a — full u2net/GrabCut pivot diff

- Fully read all 1,884 lines of commit `7c34a771` in sequence.

### What the pivot actually removed

- It deleted the complete lab-specific `src/lib/cutout-ai` worker/client/model/runtime/brush stack and `src/lib/cutout-wand`, removed their UI/flow state, lifecycle, driver switching, model selection, fault handling, and mask-normalisation helpers.
- It moved neutral Mask/Point types into `mask-tools/types.ts`, added the lazy real OpenCV GrabCut module, made u2net the lab default, and set Blend to 0.
- The current claim that deleted SAM/Wand implementations still remain in those folders is false: those implementations were genuinely deleted in this commit.

### What it falsely left behind

- The commit said “delete EdgeSAM completely” and “engine perimeter byte-untouched” at the same time. Because it did not edit `ben-chain.ts` or `ben.worker.ts`, the shared engine's complete EdgeSAM roster/runner remained, along with its weight URLs and SAM helpers. The weights themselves also remained until `3e1c55b4`.
- The lab architecture document was not rewritten in this pivot; later it gained a supersession note but retained the old contracts. This created today's mixed current/historical document.
- The pivot retained its custom flow/history/scheduler/compositor architecture and even retained `lastFileRef`/Re-detect machinery. It was a tool/model pivot, not a clean bridge reset.

### Why the timing can look like “GrabCut broke u2net”

- GrabCut remained lazy and was reachable only after a brush stroke. The pivot did not import/initialise OpenCV during page open, upload, or automatic u2net detection.
- The pivot changed the default user journey from EdgeSAM to u2net and immediately ran `segmentV531` on the original object URL. At that point the main display image was capped, but the worker still fetched and decoded the original phone photo before its internal post-decode cap. This exposed the pre-existing full-source decode/OOM risk on every normal upload.
- Before the pivot, that u2net path was optional/fallback; after the pivot it became the default. Therefore the strongest source-based explanation for the new timing is “the pivot exposed an existing u2net input-path memory bug,” not “adding GrabCut made u2net heavier.”
- The pivot also retained page-open `preloadBen`, which actually created the persistent u2net session. That combined with full-source decode and main-thread matte copies; it still did not load OpenCV before a stroke.

### Next unread block

Fully read commit `79558eb3` and `366f3a34` diffs to determine whether GrabCut later became reachable before Detect or changed upload/detection timing. Ledger before the robustness/OOM commits.

## Block 7b — full GrabCut erase-bound diff

- Fully read all 128 lines of commit `79558eb3`.
- It changed only post-stroke GrabCut behavior: preserve the base outside a 2.5× brush/24px corridor, add area/no-op guards, and rename the synthetic adapter label from EdgeSAM to `brushed`.
- It did not change upload, warmup, worker routing, model sessions, or Detect. It cannot explain a clean Detect crash before any GrabCut stroke.
- The reintroduced `maskArea` helper is general live logic, not SAM residue. The corridor/no-destroy behavior is a keeper for production GrabCut.
- Exact next file: fully read commit `366f3a34` to see when GrabCut became standalone and Detect became manual.

## Block 7c — full standalone-GrabCut/manual-Detect diff

- Fully read all 420 lines of commit `366f3a34`.
- It stopped automatic detection on upload and moved u2net to a Detect button. It also removed the visible model selector and lab URL adapter, while preserving page-open warmup.
- It made GrabCut standalone: after Upload, Add can load OpenCV and create a selection before any u2net call. Therefore two sequences must be distinguished:
  - clean Upload → Detect: OpenCV is not loaded and cannot explain the crash;
  - Upload → GrabCut stroke → Detect: OpenCV's non-disposable Emscripten heap remains resident while u2net runs and can add aggregate memory pressure.
- The commit removed the last lab code that managed `?seg` but did not delete an already-present parameter. Because `segmentML` still read the live URL, a pre-pivot `?seg=edgesam` tab silently continued routing warmup/Detect into the shared EdgeSAM chain despite the new u2net-only UI. This is the precise stale-route regression later addressed by `3e1c55b4`.
- It retained `lastFileRef`, `redetect`, `hasFile`, and Re-detect. It did not change worker sessions, timeout cancellation, or source-decode memory.
- Moving Detect to a button made the crash easier to attribute to the button press, but the actual path could still include warmup state, stale URL routing, prior GrabCut/OpenCV state, and full-source decode.

### Next unread block

Fully read `25d7402a` and `10da8c1b` diffs in order to see what was tried and what the first concrete OOM mitigation changed.

## Block 7d — full Detect-retry diff

- Fully read all 84 lines of commit `25d7402a`.
- The commit message explicitly says the iOS root cause was still unknown and not reproducible headlessly. Its “robustness” change was one same-worker retry plus a loud final message; it was not a diagnosed fix.
- Because the shared worker caches sessions and inner timeouts do not cancel underlying work, retrying in the same worker can repeat allocations or overlap with timed-out work. This was a plausible worsening under memory pressure, not reliable hardening.
- Removing the Re-detect UI left `lastFileRef`/`hasFile` in the flow. Later cleanup removed `hasFile` from the returned state but still missed `lastFileRef`, producing the current dead residue.
- Exact next commit: fully read `10da8c1b`, the source-cap change.

## Block 7e — full source-cap/OOM diff

- Fully read all 109 lines of commit `10da8c1b`.
- This is the first strong historical evidence: Dan's device console reported `[wasm] RangeError: Out of memory` followed by no available backend. The commit explicitly removed the same-worker retry and capped the URL passed into the worker to 1024 before `runCutout`.
- The source change matches the current worker: before the cap, `createImageBitmap` decoded the original phone photo before the worker's 1536 post-decode cap. Making u2net the default exposed that allocation path.
- This supports a real root cause for the earlier “loader flashes, no outline” failure class. It does not prove every later hard reload had the same cause.
- The fix is effective but not cleanly placed or fully safe:
  - Upload already decodes and downsizes the original into a 1024 working canvas; `cutSource` decodes the original again and creates another canvas/PNG blob instead of reusing that prepared working source.
  - If main-thread decode fails, it returns the original full-size URL and bypasses the guard—the exact unsafe fallback for an OOM-sensitive path.
  - It reduces worker input quality/resolution globally to 1024 and leaves source-resolution policy in lab glue instead of one bridge-owned preparation result.
- Production v1 should retain the bounded-input principle but remove the duplicate decode and fail loud rather than silently fall back to the unsafe original.

### Next unread block

Fully read `3e1c55b4` to establish the stale-route/weight deletion change, then `a1c1d231` and `050d557e` to see whether crashes persisted after both fixes.

## Block 7f — full stale-route/weight deletion diff

- Fully read all 57 lines of commit `3e1c55b4`.
- The stale-route bug was real and reproduced: pre-pivot tabs carried `?seg=edgesam`; after the UI selector/writer was removed, `segmentML` still read it. The commit added the current all-`?seg` strip before warmup and deleted both tracked EdgeSAM weights.
- The commit's “single-model override with no fallback” claim does not match the unchanged `ben-chain.ts`, which routes EdgeSAM followed by u2netp and Silueta. The memory risk was worse in a different way: a successful/resident EdgeSAM session could be followed by additional fallback sessions if it failed or yielded a degenerate matte.
- Calling this “the real root” overstates it. Evidence now supports at least two real failure configurations:
  1. uncapped original photo entering the u2net worker produced a device-observed WASM OOM;
  2. stale `?seg=edgesam` caused the supposedly u2net-only lab to load/run EdgeSAM and was reproduced on deploy.
- Deleting weights without deleting the shared roster/runner made deletion incomplete. The current lab route is protected, but the executable EdgeSAM path and stale code remain.
- The commit's manufacturing note that Save remained full-resolution is also false against current source: preparation and lab Save operate on capped prepared/working canvases.

### Next unread block

Fully read `a1c1d231` and then `050d557e` to determine what was cleaned and whether hard crashes were still observed after both source-cap and stale-route fixes.

## Block 7g — full claimed de-slop diff

- Fully read all 541 lines of commit `a1c1d231`.
- It made useful surgical corrections: removed unused imports/exports/UI fields, moved node-delta policy into the flow, fixed drawn-state history restore preparation, stopped overwriting precise Detect errors, and simplified mask raster reuse.
- It was not a whole-v1 de-slop:
  - It removed `hasFile` from the returned surface but left `lastFileRef` declared and assigned, creating the current dead field.
  - It did not address the separate full-mask history, missing global async fence, one-slot dropping tool queue, full-bake waiter leak, duplicate decode, dormant Blend fields/ranges, checkerboard Preview fallback, lab frame/output compositor, or stale architecture document.
  - It did not remove the shared EdgeSAM roster/runner.
- The commit again claimed “full-res manufacturing subject” and a clean engine perimeter. Current source disproves the first, while the second meant only that the shared engine was unchanged—not that it contained no retired EdgeSAM code or duplicated lab output ownership.
- This commit did not change the worker or crash mitigations. The final breadcrumb commit next proves whether a hard reload was still being investigated afterward.

### Next unread block

Fully read `050d557e`, then inspect any intervening path history not yet covered and build the chronological crash verdict.

## Block 7h — full final breadcrumb diff

- Fully read all 107 lines of final v1 commit `050d557e`.
- This commit proves the hard iOS reload was still observed after the 1024 cut-source cap, stale-`?seg` stripping, EdgeSAM-weight deletion, and claimed de-slop. Those changes fixed real failure configurations but did not establish universal stability.
- It added only four broad localStorage stage stamps and a next-load status reader. It explicitly says “measurement, not a fix.” There is no later v1 commit recording which stage survived or applying a final root-cause repair.
- The breadcrumb can separate decode, worker cut, UI-mask conversion, and prepare/bake boundaries, but it cannot identify the exact allocation or prove every hard reload is OOM.
- Dan's successful phone retest today means the hard reload is currently intermittent/non-reproduced. The accurate state is:
  - proven historical failure class: original-source worker decode caused a WASM OOM;
  - proven historical routing bug: stale EdgeSAM URL loaded the retired model;
  - proven later observation: a hard reload still occurred after both fixes;
  - unknown: exact cause of that later reload and whether it remains reproducible under a defined sequence.

### Next unread block

Search the exact Session 62 transcript vault for any recorded breadcrumb stage/result after this commit. Then inspect current history/test coverage needed to classify the remaining production work.

## Block 7i — exact transcript result for the final crash breadcrumb

- Searched the complete S62 lead transcript tree for the four stored stage labels, the rendered warning text, `breadcrumb`, and hard-crash wording, then read the full bounded conversation around the diagnostic deployment and its aftermath in the 2026-08-07 lead segment.
- The transcript records Dan reporting that Detect crashed and reloaded Safari, the lead deploying the four-stage breadcrumb, and the lead asking Dan to return one of `decode-source`, `engine-cut`, `derive-ui-mask`, or `prepare+bake`. No returned stage value appears anywhere in the searched S62 lead transcript tree. The accurate claim is therefore: **no breadcrumb result is recorded in the searched Session 62 lead transcripts**, not that the breadcrumb could never have produced one elsewhere.
- Meta then proposed triple full-image decode as the crash cause from source inspection. The lead initially accepted it and built an uncommitted capped-source change. Dan showed the actual test image was 1856×2464 and 5.5 MB; the lead explicitly retracted the causal theory because the decoded image size did not justify the claimed iPhone OOM story and discarded the change.
- The multiple original-image decodes remain a real avoidable allocation/latency issue in current v1, but the transcript does **not** prove they caused the later hard reload. They must be classified as production optimisation/hardening, not as the closed crash root cause.
- Combined verdict: the earlier device-console WASM OOM and stale EdgeSAM route are proven historical failure classes; the later post-fix hard reload has no recorded stage and no proven root; today's successful phone retest means it is not currently reproducible.

### Next unread block

Read the current history implementation and detector/lab test coverage, then fully read the stale architecture document before writing the KEEP/COLLAPSE/KILL production disposition and product-language recommendation.

## Block 8a — current history and test-coverage read

- Fully read `cutout-lab/history.ts`, `effect/__tests__/ben-chain.test.ts`, and `effect/__tests__/segment-ml.test.ts`, and ran a tracked test-file inventory for the lab, GrabCut add-on, v5.3.1 flow/core, and effect engine.
- `HistoryStack` itself is a small generic cursor/branch stack, but it has no `clear`/baseline-replacement action. The mobile cost comes from v1's caller cloning full masks into up to 30 snapshots; the stack cannot independently enforce a re-derivable or bounded-byte representation.
- There are no tracked tests under `cutout-lab` and no tracked tests under `cutout-grabcut`. Current lab flow races, history replacement, dropped brush inputs, failed-upload state, full-bake waiters, real GrabCut corridor behavior, and Preview/Save output therefore have no direct regression coverage.
- The detector-chain test explicitly enshrines the default `u2netp → silueta` fallback. It tests explicit u2net/silueta comparison routing but does not test the retained EdgeSAM route or missing-weight behavior. Its “production trio” naming is stale against the asserted two-model default.
- The worker-lifecycle test proves only that the outer 120-second watchdog terminates the global worker and the next request creates a new one. It does not cover the worker's inner 60-second non-cancelling timeouts, session stacking, cleanup on per-model failure, warmup timeout, or Upload/Clear cancellation.
- Existing compositor and canonical transaction tests are keepers, but they do not cover the additional lab wrapper/flow perimeter. Production cleanup needs tests at the removed/extended seams rather than another parallel harness.

### Next unread block

Fully read all 359 lines of the current lab `ARCHITECTURE.md` in chunks, then ledger exactly which parts remain current versus which should be removed or rewritten.

## Block 8b — full current architecture-document read

- Fully read all 359 lines of `cutout-lab/ARCHITECTURE.md`.
- It is not a current architecture reference. It is a stack of I1/I2/I2b/I2d/I2e/I2f/I2g historical contracts with one mid-file pivot note; old clauses remain below the note and still read as governing law. It mixes plans, device claims, implementation gates, restore points, deleted module maps, and superseded product behavior.
- Materially false/currently misleading statements include:
  - the referenced `cutout-ai/AUDIT.md`, `cutout-ai/ARCHITECTURE.md`, and `cutout-wand` module ownership no longer exist;
  - Layer-1 is said to be untouched even though the shared detector roster/worker still contains lab-era EdgeSAM execution;
  - EdgeSAM is said to be deleted and u2net consumed verbatim, while the engine EdgeSAM runner remains and the lab adds `cutSource`/breadcrumb/UI-mask glue;
  - the selector/session/wand/comet laws and gates describe removed product paths;
  - Save/Preview are called full-resolution, which current source disproves;
  - fixed suite counts, task identifiers, commit restore points, and device gates are historical evidence, not durable architecture;
  - “nothing dropped”/one latest-wins queue language hides that intermediate inputs are overwritten.
- Some principles remain valuable—engine primitives are stateless, UI should bind through `{state, actions}`, compositor must not run per drag tick, async publication needs stale guards, and tool math should be modular—but they should be restated against the final code, not preserved inside this archaeology.
- **Disposition:** replace the file with a short current-state architecture contract after the cleanup. Preserve the old history in git; do not retain superseded implementation plans inside the live contract.

### Next block

Synthesize the verified source/history/transcript evidence into a complete KEEP/COLLAPSE/KILL disposition, the minimal production-hardening sequence, and the conditional v1-versus-v2 base recommendation.

## Block 9 — production disposition and base recommendation

### Decision from the targeted v1 read

- **Use v1 as the product restoration base, conditionally on Meta finding no hidden blocker.** It already contains the mature Frame interaction, real OpenCV GrabCut behavior, Paint/vector tooling, tuned controls, and the more complete working experience. Current v2 has cleaner module intent in places, but regresses Frame, replaces real GrabCut with an unproven approximation, and still duplicates history/compositor ownership.
- This does **not** mean v1 is the better-coded or proven-stable build today. V1 has more complete product behavior over a less reliable orchestration layer. V2 has some better seams over a less faithful/incomplete product. Neither is production-ready as checked in source.
- The pivot to v2 was understandable because the v1 crash and false delivery claims destroyed trust, but source/history now show the pivot was probably premature as a product-base decision: the named SAM/Wand modules were removed, the later crash is not reproducible today, and the remaining problems are separable cleanup/hardening work rather than a need to recreate the whole product.

### KEEP unchanged or behavior-identical

- The v1 visible interaction and geometry that were already tuned: eight Frame handles/opposite anchors, current vector control ranges, Paint behavior, node editing, display-resolution edit cadence, and one release/idle bake.
- Pure `mask-tools` and `vector-edit` math.
- Real GrabCut's observable algorithm contract: lazy first-stroke activation, v1 seed rules, three iterations, 512 work cap, 2.5×/24px corridor, and never-destroy guard. The current 13 MB package is not automatically a keeper; the behavior is.
- Canonical v5.3.1 primitives: `runCutout`, `prepareEffect`, `resolveTraceOutline`, and `composeEffectArtwork`, plus the canonical compositor/transaction tests.
- One persistent u2netp session may remain for repeated Detect speed, but only after lifecycle and cancellation are made explicit; persistence itself is not the defect.

### COLLAPSE / MOVE, not rebuild

- Keep a sibling lab `{state, actions}` flow because the canonical contract explicitly permits it and v1 has additional tools. Move the existing tool drivers out of the 565-line flow into liftable modules, and compose the sibling flow from the canonical generation/upload/history services instead of retaining parallel local versions.
- Extend the canonical transaction owner for lab mask/tool state under a bounded-byte policy. Delete the separate 30-full-mask history path once exact undo/redo behavior is characterized and covered.
- Establish one lab intent token: Upload, Clear, Undo/Redo, new Detect, and new tool work supersede older async work; every result/status publish rechecks it. This closes stale-image publication, dropped-clear results, and waiter leaks at one seam rather than patching each callback.
- Consolidate upload/source preparation so the original is decoded once into a bounded working source while the untouched original remains available for true-resolution export. This removes redundant work but is **not** claimed as the proven cause of the later iPhone reload.
- Collapse v1's outer frame/pad/register/flip/clip/crop work into the canonical compositor operation. The lab bridge should decide policy and supply the vector request; it should not remain a second output compositor.
- Reuse verified v2 modules only as donor code where they already solve these seams; do not port the v1 surface onto v2 or rewrite working v1 behavior.

### KILL in the owning cutover

- The retained EdgeSAM roster, model config, prompts, encoder/decoder runner, and worker branch if the shared comparison harness is retired. At minimum, remove them completely from the production worker and production URL route; deleting weights while keeping executable routing is incomplete deletion.
- Automatic Silueta fallback from the production path. Production Detect should be u2netp-only; any comparison model must be explicit and isolated, never silently session-stacked after failure.
- `lastFileRef` unless the true-resolution export implementation adopts it as the actual original holder; current code has no consumer.
- Dormant Blend fields/ranges and their unused transform path; the checkerboard `drawCutout` Preview fallback; stale BEN2/EdgeSAM/Wand comments; the crash breadcrumb after the crash investigation is replaced by durable instrumentation/tests.
- Mirror mosaic only if Clamp-only remains the production decision. If Mirror remains a product capability, move it into the one canonical compositor instead of retaining a lab compositor.
- Replace the 359-line historical `ARCHITECTURE.md` with a short current contract; git already preserves the archaeology.

### Detector/mobile hardening required before production

- Make u2netp the sole automatic model and expose the actual winning/failing model in diagnostics.
- On inner timeout or model failure, terminate/dispose the worker before any retry or fallback; do not allow timed-out inference to continue underneath another model.
- Close `ImageBitmap` and temporary raster resources in `finally`; check HTTP status before ORT session creation; cancel/terminate pending work on Upload/Clear/supersession.
- Measure warm-session memory, first Detect, repeat Detect, and GrabCut-before-Detect separately on the target iPhone. OpenCV can affect only the latter sequence; it cannot explain clean Upload→Detect from current source.

### Missing production work, not v1 regressions to disguise as cleanup

- Natural-dimension transparent PNG Save is not implemented by v1 or v2.
- Cutline export with a document/viewBox expanded to actual outgrown curved bounds is not implemented by v1 or v2.
- V1 has no direct lab/GrabCut regression suite. Characterization tests must pin the working behavior before moves/deletions, then add history, stale-publication, Frame, output, route, and real-GrabCut coverage.
- Final stability requires a defined phone matrix and live observation; today's successful retest proves only that the crash is not consistently reproducible now.

### Minimal production-hardening sequence

1. **Freeze the working v1 behavior with characterization tests.** Cover Frame, Paint, node edit, real GrabCut corridor/never-destroy behavior, Blend-0 output, Preview/Save, and the current phone sequences. No feature change.
2. **Clean the detector perimeter.** Production u2netp-only; remove production EdgeSAM/Silueta fallback and stale URL routing; add worker cleanup/cancellation and honest diagnostics.
3. **Replace parallel orchestration ownership.** Move tool drivers; adopt/extend canonical transaction and generation services; one intent token, one history, one queue, one scheduler. Delete the superseded local implementations in the same cutover.
4. **Return final rendering to one compositor.** Move the outer frame/crop responsibilities into the canonical operation; delete the checkerboard/parallel output path and dormant fields. Add natural Save and correct Cutline through this single path.
5. **Slim real GrabCut last.** First measure/extract the exact OpenCV transitive closure needed by `cv.grabCut`. If a real provider meets the load/memory constraint, swap it behind the existing lazy seam and delete the heavy package. Do not substitute the v2 hand-built approximation.
6. **Run full independent QA and Meta gates on the launched v1 restoration.** Desktop and target iPhone must separately exercise clean Detect, GrabCut-before-Detect, repeated Detect, long edit/history, Preview, Save, and Cutline with provenance and captured evidence.

### Necessity / sufficiency verdict

- **Necessity — no unnecessary elements in this repair shape.** It reuses the v1 surface, canonical engine primitives/services, and verified donor modules; it adds only missing output/cancellation/test capability and deletes the replaced paths in the same increments.
- **Sufficiency — covers the full production-readiness ask, with two product choices still explicit rather than silently decided:** whether Mirror remains, and whether the developer comparison harness remains. Neither choice changes the recommendation that the production route is u2netp-only and owns one compositor/flow/history.

## Block 10 — OpenCV optimisation and structure-versus-substance decision

### Current question — 2026-08-08

Determine whether v1 really loads an excessive, mostly irrelevant OpenCV runtime for GrabCut; whether it can be reduced to a modular GrabCut-only capability; and whether v1's bridge/compositor divergence is useful improvement, harmless structure, or slop requiring replacement.

### OpenCV facts from the current package and source

- V1 pins `@techstark/opencv-js` 5.0.0-release.1. Its package entry point is the single `dist/opencv.js` artifact. The published file is 13,298,869 raw bytes; the entire npm tarball is 4,031,133 bytes compressed and 14,731,296 bytes unpacked.
- The browser transfer size after Next chunking/compression and the instantiated mobile heap were not measured in this read-only pass. Therefore “the phone downloads 13 MB” and any proposed “2–3 MB replacement” are not established facts.
- The package is dynamically imported only on the first GrabCut stroke. It does not affect page-open or clean Upload→Detect loading.
- Complete tracked-tree tracing found no other production import of `@techstark/opencv-js`. Other `cv` names in the tree are ordinary canvas variables. No current product feature benefits from retaining the full OpenCV surface.
- GrabCut uses more than the earlier shorthand “three functions”: `matFromImageData`, `Mat`, `Rect`, `cvtColor`, `grabCut`, matrix types, and GrabCut/type constants. It still consumes only a narrow core-plus-imgproc capability compared with the package's DNN, calibration, feature detection, object detection, video, photo, and other exported surfaces.
- The package repository states its `opencv.js` was copied from the official OpenCV 5.0.0 prebuilt artifact. The official OpenCV 5 build supports a custom `--config` export whitelist and `--disable_single_file` to split JavaScript from WebAssembly. Official default configuration exports `grabCut` inside a much broader imgproc/API list.

### OpenCV verdict

- The weight concern is **not a myth**, but the historic wording was imprecise: v1 lazily loads one monolithic prebuilt runtime for a narrow GrabCut use; raw package size is large, actual network/runtime costs remain unmeasured.
- TypeScript tree-shaking cannot remove unused C++/WASM capabilities from this already-compiled file. The correct optimisation is a pinned custom OpenCV.js build with only the required core/imgproc bindings, owned behind the existing GrabCut module.
- Put the custom runtime behind a lazy dedicated worker so GrabCut has an explicit termination/disposal boundary. Preserve the exact v1 seeds, iterations, corridor, and never-destroy behavior; change only the provider/runtime.
- Do not promise a target size. Build the exact whitelist, then compare emitted JS/WASM bytes, first-stroke latency, peak memory, output equivalence, and iPhone behavior against the current package. Delete `@techstark/opencv-js` only in the verified provider cutover.
- Do not retain unused OpenCV capabilities for hypothetical future tools. If a later product feature needs morphology, flood fill, or another operation, add that capability deliberately and remeasure.

### Bridge/compositor: improvement versus slop

#### Legitimate improvements to preserve

- A sibling lab `{state, actions}` flow is justified; the canonical flow contract explicitly allows it and the lab has Paint, GrabCut, Frame, node editing, and different output cadence.
- Mask-to-engine adaptation for Paint/GrabCut, display-resolution single-flight baking, vector clipping, and lab product policy are real missing capabilities. They should not be deleted merely to make v1 look byte-identical to v5.3.1.
- The canonical 2D flow is a pattern and service pool, not sacred code to copy blindly; its own upload prepare publication is not fully stale-guarded.

#### Slop that changes substance and must be removed

- Whole-mask history duplicates canonical transaction ownership and consumes mobile memory.
- Separate generation counters and missing Upload/Clear cancellation can publish old results into a new or cleared image.
- The one-slot “latest-wins” queue silently drops intermediate brush work.
- Resolve-only bake waiters can leak and resolve against later output.
- The outer compositor wrapper duplicates frame/output ownership, allocates extra canvases, and permits coordinate/Preview divergence. The clipping/crop behavior is needed; its parallel ownership is not.
- The checkerboard fallback produces the wrong transparent Preview behavior.

### Structural decision

- **Do not rebuild v1 from zero and do not force it through `useTwoDFirstFlow` unchanged.** That would sacrifice working behavior for superficial conformity.
- **Do refactor v1 into an improved canonical sibling bridge:** keep/move its tool and product policy, compose canonical transaction/generation/upload services, extend those services only for mask-tool state, and make the canonical compositor the sole final-pixel owner.
- This is not structure over substance. The duplicated structure already creates user-visible correctness, memory, latency, and stale-state risks. The right correction preserves every valuable behavior while deleting parallel ownership in the same cutovers.

### Verified sources

- Local: `package.json`, `package-lock.json`, `src/lib/cutout-grabcut/index.ts`, and complete tracked-tree import trace.
- Package: https://github.com/TechStark/opencv-js and npm metadata for 5.0.0-release.1.
- Official build: https://docs.opencv.org/5.0/js_tutorials/js_setup/js_setup/js_setup.html
- Official custom export surface: https://github.com/opencv/opencv/blob/5.x/platforms/js/build_js.py and `opencv_js.config.py` in the same directory.

## Block 11 — current uncommitted v1 drift during contract review

### Read boundary

- Read the complete tracked diff against `050d557e2ddbe99520c008e2090c202c554f03f8` for all eight modified files.
- This lane did not create or edit these source changes. Their owner and intended delivery boundary are not established here.

### Exact changed surface

- `finish.ts`: exposes `disposePresegCache()`.
- `flow.ts`: adds partial replacement/unmount cleanup, history reset, waiter settlement, preseg disposal, truthful Paint status, and Save cancellation when the full bake is unavailable.
- `history.ts`: adds `HistoryStack.reset()`.
- `page.tsx`: removes stale `?seg` stripping and updates the node-adjustment base after a committed edit.
- `ben-chain.ts`: removes EdgeSAM/SAM roster helpers and query-based chain selection, but keeps the automatic `u2netp → Silueta` production fallback.
- `vector-core/index.ts`, `vector-edit/index.ts`, and `node-ops.test.ts`: expose/reuse canonical exact node insert/delete operations and add curved-delete coverage.

### Contract consequences

- The diff is partial implementation work inside the planning denominator. It cannot be inherited as a settled baseline or overwritten by the later Builder.
- Lifecycle repair is already being expressed inside the existing flow, which strengthens Meta's challenge to a mandatory new `artwork-session.ts`; extraction must earn necessity from the final reconciled source, not from the earlier baseline.
- EdgeSAM removal is in progress, but Silueta remains the automatic fallback. The contract may not delete it without exact current owner-statement proof.
- Removing the page's stale-query cleanup is paired with removing query-driven detector dispatch in `resolveChain`; correctness depends on the complete worker/caller graph, not either diff hunk alone.
- The node changes satisfy part of the planned canonical-geometry repair and must be reconciled into task scope rather than rebuilt.
- The diff does not create a production-owned lift boundary, natural-resolution Save, one compositor, or integrated production proof.

### Current disposition

- Freeze source edits: read-only, no overwrite, no product-code action from this lane.
- Keep the contract and Linear sprint provisional.
- Re-pin the implementation denominator only after the source owner and Meta findings are known; then subtract already-correct work from the six tasks and retain only unmet obligations.

## Block 12 — accidental drift contained by Meta

- Meta's live pane identified the tracked edits as accidental research-lane writes, stopped that work, and restored the tracked tree.
- Independent read-back now shows v1 at `050d557e2ddbe99520c008e2090c202c554f03f8` with no tracked diff; only six Meta Playwright screenshots remain untracked.
- Block 11 remains the exact record of the transient delta and why it was not adopted. It is not part of the implementation denominator.
- Current contract blockers are now limited to lifecycle-module necessity, production-owned lift roots, and exact Silueta owner intent, pending Meta's written review artifact.

## Block 13 — current lift-boundary import proof

- Enumerated every tracked file under the current v1 lab route and every static/dynamic import in the lab plus `cutout-grabcut`, `mask-tools`, and `vector-edit`.
- The current product unit is still owned by `src/app/(dev)/cutout-lab/**`; this is a development route, not a production-owned package boundary.
- Product logic directly imports two other development-route surfaces:
  - `flow.ts` and `finish.ts` import `@/app/(dev)/effect-creator/v5.3.1/dev/PerfHUD`;
  - `v531seg.ts` imports `@/app/(dev)/effect-creator/v5.3.1/core/primitives`.
- `page.tsx` also imports the dev `PerfHUD` and dynamically imports `eruda` behind `?debug=1`.
- Library tool modules are closer to liftable: GrabCut depends on mask types plus the OpenCV package; mask tools depend on effect mask/vector core; vector edit depends on vector/outline/effect kernels. Their dependency closure still needs a re-export/dynamic-asset trace.
- Contract consequence: a manifest that simply lists the current `(dev)` route and broad dev imports is not a clean production package. The final plan must establish one production-owned feature/library boundary and leave the route as a thin adapter, or explicitly move the complete unit during its authorized cutover. Exact paths/moves remain pending Meta's findings.

## Block 14 — final-contract reread denominator

### Rehydration and prior evidence read

- Re-read the complete current `@s62-pixel-qa` day transcript through line 2101 after compaction.
- Re-read the full permanent checkpoint chain, current hydration state, directive ledger, this 621-line ledger, the 226-line v1/v2 ledger, the v1 findings report, the verbatim product proposal, and the current 229-line contract.
- Re-probed v1 at `050d557e2ddbe99520c008e2090c202c554f03f8`. Tracked source is clean; the six untracked Meta screenshots remain untouched.

### Superseded conclusions that are not final-contract evidence

- Do not delete the canonical lazy Silueta fallback without a separate owner decision; the earlier u2netp-only interpretation exceeded the recorded directive.
- Do not prescribe one global intent token; current source must determine the minimum local invalidation/freshness repair.
- Do not classify `finish.ts:bakeStickerEngine` as a duplicate compositor. It is the current Cutout clip/crop/coordinate adapter around canonical `composeEffectArtwork`; only proven duplicate/waste/failure behavior may be removed.
- Do not add Cutline or raw natural-upload-size PNG Save. Preserve and make truthful the current capped transparent full-mode output.
- Do not invent a broad oldest-device/Low-Power support floor. Final proof is the recorded physical iPhone and current declared input/output caps.
- The exact product-owned move is an authorized reversible implementation of the liftable-package requirement, not a structural Dan hold.

### Current denominator and next action

- Final source denominator: 56 tracked files, 10,570 lines, defined by the complete current v1 import/engine/test closure in `meta-space/v1-audit/audit-ledger.md`.
- Next: verify every manifest line/hash against current v1, then fully read all 56 files end to end. Record each bounded block here before opening the next block.

## Block 15 — final denominator drift check

- Recomputed line counts and SHA-256 prefixes for all 56 manifest files against current v1.
- Result: 56/56 line counts and 56/56 hashes match the frozen manifest; total denominator remains 10,570 lines at HEAD `050d557e2ddbe99520c008e2090c202c554f03f8`.
- No tracked source drift exists. The full reread can use the frozen eight-block order without mixing revisions.

### Next exact action

Fully read files 1–3: `package.json`, `scripts/cutout-lab-verify.mjs`, and `cutout-lab/ARCHITECTURE.md`; ledger the final-contract consequences before opening file 4.

## Block 16 — final reread files 1–3 (528/10,570 lines)

- Fully read `package.json` (87), `scripts/cutout-lab-verify.mjs` (82), and `cutout-lab/ARCHITECTURE.md` (359) from the verified current bytes.
- `package.json` confirms OpenCV, `eruda`, and the shared engine/vector dependencies are repository-level dependencies. It cannot serve as the later product-package manifest; closure must be derived from actual product imports/assets.
- The committed verifier is stale: it waits for automatic Detect after upload and hard-codes a local URL plus `/tmp` evidence. Current v1 requires a Detect click. Replace this verifier in the owning final proof cutover; do not add a second harness.
- `ARCHITECTURE.md` is a multi-era plan/history stack, not current authority. It simultaneously carries deleted EdgeSAM/Wand surfaces, Mirror-era budgets, later u2net/GrabCut pivot clauses, fixed test counts, old restore points, and superseded product/gate decisions.
- A few durable principles survive in source: sibling flow ownership, no compose mid-drag, single-flight bake, engine primitives below the flow, shell gesture/render duty. The final contract must not preserve the 359-line archaeology as current law.
- Minimal disposition: remove/replace the stale verifier and architecture file only after the final graph exists, using one current journey verifier and the copy-ready ownership/manifest record already required for liftability. No separate documentation increment.

### Next exact action

Fully read files 4–10: the complete current lab shell/flow/history/finish/config/segmentation implementation; record source-matched problem and preserve boundaries before opening dev imports.

## Block 17 — final reread files 4–10 (2,221/10,570 cumulative)

- Fully read the current `EditorOverlay.tsx`, `finish.ts`, `flow.ts`, `history.ts`, `page.tsx`, `ui-config.ts`, and `v531seg.ts` from the verified manifest bytes.

### Preserve exactly

- `EditorOverlay` proves the product's eight Frame grips, opposite-side/corner anchors, centered untouched axis for side grips, and max-axis aspect lock. These are preservation fixtures, not rewrite scope.
- The sibling `{state, actions}` flow is a legitimate owner for Cutout product policy and mask tools. The page calls the flow for every product action; do not force the feature through `useTwoDFirstFlow` or add a second store.
- `bakeStickerEngine` is a necessary Cutout clip/crop/coordinate adapter around `composeEffectArtwork`. It is not a second blur/compositor implementation and must remain unless a smaller source-proven edit emerges during implementation.
- Current history semantics are source-exact: the first accepted Detect is snapshot index 0 and non-undoable; Clear appends an empty snapshot and is undoable. Preserve this behavior.
- Save uses the full prepared texture, which is still bounded by the working/engine cap. Do not add raw natural-upload-size output or Cutline.

### Proven repairs

- The three product dev edges are direct and live: `page.tsx`/`flow.ts`/`finish.ts` import dev `PerfHUD` or dev outline producers; `v531seg.ts` imports dev primitives. The exact move must cut these edges while leaving optional dev HUD/eruda outside the product graph.
- Upload/Clear/unmount do not invalidate all active Detect/tool/prepare/bake/status work, reset history, settle timers/waiters, or dispose the module-global preseg cache. The bounded source is also decoded twice, and `cutSource` falls back to the unsafe original URL when decode or blob creation fails.
- The one-slot `pendingToolRef` necessarily drops intermediate accepted gestures. Replace it with one FIFO queue; do not create another queue framework.
- Restore publishes mask/drawn/settings/blend/`hasCut` before re-prepare and keeps stale `preparedRef` on failure. Prepare locally, then publish snapshot and prepared result together; failure leaves current state untouched.
- `fullBakeWaiters` resolve only on successful current full bake. Failure, timeout, cancellation, replacement, Clear, or unmount can leave stale waiters; all exits must settle once.
- Standalone one-point Paint can produce an empty swath, `acceptMask(false)` is ignored, and the UI then reports success. The page accepts taps by design, so the paint primitive/status path must make a tap truthful.
- Node adjustment keeps `nodeBaseRef` from selection time; a committed drag does not rebase it. The next radius/curve edit can revert the drag. Rebase after committed geometry; preserve the product interaction.
- Editor pointer cancellation is not fully handled (`pointerleave` commits, but overlay `pointercancel` has no owner). Settle/cancel gestures explicitly; no new gesture system.
- Mirror is a live Cutout product surface and custom mosaic path despite the Clamp-only directive. Remove it. Cutout also retains unreachable preset/vignette/tint/scale/pan fields and `CHIP_RANGE` entries plus `transformArtwork`; remove these only after the final caller trace, while preserving shared engine APIs.
- Detect always pays `prepareEffect` output work later shown unused by this lab. Remove that waste at its owning preparation/output seam; do not change the canonical compositor result.
- Preview falls back to checkerboard pixels while claiming transparency. Preview/Save must return the requested capped transparent pixels or a visible failure, never substitute/stale output.
- Dead `lastFileRef`, stale warmup/full-res wording, and the crash breadcrumb are cleanup candidates. Keep the breadcrumb through final physical proof; then exclude it from the lifted product.

### Final-contract correction

- Remove the current contract problem wording that calls first-cut/Clear history inconsistent; the real history defects are cross-upload state, non-atomic restore, and incomplete async settlement.
- Add the single bounded-source/no-unsafe-fallback and preseg-cache cleanup outcomes to the existing detector/flow cutovers; no seventh phase.

### Next exact action

Fully read files 11–15: dev primitives/HUD/producers/shapes and the real GrabCut provider. Record exact move/reuse boundaries and OpenCV/provider defects before the engine-test block.

## Block 18 — perimeter correction and final clause check

- Dan corrected the audit perimeter: the Cutout product is roughly 1,700 lines; the 56-file/10,570-line number is shared dependency/test closure, not “the v1 codebase.” No further broad reread is justified because all 56 current hashes already match the completed audit.
- The already-completed files 11–15 read confirms the three dev edges should be cut by moving/re-exporting existing reusable code, not rewriting shared primitives, HUD, outline producers, or shapes.
- `cutout-grabcut/index.ts` allocates `src`, `rgb`, and `gc` before the scratch+erase early return. That return precedes the `finally`, so those Mats leak on that path. Fix it in the existing provider regardless of whether the narrow-worker probe wins.
- Contract-only corrections: name Upload reset/atomic restore/async settlement as the history defects; add one bounded detector source with no raw-original fallback and explicit preseg-cache disposal; remove proven Cutout-only dormant settings/transform and Mirror paths after caller trace; replace the stale verifier/architecture record inside final closure; collapse repeated review boilerplate into one universal necessity/sufficiency rule.
- No seventh increment, new module, parallel provider, source edit, build, runtime, Git action, or peer communication is justified.

## Block 19 — Builder Proposal v1.0 advisory comparison

- Fully read Builder Proposal v1.0 (178 lines, SHA-256 `5b4ca19f234b899a12491f4e8f12903e6221d268bec7d7727e26f9e3e99af55c`) and compared its six cuts with the frozen QA contract and direct owners.
- Accept: replacement Upload must decode/build locally and leave the accepted artwork unchanged on failure; first accepted cut/history baseline is source-neutral, not Detect-specific; remove `@huggingface/transformers` after its two retired worker imports disappear; remove `?seg` cleanup with the selector; preserve the neutral-and-in-frame condition on Blend-0 bypass; protect successful shared `prepareEffect` outputs/callers; move scratch+erase before OpenCV load/allocation; measure peak memory; add the smallest dev-only calibration seam.
- Modify: do not mandate GrabCut workerization. Measure main-thread responsiveness as an outcome; add a worker boundary only if the retained provider fails that gate. Require a machine-checkable copy closure, not a second narrative architecture/manifest document.
- Reject Builder omissions: detector session/tensor/bitmap/preseg cleanup remains required by current source and mobile/performance scope; one-point Paint truth, node rebase/insert/delete/refit/selection, and pointer cancellation remain proven defects; stale-result/waiter/resource settlement remains required.
- Contract remains frozen at `c31729ce...` while independent Meta reviews those exact bytes. No canonical or Linear mutation occurs until both inputs are consolidated once.

## Block 20 — independent verification of Meta REVISE

- Reverified the reviewed bytes and denominator before judging Meta: contract SHA-256 `c31729ce4ec2414a8abdcc0d8374789427665fb6b612ef05d90fb5bd96dd0ef4`; v1 HEAD `050d557e2ddbe99520c008e2090c202c554f03f8`; no tracked source diff; the same six Meta screenshots remain untracked and untouched.
- Accept Meta 1. `PerfHUD` is debug-only. Its module-level `perfGesture` sink only stores/listens for HUD entries, while Cutout imports/calls it from `page.tsx`, `flow.ts`, and `finish.ts`. Delete those Cutout edges/calls; do not move the debug sink into `src/lib/cutout-lab/`. Keep bounded device instrumentation outside the lifted product until physical proof, then remove it.
- Accept Meta 2. The preserved degradation path is `u2netp` primary → lazy `silueta` → visible flood-fill. `ben-chain.ts:54-69` owns the first two stages and `prepare-effect.ts:181-198` owns the loud fallback. The contract currently omits the third stage.
- Accept Meta 3, with one orphan made explicit. The retired comparison tail includes `segParam` forwarding/preload, the BEN2/RMBG/BiRefNet Transformers map, `ML_ADAPTER_ID = ben2-onnx`, the stale page `?seg` stripper, comments/tests, and any proven experiment-only assets. After the two worker imports are removed, delete the now-unreferenced `@huggingface/transformers` dependency and lockfile closure too. Preserve only the two live production assets, `u2netp.onnx` and `silueta.onnx`.
- Accept Meta 4. `acceptMask` pushes every successful starting source, and `HistoryStack.canUndo()` requires index greater than zero. Therefore the first accepted cut—Detect, standalone GrabCut, or Paint—is snapshot 0 and non-undoable. Block 17's Detect-specific statement is superseded by this source-neutral rule.
- Accept Meta 5. Scratch+erase currently returns after `src`, `rgb`, and `gc` allocation but before the `finally`. The smallest fix is to determine scratch+erase and return before `loadCv()` and before every Mat allocation. Increment 3 must not duplicate this Increment 5 ownership.
- Accept Meta 6. The flow intentionally composes display mode from a downscaled prepared source and switches Preview/Save to full mode. The correct proof is same current geometry/content between display and output, plus identical capped full-output dimensions/pixels between Preview and PNG—not identical dimensions across display and export.
- Modify Meta 7. Meta is right that a blocking main-thread provider cannot pass production merely because the narrow binary loses. The contract must require the retained provider to pass a frozen responsiveness/device gate. Meta's unconditional worker mandate is not source-proven before measurement: if the current lazy provider passes that gate, a worker adds unnecessary transport/lifecycle code; if it fails, the one worker boundary becomes required. The probe should compare the installed official OpenCV 5.0.0 binary with a reproducible same-version `core + imgproc` build and include transferred bytes, peak memory, masks, latency, responsiveness, repeat stability, and iPhone behavior. Official OpenCV 5 build documentation supports a custom OpenCV.js build and limited module list; GrabCut is an `imgproc` API.
- Accept Meta 8 as a bounded investigation, not a new support floor. Dan kept the historical crash/root-cause requirement live and explicitly raised Low Power as one hypothesis. Record any retained Safari/WebContent/Jetsam evidence, actual device/OS/Safari/input-output caps and Low Power state, and run the focused physical matrix with Low Power off/on. If no crash reproduces and no causal log exists, state `cause unproven` and claim only bounded non-recurrence/risk reduction.
- Necessity — shrink Meta 7's unconditional worker mechanism; keep its pass/fail responsiveness outcome. All other corrections remove drift, correct false clauses, or cover still-live owner requirements. No seventh task or phase is justified.
- Sufficiency — after these corrections, the existing six increments can deliver the full directive. The frozen contract is not yet corrected; canonical and Linear remain unchanged until Builder's reciprocal review is also consumed and both inputs are consolidated once.

## Block 21 — independent verification of Builder reciprocal REVISE

- Fully read the 110-line reciprocal review at SHA-256 `4de22a8039d8f8a8a96d33c4f120d44067772ebfabcc2b0e3b13e52b4465fb26` and checked each correction against v1 HEAD `050d557e2ddbe99520c008e2090c202c554f03f8`.
- Accept Builder 1. The product component owns a `?admin` paint-calibration panel while the flow owns `paintCfg`/`setPaintCfg`. The lift needs one narrow dev-only slot; otherwise dev-only calibration UI ships inside the supposedly product-owned package.
- Accept Builder 2. Product UI already prevents a second Detect while busy, worker reset already rejects all pending requests, and u2netp/Silueta sessions are intentional worker-owned warm caches. Require observable cancellation/settlement, bitmap closure, worker termination, and raster/preseg cleanup. Add no serializer, and release sessions/tensors only when a current lifetime trace plus the mirrored ORT 1.21.0 `release()`/`dispose()` API proves it necessary.
- Modify Builder 3. Remove duplicate GrabCut ownership and exact commit counts. Shrink the Node umbrella, but retain the exact source-proven selected-node rebase defect: `nodeBaseRef` is captured at selection and is not updated by `onEditCommit`, so a later radius/curve adjustment can apply to stale geometry. Preserve current insert/delete/selection and add no refit unless a failing product journey proves it.
- Accept Builder 4. Cutout does not consume `PreparedEffect.composite` or `edgeComposite`, but shared 3D and Grid callers do and no current profile proves the Cutout waste material. Measure first; permit only a Cutout-specific skip with unchanged shared defaults/outputs/callers if the cost is material.
- Accept Builder 5 with one exact condition restored. Cutout exposes Mirror/Clamp, not Tile; shared Tile is live. Blend-0 bypass is only neutral, in-frame, and matted. Display is intentionally display-resolution while Preview/Save share capped full mode. Protect Grid, Creator, and 3D callers if shared loading/preparation changes.
- Accept Builder 6. This matches the independent correction to Meta: move the no-op before OpenCV load/allocation, compare providers mechanism-neutrally, and add one lazy worker only if the retained provider fails the responsiveness gate.
- Accept Builder 7. Liftability needs one generated/hashable import/analyzer closure record, not a second hand-maintained manifest or replacement architecture narrative. Delete the stale archaeology.
- Accept Builder 8. Correct the existing directive ledger first, point the contract to it once, and specify independently revertible cutovers rather than exact commit counts.
- The directive ledger itself contained stale earlier-plan obligations—duplicate-compositor language, Cutline/raw output, and a mandatory worker. Those are now superseded in place by the exact current owner windows and source-backed obligations before the contract cites it.
- Necessity — no unnecessary reviewer addition survives: worker, serializer, refit, unconditional pre-composite skip, narrative documentation, and commit-count ceremony are conditional or removed.
- Sufficiency — the accepted/modified Meta and Builder corrections fit the same six increments and cover the live directive in full; no seventh task, phase, module, or review artifact is justified.

## Block 22 — final consolidated contract and live Linear proof

- Re-read the consolidated contract in full: 170/170 lines, SHA-256 `412e0edc4dd95a8bab647c96d8f0f0abe62f1cbec467fb9a00de563277ef6e7b`. Both relative authority/evidence links resolve.
- Necessity — no unnecessary elements. The contract deletes debug sinks instead of moving them; makes detector session/tensor and pre-composite work trace/measurement-conditional; makes a GrabCut worker conditional on measured responsiveness failure; preserves exact current node insert/delete/selection; deletes stale architecture without replacement prose; removes exact commit-count ceremony.
- Sufficiency — delivers the full directive. The six increments cover liftability, full detector/query cutover, atomic flow/history/tools, correct shared output semantics, exact measured OpenCV with a mandatory responsiveness result, generated closure, and bounded historical-crash evidence/result.
- De-slop — every removal is owned by its cutover and protected by caller/tracked-tree proof. No separate cleanup phase, parallel product path, disabled detector tail, duplicate compositor, dual OpenCV provider, hand-maintained manifest, or orphan dependency is permitted.
- Re-read KAI-10215–KAI-10222 live after update. Parent is `Ready for Dan`; six children are `Backlog`, parented to KAI-10215, and remain the strict `10216 → 10217 → 10218 → 10219 → 10220 → 10221` chain. Parent and all six children pin the same final SHA; KAI-10222 records the supersession.
- Planning surface proof: current local contract bytes and live Linear bodies both show the final SHA and the same six cutovers. Implementation/runtime remain explicitly uncleared.
- Untouched: v1 tracked product source, builds, runtime, Git, deployment, and the six pre-existing Meta screenshots.

## Block 23 — final independent reviews and owner lock

- Builder independently full-read contract SHA `412e0edc4dd95a8bab647c96d8f0f0abe62f1cbec467fb9a00de563277ef6e7b` against V1 HEAD `050d557e2ddbe99520c008e2090c202c554f03f8` and the current directive ledger. Verdict: `AGREE`; necessity has no unnecessary elements; sufficiency delivers the directive in full.
- Claude lead independently returned the same `AGREE` verdict and verified the principal source clauses. Its only recommended strike was the unused v2-donor sentence.
- Owner authority verified in `__TRANSCRIPT VAULT/claude/s62/lead/2026-08-08/4-s62-lead--21-22.md`: Dan asked, “v2 donour for what exactly if it was rebuild from v1 ?” and later corroborated removal. V2's reusable modules are v1 extractions; its new GrabCut, Simplify, and Frame code is inferior approximation. No increment uses v2.
- Dan cancelled the additional Pixel Meta reread after it repeated the audit loop. It is not a lock dependency and produced no final verdict.
- Deleted only the unused donor sentence. Locked contract remains 170 lines at SHA `c21dd1b36ad43eeb72e7f10f7016d931dfa9f75b7de2802f9bd1e17abed38e46`; all six increments are unchanged.
- Updated KAI-10215–KAI-10222 to the locked SHA. Product source, build, runtime, Git, deployment, and screenshots remain untouched.

## Block 24 — original-intent zoom-out: hydration and authority

- Fully re-read the 370-line transcript-derived hydration pack. The original v2 rebuild was a hypothesis made while v1's bridge/compositor ownership and the phone crash were unresolved, not the required final answer.
- The hydration evidence supports the later v1-base verdict: v2 repeatedly regressed v1's accepted Frame, vector stack, full-output path, and real OpenCV GrabCut; its useful modules were extracted from v1; its new GrabCut/RDP/Frame code was approximation; its canonical-flow import still left material policy in page/bindings.
- The original “v1 bypassed the bridge and duplicated the compositor” diagnosis was only half true. V1 did bypass the canonical Layer-2 flow and suffered real cadence/history/resource defects, but later source work proved its sibling flow owns lab-specific mask/tool policy that the canonical flow cannot express and `bakeStickerEngine` is a necessary Cutout coordinate/clip adapter around the canonical compositor—not a second compositor.
- Crash evidence is bounded, not causal: an earlier blend/mirror path measured about 1.56 GB across ten Detail ticks; stale `?seg=edgesam` routing after UI deletion was a proven deletion failure; later phone termination had no retained causal log and Dan's current retest was clean. A truthful plan must remove those pressure/residue classes and permit `cause unproven`, not promise a diagnosis.
- Initial necessity result: selecting v1 is evidence-backed rather than drift. The six contract owners map to the original questions: lift/dev edges; SAM/query/runtime residue; flow/history/tool ownership; canonical compositor plus necessary adapter/output truth; measured exact OpenCV; integrated device/crash/closure proof.
- Authority-ledger slop found for correction after the remaining note pass: its pre-v1 section is still titled “Still-live atomic deliverables” and lists a v2 repair plan/Meta loop now superseded by the v1 decision; numbering duplicates item 32. This does not change the contract scope but makes the authority ambiguous and must be cleaned.
- Fully reread the superseded v2 approximation tasklist and 217-line repair plan, Builder's 178-line independent v1 proposal, Meta's 447-line superseded v1 plan, and the locked 170-line contract. The old v2 plan confirms why it is not the base: it would restore v1 Frame, vector, output, history, and real GrabCut while also adding unapproved Cutline/raw-resolution behavior. Its useful modular boundaries do not contain a smaller behavior owner than the current v1 code.
- Original-intent mapping is complete: detector/SAM/Wand/query residue → Increment 2 plus generated closure; historical crash truth → Increment 6; sibling flow versus canonical bridge → Increment 3 while preserving canonical engine calls; Cutout adapter versus compositor → Increment 4; v1 versus v2 base choice/liftability → Decision and Increment 1; OpenCV/performance → Increment 5 plus conditional preparation and warm-up measurements; integrated production proof → Increment 6.
- `/o-necessity --review`: no contract element lacks an owner problem. The exact move is required by liftability; lifecycle repairs are current defects; preparation, warm-up, ORT disposal, narrow OpenCV, and worker changes remain measurement/trace-conditional; the closure record proves copyability without a new repository or prose manifest. No v2 transplant, Cutline, raw-natural Save, new flow/history/compositor framework, support-floor promise, or seventh phase survives.
- `/o-deslop --review`: every live cemetery class has an owning cutover—debug/admin edges and dead `lastFileRef`; EdgeSAM/SAM/query/BEN2/RMBG/BiRefNet/Transformers/dependency/assets; overwrite queue and stale lifetime paths; Mirror/dormant Cutout glue/checkerboard output; GrabCut no-op leak and losing provider probe; stale verifier/architecture and temporary diagnostics. Shared Tile, canonical compositor, necessary Cutout adapter, current HistoryStack, u2netp/Silueta/flood-fill, exact GrabCut, and shared callers are explicitly protected.
- Contract verdict: no clause change is justified. Wand is already absent in the audited v1 denominator, so adding a fake deletion task would be slop; the final generated closure still proves the actual product file/import/asset/dependency set. The locked contract remains the smallest complete answer to the original audit intent.
- Corrected the directive ledger only: relabeled the old v2 deliverables as superseded historical planning input and repaired duplicate numbering. This removes authority ambiguity without changing contract bytes, product scope, or Linear task content.

## Block 25 — clean-repository adoption boundary correction

- Read the current `onemo-effects-engine` README, AGENTS file, package manifest, `_context/{briefs,decisions,spec,engine-spec,rules,log}.md`, and the two `src/lib` module READMEs. The existing repository is already Dan's named production target: `src/lib` is declared headless and portable; `src/app` is the disposable light studio.
- Checked the current 1,693-line v1 unit's import/host edges. `page.tsx` and `EditorOverlay.tsx` are React studio files; `flow.ts` is React-hook and DOM/canvas coupled; `finish.ts` and `v531seg.ts` are browser canvas adapters; `history.ts` is pure; `ui-config.ts` is shell configuration. Moving all seven into `onemo-next/src/lib/cutout-lab/` would not create the target boundary and would put React/DOM code under a headless-library label.
- The target repository also has a current documentation tension: `src/lib` is declared no-DOM while `image-pipeline` is described as a browser-side adapter. The adoption map must resolve that boundary explicitly before population; this sprint must not silently choose a permanent folder structure inside the clean repository.
- `/o-necessity --review` result: shrink the intermediate exact-move. It is prototype-repository churn and does not help direct adoption. Keep characterization tests, dev-edge removal, and the final generated closure; add the missing direct destination classification into headless core, browser adapter/flow, and studio shell.
- `/o-deslop` consequence: do not create a second copy inside `onemo-next` only to copy it again later. Polish one v1 implementation in place; later adoption copies only the cleared closure into `onemo-effects-engine`, not Git history, audit notes, debug/admin surfaces, or v2 artifacts.
- Product source, `onemo-effects-engine`, build, runtime, Git history, and deployment remain untouched. Only the Codex `_WIP` contract/authority/evidence records changed.

## Block 26 — final UI and magnetic-grid adoption seam

- Dan added two downstream production requirements: replace the current mock/admin Cutout shell with the owner-designated Figma UI converted to React, and feed the final free-shape effect into the canonical magnetic-grid sizing/backing system.
- Current V1 already retains the edited vector truth: `finish.ts` returns `FinishResult.shape: VShape`; `flow.ts` owns `shapeRef` and `preparedRef`; the prepared spec carries the mask scale context. The current public lab `view` exposes display shape/mask/canvas refs but no stable production result record containing the final vector plus mm context. The missing work is an explicit handoff, not a new vector or contour algorithm.
- Fully read `src/lib/effect/geometry-truth.ts`, `grid.ts`, and `grid-client.ts`. `contourFromShape` is the existing single VShape→manufacturing `Contour` producer at the named 0.05mm tolerance. `grid.ts` is the UI-independent public grid entry point and already supports `uniform-contour` ladder/plan recipes; `grid-client.ts` owns the existing worker client. Cutout must reuse these owners instead of importing Grid Lab UI or copying grid math.
- Fully read accepted `ADR-S59-MAGGRID-EXACT-CONTOUR-01` and `ADR-S59-MAGGRID-AUTHORITY-02`. The Grid engine must consume the exact final manufacturing contour with no grid-only resampling/approximation. The browser is preview only; manufacturing authority later regenerates from recorded original/vector, edit, size/rung, attachment, engine, and law inputs and fails loud on mismatch.
- The owner-designated Figma UI is confirmed by Dan but its exact file/key/node is not present in the audited V1 source or current QA records. Increment 1 must pin that existing Figma authority before later conversion. The current mock/admin shell remains only the behavior/calibration harness and is excluded from the adoption closure.
- `/o-necessity --review`: do not add UI conversion or Grid implementation to the first V1 polish increment. The owner explicitly placed clean-repository movement later. The smallest sufficient current work is to prove the stable React-facing flow/view interface and exact Cutout-result→canonical-Grid contract, then carry the actual Figma conversion, clean-repository population, Grid UI integration, and production regeneration as downstream release work.
- `/o-deslop --review`: no second UI, contour producer, Grid solver, sizing rule, or magnetic-backing implementation belongs in Cutout. The mock shell dies at adoption; the Figma React shell replaces it. One final `VShape` derives one manufacturing `Contour`; one canonical Grid engine owns size/rung and magnets.
- No product source, clean-repository source, Figma artifact, build, runtime, Git history, or deployment was changed in this block.

## Block 27 — portable package correction

- Dan clarified the current goal: fix V1 and finish with a portable final packaged engine that can receive additional logic and a new UI, then move into `onemo-effects-engine` as the product webapp studio module. Relocation is permitted when it serves that package.
- This supersedes only the absolute wording “polish in place/no intermediate package”; it does not authorize moving the current mixed seven-file unit wholesale into a misleading headless folder. `page.tsx`/`EditorOverlay.tsx` are React shell, `flow.ts` is React/browser orchestration, `finish.ts`/`v531seg.ts` are browser adapters, and only `history.ts` is pure. The final package must respect those layers.
- `/o-necessity --review`: KEEP the first increment's no-relocation freeze because early movement changes paths without fixing behavior or separation. ADD one required final cutover in Increment 6: move/re-export the cleared existing owners into product-owned headless and browser/React layers behind one typed public contract, then delete the old route-owned production copies. This produces the requested portable unit without a throwaway copy.
- `/o-deslop --review`: forbid parallel package trees and generic extensibility frameworks. Portability needs explicit state/actions/view and Cutout-result interfaces, not a plugin bus. The dev route can survive only as a thin test mount; the mock/admin shell, debug sinks, and route-owned production implementations do not enter the package.
- No product source, `onemo-effects-engine`, build, runtime, Git history, or deployment changed while correcting the planning records.

## Block 28 — Figma authority input is downstream, not an engine blocker

- Builder exhaustively checked the current directive transcript, Linear, V1 source, repository Figma references, and current screen evidence and found no source-proven owner-designated Cutout Figma file/key/node. The only repo-wide key found was unrelated/unproven. Inventing or substituting it would violate the no-approximation directive.
- `/o-necessity --review`: the exact Figma node is not needed to characterize or build the shell-neutral state/actions/view boundary in KAI-10216 because that task explicitly does not convert UI. Requiring it as an Increment-1 clearance condition manufactures an external blocker and couples engine repair to a downstream design asset.
- Smallest correction: KAI-10216 records the missing pin as explicit owner input and continues; the later Figma conversion must receive the exact owner-designated file/key/node before it starts. The final closure record includes the pin when supplied or carries the unresolved downstream gate without substituting another design.
- No product source, Figma artifact, build, runtime, Git history, or deployment changed.

## Block 29 — Figma removed from the current V1 fixing sprint

- Dan corrected the scope: “No figma yet we are doing v1 fixing dude”. This supersedes all current-sprint Figma lookup, pinning, mapping, conversion, evidence, and acceptance clauses. Historical owner statements remain in the directive sequence, but they do not authorize present Figma work.
- `/o-necessity --review`: Figma work is `CUT-drift`; it neither repairs V1 nor proves its portable package. The smallest sufficient UI seam is the shell-neutral state/actions/view boundary required for a future studio shell.
- `/o-deslop --review`: no Figma artifact, adapter, mapping record, placeholder, or unresolved owner-input gate belongs in this sprint. The prototype shell remains only as the behavior/calibration oracle and is excluded from the portable package.
- QA changed only the contract and durable planning records. Builder-owned product edits already in progress were not touched.

## Block 30 — existing UI/API preserved; interface project removed

- Dan's later correction is controlling: “UI is already there just fucking reminder UI never an issue.” It supersedes Block 29's remaining claim that a new shell-neutral interface is the smallest UI seam.
- Current source already exposes the UI-facing boundary: `useCutoutLabFlow` returns `state`, `actions`, and `view`; `page.tsx` consumes that API. No missing interface has been proven in KAI-10216.
- `/o-necessity --review`: remove interface design and interface proof as work. Preserve and characterize the existing API unchanged. A boundary edit is authorized only if the final relocation reproduces concrete coupling, and then only the smallest behavior-preserving edit survives.
- `/o-deslop --review`: no Figma work, replacement UI, shell-neutral-interface project, adapter framework, or speculative API belongs in this sprint. Route-specific calibration/debug UI stays outside the portable engine closure; the working UI remains the behavior oracle.
- QA's premature Linear repin to the pre-correction `0fa896…` contract was invalid. Linear must be repinned once to the corrected full-read contract; Builder remains blocked from committing until the exact SHA is live.
