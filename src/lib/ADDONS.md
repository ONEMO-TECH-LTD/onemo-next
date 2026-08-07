# v1 add-on modules — compiled keepers (branch session62-task/v1-addon-modules)

> Dan 2026-08-07: "see if glue files can be cleaned up and compiled to be add-ons so we don't
> re-derive things we must keep that the v5.3.1 bridge does not have — nothing SAM/wand — pure
> settings and logic we created to build working v1."
>
> Nothing here is WIRED. Each module is adopted by its own increment, device-gated. The v5.3.1
> bridge (flows/twoDFirstFlow/v53Flow + engine) is THE bridge — these are add-ons beside it,
> never a second bridge. ~300 of v1's 383 glue lines are NOT here (bridge duplicates + dead
> SAM/wand/mirror machinery).

| Module | What it carries | Adopting increment | Engine seam needed |
|---|---|---|---|
| `mask-tools/` | Paint shaper math, verbatim from v1 (swath, polish, solid-shape truth, union/subtract, PaintConfig) — Dan: "must be absolutely same" | Paint | — |
| `paint-driver/` | The painted-mask→engine seam (buildPreseg cache, prepareAI, finishDrawn) — the one thing the bridge lacks | Paint | `matteToMLResult` (in this branch) |
| `vector-edit/` | Node editor math, verbatim from v1 (skeleton fit, insert/delete/adjust, measure) + its tests. KNOWN v1 DEFECT kept-as-is for the node increment to fix: the skeleton fit falls back to the RAW shape (the million-node edge case) — the increment builds the override unit with a guaranteed anchor budget | Nodes | `resampleClosedUniform` export (in this branch) |
| `viewport-policy/` | Dan's laws as pure decisions: blend-0 = no compositor · outgrowth auto-composite · view-box (fixed viewport, object shrinks) · ComposeScheduler (never mid-drag, single-flight, latch-latest) · display-res floor (ADOPT ONLY if the clean bridge measurably lacks it) · paddingMM-0 config policy | Shell / blend | — |
| `cutout-render/` | v1 presentation helpers verbatim (mask tint add/erase, checkerboard cutout draw) | Shell | — |

## Assembled per-priority driver modules (Dan's list, 2026-08-07 evening)

| Priority | Module | What it assembles | Guarantee |
|---|---|---|---|
| 1 — paint | `paint-module/` | The v1 paint ORCHESTRATION as a pure driver: paintPlan (swath→polish→union/subtract, exact v1 order + loud no-ops), shapeTruthNormalize (zero-offset resolved shape = the one truth, separate-region warning), eraseWouldDestroy floor | Semantics verbatim v1 — "must be absolutely same" |
| 2 — nodes | `node-override/` | The few-nodes system as an OVERRIDE UNIT: skeletonShape with a GUARANTEED anchor budget (escalating fit; the raw dense shape is NEVER returned — the v1 million-node defect, fixed and test-gated 3/3) + nodeCommitPlan (v1 commit semantics as data) | Budget [3,48] holds for ANY input; engine/bridge untouched |
| 3 — vector | `vector-controls/` | v1 control surface as DATA (tabs/chips/ranges, detail inversion both ways, AUTO_KNOBS defaults) + autoBlendOnOutgrowth (value-true). Offset-past-frame viewport behavior lives in `viewport-policy` (viewBoxFor — fixed viewport, object shrinks) | Shell renders from data and drives the bridge's descriptor session — no parallel resolver |
| 4 — grabcut | `grabcut-lean/` | v1 grabCutRefine VERBATIM (standalone + corridor refine + floors) parameterized on a CvProvider interface — **imports NO OpenCV**; the 13MB dep is banned. Adopting increment supplies a slim build (~2-3MB core+imgproc) or a standalone grabCut | Unwireable until a lean provider exists — by design |

## Engine-policy verification gates (not a module — the checklist the clean build must pass)
1. **Blend-0 = zero compositor calls** — instrument/trace: at blend 0 no composeEffectArtwork
   invocation exists for display; the result is the photo clipped by the outline path.
2. **Cadence** — no compose during a knob drag (event-trace a drag; compose fires on release/idle).
3. **Perf marks** — PerfHUD budgets on the clean bridge vs v1's measured numbers (cut, resolve-tick,
   compose); the Mac "u2net lag" verdict comes from this comparison.
4. **Memory floor** — measure whether the clean bridge edits at display res; adopt
   viewport-policy's displayScale ONLY if it doesn't.
5. **Value reflection** — knob 0 ⇒ byte-identical original path (paddingMM-0 policy applied).

Engine seams (first commit on this branch, labeled): 2 files, ~18 lines, zero SAM code —
adopt each only WITH its increment, never ahead of it.

NOT compiled (stays dead): bakeStickerEngine's mosaic/pad/crop wrapper (served mirror/scale/pan,
cut from the surface) · prepareNative/finishSpec/v531seg (bridge duplicates) · CUT_MAX/cutSource ·
crash breadcrumb · everything SAM/wand.
