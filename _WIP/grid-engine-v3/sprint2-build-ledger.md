# Sprint 2 (KAI-10265) — build complete, evidence pack

Builder **@s62-lead** · QA **@s62-grid-pixel** · branch `session62-task/KAI-10261-grid-canvas`
(mirrored to `preview/grid-engine`) · base `9d411b0d` · head `4176974c`.

**18 of 18 children built and moved to Ready for QA. One commit per task, each with its own evidence.**

> This sprint is **scaffolding cleanup**. It is **not** the manufacturing solver, and nothing here
> should be read as delivering it. The engine that reads a band off a shape and returns where the
> magnets go — judged on coverage and symmetry balance, tested at bands 2/3/4 — remains unbuilt.

## Commits, in order

| Commit | Task | What it fixes |
|---|---|---|
| `3d514ea8` | KAI-10283 P0 | pinch is one gesture however packetized; listener mounts once |
| `a4ac6610` | KAI-10269 D1 | dead camera zoom API deleted |
| `1321a4f8` | KAI-10268 D3 | unused `syncSizeFromBox` deleted |
| `a57bd02c` | KAI-10280 P1 | drag cursor is CSS, not a ref read in render |
| `6a8d4cf0` | KAI-10272 D8 | orphan blank lines |
| `94cf7143` | KAI-10271 D4 | stale CLASSIC-band block consolidated |
| `9eb3df44` | KAI-10266 D6 | two false page-header claims corrected |
| `efc8a9d1` | KAI-10281 P6 | CSS duplication that was dimming the dark readout |
| `8d9f2db8` | KAI-10276 P4 | notepad rule asks the unit for the atom |
| `062e96bd` | KAI-10275 P5 | engine returns the lattice anchor |
| `3596419b` | KAI-10277 N1 | field frames itself; shape stops defining it |
| `741e166b` | KAI-10274 L1 | one minimum shape size, owned by the unit |
| `9f601572` | KAI-10279 P3 | registration gets the guarded route it never had |
| `4176974c` | KAI-10282 N3/L2 | structural guards — the class, not the instances |

**Four were already satisfied at base** by the instrument work that preceded the sprint, and are
recorded rather than re-done: **D2** (`ZOOM_FIT` import gone, `3d514ea8`), **D5** (false "1 is fit"
line gone, `79a65f20`), **P2** (`loadCutout` reads the live spec, `03ab30c2`), **N2/L3** (one
live-spec span for scale and frame, `16aeb68e`). Re-doing them would have been churn.

## Files changed

```
 src/app/(dev)/grid-engine/GridCanvas.tsx          30 +-
 src/app/(dev)/grid-engine/page.module.css         59 +-
 src/app/(dev)/grid-engine/page.tsx               125 +-
 src/lib/grid-engine/__tests__/pinch.test.ts       96 ++  (new)
 src/lib/grid-engine/__tests__/separation.test.ts 135 +-
 src/lib/grid-engine/bridge.ts                     27 +-
 src/lib/grid-engine/engine.ts                     17 +-
 src/lib/grid-engine/spec.ts                       19 +-
 src/lib/grid-engine/ui/camera.ts                  34 +-
 10 files, 454 insertions, 128 deletions
```

## Gate

```
full vitest      59 files passed | 2 skipped     559 tests passed | 22 skipped
typecheck        clean
focused lint     CLEAN — 0 problems (4 when the audit was written: 1 error, 3 warnings)
```

## Live instrument, final tree, served at localhost:4200/grid-engine

```
empty field        size 120   view 134.12
cut-out loaded     size 120   view 134.12    <- camera and size UNCHANGED by loading
face on load       outline                   four points centred at +/-24

pinch  10x1 -> 133   100x0.1 -> 133          <- packetizations agree (was 130 / 120)
shape on screen     642 px before and after a pinch   <- static, per the inverted model
pan started ON the shape   magnet -168 -> -162        <- shape invisible to the pointer
```

## Two findings the work produced that were not in the audit

**The guard caught a live instance on its first run** — `step: 48` on the Spacing row, the last grid
number in the shell. I had flagged it in the audit and left it; it now comes from the spec.

**The guard caught one of its own.** Falsifying each structural check by reintroducing the defect
showed four of five caught and the `ui/` rule **missed**: relative paths were computed against the
directory being listed rather than the root, so every nested file looked top-level, the
"files in subdirectories" filter selected nothing, and the test passed by iterating an empty list.
A guard that guards nothing — the exact class under repair, inside the repair. Fixed, and it now
asserts its own input is non-empty so it can never pass vacuously again.

**Falsification results** (each defect reintroduced, then reverted):

```
framework import under ui/                  CAUGHT
bare released law literal in the shell      CAUGHT
law write outside the guard (sibling key)   CAUGHT
shell reaching past the bridge into engine  CAUGHT
lattice arithmetic inside ui/               CAUGHT (after fixing the guard itself)
```

The pinch regression test was also checked against the OLD rule first and reproduces 133/130/120,
so it can fail. A test that passes on the broken code is not coverage.

## Limits, stated rather than implied

- **No jsdom or testing-library in this repo.** The packetization rule is unit-tested; the DOM-level
  criteria (non-ctrl scroll, bounds, static shape, listener churn, cursor) are proven on the running
  page. Adding a DOM test environment is new tooling and outside these tasks' exclusions.
- **A backgrounded tab never paints**, so its ResizeObserver never fires and the canvas holds its
  1×1 initial size — both notepad levels then fall below the visibility threshold and `defs` is
  empty. That reads exactly like a regression and is not one. Any layout-driven check on this
  instrument must be made against a painted tab.
- **P7 (96mm parity) untouched** — closed by Dan's law 9.3a: points hide, nothing re-centres, the
  asymmetry is accepted rather than corrected. The shipped behaviour already matches it.
