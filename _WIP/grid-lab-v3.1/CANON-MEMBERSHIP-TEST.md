# The canon membership test — attempted, failed QA, deleted. Why it cannot exist yet.

**2026-08-13.** @s62-kai-lead wrote a headless harness to ask, per placement Dan decided in the
walkthrough: is a candidate of that shape present in the raw set produced by kernel → enumerator?
It was written **without prior report or QA** — Dan's correction: *"why are you buildijg harness on
your own volition - vibe coding is foebidden - at least fucking report what it is and run by pixel
for qa?"* Reported, submitted to @s62-pixel-grid-pixel, verdict **FAIL** on both axes. Its run —
"5 of 10 present" — is withdrawn: it decided nothing about track 1, track 2 or the grok MVP.

Code deleted rather than kept behind a warning header (a test that proves nothing, preserved by a
document explaining why it proves nothing, is the cemetery this repo deletes). Recoverable from
git history at `6b1e9567` under `_WIP/grid-lab-v3.1/harness/`.

## The three findings

1. **The claim was unsupported.** Every predicate tested arrangement *structure*, never the ruled
   location. duck60 accepted any single, belly included; bat-woman accepted any three corners
   rather than the top plus the two utmost base corners; pill accepted any diagonal. All passes
   were possible false passes; no failure was an engine finding.
2. **Predicates were loose where the canon is exact.** duck 152mm is 48 × 96mm → base spans (1,2),
   not "unequal with one > 1"; butterfly 130mm and poke1 123mm are 96 × 96 → (2,2), not ">= 2";
   bot 144mm is (1,2), not any h > w; bot 236mm is column span 2 with a larger vertical span;
   pill 79mm is diagonal *base neighbours*, per-axis step 1. Requiring `population === "sparse"`
   for butterfly 214mm is itself wrong — the same four positions are lawfully reachable on the
   base population at step 2.
3. **The max-clearance anchor was a sampled proxy** (best of a 49 × 49 bbox sample), not O-1's
   construction. A miss under it establishes nothing about the lawful anchor domain.

## The blocking reason — this is the part that outlives the harness

Findings 2 and 3 are fixable: the canon states exact millimetres, and max-clearance can be defined
concretely. **Finding 1 is not fixable yet.** The canon names regions in words — "the head", "one
per wing", "the top half", "utmost corners" — and a shape's masses have no computable definition.
That is precisely the concept the part-3 prompt requires GPT to **name and not fill**. A membership
test that proves Dan's placement rather than its silhouette therefore cannot exist ahead of part 3.

## Standing consequence

Headless membership testing is a smoke test here, never the decider. The decider between engines is
Dan's eye on the raw candidate set on the running page — his ruling, 2026-08-13 13:32: headless
proof kept certifying wrong engines through five attempts, and the only gate that ever caught a real
defect was him looking at the running surface.
