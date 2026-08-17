# KAI-10220 QA verdict — `ad6b54cf…`

> **SUPERSEDED — historical snapshot only.** Dan reverted the direct-pixel control migration and restored all five Vector controls to their original v1 meanings/ranges. This HOLD no longer governs current KAI-10220 and carries no open device gate forward.

Verdict: **HOLD — no source rework.** The correction is code-clean and behaves correctly. The accumulated owner scope still requires the physical-iPhone capped/original output comparison before QA can clear the increment.

## Independent evidence

- Pinned local and upstream to `ad6b54cfb2f35edb1c8316ac3a81a5d436681dcd`; exact correction delta is eight tracked files, `+63/-27`. QA changed no product source.
- Full-read the exact diff and all eight current files. PURE is exactly `1/1/1/1/1`; Detail is source-relative `0..100` with `0 = full`; Offset/Simplify/Smooth/Radius ranges are `0..250px`, `0..40px`, `0..200` strength and `0..350px`. CLASSIC–SPACE retain the existing conversion seam.
- Preset/raw tuning reuses `replaceHistory()` and the existing snapshot. It adds no Undo step. The existing atomic restore reinstates both recipe and label.
- Serialized suite: 57 files passed, one declared skipped; 542 tests passed, 10 declared skipped. Typecheck, scoped zero-warning lint, exact diff check and production build passed.
- All five exact-current Cutout oracles passed. Chromium/WebKit preserved the detector chain, FIFO/history/tools, Preview/Save truth, one OpenCV provider, raw GrabCut hashes, shared continuous-alpha finish, Paint behavior, preset/source ownership and capped/original switch-back hashes.
- QA-owned current-route observation served the exact commit from the correct worktree on port 3231. Upload → actual u2netp Detect succeeded in 2590ms; TECHNO selection created no Undo step; accepted Paint switched to ZERO; Undo restored TECHNO and Smooth 20. PURE showed `1` for all five controls with the required ranges. The canvas stayed `1024×1024`; browser console had zero warnings/errors.
- Visual evidence: `../evidence/KAI-10220-ad6b54cf/qa-current-pure-all-ones.png`, 1280×1073, SHA-256 `ed8e895e94f99db00248bbc9af4deb70d02ec23dea5bb11d970be384ee98585d`.

## Remaining owner gate

On the exact `ad6b54cf…` Vercel deployment, a physical iPhone must compare capped 1536px and original-upload Preview/Save for visible quality, preparation time, Save completion, repeat stability and Safari freeze/reload/crash behavior. Desktop Chromium/WebKit cannot substitute for that product/device observation.

Necessity — **no unnecessary elements** in the correction.

Sufficiency — **partial only because the required physical-iPhone capped/original comparison remains unrecorded.** KAI-10220 stays In QA review; KAI-10221 stays blocked.
