# KAI-10221 Builder ledger

## 2026-08-10 — start

- Exact predecessor: `501a30e1b15ba4f42d185871e1f9055be6da7452`, independently QA CLEAR; KAI-10220 closed on QA by Dan's explicit Meta waiver.
- Worktree: `/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.codex/worktrees/s62-pixel-v1-050d557e`.
- Branch: `session62-task/KAI-10221-portable-package`, created at the predecessor snapshot.
- Authority: contract `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, 177 lines, Increment 6 plus later owner corrections recorded chronologically in Linear/transcripts.
- Hard boundaries: preserve current UI behavior/API; no Figma/UI redesign; no generic framework; no duplicate package; no `onemo-effects-engine` population; no personal-preset implementation; Grid remains the only size/rung/magnet owner.
- Hydration/probe block: full-read the directive/source ledgers and every current Cutout owner/caller/export; trace the live import and output/Contour/Grid seams; record the smallest complete cutover before editing product source.

## 2026-08-11 — correction dependency cleared

- KAI-10284 QA CLEAR authority: `89e23e24af5c0e8f2ee36c651f0b60f5be31619b`.
- Cleared commits cherry-picked without squashing: `b34b9b69`, `881a6fb1`, `5204c0ee`, `3bfcb492`.
- Current local/upstream head: `3bfcb49288ccf4c78c3a19b2b97b1297cb8470d9`.
- KAI-10221 is Building; portability work resumes from this pushed cleared head.

## Necessity minimal diff

1. Exact-move the six route-owned production owners into one product studio module and move pure history under `src/lib`; replace the route page with a thin mount. Split only the proven route coupling: query/debug/calibration stays in the route through one narrow calibration slot. Delete the old owners in the same cutover.
2. Add one headless final-result builder beside existing vector truth. It records final `VShape`, working-mask scale, exact `geometry-truth.ts` contour, artwork/mask identity and versioned inputs. Test that output boundary directly; do not import or adapt to the legacy or unfinished Grid engine, and add no sizing or magnet math.
3. Replace `scripts/cutout-lab-verify.mjs` in place with the final journey, delete stale `ARCHITECTURE.md`, and add one generated closure/analyzer record plus its generator. No second verifier or prose architecture file.
4. Run the integrated static, Chromium/WebKit and current-route visual gates. Retain phone diagnostics until the exact candidate is deployed for Dan's Low Power off/on iPhone check, then remove route diagnostics before QA handoff.

Necessity — no element beyond the contract: one move, one concrete result seam, one verifier replacement, one generated record.
Sufficiency — covers every Increment 6 clause; physical-iPhone evidence remains the final external gate, not silently omitted.

## 2026-08-11 — owner correction: Grid binding deferred

- Active Grid replacement is still in flight in the dedicated Grid lanes; no stable downstream contract exists to integrate against.
- KAI-10221 still packages Cutout now: portable headless/browser owners, preserved current UI-facing API, and one deterministic final-result boundary.
- Removed from this sprint: import of `src/lib/effect/grid.ts`, direct Grid consumer proof, guessed adapter/request shape, and any claim that Grid integration is complete.
- Later Grid integration consumes the recorded Cutout result after the new Grid interface freezes; Cutout owns no sizing, rung, or magnet logic.

Necessity — no premature Grid dependency or speculative adapter remains.
Sufficiency — the portable Cutout package and exact downstream output boundary remain delivered in full; Grid integration is explicitly outside this corrected sprint.

## Result-boundary source probe

- `shapeRef` is the final resolved/edited `VShape` in the 1024px working-canvas coordinates.
- `finishSpec` scales the engine spec uniformly by `workingWidth / spec.maskWidthPx`; therefore the result scale is `spec.mmPerPx * spec.maskWidthPx / workingWidth`, with working canvas width/height as mask dimensions.
- `geometry-truth.ts` already owns both manufacturing `Contour` derivation and vector identity. The result builder will call those owners directly and add no contour math.
- Exact artwork hashing remains on-demand at result export rather than upload, matching the existing privacy/memory rule in `effect/types.ts`; the flow retains the uploaded `File` only while that artwork is active.
- Exact mask hashing is also computed only when the result is requested. The pure result module receives precomputed identities and has no DOM, React, File, crypto, Grid, or repository coupling.
- Public boundary addition is one concrete `actions.exportResult()` call. The current UI ignores it, so existing rendering and interaction remain unchanged; future UI/manufacturing consumers receive a snapshot without reaching into flow refs.

## Result-boundary snapshot

- Pushed exact snapshot: `e5c7af611f63d9cdf75b6da2f83ed20e11f1848d` (local equals upstream).
- Added one pure `src/lib/cutout-studio/result.ts` owner and one focused contract test; flow adds only on-demand exact hashing and `actions.exportResult()`.
- Artwork bytes are not decoded or copied during upload for identity; hashing occurs only when a consumer requests the manufacturing result.
- Result test, typecheck, scoped lint, and diff hygiene pass. No Grid import, adapter, sizing, rung, or magnet logic exists in the delta.

## Portable closure snapshots

- `347dfa33609b21a39e0c705e57efb9fa3565fadb`: stale upload-only verifier replaced by the full preservation journey; stale route `ARCHITECTURE.md` deleted; generated closure analyzer added; prototype-history comments removed.
- `d7cf8197b0609624b548cb129de5e3c696040624`: final diagnostic cutover. The iPhone stage breadcrumb remains active only in the excluded dev mount; the portable source closure has no `localStorage`, eruda, query, calibration panel, or debug sink.
- `97ddfb39c222f978301c0de3dc9f92e5b6076474`: exact available runtime evidence recorded in the generated closure.
- Local and upstream resolve to `97ddfb39c222f978301c0de3dc9f92e5b6076474`.

## Generated closure evidence

- Record: `src/components/cutout-studio/closure.generated.json`, SHA-256 `2dfcb9510ba6cad9d1b1e7b053d4469bd8f50d49da0d4b7987c5961580cf2aa7`.
- Runtime closure: 40 source files, 337,511 bytes; every file has source SHA, exact same-path `onemo-effects-engine` destination, and headless/browser-adapter/browser-React classification.
- Route-referenced emitted assets (shared + route, explicitly not Cutout-exclusive): 1,298,858 raw bytes; 363,812 gzip estimate; 297,118 Brotli estimate.
- Active assets only: u2netp, Silueta, ORT entry module, threaded module/WASM. Dependencies and installed license metadata recorded; `paperjs-round-corners` correctly remains `UNKNOWN` because its installed package declares no license.
- One named owner each for flow, history, FIFO, scheduler, compositor, Cutout adapter, detector, GrabCut provider, and result.
- Grid integration is recorded as deferred until the replacement Grid contract freezes; no Grid source or API enters the closure.

## Exact final gates

- Production build on exact `97ddfb39c222f978301c0de3dc9f92e5b6076474`: pass; `/cutout-lab` statically emitted. Regenerating the closure after the build reproduced the committed closure bytes exactly.
- Serialized Vitest: 59 files pass + 1 declared skipped; 541 tests pass + 10 declared skipped.
- Typecheck, scoped lint, diff hygiene: pass.
- Final verifier on exact pushed snapshot: Upload → u2netp Detect → Frame/Nodes/Paint/real GrabCut edit → Preview/Save → replacement/Clear/Undo/Redo; exact fixed-viewport outputs preserved.
- Chromium/WebKit detector, flow, output, and GrabCut oracles pass. Preview/Save share pixels; route-only diagnostic injection does not change Detect or output.
- Visual gate: production server `http://localhost:4011/cutout-lab?admin=1`, PID 43809, serving exact `97ddfb39c222f978301c0de3dc9f92e5b6076474`; current UI and route-only admin calibration loaded unchanged. Screenshot: `output/playwright/KAI-10221-97ddfb39-current.png`.
- Physical-iPhone Low Power off/on remains owner-device evidence for QA; the breadcrumb sink stays available in the route without contaminating the portable package.

Necessity — no unnecessary element: direct moves, one result boundary, one generated closure analyzer, one verifier replacement, and one route-only diagnostic injection; no Grid adapter or framework.
Sufficiency — Builder delivers the corrected portable-package sprint in full; independent QA and exact physical-iPhone observation remain the closing gate.

## 2026-08-11 — owner device pass + Paint Autotune correction

- Dan completed the exact Vercel physical-iPhone journey with Low Power off/on; the integrated engine flow works.
- Owner-visible residual: Paint's final outline still exposed sampled hand jitter as micro polygon segments. Mask-wide smoothing changed the envelope but did not correct the captured centre-line intent.
- Minimal correction: add one Paint-only `autoTuneStrength` value and admin slider; normalize the captured centre-line before swath rasterization using extent-relative filtering plus open-path simplification, then render the retained curve through quadratic joins. Brush diameter remains thickness only. Existing mask smoothing remains a distinct control; AI/GrabCut vector controls remain independent.
- Focused contract: 0 preserves raw sampled points; full strength collapses a near-straight jittered gesture to a straight path and retains a deliberate curve with fewer samples. Focused tests, typecheck, scoped lint, and diff hygiene pass.
- Pushed rollback snapshot: `e3d713c3b3530f01e7b5702158ed4f0da2c45f24`; local equals upstream.
- Full serialized suite: 543 pass + 10 declared skip. Production build, canonical preservation and exact-current flow oracle pass. The real route's identical jittered gesture publishes 39 visible outline nodes at Autotune 0 and 6 at Autotune 100; screenshot `output/playwright/KAI-10221-paint-autotune-current.png` shows the continuous tuned line with the 100% slider. Console remains clean.
- Regenerated closure record SHA-256: `df1cc45cd03c21dc9bb0ea7969de36c6ccca82291cfe8a477f6da129a3d12e03`.

Necessity — no new framework or parallel Paint path; one config field, one pure normalizer in the existing mask-tools owner, one route-only calibration row, and focused tests.
Sufficiency — covers the missing centre-line wobble correction and adjustable 0–100 Autotune control; full runtime/QA gates remain.

## 2026-08-11 — Paint controls standardized + original pixels everywhere

- Paint-specific exposed calibration is now exactly two controls: Autotune 0–300% and Mask smoothing 0–100%.
- Removed Paint swath calibration; brush size is the single stroke-width owner. Loop-close is fixed internally at 0.35; canvas cap and join remain round.
- Paint now exposes and uses the existing shared Vector controls in Paint/Paint erase. Its independent default recipe is Detail 0, Offset 0, Simplify 15, Smooth 0, Radius 0; Cutout/GrabCut recipes remain separately restored.
- Removed the capped/display-resolution output path and its toggle. The original upload source now drives live result, Preview, Save and exported result identity; the working editor mask remains 1024px.
- Updated the preservation/oracle fixtures only where the intentional original-pixel and control cutovers changed exact behavior. The current fixed-viewport preservation output reproduces twice at 1795×767 RGBA, SHA-256 `49ce2430cee91de9df477f1299b8064a82da3414d02e44468755bc225687c075`.
- Serialized Vitest: 59 files pass + 1 declared skipped; 544 tests pass + 10 declared skipped. Typecheck, scoped lint, diff hygiene, production build, preservation, flow, output and Chromium/WebKit GrabCut oracles pass.
- Visual fallback gate: production route on port 4011 from this worktree; exact-current real Paint journey shows brush size plus shared Vector controls, and admin exposes only Autotune and Mask smoothing. Screenshot: `output/playwright/KAI-10284-shape-relative-paint-smoothing.png`.
- Generated closure SHA-256: `65bb24123232d49f270d662fad87b90e05175a1c6acf4df2003ec4e53908f665`.

Necessity — no unnecessary control or duplicate vector pipeline remains; the delta deletes the lossy output branch and redundant Paint controls while reusing the existing Vector owner.
Sufficiency — delivers the owner directive in full; independent QA remains the closing gate.

## 2026-08-11 — KAI-10285 Paint negative-shape eraser

- Owner correction: Paint erase must resolve the erase stroke as its own negative shape with the active Paint and shared Vector controls, then subtract it from the untouched accepted main shape. It must not smooth or refit the surviving main shape.
- Minimal implementation reuses the existing Paint raster controls and Vector outline resolver; no second eraser, geometry framework, or GrabCut change was added.
- CLASSIC is the default Cutout Vector preset per the preceding owner directive. Paint retains its separate 0/0/15/0/0 recipe.
- Real-route Chromium/WebKit oracle exercises the Paint negative stroke. Existing raw GrabCut oracle independently proves standalone, refine-add, refine-erase, and repeat; refine-erase returns byte-exactly to the standalone mask in both engines (`25818a9a…`).
- Current production build passes typecheck, scoped lint, diff hygiene, preservation, and GrabCut/Paint browser oracles. Final serialized suite: 544 pass + 10 declared skip.
- Visual evidence: `output/playwright/KAI-10285-negative-paint-eraser.png`; the real route reports the local negative Paint erase completed while the accepted main shape remains present.

Necessity — no unnecessary elements: one reused negative-shape resolution path, state needed to prevent reapplying the negative recipe to the main shape, and regression proof.
Sufficiency — implements the requested Paint subtraction semantics and independently confirms GrabCut erase remains correct; QA remains the closing gate.

## 2026-08-11 — KAI-10285 QA rework and owner visual correction

- QA reproduced that snapshot `982504db8e11328f0e72e0e514ff132e89675630` re-traced the entire surviving mask, changed the accepted recipe, and moved pixels far outside the erase stroke. That snapshot is rejected.
- The first rework preserved the accepted outer path and appended the clipped negative as an opposite-winding hole. Dan's real iPhone screenshot proved that was still wrong: a negative crossing the outer outline cannot be represented as an interior hole and fragmented into a large closed polygon. No snapshot was committed from that state.
- Final minimal correction uses the already-installed Clipper2 `differenceD` operation. It subtracts the finished negative stroke from the accepted vector geometry directly, changing only the intersected boundary and retaining the accepted source recipe/history. The mask subtraction remains exact outside the negative raster.
- `finishMask` returns the negative in mask/canvas coordinates, fixing the prior vertically mirrored erase. Defaults are Edge finish 12px, Paint Autotune 50%, and Paint Mask smoothing 20%.
- The browser oracle now deliberately crosses the accepted GrabCut outline, catching the fragmented-hole failure rather than proving only an easy interior puncture. Raw GrabCut refine-erase remains byte-exact to standalone in Chromium and WebKit.
- Focused vector/Paint tests: 26 pass. Final serialized suite: 59 files pass + 1 declared skip; 547 tests pass + 10 declared skip. Typecheck, scoped lint, diff hygiene, production build, preservation, and exact-current Chromium/WebKit GrabCut/Paint oracle pass. The initial parallel suite run timed out only two unrelated Grid tests under concurrent build/oracle load; the required serialized rerun passed them and the whole suite.
- Generated closure record SHA-256: `b3352b08db12490aac129f88f364fcdda0e8f384423b846f8dd03aa718e88955`; 40 files, 343,045 source bytes.
- Current visual evidence: `output/playwright/KAI-10285-grabcut-base-after-paint-erase.png` shows a local boundary-crossing notch with the surrounding accepted shape intact. LAN production build remains at `http://192.168.4.67:4011/cutout-lab?admin=1` for owner verification.

Necessity — no unnecessary element: one existing-kernel boolean operation replaces the invalid hole construction; no GrabCut product edit or second geometry path.
Sufficiency — covers local subtraction, crossing-boundary behavior, coordinate parity, accepted recipe/history stability, exact mask preservation outside the negative, and the 12/50/20 defaults; full final gates and QA remain.

## 2026-08-11 — KAI-10285 curve/history rework

- QA rejected `c2c25331b774ceafe58117ed1990859a6a082f80`: Clipper2 made the boundary cut visually local but flattened the whole accepted Bezier outline, increasing editable nodes 26→269. Undo drifted 7,524 canvas pixels and Redo 448.
- QA record snapshot `e5e0f19e685e091567a1d5c905e301b23a349387` is the exact new predecessor and is pushed; product bytes remain the rejected `c2c25331` below it.
- Minimal correction removes Paint subtraction from the polygon-only Clipper kernel and uses the already-installed Paper headless kernel that owns the existing Vector curve operations. Paper splits only intersected curve segments, retains untouched Bezier handles, and restores stable source anchor ids where the point survives exactly.
- History restore now prepares the exact cloned mask stored in the snapshot. The stored drawn vector restores the editor outline only; it is no longer rasterized as a substitute matte.
- The real-route oracle now freezes bounded node growth and compares exact canvas hashes after Undo and Redo in the same Vector view. The earlier 448-pixel Redo report included an erase-mode overlay versus Vector-mode comparison; the proof now holds the view constant while still requiring byte-exact restoration.
- Focused curve/Paint tests pass; typecheck, scoped lint, diff hygiene, production build, fixed-viewport preservation, and the serialized 547-pass/10-declared-skip suite pass. Exact-current Chromium/WebKit GrabCut/Paint oracle passes with exact Undo/Redo; the crossing cut adds only five boundary nodes in each engine (Chromium 30→35, WebKit 27→32), not the prior global 26→269 explosion.
- Generated closure record SHA-256: `dcca45fa91b546cc5b04eab4691a60561798798aa11fce64640aff5e186fe70e`; 40 files, 343,853 source bytes.

Necessity — removes the global polygonization and one history substitute-raster path; reuses the existing Paper owner, with no new engine or surface.
Sufficiency — preserves untouched curves/handles, creates nodes only at the cut boundary, restores the exact stored mask, and freezes node/history behavior; final complete gates and QA remain.

## 2026-08-11 — KAI-10285 owner-reproduced near-returning erase correction

- Dan's LAN screenshot rejected `ad8af65234ee460de21a91f5a4ef911596090e6b`: a near-returning Paint erase gesture inherited Paint shape's `closeFrac: 0.35`, closed the gesture, and filled its interior as a giant negative region.
- Minimal source correction: Paint erase calls the existing swath owner with `closeFrac: 0`. It remains an open round ribbon while retaining the active Autotune, Mask smoothing, and shared Vector controls. Paint shape loop-fill remains unchanged.
- The existing Paper boolean owner retains the largest connected outer result and only holes contained by it. An erase cannot publish detached islands. Surviving main anchors and Bezier handles stay untouched; no second post-boolean smoothing pass exists.
- Rejected experiment: an extra post-boolean boundary-smoothing pass overshot the accepted bounds and was removed. The finished negative already supplies the smoothed cut boundary; smoothing the surviving main again would violate the owner directive.
- Proof: focused 27 pass; serialized 548 pass + 10 declared skip; typecheck, scoped lint, diff hygiene, production build, fixed-viewport preservation, and exact-current Chromium/WebKit GrabCut/Paint oracle pass.
- Real-route observation: production build on `http://127.0.0.1:4011/cutout-lab?admin=1`; near-returning gesture no longer fills its loop or leaves fragmented outlines, accepted recipe remains stable, Undo/Redo are exact, and raw GrabCut refine-erase remains byte-exact to standalone. Evidence: `output/playwright/KAI-10285-grabcut-base-after-paint-erase.png`.
- Generated closure: 40 files, 344,944 source bytes, SHA-256 `3d6eb740788511f1d50e698b87d8e0e476e7d9118d6da4c74aec9ccfa174c873`.

Necessity — no unnecessary element: one erase-only close override, one extracted closure predicate for proof, and one connected-result filter in the existing Paper owner; no GrabCut/UI/provider/framework change.
Sufficiency — delivers open negative-ribbon semantics, tuned/smoothed local cut geometry, one connected result, preserved surviving curves/history/recipe, and unchanged GrabCut erase.

- Exact committed and pushed product snapshot: `d63a2a6ccd31267b30b8fd96bb2fcced93233328`; local and origin agree.
- Linear KAI-10285 records the exact handoff and is Ready for QA. `[s62-pixel-builder] [QA-REVIEW]` landed in `@s62-pixel-qa`; independent review is active. No `_WIP`, QA-space, or Playwright artifact was staged.

## 2026-08-11 — Paint Shape full-history trace after owner visual rejection

- Owner screenshot `_WIP/screenshots/Screenshot 2026-08-11 at 22.06.33.png` rejects `d63a2a6c`: the accepted Paint result contains internal diagonal holes and sharp cut intersections. QA on that snapshot was stopped; `fd6a2563` is only QA's rejection record above the rejected product bytes.
- `338d5edf` introduced geometric add/erase. `42343d65` changed it to the Paint brush. `01ef60f8` established the defining behavior: subtract/union first, then run the engine mask polish on the completed Paint result so joins/cuts become one finished blob.
- `2e01b0d`/`f8509cbc` added the no-holes law and explicit interior-erase no-op: `inside stays solid — erase carves from the edge inward`. `solidShapeMask` rasterized only `flattenShape(...)[0]`, so Paint shape truth could publish only one solid outer ring.
- `7c34a771` removed the global hole guard to preserve raw u2net/GrabCut masks, but Paint kept its completed-result polish and one-ring shape-truth path. `0b747d81`, `fee76892`, `b34b9b69`, and `e8cf49b9` retained that architecture through flow/history, live calibration, shape-relative smoothing, Autotune, and shared Vector controls.
- Exact regression: `982504db` stopped polishing the completed erased blob and introduced a separate negative-vector path with `ZERO_SETTINGS` on the survivor. `c2c25331` then changed `solidShapeMask` from the first ring to every ring and the boolean branch preserved holes. `ad8af652`/`d63a2a6c` changed boolean kernels/open-ribbon behavior but retained the regression.
- Minimal correction: restore Paint-only post-boolean mask finishing plus Paint-only enclosed-hole fill and one-ring shape truth; delete the rejected Paper subtraction branch and its tests. Keep current 12px/50%/20% defaults, original-resolution output, shared Vector controls, open erase ribbon, history/FIFO, and GrabCut code unchanged.

## 2026-08-11 — Paint Shape original-law restoration, current-controls adaptation

- The history trace remains authoritative: `01ef60f8` made Paint one finished mask; `2e01b0d` added solid/no-internal-erase behavior; `982504db` introduced the failed separate vector-negative branch; `c2c25331` made its holes publishable.
- Restored the original product laws without restoring obsolete brush-linked math: Paint erase is always an open Autotuned swath, Mask smoothing finishes that negative swath, subtraction operates against the current zero-offset visible solid shape, and enclosed holes are filled. An internal erase returns the accepted source unchanged; only an exterior-connected stroke carves.
- Deleted the rejected `finishMask` + Paper subtraction branch, its history flags, and its dedicated tests. `solidShapeMask` again publishes only the first/largest ring. GrabCut code is unchanged.
- Corrected the Paint shape-truth settle: after its normalized mask prepares, the visible outline is resolved from that same accepted mask. Initial commit and Undo/Redo no longer use two different geometries.
- Paint-specific prepare failure no longer tells a hand-drawn user to find a clearer subject; it reports that the accepted Paint shape was kept.
- Exact-current production visual: `output/playwright/KAI-10285-paint-base-boundary-erase.png` shows one smooth outer Paint blob with one boundary notch and no internal contour. The same oracle rejects repeated internal erases, proves GrabCut-base and Paint-base boundary erases, and observes Undo/Redo in Chromium and WebKit.
- Current gates: focused tests 47 pass; serialized suite 548 pass + 10 declared skip; typecheck, scoped lint, production build, preservation, detector, flow, output, and Chromium/WebKit GrabCut/Paint oracles pass. The preservation fixture intentionally moves to 1835×817 RGBA SHA-256 `64c79250c782516c0cb57b79c29bd7f4c131d5fcd47459e7fd9986f5bc353d29`, reproduced twice before freezing.

Necessity — deletes the failed parallel vector/Paper erase path and uses only existing Paint mask, outline, and preparation owners; no new framework, UI, provider, or GrabCut change.
Sufficiency — restores solid-shape/no-hole/internal-no-op behavior, limits smoothing to the new negative boundary under current controls, preserves one connected result, and stabilizes history/render truth. Final audit and snapshot/QA handoff remain.

- Final repeated closure generation is byte-stable: record SHA-256 `0bb0a7ccf24533dcb6aa2d3bad1be0270620178ffbe0af7a2c08d821befed4b1`; closure content SHA-256 `72b8184f9b4312f1fcf7c5368ed91e6fd7581d9413144bcd62b8b22c7c13cb59`; 40 files, 340,613 source bytes.
- Final exact-tree gates rerun: 548 pass + 10 declared skip; typecheck; scoped lint; diff hygiene; production build; preservation; detector Chromium/WebKit; flow/FIFO/history; Preview/Save output Chromium/WebKit; GrabCut/Paint Chromium/WebKit. All pass.
- Audit result: 253 additions / 285 deletions across 11 tracked product/proof/generated files. The product delta deletes the failed vector/Paper branch; `src/lib/cutout-grabcut` has no diff; removed identifiers have zero live references.
