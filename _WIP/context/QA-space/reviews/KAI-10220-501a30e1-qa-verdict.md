# KAI-10220 QA verdict — CLEAR

Snapshot: `501a30e1b15ba4f42d185871e1f9055be6da7452`

Authority: contract `367e2d270cac4e0027fe2271f26b3f0c5511654f22a450138fb952f3a3ed6c91` plus the chronological owner corrections recorded on KAI-10220.

## Source

- PURE is the Cutout default at visible Detail/Offset/Simplify/Smooth/Radius `0/1/15/0/0`; Paint retains its separate ZERO recipe.
- Offset is `0..25`; Simplify is `0..300`; both retain the restored original conversions and engine math.
- The Detail+Simplify repair is carried through the existing outline input and fitter. Only the Cutout adapter opts in after non-zero visible Detail. Paint, Grid Lab and Creator omit the flag and retain the prior guard.
- Original-upload Preview/Save remains default; the existing admin switch retains capped `1536` fallback.
- No personal-preset persistence, second fitter/provider/history/recipe framework, packaging work or KAI-10221 build-ahead appears.

## Independent gates

- Focused changed-owner tests: 24 pass. Full serialized suite exits cleanly.
- Typecheck, exact diff check and production build pass; all 22 pages generate.
- Scoped lint: zero errors. The sole unused-import warning is proven present in the exact parent and predates this correction.
- All five exact-current Cutout browser oracles pass: preservation, detector degradation, flow/history/tools, truthful output and GrabCut/provider/shared-finish/preset behavior in Chromium and WebKit.

## Current-runtime observation

QA served the exact worktree and commit on local production port `3233`, then ran Upload → actual u2netp Detect (`2044ms`) on the real Cutout route.

- Vector opened on PURE with exact values `0/1/15/0/0`.
- Offset exposed maximum `25`; Simplify exposed maximum `300`.
- At Detail `70`, moving Simplify `15 → 300` visibly changed the fitted outline on the real canvas.
- Original upload was the default at `2048×2048`; switching to capped produced `1536×1536`, and switching back restored `2048×2048`. Preview reported the same original-resolution pixels as Save.
- Browser console: zero errors and zero warnings.

Evidence:

- `../evidence/KAI-10220-501a30e1/detail70-simplify15.png` — SHA-256 `0b2a06668f29be01084d64a3adfa5f1b1361b006519158ca9b95f26dc02a7ab9`
- `../evidence/KAI-10220-501a30e1/detail70-simplify300.png` — SHA-256 `6cdb9adde7d2090ecfdd140e93ecb9fe9e6ce9a3a2d44d0f16021b49f3f5cbc0`

The prior physical-device HOLD does not carry forward: KAI-10220 explicitly records Dan's supersession that the earlier snapshot and device gate are historical only.

Necessity — no unnecessary elements.

Sufficiency — delivers the accumulated KAI-10220 owner directive in full.

Verdict: **CLEAR**. Move KAI-10220 to Ready for Meta; keep KAI-10221 blocked pending Meta.

QA made no product-source edit.
