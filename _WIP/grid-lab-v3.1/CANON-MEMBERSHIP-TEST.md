# The canon membership test — v1 failed QA, v2 rebuilt, and what v2 found

## v1 — failed, withdrawn

Written 2026-08-13 ~19:24 **without prior report or QA** (Dan's correction: *"why are you buildijg
harness on your own volition - vibe coding is foebidden - at least fucking report what it is and run
by pixel for qa?"*). Submitted to @s62-pixel-grid-pixel; verdict **FAIL** on both axes. Its result —
"5 of 10 present" — is withdrawn. Findings:

1. Predicates tested arrangement *structure* only, never the ruled location, so passes could be
   false and failures were not engine findings.
2. Predicates were loose where the canon states exact millimetres.
3. The max-clearance anchor was a 49 × 49 float sample, not O-1's construction.

## v2 — rebuilt (harness/canon-membership.mjs)

- **Structure per case is quoted from the canon** and measured in BASE lattice indices, so a
  four-corner square 96mm on a side is spans (2,2) whether emitted on the base or sparse population.
- **Max-clearance is now a defined construction**: exact refined grid search, COARSE=64 divisions
  then REFINEMENTS=8 passes subdividing by SUBDIV=8, every comparison an exact rational
  cross-multiplication, ties to smallest x then y. Reproducible from those three constants.
- **Region claims are reported, never assumed.** Computable ones ("the TOP half", "utmost corners")
  are checked; the rest report NEEDS-EYE and are closed by the visual arm. No case passes on
  structure alone.
- **Trace orientation is measured, not assumed** — the narrow end of each outline is computed and
  printed, so "top" is evidence rather than a convention.

## What v2 found — 3 confirmed · 2 needs-eye · 5 absent

**And the first absence checked turned out to be a defect in MY canon description, not the engine.**

`band-3/description.md` states butterfly 130mm as *"the held corners sit 96mm apart both ways"*.
Dan's own words for that frame were only *"perfect example of band 2 grid in the band 3 shape"*.
Reading his screenshot: shape 130 × 107mm at 4.8 px/mm, the four discs he selects are **215–230px
apart ≈ 48mm** — an adjacent 2 × 2 square, which is exactly what "band 2 grid" means. The engine
produces precisely that: 4 held at (-1,-1) (0,-1) (-1,0) (0,0), spans (1,1), at origin 24,24.
The "96mm apart" is my transcription error, and it made a correct engine look wrong.

96mm spacing was also *geometrically impossible* there — 96 + 24 = 120mm of vertical material
needed against a 107mm-tall shape — which the test should have made me check before I wrote it.

**Second reading, bot 144mm:** Dan's own numbers ("96mmx48mm narow 4") are correct — spans (1,2),
shoulders and legs with the belly row skipped. The screenshot shows a lattice pitch of 48mm against
a 107 × 144mm shape and three usable rows. The engine's best across the four half-pitch origins
holds only two adjacent rows, spans (1,1). The screenshots show Dan's placements came from a
**panned** lattice, so his accepted registrations are not necessarily reachable from the four
half-pitch offsets of a bbox/centroid/max-clearance anchor. That is a live question about the lawful
origin domain, not a proven engine defect.

## Consequence — the descriptions are a lossy layer and must be verified before any engine is judged

Between Dan's rulings and this test sits `selection-examples/*/description.md`, written by
@s62-kai-lead from his screenshots. At least one of its geometric claims is false. **No engine may
be judged against these descriptions until every geometric claim in them has been checked against
the screenshot it describes** — pitch, which sites, exact spans — and corrected where it fails.

The region claims that remain (`one per wing`, `head pair + body pair`) are closed the way Dan
named: render the engine's candidate on the real page with Playwright and compare with his
screenshot. No computable definition of a shape's masses is required for that, which is why the
earlier claim that this test is blocked on part 3's region definition was wrong.
