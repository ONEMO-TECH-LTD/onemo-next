# KAI-10217 QA ledger

## Pinned authority

- Review commit: `216aaeb7067fbe8953cd4492a184375d27c78994`.
- Branch/upstream: `session62-task/KAI-10217-detector-resource-ownership`; local and remote heads matched at intake.
- Contract: `../contracts/v1-polish-optimisation-production-contract.md`, 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 2.
- Baseline: QA-cleared KAI-10216 snapshot `88dede13066dd7e22db365568943150f90e22e0a`.
- Boundary: independent QA evidence and verdict only; no product edits; KAI-10218 stays locked.

## Required proof

1. Complete diff and source/caller audit: necessity, sufficiency, residue deletion, preserved degradation chain, bounded-source truth, lifecycle ownership, rollback isolation.
2. Full tests, typecheck, scoped lint, production build, and deterministic preservation/detector oracles.
3. Real primary u2netp, forced lazy Silueta, forced visible flood-fill, replacement, cancellation, timeout, and worker-death paths.
4. Current-code Chromium and WebKit observation with provenance and captured evidence.
5. Physical-iPhone cold, warm, repeat, replacement, and cancellation. Emulation is not a substitute.

## Minimal QA diff

- Add this ledger and one final verdict artifact; update Linear with the exact verdict.
- Do not change implementation to make the review pass.

## Intake state

- Worktree HEAD and upstream both matched the requested commit.
- Tracked tree was clean; `_WIP/` was the only untracked root.
- Builder reported no physical-device proof. That gate remains open until independently executed or returned as a blocker.

## Source read — detector core and Cutout owner

- `ben-chain.ts` now owns exactly `u2netp -> silueta`; degeneracy sends an unusable primary matte to the lazy fallback.
- `ben.worker.ts` decodes the bounded object URL once, reuses one bitmap across the model chain, closes it in `finally`, and reports the successful adapter. ORT sessions remain intentionally warm inside the worker.
- `segment-ml.ts` owns one lazy worker, one pending map, watchdog settlement, cancellation, worker-error/message-error reset, and final disposal. Timeout/worker failure rejects every pending request once and terminates the shared owner.
- `v531seg.ts` encodes the already-bounded 1024px working canvas once, always revokes its temporary object URL, preserves `SegmentMLCancelled`, and invokes the visible flood-fill only for non-cancellation model failure.
- `flow.ts` invalidates Detect by generation on replacement/Clear/unmount; replacement and Clear cancel active segmentation; unmount disposes the worker and clears Cutout raster/prepared/display refs. `acceptMask` checks the generation again after prepare before publishing detector output.
- Existing non-atomic upload/history/tool defects remain present and are still owned by Increment 3; no KAI-10218 repair was observed in this read.

## Source read — affected product callers and tests

- Full-read the changed Cutout route, finish path, mask/effect preparation, GrabCut, shared v5.3.1 routes/flows/contracts, changed detector tests, and the new browser detector oracle.
- The preserved product chain is source-backed: primary `u2netp`, lazy `silueta`, then visible flood-fill. The new detector oracle proves primary, replacement/stale suppression, Clear/unmount, Chromium/WebKit, and a forced dual-model failure into flood-fill.
- `segment-ml.test.ts` independently encodes timeout, cancellation, and worker-death settlement. `ben-chain.test.ts` encodes fixed adapter order, self-hosted assets, and degenerate-primary fallback.
- The new detector oracle does not itself prove a successful forced-Silueta run; that remains an open real-route gate to execute through the existing preservation oracle.
- The known Upload/history/tool and GrabCut no-op defects remain unchanged and are still represented as later-increment expected failures. No downstream repair was observed.
- Necessity candidate requiring diff confirmation: Cutout `ARCHITECTURE.md` was rewritten into a new short narrative even though Increment 6 says the stale Cutout architecture document is deleted rather than replaced. This is not yet a verdict finding; the exact diff and contract boundary must decide it.

## Continuity checkpoint

- Rehydrated from the exact latest Transcript Vault segment after compaction and resumed from this ledger. No completed source read was repeated.
- `/o-proto` is consistent with the active AGENTS rules for this review: exact cadence is QA verdict then stop; no product edits; QA must observe current code independently.

## Complete diff audit — detector/resource cutover

- Reviewed every changed source/test file and every changed lockfile hunk from KAI-10216 (`88dede13`) to the requested snapshot. The generated lock closes the removed Transformers/ORT/protobuf/sharp transitive tree; `npm ls` reports no `@huggingface/transformers`, `onnxruntime-node`, or npm `onnxruntime-web` installation.
- Tracked runtime assets contain only `u2netp.onnx`, `silueta.onnx`, and the pinned same-origin WASM runtime family. No EdgeSAM/BEN2/BiRefNet/RMBG comparison weight is tracked or referenced. The obsolete WebGPU runtime module is deleted and has no remaining consumer.
- Product-source searches found no live selector/model-map/Transformers/ML-adapter fallback. The only `?seg=ben2` use is a new oracle input that proves the production route ignores the stale query; it does not forward a selector.
- Shared v5.3.1 callers now remove the query adapter, cancel active inference on replacement/cancel, and dispose the module-owned worker on unmount. Their existing orchestration stays otherwise intact.
- Cutout uses one already-decoded 1024px canvas, creates one temporary object URL, and the worker fetches/decodes it once. The same bitmap is reused through the fixed chain and closed in one `finally`; sessions stay warm only inside that worker lifetime.
- `segment-ml.ts` has one lazy worker owner and pending map. Watchdog, worker error/message error, explicit cancellation, and disposal each terminate the matching worker and reject all still-pending requests once; late messages cannot republish settled work.
- No new serializer/provider/parallel detector path was added. The later Upload/history/FIFO/output/OpenCV fixes remain unimplemented and dependency-gated.

## Necessity issue — confirmed

- `src/app/(dev)/cutout-lab/ARCHITECTURE.md` is replaced with 53 lines of new hand-written architecture prose in this increment. Contract Increment 6 explicitly owns deletion of this stale file and says not to replace it with narrative prose. The rewrite is downstream build-ahead and cannot survive the Increment 2 necessity gate.
- One stale `cutout-ai` name remains in `v531seg.ts` comments even though that stack was removed. This is a tiny residue, but the architecture rewrite is the blocking unnecessary delta; any correction should remove both without expanding scope.

## Automated gates

- Full Vitest: 57 files passed, 1 skipped; 525 tests passed, 5 expected failures for dependency-gated later increments, 10 skipped. No unexpected failure.
- TypeScript, scoped ESLint across every changed executable source/test, and `git diff --check` passed.
- Next.js production build passed and emitted `/cutout-lab`, `/effect-creator/v5.3.1`, and `/effect-creator/v5.3.1/2d`. The existing repository-wide middleware deprecation warning remains non-blocking and unrelated.
- Deterministic preservation oracle passed on the exact current-code server: primary u2netp, forced real Silueta, real OpenCV edit, same-byte replacement, Clear/Undo/Redo, cancellation, exact 1330x621 and 1415x660 RGBA hashes.
- Detector oracle passed independently in Chromium and Playwright WebKit: no eager model request, stale query ignored, real replacement cancellation/stale suppression, subsequent primary recovery, Clear/unmount, and forced fixed-order dual-model failure into usable visible flood-fill.
- Unit lifecycle gates passed for the exact implementation: 120-second watchdog worker replacement, all-pending cancellation once, worker error settlement, late-completion suppression, and omitted-adapter loud failure.

## Current-code visual gate

- Provenance: port 3217 is served by the requested Codex worktree's Next dev process; worktree HEAD is `216aaeb7067fbe8953cd4492a184375d27c78994`.
- Independently observed the real `/cutout-lab` route at fixed 1280x720 through the declared headed Playwright Chrome fallback. Primary u2netp, forced lazy Silueta, and forced visible flood-fill each produced a savable on-canvas cut with zero console warnings/errors.
- Captured and visually inspected `KAI-10217-evidence/qa-primary-u2netp.png`, `qa-forced-silueta.png`, and `qa-forced-flood-fill.png`. The flood-fill capture is visibly labelled as degraded and differs from the model cuts, so the fallback is not silently misrepresented.
- The repository Playwright package independently ran the WebKit oracle. The separate CLI wrapper lacked its own WebKit binary, so screenshots use Chrome; no emulation or wrapper install was substituted for the already-passing repository WebKit gate.

## Real runtime lifecycle probes

- Held the live u2netp model response on the current `/cutout-lab` route until the implementation's actual watchdog fired. It terminated the worker, settled into visible usable flood-fill after `121173ms`, and did not hang the UI.
- Forced the exact emitted `ben_worker` browser Worker to throw as a native Worker error. The product owner degraded visibly, then the next Detect constructed a clean worker and completed as u2netp. This exercises the actual page/worker error boundary rather than Vitest mocks.
- Durable probe: `KAI-10217-evidence/runtime-lifecycle-probe.mjs`, SHA-256 `5e3b1130dd061d776200c883d84a1fac0f97d1dfc50d404879926fd6e46df79d`.

## Physical-iPhone gate — blocked

- No physical iPhone/iPad is attached over USB: System Profiler and IORegistry returned no device. No `idevice_*`, Configurator `cfgutil`, Xcode, `xctrace`, or `devicectl` installation is available to discover/control a Wi-Fi-paired device; the active developer directory is Command Line Tools only.
- Therefore the contract-required physical-iPhone cold, warm, repeat, replacement, and cancellation matrix was not executed. Desktop emulation was not used as a substitute.
- This is a mandatory proof gap, not evidence of a product defect. The exact snapshot cannot receive QA CLEAR until an actual declared iPhone executes the matrix.

## Final intake integrity

- Local HEAD and upstream still match the requested commit exactly. Product tracking remains unchanged; only the untracked `_WIP/` QA records/evidence were added.
