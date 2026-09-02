# T3 addendum — search inefficiency audit (read-only, 2026-09-02)

Dan: "millions of decisions is a bit too much as we load the canon frame already … audit inefficiencies
in the engine to understand how it works." Every number below was measured on the headless call on the
four cutouts (Duck, BOT, Batwoman, Butterfly), pitch 48, rim 12, in Node; probes were temporary
instrumentation, deleted after the run; nothing here is built.

## How the search works today (one band, one shape)

1. The classifier names the canon frame (e.g. 3×4 = 12 nodes) and the band gives an outline size range.
2. **Reveals.** The band is walked at 48 sizes (1 mm apart), largest first.
3. **Phases.** At each size the lattice is slid over the shape at 48×48 = 2 304 phase offsets (1 mm).
   For each phase every lattice point is seat-tested (point-in-shape + 12 mm edge clearance) → a "free set".
4. **Windows.** Phases are sorted by free-seat count; for each phase every placement of the canon frame
   over the lattice ("window") is checked node-by-node against the free set; the held subset gets a string
   id and feeds two accumulators (blind max-count, priority tuple). The loop breaks when neither can improve.
5. The handful of unique subset ids (3–75 per band) are each **wrapped once** — the Clipper wrap finds the
   exact contact size itself — and the judge orders the offers.

So the whole sweep (2–3) exists only to discover **which subsets of the known frame can sit in the shape**.
Where they sit at which reveal is recomputed by the wrap and discarded.

## Inefficiency ledger — evidence first

| # | finding | measured | why it is waste | sound fix (needs its own proof) |
|---|---|---|---|---|
| I1 | Seat-test memo never hits | 0 hits in 20/20 solves; deleting it −23.4 %, offers byte-identical | every phase shifts the lattice 1 mm, so no point repeats | **T3 (cleared):** delete |
| I2 | Free sets are built for **all 2 304 phases** per reveal, but the window loop visits **2–10 %** of them before it breaks | Duck B3 6 409/110 592 phases visited · BOT B5 2 071 · Batwoman B5 4 337 (Butterfly B5: 100 %, see I5) | seat tests are 37–74 % of the search and ~90 % of them feed phases never used | build free sets lazily, in an order that preserves the break rule (ordering by an arithmetic upper bound — lattice points in the box — and materialising on demand). Offers depend only on the subset ids, not on which phase found them, so the accumulators' answers do not change; a proof + equality gate is required |
| I3 | **48 reveals per band; only the first (largest) decides anything** | blind maximum reached at reveal 0 in 12/12 sweeps; priority floor moves exactly once, at reveal 0; only 3–7 reveals add any id, all lower-count and never chosen. **First-reveal-only run: 20/20 cases pick the same layouts** (same counts, roles, centring; the only deltas are 0.01–0.02 mm from the probe's own 0.001 mm size nudge) · time 61.1 s → 14.2 s (**−77 %**) | This is not monotonic for arbitrary contours: a growing hole can remove a seat that was legal at a lower reveal, and Core centring may change placement with size. The 20-case observation is not a proof. | run the largest reveal, then continue **only while** a reveal still adds a new id or moves a floor (adaptive stop), or prove monotonicity for the shape class and drop the loop. Either way: equality gate on the corpus, plus a concave-shape counterexample search before trusting it |
| I4 | Window loop allocates per window | 70–85 % of windows hold ≥1 node; each builds two arrays + a joined string id; Butterfly B5 = 5.1 M held windows for 75 ids | millions of small allocations to find dozens of ids | integer subset encoding instead of string ids (frames ≤ 31 nodes fit a bitmask at 48 mm; 24 mm frames need a packed key) — micro, measure before deciding |
| I5 | The break rule cannot fire when the frame is bigger than what the shape can hold | Butterfly B5: canon 20 nodes, shape holds 12 → `phaseCount ≥ maxCount` stays true → all 110 592 phases visited, 7.06 M windows, 11 s | the rule compares free seats in the whole lattice to the best held count; a frame that never fits whole never closes the gap | cap the comparison at the frame's own node count / the phase's max possible held nodes — needs proof it cannot prune a lawful window |

Observed but **not** waste: wraps (3–7 per band, Clipper) are cheap; classify, bake, protector are noise;
warm repeats are 45–145 ms — the caches work.

## What this means for "instant"

Today's cost is 48 reveals × 2 304 phases × ~25 seat tests ≈ 2.6 M tests to find a few subsets of a
frame we already know. I1 (cleared) removes a quarter of it without touching the search. **I3 alone
removes ~three quarters** — if its soundness holds — and I2 removes most of the remainder; together they
would put a cold band solve in the low hundreds of milliseconds, i.e. phone-viable without a server.
None of I2–I5 is authorised yet: each changes the search and therefore needs a stated equivalence proof,
an equality gate over the corpus and a deliberate counterexample hunt before QA sees code.

## Proposed order (Dan's call)
1. Land T3 as cleared (I1).
2. I3 with the adaptive stop (largest reveal first, continue only while something new appears) — the
   biggest win, and adaptive means it degrades to today's behaviour on a shape that needs more reveals.
3. I2 lazy free sets.
4. I5 break-rule cap, I4 encoding — only if the numbers after 2–3 still warrant them.

## Corrections after the full read of `units/layout.ts` and two more probes (same day)

- **I2 as written is retracted.** Lazy free sets need an ordering bound that is cheaper than the seat tests.
  The only cheap bound is "lattice points inside the box at this phase", which varies by ±1 per axis
  (e.g. 16 / 20 / 25) and is always ≥ the held maximum (e.g. 12), so it never lets a phase be skipped.
  The stop rule needs the exact free count, and computing it IS the seat test. No exact saving there.
- **I2′ (cross-reveal blind floor, mirroring the existing priority floor) measured: no gain** (+2 %, noise;
  offers identical 20/20). The priority accumulator keeps a phase open whenever its best tuple is not yet
  full-priority, so closing the blind side alone skips no window loop. Rejected by measurement.
- **I3: parked; do not schedule** unless a future design first includes holed and Core-centred counterexamples plus exhaustive full-reveal equality (QA F2). Identical on 20/20 only; not a proof.
- **I5**: no cheap exact fix exists; dropped.

**Net: after the full read, the only result-preserving optimisation available without changing the
search is I1 (built: `97206655`).** Offers byte-identical on 20/20; cold total −23 % on a quiet machine
(59.1 → 45.3 s), −7 to −13 % under load (machine variance, not the change). Everything larger is either
unprovable (I3) or an algorithm change, which is a product decision, not an optimisation.
