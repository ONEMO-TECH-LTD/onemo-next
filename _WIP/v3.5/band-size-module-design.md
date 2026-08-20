# Band Size Module — design

Author: s62-kai-meta · 2026-08-19 · **updated against `7d50392e` (frame flap law + holding-first walk)** — earlier version of this doc audited the pre-fix code; superseded findings are marked.

Authority — Dan's directives: *"it must select all variants based on the flap/centering etc — the smallest sizes that allow shape wrap — set magnet grid layout from min to max possible, not only max"* · *"wrap means snug tangent fit — rounded corners will make scale bigger, that is all, but this must be shown in the variant — the range and snug fit based on the flap value must decide what minimum magnet number it can hold."*

## The law

Per band: **the ladder lists every magnet count the band can wrap, minimum to maximum, one step per count, each at its snug tangent size.** The flap dial decides what wraps — and therefore each band's minimum count. The landing pick stays the ruled one: smallest size at maximum count.

## Definitions

- **Snug tangent size** — the smallest size at which count k seats and wraps. The shape shrink-wraps the layout; rounded corners push the number up (circle's single = its own true size, not the square's 24) — the variant displays that true number.
- **Wrap** — no outline point beyond the seated layout's reach at `padding + flap`. Material *between* magnets is held by the frame; material past it is flap.
- **Variant** — a magnet count. One ladder step per count. Registration differences are not variants.

## Why band minimums fall out of the flap value (Dan's 1/2/3 intuition, exact)

A line of k magnets covers `48·(k−1) + 2·reach` along its axis; wrap needs that to reach the size, so the minimum count at size b is `k ≥ (b − 2·reach)/48 + 1`.

At flap 12 (reach 24): **B1 → 1 · B2 → 2 · B3 → 3 · B4 → 4 · B5 → 5** per longest axis. The dial moves it (flap 24 lets a single wrap 72mm; flap 0 tightens everything). No hardcoded minimums — counts below the threshold never wrap, so they never appear.

## State after `7d50392e` — what the fix delivered (verified by probe)

- **Holding-first walk works.** On a B2 ellipse at flap 20 the ladder reads `76mm·2⌾ · 106mm·3⌾ · 108mm·4⌾` — min→max, one per count, each at its snug size. Dan's law, live, on this fixture.
- **Single-pass walk restored** (the double-walk regression is gone).
- **The radial blanket-wrap metric is gone** — flap now measures excess past the seated frame + reach, and the tangent standards measure 0 at flap 0.

## Remaining defects (current code, probe-backed)

1. **THE B1-clones mechanism (Dan's 17:15 screenshots) — the gate is a threshold, not a snug test.** "Flap ≤ dial" admits an entire **run of sizes per layout**: probed on a B1 blob at flap 12, the same single magnet holds from 30mm (tangent) through 44mm (still within allowance) — 8 gate-passing sizes of one layout, all within radial reach too, so this is not a metric bug. The ladder's unit is a *size*, so the run lists as 8 chips on cutouts — while squares collapse to one only by accident (their registration is stable across sizes, so the sig-dedupe merges the run; cutouts' registration drifts → 8 "distinct" sigs). **Dan's law:** a variant is a layout at its **smallest** gate-passing size — the snug tangent fit; larger sizes of the same layout are the same variant worn looser and are not options. An arrangement-keyed dedupe (keep-first) fixes the *display*; the structural fix is per-layout selection in the walk itself, because the gate still classifies the whole loose run as "fits" and that classification leaks into the pick, the fallback, and the status line.
2. **The frame law still over-credits geometry the layout doesn't have** (not the driver of the B1 case, but real). (a) Empty corners: excess is measured against the seated magnets' *bounding box* — an L/tee/diagonal layout credits material over corners with no magnet; probe: L of 3, vertex 75.9mm from the nearest magnet (reach 24) counted held. The pill's ruled diagonal pair credits both empty corners. (b) Inflation corners: the box is inflated per-axis, so its corners sit reach·√2 (41% farther) than the dial says. Whether corner material counts as held is a **Dan ruling** — note his released 72mm square standard itself lives in that corner slack (its corner material sits 5mm past the corner magnet's disc, diagonally), so a pure radial law would fail the released standard at flap 0. The law must be stated, not guessed: per-axis (frame/box, standards pass, diagonals get grace) vs radial (disc, no grace, standards need flap ≥ 5).
3. **Walk-vs-display inconsistency (latent, code-visible, not reproduced).** The walk qualifies sizes with `preferHolding: true`; the ladder-step and final solves run plain `cfg` — a size where a higher non-holding count also seats can render a flap-violating layout on a "Fit" step. Pass `preferHolding` in band-mode display solves.
4. **Residual count-shadowing (edge case):** a count that only ever holds at sizes where a higher count also holds never wins a solve and silently vanishes from the ladder. Per-layout bookkeeping inside the sweep removes it and is the clean route to one-step-per-layout.
5. Spec documents `GOVERNOR` 0–2; logic and panel ship four (Top-small = 3) — doc drift.

## Open rulings for Dan — two

1. **Whole-silhouette wrap vs governed-zone wrap.** The ruled B1 yardsticks (duck ~58mm single-on-head, batwoman head-top) leave body material past any single magnet's reach — whole-silhouette wrap excludes them at flap 12. Either their B1 answers exist only at a larger flap, or wrap is judged against the governed mass with the rest declared un-held.
2. **Fallback display.** When no count wraps: keep the labelled best-seated render (current), or show nothing plus one line `no wrap in B{n} at flap {v}` — recommended, since a painted non-qualifying layout keeps reading as the band's answer.

## Module placement

Frame-structure excess metric → compute · variant-per-count rule + minimums-by-arithmetic consequence → logic · walk + per-count bookkeeping → engine door · spec adds no new values · shell unchanged.
