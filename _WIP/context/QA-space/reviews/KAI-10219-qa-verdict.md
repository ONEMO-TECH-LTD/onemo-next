# KAI-10219 QA verdict

## Verdict

**CLEAR** on exact snapshot `5db841832c3adc35e0f1ffd85efe5d2add4bcefd` against contract `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 4.

- Necessity: **no unnecessary product elements**. The diff deletes dormant Cutout output paths, adds one bounded opt-out to an existing preparation owner, adds cancellation to the existing compositor seam, and repairs publication through the existing flow. No second compositor, output framework, relocation, OpenCV work, or later-task build-ahead exists.
- Sufficiency: **delivers Increment 4 in full**. The necessary Cutout adapter remains; shared preparation defaults, Tile, Grid, Creator, and 3D consumers remain; Blend-0 is conditional; Preview/Save are truthful at the current cap; failure and SVG resource exits settle.

## Independent proof

- Source/diff: full changed-file and immediate-caller read; `git diff --check` clean. The Cutout-only preparation skip avoids at least 18,874,368 bytes of retained RGBA output canvases on the recorded 1536×1536 fixture, while shared callers still receive `composite` and `edgeComposite`.
- Static: 57 test files pass + 1 skipped; 531 tests pass + 1 expected fail + 10 skipped; typecheck passes; production build passes; full lint has 0 errors; changed-file lint has 0 errors.
- Current runtime: port 3217 serves the reviewed worktree at the reviewed snapshot. Preservation, detector, flow, and output oracles pass.
- Pixel truth: Chromium Preview and Save are exact-equal 1330×621 RGBA pixels, SHA-256 `f852cabd19d2ea1f71ca9876cf6a72f14f6df21a85791c7cbba7f89c94e60b83`, with transparent and opaque pixels. WebKit witnesses the same Preview/Save source canvas at 1329×622; its saved PNG also contains transparent and opaque pixels. Rejection, timeout, cancellation, replacement, and PNG-encode failure settle visibly.
- Visual gate: QA opened its own current-route captures. Preview shows the capped cutout and an explicit ready status; the edit surface has one Blend control and no Mirror/Tile/fill controls. Evidence: `KAI-10219-evidence/qa-output.png` and `KAI-10219-evidence/qa-controls.png`.

The stale route `ARCHITECTURE.md` is not edited here because authoritative Increment 6 explicitly deletes it whole; updating prose now would be throwaway scope.

KAI-10220 remains locked. KAI-10219 may move to Meta review; this QA verdict does not close product/runtime sign-off.
