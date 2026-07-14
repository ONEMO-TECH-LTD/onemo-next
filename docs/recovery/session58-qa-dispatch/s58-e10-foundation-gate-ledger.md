# E10 foundation gate — @s58-expert live-probe ledger (2026-07-08)

Gated HEADs on session58-task/react-figma-engine, live on :3025 (designer's server), by @s58-expert.
Method: code-read of the committed diffs + REAL browser click-tests (own tab, computer-use) + API/curl
+ tsc/eslint. Not code-read alone for the interactive surface.

## VERDICT: PASS (both slices' load-bearing surface), with 1 hard-break found+fixed (pre-existing
pollution, NOT the slices), 2 interactive checks PASS-by-composition, 2 low/pre-existing notes.

---

## HARD BREAK found at gate start — FIXED (pre-existing test pollution, NOT slice code)
Editor was **500 on /react-figma AND /react-figma/canvas** when I began. Root cause (from the 500 body):
`onemo-component-library/src/buttons/DemoButton.tsx` had DemoButtonGhost = `<Component />` + a dangling
`import { Component } from '@/app/(dev)/react-figma-components/Component'` — a probe deleted during an
insert/extract test whose CONSUMER edit (in the SEPARATE library repo) was never reverted. tagging-loader
ENOENT'd on the missing Component.tsx → whole editor 500 (every route loads the library). It was an
UNCOMMITTED stray edit (M in the library repo; HEAD = clean seed). **I `git checkout`'d it → editor 200
in 2.4s.** Not a defect in either gated slice. Designer owned it (checked the onemo-next worktree tree,
but the pollution was in onemo-component-library — two-repo cleanup gap; lesson logged).

## Slice 2 — interaction foundation @ e7f90b9 (the NEW surface) — LIVE-PROVEN
Diff = page.tsx +22/-8, canvasMode driver only. `canvasMode = rail==='components' && editingComponent`.
- **(d) dead-gallery-state — PASS, proven live.** Clicked Components rail with nothing being edited →
  canvas shows the PAGE (Editor402), NOT a gallery/blank; library in the left panel. Screenshot-confirmed.
- **page-default on Components rail — PASS live** (same).
- **double-click → edit mode — PASS, proven live.** Double-clicked DemoButton → canvas = its variant
  gallery (DemoButton + DemoButtonGhost frames, "2 variants") + breadcrumb **"Home › DemoButton"** top-left.
- **breadcrumb return — PASS, proven live.** Clicked Home → back to the PAGE canvas, breadcrumb gone,
  library stays. Full cycle (page → edit → page) verified.
- **(a) File-rail select/edit — PASS live.** Page renders, Layers populate, a div is selected, inspector
  shows Frame. Untouched by the diff (applySelection/wireCanvas unchanged).
- **canvasMode consistency — PASS code-verified.** Only line 2328 drives the canvas; the 4 risk sites
  (hostDims 3352, draw-guard 3527, InsertIsland 3840, iframe key 3856) all read the derived canvasMode →
  inherit the fix consistently. Grep confirms no `rail==='components'` bypasses the canvas driver (line
  3735 is the LEFT-PANEL library render, correct).
- **(b) create-from-selection + (c) manage-menu insert — PASS-BY-COMPOSITION (fresh write-test deferred).**
  Both are UNCHANGED ops from phase-1 (which I gated; insert proven to write real <DemoButton/>+import).
  The page-persistence that makes them work FROM the Components rail is now PROVEN (page stays on canvas).
  I did NOT re-run a live write-test THIS round — deliberately, to avoid another two-repo pollution right
  after cleaning one. If you want belt-and-suspenders, I'll run a coordinated write-test (select a page
  element → create-from-selection → verify file + revert BOTH repos). Flagging honestly, not claiming a
  fresh live write.

## Slice 1 — phase-1 relocation @ 0eb6b53 — HOLDS after slice-2
- Assets = images/icons only (no components tab) ✓; library renders Global→buttons→DemoButton→
  DemoButtonGhost (variant nested) ✓ live; empty-state / no-Assets-reference ✓ live; global create ✓
  (probed earlier, cleaned up); search wired ✓; manage menu ✓ (earlier gate). No regression from slice-2.

## Build gates
- **tsc --noEmit: 0 errors** (real run; my earlier `timeout`-wrapped run silently no-op'd — macOS has no
  `timeout` — re-ran properly).
- **eslint page.tsx: 12 errors** = the stated baseline, **zero added** (+11 warnings, baseline).
- **/react-figma 200 · /react-figma/canvas 200 · /react-figma/components-canvas 200** (after the fix).

## Notes (pre-existing / cosmetic — NOT slice-2 defects, non-blocking)
- **[LOW, pre-existing] Console hydration mismatch** (the red "1 issue" dev badge): from the engine's
  runtime `data-eng-id` tagging (ensureId, engine.ts — old M2 read-bridge) adding IDs the server didn't
  render. Dev-only, not from slice-2 (diff didn't touch engine/canvas-host). Eventual cleanup: add the id
  in an effect or `suppressHydrationWarning` on the host. Out of this gate's scope.
- **[COSMETIC] Library "No components yet" flashes** for one frame before the fetch resolves, then
  populates correctly. Timing, not a defect. (Could gate the empty-state on `dsComponents !== undefined`.)

## The 2 added VISUAL items @ 3f31aa8 (rail even-gaps, variables column separators) — MY CALL
These are pixel-aesthetic = Dan's eye, not my adversarial gate. I verified the STRUCTURAL facts I can:
the rail shows File/Assets/Components/Variables at even spacing (marginTop:16 removed — saw it live, looks
even). The variables-separator continuity I did NOT re-inspect this round. **Disposition: structurally
plausible, VISUAL sign-off = Dan** — exactly what you offered. Flag them to Dan as "self-verified, needs
your visual sign-off," not QA-passed.

---
Bottom line: slice-2's state machine (the actual change) is FULLY proven live; phase-1 holds; build green.
The one 500 was pre-existing pollution I fixed. (b)/(c) are pass-by-composition with a deferred fresh
write-test on offer. Nothing marked Done — Dan's gate. Relay verbatim.
