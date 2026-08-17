# KAI-10220 QA verdict — `8d85eaf…`

Verdict: **HOLD — no source rework.** The bounded original-resolution comparison is code-clean; the required physical-iPhone comparison remains open.

## Authority

- Contract: `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 5.
- Live owner addition: one admin-only capped-1536px versus original-upload-resolution Preview/Save comparison; retain the 1024px editor/mask proxy and exact recipe; report dimensions/time; do not call it manufacturing closure.
- Reviewed snapshot: `8d85eaf8c038f914cdb062117fd4fa1130e3ecc9`, parent `9ca0a27deb8c36144b5ef5fd68fc3a5c51096cd3`; local and upstream exact.

## Independent source audit

- Full-read all six changed files, 2,870 lines, the exact `+139/-39` delta, and immediate shared callers/tests.
- `originalTexture` is an optional extension to the existing `prepareEffect`; all omitted/shared callers keep `effectiveTextureDim()`. Only Cutout's existing preparation seam passes it.
- Original mode reuses the accepted preseg/mask, shared edge finish, outline recipe, `bakeStickerEngine`, and canonical compositor. The 1024px editor canvas/mask remains unchanged.
- The toggle is generation-guarded and validate-before-publish. It does not mutate settings, blend, mask, vector, outline-source recipe, history, or artwork identity. Failure retains the prior prepared output.
- No second export/preparation pipeline, dependency, provider, package, Grid/Creator change, manufacturing claim, or KAI-10221 work exists.

## Independent gates

- Vitest: 57 files passed, 1 declared skipped; 542 tests passed, 10 declared skipped.
- Typecheck passed; six-file ESLint passed with zero warnings; exact diff check passed.
- Production build passed: Next 16.2.12 compiled, TypeScript completed, 22 pages generated.
- All five exact-current oracles passed: preservation, detector, FIFO/history/tools, truthful output, and Chromium/WebKit GrabCut/Paint/output-source comparison.
- Chromium capped GrabCut PNG remained `1263×443`, SHA `2a6bf8c…`; original became `1683×591`, SHA `a76410cb…`; switch-back reproduced capped bytes exactly.
- WebKit capped GrabCut PNG remained `1263×443`, SHA `824c2ff1…`; original became `1684×590`, SHA `d6b735de…`; switch-back reproduced capped bytes exactly.

## Visual gate

- Surface: real `/cutout-lab?admin=1` production build served from this worktree on port 3228 at exact commit `8d85eaf…`.
- QA uploaded the 2048×2048 fixture and ran real u2netp Detect. The editor canvas stayed `1024×1024`; capped mode reported `1536×1536`; original mode reported `2048×2048`; history stayed `2` through original → capped → original. Recorded preparation times were 159ms, 177ms, and 116ms in this run.
- Original-resolution Preview rendered through the real route, reported the same original-resolution pixels as Save, and produced a `1791×824` preview canvas with zero console warnings/errors.
- Evidence: `.playwright-cli/page-2026-08-09T19-50-54-013Z.png`, SHA-256 `bce1709acd3935940a04b3245a848e6b8eb00f670ae248e1f5892f3bfcec03fd`.

## Remaining gate

Dan must compare capped/original quality, preparation time, Save completion, repeat stability, and Safari freeze/reload/crash behavior on the physical iPhone using the exact deployment. Desktop/WebKit evidence cannot substitute for that product/device decision.

Necessity — **no unnecessary elements.**

Sufficiency — **partial only because the required physical-iPhone capped/original comparison is not yet recorded.**

KAI-10220 remains In QA review. KAI-10221 remains blocked.
