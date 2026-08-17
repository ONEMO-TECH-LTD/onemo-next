# KAI-10285 QA — REVISE

Snapshot: `482bac6c6a49bcef2ea33fcd8abe34c65f14263c`

## Blocking finding

The rejected boundary/near-loop failure remains product-visible. On the real `/cutout-lab?admin=1` route, the default CLASSIC GrabCut shape followed by the same near-returning Paint erase changed 12,247 of 15,376 pixels inside the loop interior (79.6%) and left only the car's front selected. The interior-loss count is identical to the rejected `d63a2a6c…` reproduction.

The correction fills only fully enclosed empty regions. A near-returning negative connected to the exterior leaves its interior exterior-reachable, so `fillEnclosedHoles` does not restore it. The later shape-truth trace publishes the wrong surviving contour. This violates Dan's rule: one boundary-connected chunk only; no internal/diagonal cutout or detached result.

The committed browser proof does not cover the rejected route. Before its erase it changes the accepted Cutout recipe to zero offset, then permits up to 10,000 changed pixels outside a broad edit rectangle. It never repeats the default CLASSIC near-returning gesture or asserts that the actual main remainder survives.

## Smallest rework

1. Keep the current deletion of the failed Paper/vector-negative branch and keep Autotune/Mask smoothing on the negative only.
2. Reject or normalize any subtraction that does not leave the intended main receiving blob with only a local boundary carve. Do not publish the current near-loop result merely because its interior is exterior-reachable.
3. Add the exact default-CLASSIC near-returning reproduction to the existing real-route oracle. Assert the loop interior/main remainder survives, no internal contour or detached fragment publishes, and pixels outside the narrow cut boundary remain unchanged.
4. Remove the recipe preconditioning and broad 10,000-pixel escape hatch from the acceptance proof. Preserve raw GrabCut and unrelated owners.

## Independent gates

- Full source/diff read: 11 changed files.
- Focused: 47/47 pass.
- Full serialized suite: 548 pass, 10 declared skip.
- Typecheck, scoped lint, diff check, production build: pass.
- Generated closure reproduced byte-exact: `0bb0a7ccf24533dcb6aa2d3bad1be0270620178ffbe0af7a2c08d821befed4b1`.
- Chromium/WebKit GrabCut/Paint oracle: pass, including unchanged raw GrabCut hashes and internal no-op.
- Independent current visual gate: fail. Exact build served from this worktree on port 4017; Chromium Playwright fallback, real route, Upload → standalone GrabCut → default CLASSIC → near-returning Paint erase. Evidence:
  - `_WIP/context/QA-space/evidence/KAI-10285-loop-base-482bac6c.png`
  - `_WIP/context/QA-space/evidence/KAI-10285-loop-erase-482bac6c.png`
  - `_WIP/context/QA-space/evidence/KAI-10285-loop-erase-482bac6c.json`

Necessity — shrink the permissive oracle only; the deletion of the parallel Paper path is justified. No new engine, framework, UI, provider, or GrabCut product edit is needed.

Sufficiency — partial: internal no-op, basic boundary subtraction, static gates, output, and raw GrabCut pass; the governing screenshot case and main-remainder invariant still fail.
