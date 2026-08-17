# KAI-10219 independent QA ledger

## Authority

- Snapshot: `5db841832c3adc35e0f1ffd85efe5d2add4bcefd`.
- Parent: Meta-cleared KAI-10218 snapshot `0b747d813e62f0ce77b7f2b3f9a93e213a7741a7`.
- Local and upstream heads match.
- Contract: 177 lines, SHA-256 `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 4.
- Live KAI-10219 entered `In QA review`; KAI-10220 remains Backlog and blocked.

## Atomic deliverables

1. Keep `bakeStickerEngine` as the necessary Cutout clip/crop/coordinate adapter around the one canonical compositor.
2. Measure Cutout-only unused preparation cost before adding a skip; retain shared defaults/outputs for every other caller.
3. Remove Mirror and Cutout fill-choice/mosaic glue; Clamp is Cutout's only fill while shared Tile/non-Cutout callers remain intact.
4. Remove only proven Cutout-dormant preset/vignette/tint/scale/pan settings, UI ranges, and transform path.
5. Preserve Blend 0 bypass only for neutral, in-frame, matted output; outgrown Clamp and matteless degradation still compose; preserve current cap.
6. Preview and Save produce truthful capped transparent pixels or a visible failure; no checkerboard/stale substitute.
7. Settle image/SVG rejection, timeout, cancellation, and resource ownership on every output exit.
8. Prove display-resolution editing, Preview/Save full-mode agreement, Chromium/WebKit output, and shared Grid/Creator/3D callers where shared loading/preparation changed.
9. No Cutline, raw-natural Save, compositor migration, output framework, OpenCV work, or KAI-10220 build-ahead.

## Review state

- Full-read live Linear authority and 177-line contract.
- Full-read Builder ledger and its retained temporary-profile script. The ledger records three 1536px runs and a two-output retained-allocation witness; the final snapshot intentionally contains no production profiling sink, so timing remains a historical record pending independent code/allocation corroboration.
- Full-read `finish.ts`, `flow.ts`, `ui-config.ts`, `composite.ts`, `prepare-effect.ts`, `prepare-effect-fallback.test.ts`, package entry, and the 218-line output oracle.
- Source findings so far: `bakeStickerEngine` remains the Cutout clip/crop/coordinate adapter around `composeEffectArtwork`; Cutout opts out only of unused shared prepared outputs; the shared default still builds both; Clamp/Tile remain in the shared compositor; Cutout dormant controls/transform/mosaic code are removed; Blend-0 bypass is conditional on neutral + in-frame + matted; SVG load now owns reject/timeout/cancel cleanup and Blob URL revocation; Preview/Save now fail visibly rather than substituting display/checkerboard output.
- Full-read remaining changed page/tests and the immediate shared preparation/compositor consumers: v5.3.1 primitives, Grid Lab page/panel, and the 3D `ShapedModel`. Default `prepareEffect` still returns `PreparedEffect` with `composite` + `edgeComposite`; Grid still consumes that composite, exposes Clamp + Tile, and recomposes through the canonical compositor; 3D still requires and consumes both outputs. Only the two Cutout prepare owners pass `buildOutputs:false`.
- Exact diff maps to the contract without product expansion: deletions remove dormant Cutout-only output paths; one bounded preparation option preserves every existing caller default; one optional compositor cancellation callback preserves shared call semantics; flow/page changes make existing Preview/Save publication truthful. No relocation, output framework, compositor migration, OpenCV change, Cutline, or KAI-10220 code is present.
- Independent allocation corroboration: the skipped pair are two full-size RGBA output canvases. At the recorded 1536×1536 fixture that is a minimum `2 × 1536 × 1536 × 4 = 18,874,368` bytes before temporary SVG/filter allocations. Cutout source consumes neither output; Grid/3D do. This establishes materiality independently of the Builder's historical timing values.
- The route's stale `ARCHITECTURE.md` still names Mirror/mosaic/`drawCutout`, but authoritative Increment 6 explicitly owns deleting that whole stale file without replacement. Editing it in Increment 4 would add throwaway work, so it is not an Increment-4 blocker.
- Static gates on the exact snapshot: `git diff --check` clean; 57 test files pass + 1 skipped, 531 pass + 1 expected fail + 10 skipped; typecheck passes when run after build; production build passes; full lint has zero errors (404 pre-existing/generated warnings); changed-file lint has zero errors (only `package.json` config-ignore warning).
- The first parallel test/typecheck attempt produced two unrelated Grid timeout failures and `.next/types` deletion races while the build was mutating `.next`; sequential reruns passed. Those are harness contention, not snapshot failures, and are not used as pass evidence.
- Runtime provenance: port 3217 is served by the exact Codex worktree; both launcher/server CWDs match it; the process started after the reviewed snapshot; HEAD/upstream remain `5db841832c3adc35e0f1ffd85efe5d2add4bcefd`.
- Independent current-route preservation oracle passes: fixed 1280×720 first PNG 1330×621 RGBA `d7a28a…`; edited/GrabCut PNG 1415×660 RGBA `55e6178e…`; replacement is byte-identical; primary/Silueta coverage remains.
- Independent detector oracle passes on Chromium and WebKit with exact `u2netp → Silueta` ordering. Independent flow oracle passes ordered burst settlement.
- Independent output oracle passes. Chromium Preview and Save are exactly the same 1330×621 RGBA pixels (`f852cabd…`, 94,842 transparent / 727,814 opaque); failed Preview preserves editing output; PNG failure is visible; replacement cancellation settles. WebKit witnesses the same source canvas for Preview/Save at 1329×622 and the decoded PNG has transparent + opaque pixels (`e1af79e…`).
- QA-owned visual captures were opened and inspected: Preview visibly shows the transparent capped sticker result and the status says the preview is ready with the same capped pixels as Save; the editing view exposes only the single Blend control and no Mirror/Tile/fill controls. Captures: `KAI-10219-evidence/qa-output.png` (`d720cb…`) and `qa-controls.png` (`982090…`).
- All atomic deliverables have source + executable proof. QA verdict: CLEAR; verdict artifact `KAI-10219-qa-verdict.md`.
