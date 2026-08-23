# v3.5.2 — final proposal: finish the three-law grid, necessary and sufficient

Author: s62-kai-lead · 2026-08-22 · supersedes my earlier proposal and synthesis. Canon that encodes it: master v3.5.2-1 at plan commit `a6b91629` (899 lines). Base: product `2c043257`.

## 1. Goal (Dan)

Shape → 12 mm erosion → centre by the selected method → wrap (0 = touching) → scale per magnet count (each next count at the size where it snaps, centred and wrapped; no repeats across B1–B4; vertical beats horizontal). Third tab, old tabs untouched. Functional, frugal, solid.

## 2. What exists and stays (proven live at `2c043257`)

Centre — all 6 modes, 4 governors, parity, four placements, 2 mm ruler: **untouched**. Wrap — exact tangency, fixed/Auto, typed refusal, witness dots: **untouched**. Tab, worker, module split: **kept**.

## 3. What we build — eight rollback commits, ~500 lines, all in existing files

| # | Commit | Why it is necessary (brief clause / measured defect) | Size |
|---|---|---|---|
| 1 | Frozen Centre path **emits** what it already computed: mesh sample index, island sums, chosen placement, phase cell, lattice k, belt. Outputs and choices unchanged. | Exact judgement needs the *identity* of the chosen centre, not its rounded decimal. | ~40 |
| 2 | **One exact shape rule**: normalized outline and holes = (source − min) / longest span, exactly; at size s the shape is that × s. Replaces the float `actual === longestMM` branch. | Measured: the float branch decides tangency by its last bit (square-25 at pitch 24 refused by 1e-16). | ~20 |
| 3 | **Exact adapter**: from the emitted identities build the centre, phase and magnets as straight-line functions of size; instantiate at any exact size. | Scaling needs the magnets as a function of size; the numeric path gives only a snapshot. | ~80 |
| 4 | **One judgement** for Free and rungs: exact seat legality of every node + exact worst-belt Wrap over outline and holes, including at an irrational size (one square root, existing comparison). | "Every control true": the same layout must get the same verdict in Free and in a rung. Today seat and Wrap disagree by float noise. | ~140 |
| 5 | **Walk → discovery**: the existing band walk keeps stepping but only records states — all four placements, before the winner is picked — with brackets; it certifies nothing; seat-based band ownership deleted. | Measured: seat-based ownership lost the squircle's 8-magnet rung in B4; winner-only observation cannot see the 2-magnet square layout. | ~60 |
| 6 | **Local contact roots**: for each recorded state, every belt disc × every segment gives a quadratic in size; solve inside the bracket (root isolator returns from the reverted branch with this consumer); re-run the numeric Centre once at the root; judge; discard on state change. | "Size where it snaps" is irrational for diamonds/curves; a 1 mm walk never lands on it. One solve, no recursion. | ~120 |
| 7 | **Logic**: next count strictly greater than last published, earliest accepted rung owns it, no cross-band repeat, co-lawful placements kept, vertical beats horizontal after centre/wrap/count/allowance tie, fixed/Auto on the same requirement. | Scaling law + gravity ruling. | ~40 |
| 8 | **Worker/tab**: store the B1–B4 result once, select rungs from it, show rounded size keep exact, B5 removed, honesty note = three laws; pitch/padding/mass-depth flow through the public config. | Engine must run where Dan looks; "every control true". | ~60 |

Performance is inside 5–6: discovery is float, exact work only at candidate roots (today's exact-per-millimetre walk takes 53–86 s per band on a real cutout — not shippable).

## 4. What we do not build — and the stop rule

Not built: exact Centre rebuild, offset geometry, regime/event enumeration, proofs over every real size, first-lawful certificates, resultants/RUR/expression graphs, recursion or cycle handling, T4 worker migration, any tolerance or rounding in the law.

Stop before code if: a helper has no live rung consumer · a test asks for completeness over every real size · Centre or Wrap behaviour moves · a certificate exists for another certificate · recursion appears without a failing fixture · algebraic geometry beyond the one candidate state being judged.

## 5. Gates — three mandatory, then the tab

- Fixture 12 — adapter identity: every centre mode/governor reconstructs from emitted identities; square 25 @ pitch 24 one exact verdict; Weight squircle 72 identical exact refusal in both paths; report-decimal perturbation changes nothing.
- Fixture 17 — holed cutout: exact hole segments, hole overlap refused, hole as binding witness, Free = rung.
- Fixture 10 — denser-step walk on square, circle, pill, rectangles, diamond, heart, duck, bot, batwoman, holed cutout finds no count the walk missed. A miss becomes a fixture before any mechanism.
- Then the live tab: square 1 → 2 & 4 → 8 → 12 at 24/72/120/168 with touch dots; 24.1 refuses; diamond's irrational rung; squircle 8 in B4; every band < 2 s on a real cutout; Centre/Wrap visuals unchanged. Dan looks at this, not at test output.

## 6. Why the last two days failed, and what is different now

1. The contract demanded "exact over every size, no mesh anywhere" while freezing a sampled mesh — an unsatisfiable pair; every builder built the only thing that satisfies it: a proof platform. **Deleted.** The requirement is now: every *published* rung exact; discovery measured.
2. Builders landed 1,800-line public slices "to be cleaned later". **Rule:** eight named commits, each live-checked, no public WIP.
3. Reviews shipped line-cited verdicts without the fix; each round re-derived. **Dan's rule:** every finding carries its replacement text.

One builder, one tree, one commit per row above. Time, counted per commit against what T1/T2/Wrap actually took: 1) 20 min · 2) 15 · 3) 40 · 4) 60 · 5) 30 · 6) 45 · 7) 20 · 8) 40 ≈ 4.5 h of build, plus ~1.5 h for the three fixtures (QA writes them in parallel) and 30 min of live checks — one focused session, same day.

## 7. Open for Dan

Nothing blocks. One standing note: under "shape bits are the law" the flattened reference squircle is refused at flap 0 (off by 2e-14 mm); it rungs under Auto. If you ever want flat-0 rungs on curves, a single clause (lawful when exact gap ≤ 0.001 mm) does it — your call, later or never.

## 8. Verdict

Necessity — no unnecessary elements: every row maps to a brief clause or a measured defect; nothing speculative remains.
Sufficiency — delivers the directive in full: Centre kept, Wrap kept, exact next-count scaling across B1–B4 with gravity and ties, truthful controls, on the live tab.
