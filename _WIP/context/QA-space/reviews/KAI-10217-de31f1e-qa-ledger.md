# KAI-10217 de31f1e QA re-review ledger

## Authority

- Snapshot: `de31f1e3b16d4f756e2d805b7040decef2cb1738`.
- Parent: `216aaeb7067fbe8953cd4492a184375d27c78994`.
- Local and upstream heads match.
- Contract: 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 2.
- Linear entered `In QA review`; KAI-10218 remains dependency-gated.

## Correction-delta audit

- Exactly two tracked files changed from the rejected snapshot.
- `ARCHITECTURE.md` is byte-identical to KAI-10216 snapshot `88dede13066dd7e22db365568943150f90e22e0a`, SHA-256 `a3c659a9d0766dc88701df7abad2743792491d70f4332931713c43548b193fab`.
- `v531seg.ts` changes only its opening comment and removes the stale `cutout-ai` reference.
- No executable source changed in the correction delta.
- Both changed files were full-read. `git diff --check` passes.

## Independent gates

- Targeted detector tests: 21 pass, 5 named later-increment expected failures.
- Typecheck, scoped ESLint, `git diff --check`, and production build pass.
- Detector oracle passes Chromium and WebKit with u2netp then lazy Silueta fallback order.
- Fixed-1280x720 preservation oracle passes: primary/replacement RGBA PNG `1330x621`, SHA-256 `d7a28a6976223e9f82f73f16d3a77f3bbec770f727805dcb85d4041d9c0daf28`; post-GrabCut RGBA PNG `1415x660`, SHA-256 `55e6178e24616933bba926474da07a6e8340dc50938af494663152a1176e158d`.
- Port 3217 provenance: listener command resolves to this worktree; worktree HEAD is `de31f1e3b16d4f756e2d805b7040decef2cb1738`.
- Visual fallback: Playwright opened the real `/cutout-lab` route at 1280x720. The unchanged Cutout Lab UI rendered ready for upload. Screenshot: `KAI-10217-evidence/qa-de31f1e-current-route.png`, SHA-256 `bf27dc799a3db3c0a83b38a4a73069331d68619024a16b4fc749a0d344c88771`.

## Physical-device gate

- USB system inventory contains no iPhone/iPad.
- `idevice_id` and `cfgutil` are unavailable.
- `xcode-select` points to Command Line Tools; `xctrace` is unavailable.
- Cold/warm/repeat/replacement/cancellation on physical iPhone therefore remains unexecuted. Desktop or emulated evidence was not substituted.

## Verdict

- Source accuracy: correction delta passes; no executable change or regression found.
- Necessity: no unnecessary elements in the correction delta.
- Sufficiency: partial only because the required physical-iPhone matrix has not run.
- Overall: **REVISE — code correction clear; physical-device proof still required.**
- Keep KAI-10217 in `In QA review`; KAI-10218 remains locked. There is no further Builder code rework from this review.

## Partial physical-iPhone evidence

- Dan observed Upload then successful u2netp Detect on the owner-confirmed exact Vercel preview. The photo visibly shows the completed cut, enabled Save, `Status: done (cut: u2netp)`, and `MAGIC CUT 6018ms`.
- Evidence file verified: `../../builder-space/evidence/KAI-10217-physical-iphone/iphone-detect-6018ms.jpg`, 590x1280 JPEG, SHA-256 `79f1895adc3f8090efc4ebda32800d6fc8bebf8da901dc43fe46ba3a92670ffb`.
- Source confirms the displayed duration starts immediately before `segmentV531` and is committed immediately after it returns (`flow.ts:306-309`); `acceptMask`, prepare, and bake begin afterward (`flow.ts:310-312`). The 6018ms is therefore detector-path time, not end-to-end cut completion time.
- This proves one physical-iPhone u2netp Detect succeeded. It cannot be classified cold or warm: device model, iOS/Safari, Low Power state, prior page/model/session state, and input dimensions were not recorded.
- Still open: classified cold/warm, repeat, same-session replacement during Detect, and Clear/navigation cancellation. Verdict remains REVISE; KAI-10218 remains locked.

## Separate GrabCut observation

- KAI-10220 now owns Dan's visible stair-step finding. Current source confirms a 512px maximum work dimension (`cutout-grabcut/index.ts:22-25`), nearest-index expansion to the full mask (`index.ts:91-93,118-121`), and verbatim GrabCut mask acceptance (`flow.ts:241-245,368-375`).
- This does not expand or clear KAI-10217. KAI-10220 must prove the smallest existing finishing seam; no new smoother or raw-GrabCut semantic change is authorised by this QA note.

## Final owner-scoped QA clearance

- Dan ruled after physical-iPhone testing: “Ok the iPhone passes progress to the next task.”
- This supersedes the earlier request for a larger physical-device matrix as a KAI-10217 progression blocker.
- Source accuracy: CLEAR. Necessity: no unnecessary elements. Sufficiency: delivers Increment 2 in full under the scope owner's product-device acceptance.
- Final QA verdict: **CLEAR** on exact snapshot `de31f1e3b16d4f756e2d805b7040decef2cb1738`.
- Advance KAI-10217 to `Ready for Meta`; remove KAI-10218's dependency block and advance it to `Ready for Builder`.
