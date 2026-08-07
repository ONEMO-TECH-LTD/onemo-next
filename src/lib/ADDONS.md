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

Engine seams (first commit on this branch, labeled): 2 files, ~18 lines, zero SAM code —
adopt each only WITH its increment, never ahead of it.

NOT compiled (stays dead): bakeStickerEngine's mosaic/pad/crop wrapper (served mirror/scale/pan,
cut from the surface) · prepareNative/finishSpec/v531seg (bridge duplicates) · CUT_MAX/cutSource ·
crash breadcrumb · everything SAM/wand.
