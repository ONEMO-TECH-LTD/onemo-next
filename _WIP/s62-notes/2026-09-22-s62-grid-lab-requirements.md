# s62-grid-lab — requirements as Dan stated them, 2026-09-22

Source: `__TRANSCRIPT VAULT/claude/s62/lead/2026-09-22/_day.md` (770 lines, 28 Dan turns, read in full).
Every row quotes Dan. Status is measured, not remembered.

## Milestone: s62-grid-lab

| # | Requirement (Dan's words) | Status |
|---|---|---|
| R1 | "launch the latest gridlab first" | DONE — :4065 staging, :4066 work |
| R2 | "wrap must exist but we need to add edge margin around which the wrap happens — can we add the engine parameter and expose it" | DONE |
| R3 | "wrap will use the offset - aka edge padding of the shape" | DONE — one parameter, not two |
| R4 | "add the offset to the grid engine that we can set as admin" | DONE — lockable dial |
| R5 | "the edge padding applies to all shapes canon and wrapped" / "it is override for all wrap exposed and canon shapes that is the point" | DONE |
| R6 | Padding disc, three modes: default square+radius=full; mode 2 square 24mm + radius exposed default 11mm; mode 3 24mm + 4mm offset = 32mm, radius 12.8mm | DONE |
| R7 | "all this makes the engine integrated spec variants - and engine reacts to it as well" | DONE |
| R8 | "we also need to add radius slider to shapes as well" | **OPEN** — disc radius done; the released SHAPES' own corner radius is not |
| R9 | "nothing can be hardcoded into page - the shapes must live in the library and routed to the grid lab and routable as canon as part of the grid-lab api" | **PARTIAL** — page no longer decides; disc lives in `foundation/`, not the library, and is not canon-routable on the Grid Lab API |
| R10 | "lets finish in the onemo next and make it packaged for studio" | **OPEN** |
| R11 | "desloping it from onemonext and any other shit" | **OPEN** — kill-list must be signed by Dan before anything is removed |
| R12 | "file task properly for the manufacturing additions and do them" | **IN PROGRESS** — see below |

## Manufacturing additions (R12) — what "manufacturing" needs

Context: Dan cuts on a laser from Illustrator. The 39 SVGs at `~/Downloads/onemo-grid-shapes-48mm/`
were exported 16 Sep and predate every change below, so they no longer describe what the engine makes.

| # | Task | Why it is manufacturing, not cosmetic |
|---|---|---|
| M1 | SVG export carries the padding-disc geometry (all three modes) | The disc is the sticker/panel artwork that gets cut. A circle-only export cannot produce the squircle panels. |
| M2 | SVG export carries edge padding in the outline and the stated size | The cut outline moved. An export at the old size cuts the wrong part. |
| M3 | Oval `legal-area` layer is empty — engine has no exact inset for curves | Carried open since 16 Sep. Dan uses the legal-area layer to place magnets; empty means he places by eye. |
| M4 | Re-export all released shapes at both pitches with the new geometry | The existing 39 files are stale against the current engine. |
| M5 | The fluid join (double offset, positive then negative) as engine geometry | Dan does this by hand in Illustrator per artwork. `Clipper.inflatePaths` already performs it; the engine can emit the joined panel directly. |

## Blocked on Dan

- **Linear MCP is disabled for this project.** `claude mcp list` → "claude.ai Linear: Disabled for this project (re-enable via /mcp)". The milestone and tasks cannot be filed until that is enabled. Config changes are Dan's, never an agent's.

---

# SELF-VERIFICATION — measured 2026-09-22, not remembered

Worktree `onemo-next/.claude/worktrees/s62-edge-padding`, branch `session62-task/edge-padding-offset`, off `18162dd2`.

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| R1 | launch latest gridlab | PASS | :4066 HTTP 200, zero page errors |
| R2 | edge margin as engine parameter, exposed | PASS | `EDGE_PADDING_MM` in spec; dial on the Bench, lockable |
| R3 | wrap uses the offset (one parameter) | PASS | `units/wrap.ts` — radius is the disc's reach, not the bare rim |
| R4 | admin-settable | PASS | `LOCK_KEYS` carries `edgePaddingMM`, `paddingShape`, `paddingRadiusMM`; validator bounds each |
| R5 | applies to ALL shapes, canon and wrapped | PASS | canon: released 72mm square → 80mm at 4/side, magnets and band unmoved (test + screenshot). wrapped: 3×3 solves 120.0 → 120.8 → 130.7 |
| R6 | three padding-disc modes at Dan's numbers | PASS | 5 tests pin circle 24/full, squircle 24/11, offset 32/12.8 |
| R7 | engine spec variants, engine reacts | PASS | wrap clears the disc's real reach; a squircle wraps wider than a circle of the same cell |
| R8 | "radius slider to shapes as well" | **FAIL — not built** | disc radius only. The released shapes' own corner radius is untouched. Asked Dan twice, never answered, then dropped it — that was mine to chase, not to let lapse. |
| R9 | shapes in the LIBRARY, routable as canon on the grid-lab API | **PARTIAL** | page no longer decides (architecture gate confirms). But the disc lives in `foundation/padding-disc.ts`, not the library, and is not a canon-routable citizen on the API. Dan's placement, not executed. |
| R10 | packaged for Studio | **PARTIAL** | engine package builds clean — 146 files (was 144), 0 unresolved aliases, 2/2 consumer tests. So the new geometry IS inside the boundary Studio consumes. The Grid Lab UI is still a route in onemo-next. |
| R11 | deslop onemo-next | **NOT STARTED** | needs a sweep, then a kill-list Dan signs before anything is removed |
| M1–M5 | manufacturing additions | PASS | 231 SVGs, six sets (48/96mm × circle/squircle/offset). legal-area 39/39 and 38/38. Panel fuses to one island. Committed script `scripts/export-grid-shapes-svg.ts`. |

**Gates:** 898 tests pass, 0 fail · typecheck clean · engine package 2/2 · every architecture gate green · live page verified by screenshot on both Presets (canon) and Generators (searched).

**Blocked on Dan, not on work:**
- **Linear is at its free issue limit** — no issue can be created in this workspace by anyone. Milestone `s62-grid-lab` was created (a milestone is not an issue); the tasks were refused. Upgrading is spend, so it is Dan's.
- The Session 62 container does not exist in this workspace; only Session 63's does.

**Nothing committed.** Worktree is live and green.
