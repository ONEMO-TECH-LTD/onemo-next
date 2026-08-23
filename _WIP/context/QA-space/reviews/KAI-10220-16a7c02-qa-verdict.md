# KAI-10220 independent QA verdict — REVISE

Snapshot: `16a7c02c6f1f2b3dd2a02141f97b033dd22a0a75`  
Contract: `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91`, Increment 5  
Scope: Paint swath default `1x`; accepted-result switching between Paint and AI/GrabCut recipes; named preset screen excluded.

## Verified clean

- Local and upstream heads match. Full-read the 177-line contract and all six changed files, 2,528 lines, plus the exact diff from `fee76892…`.
- `PAINT_DEFAULTS.swathMult` is `1`. Accepted Paint shape/erase and live recalculation select the clean Paint recipe. Detect, standalone GrabCut and refinement select the prior Cutout recipe. Tab clicks do not switch. History snapshots carry the source kind and settings; Undo/Redo restores them.
- QA-owned real-route proof observed Paint smooth `0`, tuned Paint `23`, restored Cutout `37`, Undo Paint `23`, Redo Cutout `37`, swath `1x`, and zero console warnings/errors. Evidence: `evidence/KAI-10220-16a7c02/qa-paint-clean-recipe.png`, `qa-cutout-restored-recipe.png`, and `qa-source-history-redo.png`.
- Focused characterization passes 19/19. The second full serialized run passes 57 files/534 tests with 10 declared skips; the first run's three unchanged timeouts pass in isolated reruns. Typecheck, six-file zero-warning lint, `git diff --check`, production build, and all five current-build Cutout oracles pass. Chromium and WebKit source-recipe/provider proof passes.
- The local production listener is proven to serve this worktree at the exact snapshot. Vercel logs independently pin the supplied protected deployment to the same branch/commit, successful Next 16.2.12 compile, TypeScript, 22-page generation and Ready state.
- No new preset UI, provider, framework, recipe store, or KAI-10221 work exists. The prior Increment-5 closure is otherwise preserved.

## Blocking defect

Paint's deposited mask width is computed from image space in `flow.ts:596-603`: `brush × imageWidth / displayWidth × swath`. The changed live ink and cursor use view-box space in `page.tsx:142,180-184`: `brush × viewBoxWidth / displayWidth × swath`.

Those spaces diverge after Frame/outgrowth. The QA real-route probe produced image width `1024`, view-box width `1987`, deposited internal width `34.91`, rendered ink/cursor width `67.74`: the live width is `1.94×` the width actually deposited. At swath `0`, the mask draws nothing while the live ink still forces a 2-pixel stroke. Therefore the Builder claim that Paint ink/cursor reflect the actual swath is false outside the initial in-frame geometry.

## Smallest exact correction

1. In `page.tsx`, scale Paint ink and the Paint cursor from `img.width / disp.w`, matching `paintStroke`; keep the existing AI cursor behavior outside this correction.
2. Do not render Paint ink/dot when `swathMult === 0`; otherwise match `swathMask`'s internal width.
3. Extend the existing source-recipe browser oracle with one Frame/outgrowth witness proving live Paint ink/cursor width still equals the deposited mask width. Add no file, abstraction, UI, preset, provider, or KAI-10221 work.

Necessity — **no unnecessary elements. The six-file shape is minimal; correct only the two Paint rendering calculations and affected oracle.**

Sufficiency — **partial: source-owned recipes and history are delivered, but Paint's changed live swath witness is not truthful after view-box outgrowth or at zero.**

Verdict: **REVISE.** KAI-10220 returns to Building. KAI-10221 remains blocked.
