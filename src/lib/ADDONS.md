# v1 add-on modules — grouped by LAYER (branch session62-task/v1-addon-modules)

> Dan 2026-08-07: compile the working-v1 keepers as add-ons; nothing SAM/wand; the v5.3.1 bridge
> is THE bridge — these stand beside it, never a second bridge. Naming law: every module carries
> its LAYER prefix + its FUNCTION, matching the structure law
> **engine < tool modules < bridge flow < shell**. Nothing is wired; each module is adopted by its
> own device-gated increment.

## ENGINE side — feeds the engine new inputs (points DOWN into the engine; the engine does the work)

| Module | Function | Adopting increment |
|---|---|---|
| `engine-matte-input/` | Painted-mask → the engine's shaped pipeline as a standard cut (buildPreseg cache, prepareAI, finishDrawn through the engine's own resolver). The one input path the engine lacks | Paint |
| *(in-engine seams, first commit)* | `matteToMLResult` (segment-ml — the engine's own extracted tail) + `resampleClosedUniform` export (outline-core). 2 files, ~18 lines, zero SAM code | Paint / Calibration |

## TOOL modules — new capabilities (pure math; engine-calling where the engine has the op)

| Module | Function | Adopting increment |
|---|---|---|
| `tool-paint-math/` | Paint shaper math VERBATIM v1 (swath, polish→engine smoothMask, solid-shape truth, union/subtract, PaintConfig) — Dan: "must be absolutely same" | Paint |
| `tool-node-math/` | Node math VERBATIM v1 (+tests 4/4): insert/delete = topology the engine lacks; adjust/measure CALL the engine's own resolve/mintIds — no duplication | Nodes |
| `tool-grabcut/` | v1 GrabCut logic verbatim (standalone recognise, corridor refine, floors) on an injected CvProvider — ZERO OpenCV import; 13MB dep banned; unwireable until a slim provider exists | GrabCut (LAST) |

## BRIDGE side — flow logic (decisions/orchestration; zero pixels; composes beside the v5.3.1 flow)

| Module | Function | Adopting increment |
|---|---|---|
| `bridge-compose-policy/` | Dan's laws as pure decisions: blend-0 = NO compositor · outgrowth auto-composite · fixed-viewport view-box (object shrinks) · ComposeScheduler (never mid-drag, single-flight, latch-latest) · display-res floor (adopt ONLY if the clean bridge measurably lacks it) · paddingMM-0 config policy | Shell / Blend |
| `bridge-paint-flow/` | Paint ORCHESTRATION verbatim-in-semantics (paintPlan order + loud no-ops, shapeTruthNormalize at zero-offset, separate-region warning, never-destroy floor) | Paint |
| `bridge-node-override/` | Few-nodes OVERRIDE UNIT: guaranteed anchor budget [3,48] (v1 million-node defect FIXED, tested 3/3 — raw dense shape can never reach the user) + v1 commit semantics as data. Engine/bridge untouched | Nodes |
| `bridge-control-surface/` | v1 control surface as DATA (tabs/chips/ranges, detail inversion one-mapping, AUTO knob defaults) + value-true auto-blend-on-outgrowth. The shell renders from this and drives the BRIDGE's descriptor session — no parallel resolver | Shell / Vector |

## SHELL side — presentation only

| Module | Function | Adopting increment |
|---|---|---|
| `shell-render/` | v1 presentation verbatim (mask tint add/erase, checkerboard cutout draw — blend-0 truth: photo clipped by the path) | Shell |

## Still MISSING from the pool (named, not improvised)
1. **The tool-commit seam** — how a tool's mask result enters the BRIDGE's session/state (v1's
   acceptMask: validate-before-commit, selection-kept-on-failure). The load-bearing design of the
   paint increment; must route through the bridge's transactions so there is ONE history.
2. **Tool queue + timeouts** — serialized latest-wins, no busy-gating, every await times out loudly.
3. **Full-res-on-Save orchestration** — pending the memory-floor measurement gate.
4. **Live-drag edit presentation** (anchors glued mid-drag) — rides the shell.

## Known CONFLICTS (resolved by ruling, not silently)
- **History**: ONE history = the bridge's. Tool commits must enter bridge state; a second lab-side
  history is FORBIDDEN (the v1 knobs-lost-on-undo bug class).
- **Blend default**: bridge composites by default; Dan's law = blend-0 raw. bridge-compose-policy
  carries the law; the adoption applies it at session level — verification gate #1 below.
- **Knob values**: exist in the bridge session AND on the v1 face — detail inversion applied in
  exactly ONE place (the shell renders from the session; control-surface provides the mapping).

## Engine-policy verification gates (the clean build must pass)
1. Blend-0 ⇒ ZERO compositor calls (result = photo clipped by outline path).
2. No compose during a knob drag (release/idle only).
3. PerfHUD numbers vs v1 (cut, resolve-tick, compose) — the Mac "u2net lag" verdict.
4. Memory floor measured (adopt displayScale only if the bridge lacks it).
5. Knob 0 ⇒ byte-identical original path (paddingMM-0 policy).

NOT compiled (stays dead): bakeStickerEngine's mosaic/pad/crop wrapper · prepareNative/finishSpec/
v531seg (bridge duplicates) · CUT_MAX/cutSource · crash breadcrumb · everything SAM/wand.
