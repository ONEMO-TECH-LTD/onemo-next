# _archive — history and evidence only

**Nothing in this folder is an instruction.** Everything here is superseded, executed, or a source
artifact kept for traceability. If a file here disagrees with a live document, the live document wins.

**Live documents** (`_WIP/v3.5.6/`):

| File | What it governs |
|---|---|
| `v3.5.6-pipeline-brief.md` | **The pipeline** — what it is, each step, what the classifier delivers |
| `grid-lab-architecture.md` | The code structure and the staged refactor; owns the open questions and the classifier method |
| `v3.5.6-current-brief.md` | The engine's product authority — the three laws, neutrality, safe area, Spec/module ownership, acceptance |

> One caveat on `v3.5.6-current-brief.md`, recorded rather than edited: its §5 Fit contact policy
> (`group | single | double | most | all`) and the six scoring orders belonged to the v3.5.5 engine that
> was rolled back on 08-24. Sections 1, 4, 7, 8, 9 and 12 are live.

---

## What is in here, and why

### `v3.5.6-brief-ledger.md` — superseded
The fork's directive extraction (08-25 10:44). Its own successor says why it is dead: the fork assembled
08-24 lines 1201–4859 from **inherited context, not fresh reads**, and claimed a full read.
Superseded by `v3.5.6-full-ledger.md`, and the pipeline content by `v3.5.6-pipeline-brief.md`.

### `v3.5.6-full-ledger.md` — history
The chronological directive record for 08-24 and 08-25, from a genuine full read. Kept as the history of
what was ruled, rejected and parked. **Its §5 "the plan as it now stands" is stale** — it describes the
reversal as unapproved and unbuilt; the reversal was ruled, built and shipped. Read §§1–4 and §8 as
record; ignore §5–§7 as a plan.

### `v3.5.6-task-list.md` — executed and superseded
The v3.5.5 analysis task list, whose only entry is **T1: flap is a wrap tolerance only**. Overtaken by
Dan's stronger ruling on 08-25 12:32 — *"delete flap dude - the magnet disk is the allowance - the flap
logic is dupe"* — after which the flap concept was removed from the engine entirely (192 lines, 7 files).
Nothing in it is outstanding.

### `v3.5.6-layout-library.md` — superseded by the built corpus
The 08-25 draft enumeration: ~100 candidate layouts per frame, with a family→options table marked DRAFT.
Superseded by the library as Dan actually ruled it — square / rectangle / diamond / triangle, 45 shapes,
`full · perimeter · corners` with `48 · 96 · custom` spacing, Slice removed, Flag merged, universals
dropped. The corpus now lives in code (`src/lib/effect/library/`), frozen by tests and the catalogue's
identity manifest.

### `v3.5.6-engine-research-list.md` — evidence
The extraction of all 27 engine suggestions and 24 links from the research conversation (08-24 20:48).
Every one is now decided: **Clipper2 adopted**; Minkowski, SVGNest/DeepNest, `deltaCallback`, `rectClip`
and the physics engines rejected with reasons; OpenCV `convexityDefects` / `distanceTransform` and
PolyTree/holes parked. The decisions and their reasons are recorded in the ledger and the pipeline brief.

### `google search` — source artifact
The research conversation Dan supplied on 08-24, containing the V2 rigid-lattice-nesting code and the
engine survey. It is the origin of the Clipper2 method that became the wrap engine (*"ok the wrapping
works now congratulations"*, 08-24 17:11). Kept for traceability; its content is fully consumed.

---

## Flagged, not moved

`_WIP/v3.5/` holds the bench image corpus — `asset-lib` (7 files, 38 MB) and `cutouts` (10 files, 36 MB) —
**plus a duplicate nested copy at `_WIP/v3.5/v3.5/` (a second 74 MB)**. All of it is tracked in git.

Nothing in `src/` or the build config reads these paths: the bench serves its libraries from
`public/grid-engine/` (moved there on 08-24, which is what fixed the Vercel deploy), and `.vercelignore`
excludes `_WIP` entirely.

So this looks like ~148 MB of tracked dead weight, half of it an accidental duplicate. Removing tracked
binaries is a deletion of committed data, so it waits on Dan's word rather than being swept in with a
documentation tidy.

- **`v3.5.6/v3.5.6-pipeline.md`** — the step-1 unit sheet (08-25). Superseded by
  `v3.5.6-pipeline-brief.md` (the pipeline) and `grid-lab-architecture.md` (the code structure).
  Archived because it actively contradicts them: it names the family enum `square · round · triangle`
  and marks both `shapeFamilyOf` and the classifier panel **done** — the hardcoded families with their
  invented `fill < 0.68` are being deleted, and the decision trace is not built.
