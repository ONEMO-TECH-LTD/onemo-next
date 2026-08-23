# KAI-10217 Builder ledger

## Authority and boundary

- Base snapshot: `88dede13066dd7e22db365568943150f90e22e0a`.
- Branch: `session62-task/KAI-10217-detector-resource-ownership`.
- Contract: active Builder-worktree 177-line file, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 2.
- Preserve: u2netp primary -> lazy Silueta -> visible flood-fill; current UI behavior/API.
- Delete: detector comparison/SAM/query/Transformers residue and proven orphan closure.
- Repair in place: bounded input, request/worker/bitmap/cache lifetime; no new framework or serializer without a reproduced need.

## Fresh source read — detector entry and chain

- `package.json` still owns runtime `@huggingface/transformers`.
- `ben-chain.ts` contains production u2netp/Silueta plus remote comparison `u2net`/`isnet`, EdgeSAM encoder/decoder roster, SAM thresholds/prompt/soft-prob helpers, and `resolveChain(seg)` branches for query-driven comparison or Transformers fallback.
- `segment-ml.ts` reads `location.search` through `segParam()` and sends it on both inference and preload. It owns one module-global Worker and pending map; watchdog failure terminates the worker and rejects all pending requests. There is no public cancel/dispose owner for replacement, Clear, or unmount. `ML_ADAPTER_ID = ben2-onnx` survives as omitted-adapter fallback.
- `v531seg.ts` bounds oversized sources to 1024px, but decode or blob-creation failure returns the original URL, violating the one-bounded-source rule. Its temporary blob URL is revoked after `runCutout`.
- `cutout.ts` is a thin dynamic-import bridge into `segmentML`; it does not own publication or cancellation.
- Existing `ben-chain.test.ts` positively locks comparison models and Transformers-null routing; Increment 2 must replace those expectations with the production-only chain. `segment-ml.test.ts` covers watchdog reset only.

## Necessity/deslop disposition so far

- KILL candidates: query selector, comparison REMBG entries/host, all SAM-only chain code, Transformers worker path, `ML_ADAPTER_ID`, dependency/lock closure, stale tests/comments. Final deletion requires full consumer and tracked-asset trace.
- KEEP: u2netp/Silueta specs, lazy fallback order, degenerate-matte guard, shared worker transport and result conversion, current visible fallback.
- REPAIR: current owners rather than adding a second detector/provider/lifecycle layer.

## Fresh source read — worker

- `ben.worker.ts` contains two complete detector families: the retained raw-ORT rembg chain and the removable Transformers comparison pipeline. Query `seg` selects comparison REMBG, EdgeSAM, or Transformers models; preload duplicates the same branching.
- `runRembg` creates an `ImageBitmap` and closes it only inside `finishMatte`. Any error after bitmap creation but before `finishMatte` leaks it. `runSam` has the same problem and closes only one explicit no-candidate exit.
- Worker messages have no cancellation identity beyond request id. The async handler can continue inference after the main-thread request is stale; terminating the one worker is the only existing hard cancellation mechanism.
- Cached production ORT module/sessions are intentional warm worker-owned resources. Terminating the worker on owner exit is the matching lifetime boundary; no speculative session-disposal API is justified.
- Preload is best-effort and currently routed by the removable query selector. Production-only preload should warm only u2netp and keep Silueta lazy.
- The production chain loop already provides the correct u2netp -> Silueta -> thrown failure path consumed by visible flood-fill. Preserve this loop while removing every alternate roster/Transformers branch.

## Gate state and wider query-tail trace

- KAI-10216 exact snapshot `88dede13066dd7e22db365568943150f90e22e0a` received independent Meta CLEAR against contract `367e2d27`; the earlier structural blocker was explicitly retracted as stale-contract error. KAI-10217 remains the only build scope.
- The stale `?seg` tail is not confined to Cutout Lab. Both v5.3.1 route shells derive `segPresent`, inject it into `CreatorAdapters`, and the two live flows use it to skip their normal production segmentation. Removing the query experiment therefore requires deleting those adapter fields/branches as well as Cutout Lab's strip block.
- `useGenerationTask` suppresses stale Magic publication but does not terminate the shared segmentation worker. `v53Flow` retains an in-flight segmentation promise in `cutCacheRef`; `twoDFirstFlow` retains a first-blur run flag. Replacement clears their local references/guards, not the worker-owned request.
- `useHistoryTransaction` owns prepared and segmentation LRUs for Creator history. Those caches are separate from Cutout Lab's raster/preseg refs and are required by current history behavior; Increment 2 does not justify deleting them. Cutout Lab's `maskRef`, raster/geometry refs, prepared ref, live bake, and display shim are the caches that must be zeroed on replacement/unmount.
- Raw-URL fallback after bounded decode/blob failure is isolated in `cutSource`; fail that operation instead of silently sending the original oversized source to inference.

## Implemented cutover — current uncommitted tree

- `ben-chain.ts` now exposes only the fixed self-hosted `u2netp -> Silueta` chain and retains the degenerate-matte guard.
- `ben.worker.ts` no longer contains Transformers, comparison REMBG, EdgeSAM/SAM, query, or preload branches. Every inference bitmap closes in `finally`; the owner watchdog terminates the worker instead of abandoning an inner timed-out async operation. Warm ORT module/session caches remain worker-owned.
- `segment-ml.ts` no longer reads `?seg`, preloads, or substitutes a default adapter. It now owns explicit pending-request cancellation and owner disposal, and settles worker error/message-error/constructor/postMessage failures exactly once.
- Cutout Lab replacement, Clear, and unmount invalidate the active detector generation; replacement and unmount terminate detector work; unmount also clears detector/raster/prepared/display refs. Stale inference cannot publish mask or prepared output. Current UI actions/view shape is unchanged; the now-no-op warmup action retains the existing API and only preserves the crash breadcrumb.
- Creator v5.3.1 route and flow `segPresent` branches are deleted. Replacement/cancel/unmount terminate or dispose detector work, and the two flows guard stale first-blur/background publication without a new serializer or provider.
- Bounded source creation now fails loud on decode/blob failure; it never falls back to the raw oversized original.
- `@huggingface/transformers`, its lock closure, the zero-reference WebGPU ORT loader, stale detector types/comments/tests, and obsolete architecture/tuning claims are removed. No tracked SAM asset existed. Route-only `?debug=1` eruda and `?admin=1` calibration remain intentionally unchanged.

## Automated gate checkpoint

- Targeted Vitest: 3 files passed, 21 tests passed, 5 contract-owned later failures remain expected.
- TypeScript: clean.
- Scoped ESLint: zero errors; only pre-existing warnings in untouched files.
- Diff hygiene: clean.
- Exact tracked search is clear for `?seg`, Transformers/Hugging Face, EdgeSAM/SAM, BEN2, `ML_ADAPTER_ID`, `segPresent`, and the removed WebGPU loader. The final stale BEN2 example in `prepare-effect.ts` was replaced with detector-neutral wording.
- Remaining before snapshot: add/run the smallest real-route detector ownership oracle, run full suite/build/current-code visual gate, then full audit and commit/push for QA. No KAI-10218 work is included.

## Real-chain repair and proof checkpoint

- Fresh route proof exposed one real gap: generic engine prepare could flood-fill, but Cutout Lab called `segmentV531` first and stopped on an exhausted ML chain, so its advertised visible flood-fill was unreachable there. The smallest repair keeps the same bounded URL, converts it through the existing `segment()`/adapter identity after both models fail, and explicitly restores the existing warning after the degraded cut is accepted. No UI control/API changed.
- Added one proof-only Playwright oracle, `scripts/verify-cutout-v1-detector.mjs`, reusing the installed package. At fixed 1280x720 it runs Chromium and WebKit against the real route and proves: no mount/upload preload; stale `?seg=ben2` cannot alter u2netp primary; replacement cancels an intercepted request and stale output cannot publish; the next cold request succeeds; Clear invalidates output; unmount releases an intercepted request; both models fail in exact order before a visible, savable flood-fill; no remote/comparison detector traffic.
- Detector oracle passed both Chromium and WebKit. Each saw two primary-lifecycle model requests and exact forced-fallback order `/seg-models/u2netp.onnx`, `/seg-models/silueta.onnx`.
- Existing KAI-10216 preservation oracle remains byte-exact: 1280x720 primary PNG `d7a28a…`, edited OpenCV PNG `55e6178e…`, same-byte replacement identical, forced Silueta observed.
- Full Vitest passed: 57 files passed, 1 skipped; 525 tests passed, 5 expected later-contract failures, 10 skipped. TypeScript, changed-file ESLint, diff hygiene, and production build pass.
- Visual gate used the established Playwright fallback because the in-app browser runtime failed a clean initialization retry. Provenance: port 3217 is `next-server` PID 32767, cwd is this exact worktree, base HEAD `88dede…` plus the live KAI-10217 diff. Actual UI observation: primary u2netp cut shows the expected car contour and enabled Save; forced two-model failure shows the explicit flood-fill warning and enabled degraded Save. Evidence: `evidence/KAI-10217-primary.png`, `evidence/KAI-10217-flood-fill.png`.
- Physical iPhone is not available in this lane. No emulation is being mislabelled as physical-device proof; independent QA must run that contract gate before closure.

## Completion-audit corrections

- The source-to-contract audit found two pre-commit misses and corrected them before snapshot:
  1. cancellation could reject `runCutout` and then incorrectly enter the flood-fill path; `SegmentMLCancelled` now propagates, so replacement/unmount stop rather than degrade;
  2. `v531seg` still decoded the original to rebuild a bounded URL, while each model attempt decoded that URL again. It now encodes the flow's existing 1024px working canvas once, the worker creates one bitmap shared by u2netp/Silueta and closes it in one `finally`, and the caller-owned flood-fill reads the same canvas without another decode. A generation check after asynchronous encoding prevents a replaced request from spawning a late worker.
- Targeted tests, typecheck, lint, diff hygiene, Chromium/WebKit detector ownership oracle, and the byte-exact preservation oracle all re-passed after these corrections. Primary/output hashes remain unchanged.
- Dependency tree is valid and no longer contains `@huggingface/transformers`; exact tracked-source searches find no EdgeSAM/SAM, Transformers/Hugging Face, BEN2, model-query, default-adapter, or WebGPU-loader residue. The remaining ORT variants are retained because their device/runtime fallback reachability is not disproven; deleting them without physical-iPhone proof would be speculative.

## Final Builder audit verdict

- Detector/query/dependency/assets: PASS — `ben-chain.ts:10-17` is the only roster; tracked product search is clear; the dependency tree is valid; the zero-reference WebGPU loader is deleted.
- Fixed degradation chain: PASS — worker lines 123-147 reuse one bitmap across u2netp/Silueta and close it; `v531seg.ts:30-83` supplies the same-source caller fallback and exact adapter identity; Chromium/WebKit observe the exact order and visible savable warning.
- Bounded-source and resource ownership: PASS — Cutout upload lines 272-295 decodes once to the existing 1024px canvas; `v531seg.ts:11-68` encodes it once and guards a replaced generation before spawning work; worker lines 123-144 owns one bitmap; `segment-ml.ts:47-120` owns settle/reset/timeout/cancel/dispose.
- Replacement/Clear/unmount/stale publication: PASS — Cutout flow lines 272-325 and 488-549 invalidate generations, cancel/dispose the worker, clear detector/raster/prepared/display refs, and gate prepare/publication. Creator's two existing flow owners likewise cancel on replacement/cancel and dispose on unmount without adding a serializer.
- Preservation and gates: PASS — full Vitest 525 pass with only five named later-increment expected failures; typecheck, changed-file lint, diff hygiene, production build, byte-exact preservation oracle, Chromium/WebKit ownership oracle, and current-code primary/degraded visual observation pass.
- Physical-iPhone cold/warm/repeat/replacement/cancellation remains an independent QA gate, not a Builder claim. The snapshot is ready for QA, not Done.
- Necessity: no unnecessary production module, provider, serializer, preload, UI/API change, or later-increment repair was added. The single new file is the minimum proof-only browser oracle.
- Sufficiency: the code delivers every Increment-2 change/proof obligation available in this lane; task closure correctly waits for independent QA including the physical-device check.

## QA correction proof

- Restored `cutout-lab/ARCHITECTURE.md` byte-for-byte to KAI-10216 SHA-256 `a3c659a9d0766dc88701df7abad2743792491d70f4332931713c43548b193fab`; Increment 6 still owns its deletion. Removed only the stale `cutout-ai` comment from `v531seg.ts`.
- Affected static gates pass: diff hygiene, TypeScript, scoped `v531seg.ts` ESLint, and 3 targeted Vitest files with 21 passes plus 5 expected later-increment failures.
- Detector ownership oracle passes Chromium and WebKit with the exact u2netp -> Silueta fallback order. Preservation oracle passes at 1280x720 with primary/replacement SHA `d7a28a6976223e9f82f73f16d3a77f3bbec770f727805dcb85d4041d9c0daf28` and edited SHA `55e6178e24616933bba926474da07a6e8340dc50938af494663152a1176e158d`.
- Current worktree surface remains healthy on port 3217: Cutout Lab loads at 1280x720 with its existing controls/status and zero console errors or warnings. Screenshot: `.playwright-cli/page-2026-08-09T08-56-55-233Z.png`.
- Necessity: only QA's two exact corrections exist. Sufficiency: the bounded correction and required desktop/browser reruns pass; physical-iPhone cold/warm/repeat/replacement/cancellation remains an unexecuted closing QA obligation, so this is a corrected Builder snapshot handback, not task clearance.
