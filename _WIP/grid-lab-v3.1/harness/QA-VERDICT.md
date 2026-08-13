# canon-membership.mjs — QA VERDICT: **FAIL**. Its output is NOT evidence about any engine.

Built 2026-08-13 ~19:24 by @s62-kai-lead **without prior report or QA** — Dan's correction:
"why are you buildijg harness on your own volition - vibe coding is foebidden - at least fucking
report what it is and run by pixel for qa?" Reported to Dan and submitted to @s62-pixel-grid-pixel
19:26. Verdict returned same evening.

## The numbers it produced, and their status

"5 of 10 canon placements present, 5 missing" — **WITHDRAWN**. Under this verdict the five passes
are possible false passes and the five failures are not engine findings. Nothing about track 1,
track 2 or the grok MVP is decided by this run.

## Pixel's findings (verbatim summary)

1. **The headline claim is unsupported.** Every predicate tests arrangement *structure* only, never
   the ruled location or region. duck60 accepts any single, including body or neck; bat-woman
   accepts any three corners rather than the top plus the two utmost base corners; pill accepts any
   diagonal; bot/duck/butterfly accept any rectangle of loose aspect. All five passes stay
   unverified until the oracle carries exact accepted lattice position sets, or explicit
   region/extreme membership taken from the screenshots.

2. **Several predicates are materially too loose against canon text**, which states exact spans:
   - duck 152mm — exactly 48 × 96mm → base-index spans (1,2), not "unequal with one > 1"
   - butterfly 130mm and poke1 123mm — exactly 96 × 96 → spans (2,2), not ">= 2"
   - bot 144mm — 48 wide × 96 tall → (1,2), not any h > w
   - bot 236mm — width one 96mm step → column span 2 with a larger vertical span, not any tall rect
   - pill 79mm — diagonal *base neighbours* → per-axis step 1, not any two-point diagonal
   - butterfly 214mm — four points on the 96mm grid in one corner square → base-index spans (2,2);
     requiring `population === "sparse"` is itself questionable, since the same four positions are
     lawfully reachable on the base population at step 2

3. **The max-clearance anchor is a sampled proxy, not the construction.** `maxClearanceOf` picks the
   best of a fixed 49 × 49 bbox sample; a different density can move the origin and change the held
   mask. Until O-1's max-clearance construction is concretely defined and reproduced, a miss under
   this sample does not establish absence across the lawful anchor domain.

Pipeline mechanics were found coherent: 1e6 source quantisation, max-bbox sourceSize, source-unit
anchors → target origin, the four half-pitch origins, kernel/enumerator calls and the base+sparse
grammar are wired without mutating either engine.

**Necessity** — shrink the claim to structural-family smoke testing, or add authoritative
exact-placement/region oracle data plus a defined max-clearance construction.
**Sufficiency** — partial: the current output proves neither the five passes nor the five failures
against Dan's canon.

## Why the faithful version is blocked, not merely unwritten

Findings 2 and 3 are fixable from written canon and a defined construction. Finding 1 is not: the
canon states region in words — "the head", "one per wing", "utmost corners", "the top half" — and
there is no computable definition of a shape's masses/regions. That is the same undefined concept
the part-3 prompt requires GPT to **name and not fill**. So a membership test that can prove Dan's
placement rather than its silhouette cannot exist ahead of that definition.

**Standing consequence:** this file is a structural smoke test at best. The decider between engines
remains Dan's eye on the raw candidate set on the running page — his own 13:32 ruling, that headless
proof kept certifying wrong engines while the only gate that ever caught a real defect was his.
