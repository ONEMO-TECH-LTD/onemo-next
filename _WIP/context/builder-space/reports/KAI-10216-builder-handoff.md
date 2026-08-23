# KAI-10216 Builder handoff

## Authority

- Baseline: `050d557e2ddbe99520c008e2090c202c554f03f8`.
- Branch: `session62-task/KAI-10216-cutout-v1-production-polish`.
- Contract: `../../QA-space/contracts/v1-polish-optimisation-production-contract.md`, 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`.
- First snapshot: `26d37579c0a119c2482212b6b84c482918937d75`.
- QA repair snapshot: `78a21d9d0e93f5aaf81fc9c22ac05ae462c1a30e`; local and remote branch heads match exactly.

## Result

- Preserved the existing Cutout UI and existing flow surface, including top-level `measureNode`; no interface, Figma, or UI project was added.
- Moved the existing `runCutout` and pure trace-outline-control implementations unchanged behind product-owned library paths. The dev paths are active identity re-exports for current callers, not duplicate implementations.
- Removed the Cutout `PerfHUD` mount, every Cutout `perfGesture` edge, their orphan timers, and dead `lastFileRef`.
- Added executable classification for all seven Cutout owners and every direct dependency, with DOM/React/Next exclusion on headless-classified owners and no intermediate `src/lib/cutout-lab` package. The current page is a selective test-shell donor: stale query handling, eruda diagnostics, and `?admin=1` paint calibration are explicitly excluded from the final shell.
- Replaced broad source-string behavior claims with exact unit-oracle citations and one real-route Playwright preservation oracle. It exercises Frame anchoring, all existing collective-control tests, Paint, Nodes, real GrabCut, u2netp and forced lazy Silueta, Clamp, Preview/Save, Clear, Undo/Redo, replacement, and cancellation. Visible flood-fill degradation is exercised through the existing progress callback.
- Six explicit expected failures remain assigned to KAI-10217 through KAI-10220. No later defect was repaired.
- `onemo-effects-engine` is unchanged.

## Builder audit

- Exact-move comparisons against baseline are byte-clean after import-path normalization.
- No Cutout `PerfHUD`, `perfGesture`, `lastFileRef`, or `/(dev)/` import remains in the five future portable owners.
- Compatibility re-exports remain consumed; no second implementation survives.
- Stale architecture/HUD material outside this increment remains for KAI-10221; no adjacent cleanup was taken.

Necessity: **no unnecessary elements.** The attempted replacement interface was removed after the owner correction.

Sufficiency: **delivers KAI-10216 in full.** Every contract-line-52 behavior has an exact executed oracle or exact executed-test citation; lines 53-62 map to the corrected adoption record, exact owner moves/re-exports, debug/dead-edge deletion, current API preservation, static gates, and the live product journey.

## Proof

- Tests: 57 files passed plus one skipped file; 524 passed, six expected later-increment failures, and ten skipped.
- Real-route preservation script: pass at fixed 1280x720. Primary and same-byte replacement Save are byte-identical; Frame, Nodes, Paint, real lazy OpenCV GrabCut, Clear/Undo/Redo, cancellation, and forced u2netp-to-Silueta fallback pass.
- Typecheck: pass.
- Scoped lint: pass.
- Diff hygiene: pass.
- Production build: pass after the final UI/API correction; 22 pages generated.
- Live surface: port 4001, PID 34639, cwd is the exact worktree at first snapshot plus the proof-only QA repair diff.
- Journey: Upload `public/assets/test-artwork.png` -> u2netp Detect -> Detail 25 -> Preview -> Save; no browser console errors or warnings.
- Builder reconciliation run: clean new Chrome 145 headless context; local/session storage cleared; viewport 1200x800; Upload → Detect → Vector → Detail 25 → Preview → Save; zero console errors/warnings.
- Screenshot: `../evidence/KAI-10216/playwright-reconciled/upload-detect-edit-preview.png`, SHA-256 `13231509bcced5609db190998a8cdfea01644c782e856c03129e00bf63edec08`.
- Builder fixed-viewport oracle at 1280x720 repeatedly emits 1330x621 RGBA SHA-256 `d7a28a6976223e9f82f73f16d3a77f3bbec770f727805dcb85d4041d9c0daf28`; same-byte replacement is byte-identical.
- QA's independent 1200px-wide run repeatedly emits 1329x622 RGBA SHA-256 `20ea0230c645f82ceefbb9f17dc5859466b5035928b8919ed13eb904ac80be3b`. Both records are retained. QA classified the one-pixel viewport dependence under KAI-10219; KAI-10216 does not change product output.

## QA scope

Re-audit the exact repair commit independently. Do not infer clearance from Builder evidence. KAI-10217 remains blocked until QA and Meta clear the repair snapshot.
