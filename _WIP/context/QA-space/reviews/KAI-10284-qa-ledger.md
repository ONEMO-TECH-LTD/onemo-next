# KAI-10284 independent QA ledger

## Intake — 2026-08-11

- Exact local/upstream snapshot: `1cc2afd2b31373bf9322491bff27fdd1c6a01043`; correction base: `5c32124b`; branch `session62-task/KAI-10284-paint-smoothing`.
- Live owner contract: one visible brush diameter for Paint and GrabCut; Paint smoothing derives only from the accepted combined mask's occupied area and bounds; `0%` is exact-off and `100%` is the shape-relative extreme; live Paint recalculation and existing GrabCut seed/halo/corridor semantics remain; no new smoother/framework/UI/vector/preset/portability work.
- Exact delta: six tracked files, `+108/-29`. KAI-10284 is In QA review; KAI-10221 remains Ready for Builder but blocked by KAI-10284 until QA verdict.
- QA will full-read the six files and exact diff, trace every changed production caller, then run focused/full/static/build, existing browser oracles and QA-owned current-route visual proof. No QA product edit.

## Source and necessity checkpoint — 2026-08-11

- Full-read all six changed files and the exact production/script diff. Paint now smooths the accepted combined mask through an API with no brush input; occupied area and the shorter occupied bound determine the radius. Zero returns an exact clone, and geometrically doubled masks double the tested radius.
- The single visible brush value reaches Paint and GrabCut through the same display-to-working scale. Paint ink/cursor use its effective swath diameter; GrabCut uses half the displayed diameter as seed radius, with the established 3x halo and 2.5x corridor derivations retained.
- Initial Paint and live latest-operation replay both call the same mask-relative smoothing owner. GrabCut provider, iterations, raw-mask publication, history and refinement ownership are unchanged outside the diameter normalization.
- The six-file change is bounded: one shared geometry helper prevents duplicated diameter math, one focused unit file freezes the new invariants, and the existing real-route oracle is updated rather than adding a verifier. No second smoother, provider, UI, framework or KAI-10221 work exists. Static, browser and visual gates remain.

## Static checkpoint — 2026-08-11

- Focused smoothing tests pass `3/3`; full serialized suite passes `539` with `10` declared skips across `58` passing and one skipped file.
- Typecheck, six-file scoped lint, exact-diff hygiene and the production build pass. The build emits only the repository's existing Next.js middleware deprecation notice.
- Existing Chromium/WebKit oracles and QA-owned current-route visual proof remain.

## Browser, visual and verdict checkpoint — 2026-08-11

- Detector, flow, output and GrabCut Chromium/WebKit oracles pass. The preservation oracle fails twice, deterministically, because its post-GrabCut PNG fixture still expects the pre-normalization output (`1793x763`, `0ef4108a…`) while current bytes are `1782x763`, `25b52791…`.
- QA-owned exact-current production runtime visibly proves Paint `0%` → `100%` live recalculation, a changed shape, equal `15px` Paint/GrabCut cursor diameters, and a console with zero errors/warnings. Four QA screenshots are stored under `../evidence/KAI-10284-1cc2afd2/`.
- Verdict: REVISE. Product source is clean; update only the stale preservation fixture and rerun the gates. Necessity: no unnecessary product elements. Sufficiency: partial until that required existing oracle passes. KAI-10221 remains blocked.

## Superseding QA CLEAR — 2026-08-11

- Builder corrected the initially mistyped handoff authority; exact local/upstream snapshot is `89e23e24af5c0e8f2ee36c651f0b60f5be31619b` and Linear now matches it.
- Rework is exactly two expected fields in the existing preservation oracle; no product source changed. The independent preservation run now passes with `1782x763` RGBA SHA `25b52791…`.
- Full serialized `539 pass / 10 declared skip`, typecheck, verifier lint, diff hygiene and production build pass.
- QA-owned production route served from the exact snapshot and visibly completed Upload → Paint `0%` → live `100%` recalculation with a clean console. Evidence stored under `../evidence/KAI-10284-89e23e24/`.
- Necessity: no unnecessary elements. Sufficiency: full. QA CLEAR closes KAI-10284 under Dan's no-Meta Session 62 cadence and releases KAI-10221.
