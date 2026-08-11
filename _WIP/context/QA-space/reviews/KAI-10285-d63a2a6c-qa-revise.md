# KAI-10285 QA — REVISE

Snapshot: `d63a2a6ccd31267b30b8fd96bb2fcced93233328`

## Blocking findings

1. A near-returning Paint erase still becomes a filled negative region.
   - The exact-current CLASSIC journey changed 12,247 of 15,376 pixels inside the loop interior and visibly retained only the car's front section.
   - `flow.ts:428-435` disables explicit loop fill, then sends the ribbon mask through `finishMask`.
   - `finish.ts:110-123` calls `traceContourRaw`; `contour.ts:135-150` intentionally keeps only the largest contour and drops holes. The ribbon's inner contour is therefore lost before Paper subtraction.
   - The committed oracle permits this because its local-diff box includes the whole interior and `nodesAfter <= nodesBefore + 12` accepts destructive node reduction (`verify-cutout-v1-grabcut.mjs:320-335`).

2. Default CLASSIC history is not exact.
   - Stable same-view sampling reports 455 changed pixels after Undo. Raw and PNG hashes both differ. Redo is exact and CLASSIC remains selected.
   - The committed history journey switches to PURE first, so it does not cover the product default.

## Smallest correction

- Preserve both contours of the negative ribbon, or equivalent open-stroke topology, through the existing Vector finishing path; do not send it through the subject tracer that drops holes.
- Keep subtraction in the existing Paper owner. Retain the actual largest connected receiving result plus legitimate holes.
- Add a near-returning-loop assertion that the loop interior remains unchanged, and add exact Undo/Redo proof on default CLASSIC.
- No new geometry engine, UI, provider, GrabCut edit, or framework.

## Verified passing scope

- Ordinary boundary subtraction publishes one connected result, preserves CLASSIC, and keeps Redo exact.
- Focused 47/47; serialized 548 pass + 10 declared skip; typecheck; scoped lint; diff check; production build.
- Closure regenerates byte-exact at `3d6eb740788511f1d50e698b87d8e0e476e7d9118d6da4c74aec9ccfa174c873`.
- Preservation and Chromium/WebKit GrabCut journeys pass, including unchanged raw GrabCut masks, 12/50/20 defaults, recipe, and original-resolution output.

## Visual evidence

QA production build, exact snapshot, real `/cutout-lab?admin=1` route on port 4016 using the established Playwright Chromium fallback:

- `_WIP/context/QA-space/evidence/KAI-10285-loop-base-d63a2a6c.png`
- `_WIP/context/QA-space/evidence/KAI-10285-loop-erase-d63a2a6c.png`
- `_WIP/context/QA-space/evidence/KAI-10285-loop-erase-d63a2a6c.json`
- `_WIP/context/QA-space/evidence/KAI-10285-boundary-erase-d63a2a6c.png`
- `_WIP/context/QA-space/evidence/KAI-10285-boundary-erase-d63a2a6c.json`

Necessity — shrink the ineffective open-close flag claim and permissive oracle; no unnecessary replacement owner is justified.

Sufficiency — partial: ordinary subtraction, one-result filtering, defaults, recipe, original output, and raw GrabCut pass; near-returning ribbon topology and CLASSIC Undo exactness fail.
