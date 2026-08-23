# KAI-10220 independent QA — HOLD

## Verdict

Exact snapshot `20c45436f86e34106d329fa295dc054a934d5ad5` needs no code rework from QA. Source, static, Chromium, WebKit, current-build visual, and exact-deployment gates are clean. QA cannot emit CLEAR until Dan completes the required physical-iPhone 3/5/7 comparison for standalone and refine GrabCut edge quality and timing.

KAI-10220 remains In QA review. KAI-10221 remains Backlog and blocked.

## Source result

- u2net and GrabCut differ only in initial mask production. Both converge on one `prepareCut` owner, one edge value, one filter, contour, matte, preparation, composition, Preview, and Save path.
- One private mask filter produces the continuous-alpha matte and the thresholded binary contour. No second smoother, provider, worker, framework, or detector-specific finish survives.
- Raw GrabCut masks, provider behavior, history, refinement input, u2net model owners, and detector degradation chain are unchanged from the failed parent.
- The route-only existing admin panel owns the single 0..12 calibration value. No product panel or KAI-10221 work was added.
- `EFFECT_BUILD_CONFIG`, its serialized payload hash, and the Grid/Creator callers keep their prior bytes and defaults. The new optional value is absent from the global object; byte-identical Grid recipe/hash suites pass.
- Scratch+erase still exits before provider loading and every Mat allocation. The retained installed OpenCV build remains the only provider.

## Independent proof

- 533 tests pass with 10 declared skips when serialized. Two default-parallel attempts hit only the unchanged exhaustive Grid test's fixed 5s timeout; that file passes 6/6 alone and the full serialized suite passes. This is recorded, not hidden as an unconditional default-command pass.
- Typecheck, changed-scope zero-warning lint, full lint with zero errors, production build, and `git diff --check` pass.
- Preservation, detector, flow, output, and shared-edge/GrabCut oracles pass on the exact production build in Chromium and WebKit. Exact raw GrabCut hashes remain frozen; continuous-alpha witnesses are nonzero; only one provider request occurs.
- Own headed route observation on the exact local build exercised actual u2net 3→7, standalone GrabCut 3→7, and GrabCut refine at 7 with zero console warnings/errors. Evidence is under `KAI-10220-20c45436-evidence/`.
- Vercel deployment `dpl_EqXUHZNutyLg5BqgNkpPtXBo3tzm` independently resolves to commit `20c4543`, successful build, 22 generated pages, deployed Cutout route, and Ready state.

## Remaining gate

On the exact Vercel preview, compare the same physical-iPhone cut at 3px, 5px, and 7px for:

1. standalone GrabCut staircase removal without lost fine detail;
2. Add/Erase refinement quality;
3. practical visible timing and stable completion.

If one value passes, QA can convert this HOLD to CLEAR without Builder rework. If all fail, the device observation must define the smallest exact revision; desktop evidence cannot substitute.

Necessity — no unnecessary product elements.

Sufficiency — partial only because the explicit physical-iPhone calibration/acceptance result is outstanding.
