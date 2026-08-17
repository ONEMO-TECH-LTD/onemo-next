# KAI-10217 Builder handoff

- Snapshot: `de31f1e3b16d4f756e2d805b7040decef2cb1738` (supersedes `216aaeb7067fbe8953cd4492a184375d27c78994`).
- Branch: `session62-task/KAI-10217-detector-resource-ownership`.
- Remote branch resolves to the same SHA.
- Base: KAI-10216 Meta-cleared `88dede13066dd7e22db365568943150f90e22e0a`.

## Delivered

- Deleted the EdgeSAM/SAM, comparison/query, Transformers, default-adapter, preload, dependency/lock, stale type/comment/test, and zero-reference WebGPU-loader tail.
- Preserved fixed u2netp -> lazy Silueta -> explicit flood-fill degradation with current UI/API unchanged.
- Reused the existing 1024px working canvas; one encoded URL and one worker bitmap serve the entire model chain. The bitmap closes on every success/throw path; the temporary URL is revoked.
- Added existing-owner cancellation/disposal for replacement, Clear, timeout, worker death, and unmount; stale detector/prepare output cannot publish. Cutout raster/preseg/display refs clear on replacement/unmount. Creator's existing two flows now remove the same query bypass and cancel their shared detector owner.
- Kept intentional warm ORT sessions inside the worker. No provider, serializer, production seam, UI project, or later-increment repair was added.

## Gates

- Vitest: 57 files passed, 1 skipped; 525 passed, 5 expected later failures, 10 skipped.
- Typecheck, changed-file ESLint, diff hygiene, dependency-tree validation, and production build pass.
- Preservation oracle: exact primary/replacement PNG `d7a28a…`; exact OpenCV edit `55e6178e…`; forced Silueta passes.
- Detector oracle: Chromium + WebKit pass no-preload/query override, replacement cancellation, stale suppression, recovery, Clear, unmount, exact fallback order, and visible savable flood-fill.
- Current-code visual gate: port 3217 serves this exact worktree/SHA. Primary u2netp and forced flood-fill states are visibly correct with Save enabled. Evidence: `../evidence/KAI-10217-primary.png`, `../evidence/KAI-10217-flood-fill.png`.

## QA gate

- Independently reproduce the snapshot and source audit.
- Run the contract's physical-iPhone cold/warm/repeat/replacement/cancellation checks. Builder had no physical device and does not substitute emulation.
- KAI-10218 remains untouched and locked until QA then Meta clear this snapshot.

## QA correction

- Restored `cutout-lab/ARCHITECTURE.md` byte-for-byte to KAI-10216 SHA-256 `a3c659a9d0766dc88701df7abad2743792491d70f4332931713c43548b193fab` and removed the stale `cutout-ai` comment from `v531seg.ts`. No executable detector behavior changed.
- Rerun passes: diff hygiene, typecheck, scoped lint, 21 targeted tests plus five expected later-increment failures, Chromium/WebKit detector oracle, and the fixed-viewport preservation oracle with exact primary/replacement and post-OpenCV hashes.
- Port 3217 served this exact worktree during the correction gate; the existing Cutout Lab surface loaded at 1280x720 with zero console errors or warnings.
- Physical-iPhone cold/warm/repeat/replacement/cancellation remains mandatory and unexecuted. This snapshot returns to QA; it is not a task-clear claim.
