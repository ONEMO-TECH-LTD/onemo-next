# MAGFIT Contract Addendum v1.1 — Corrections Before Build

**Applies to:** `MAGFIT_ENGINE_CONTRACT.md` (1.0-draft) and `magfit-core/0.1.0`
**Authored:** s62-kai-meta, 2026-08-12, after independent validation of the mathematics
**Status of the base contract:** everything not amended here stands as written.

Every correction below is traced to a source ruling or to a measured run. Nothing here is
invented; each item names its evidence.

---

## A. Validation verdict — what is real and what is not

The mathematics of the base engine was re-derived and re-run independently (not inherited
from pixel's or lead's claims). Verdicts:

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Disc predicate (centre inside + boundary distance ≥ 12, closed tangency, exact rational) | **CORRECT — keep** | Equivalence proof sound; exact 128-bit implementation verified by reading `src/magfit.cpp` and running the suite |
| 2 | Band spans, 12mm steps, walk-every-size (no monotonicity assumption) | **CORRECT — keep** | span(b)=24+48(b−1); concavity argument sound |
| 3 | Selection returns 72mm/pair for a circle | **REAL DEFECT** | Ran a 720-gon circle: engine returns 72/pair. The law-book flap table and Dan's quadrant method (grid-laws.md, "HOW FLAP IS MEASURED"; ChatGPT round 6 §6) put the circle at **96mm/four-disc**. Four-disc requirement: 2·(√(24²+24²)+12) = **91.882mm → 96** |
| 4 | Band-2 sparse rule `ANY + min 1` is vacuous | **REAL DEFECT** | Parity proof: every template node lies in exactly one of the four thinning phases, so any non-empty layout always has ≥1 active node on some phase — the gate can never reject. Empirically: circle band 2 passes at min 1, fails at min 2 |
| 5 | Flap switches inverted | **REAL DEFECT** | Law (Dan 08-11, grid-laws.md L14): "no flap zone **greater than** 12–24mm on any side" — the values are **maxima**. Law table: square flap 0 = pass; circle band-3 flap 20 = **fail** at 12. Engine implements `flap ≥ limit` = pass. Ran the 72mm square: flap 0 reads `false` on both switches — backwards |
| 6 | Straight capsule ≠ general "linked" | **REAL, MINOR — declare, don't change** | The 24mm straight capsule is sufficient but not necessary (rejects a curved 24mm corridor). Conservative and deterministic; promoted to explicit v1 law in §B4 instead of silently assumed |
| 7 | O(n²) validation too slow; C ABI repeats validation | **NOT A DEFECT at real sizes** | Measured: BOT, 8,105 raw vertices, full pipeline (validate + solve bands 2+3) = **94ms**. The C++ API already validates once per solve across all bands, and the CLI uses it. No spatial index is justified by measurement (Necessity Law). C-ABI note stands for future mobile embedding only |
| 8 | Band 4 missing | **FALSE** | Ran square through band 4: 168mm, 16 magnets. Present in the shipped core |
| 9 | GPT validation record unverifiable | **RESOLVED** | Suite built and run locally (SDK libc++ flags): all fixtures pass, C boundary passes |

**Conclusion: the mathematical core is valid and can be built on.** Three real defects
(#3, #4, #5) must be corrected before the numbers can be trusted. They are policy/reporting
defects on top of a correct geometric kernel — no new mathematics is required.

---

## B. Corrections — the law this build implements

### B1. Selection: full-layout calibration first (supersedes contract §3.5)

Provenance: Dan's quadrant method (2026-08-12 11:49 — the four quadrants ARE the band-2
calibration; each demands a scale; the worst one governs) and its circle validation (96mm
four-disc, ChatGPT round 6 §6, consistent with the law-book flap table row "circle band 2 →
92 → 96"). Dan's 09:23 words scope the pair: "options to apply pair logic as well **to
accommodate narrow shapes less than 72mm**" — the pair is an accommodation for shapes that
*cannot* carry the square, not a cheaper early exit for shapes that can.

**Law (layout-TIER-first, as sharpened by GPT's own v2 correction spec):**

1. The **strongest layout tier the material carries anywhere in the band governs** —
   tier strength is the supported node count: full b×b square > linked L / partial
   blocks > pair. Within the winning tier, the **smallest legal size** wins; at that
   size the existing deterministic candidate order decides ties.
2. `NO_FIT` when no size carries at least a pair.
3. A single magnet never satisfies a public band.

The former behaviour (first passing size regardless of layout) remains available as
`selection = SIZE_FIRST` — Dan's standing method is to keep both ends of a ruled range
testable ("why do I need to rule if I never tested — add all options and test", the same
treatment the 12/24 flap switch gets). **Default: `LAYOUT_FIRST`.**

Worked consequences (all verified by running the corrected engine; numbers as amended by
§B6's freed sizes — see §B9 for the final selection order):
- circle/octagon → band 2: **94mm, 4 magnets** (was 72/pair); band 3: **164mm, full
  nine-disc square** — which the 12mm ladder had wrongly pushed out of the band
- 72×24 ribbon → band 2: 72mm pair (unchanged — nothing stronger than a pair ever fits)
- L-shape → band 2: 72mm, 3 nodes, 2 links (its own natural tier at its first size)

### B2. Sparse (96mm) law: engages at band 3, requires a pair (supersedes contract §10.1)

Provenance: Dan 2026-08-12 11:01 — "band 2 = 48mm grid only. 96 participates from band 3
up." Standing charter L14 (08-11): the minimum pair must hold "in 48mm **and** 96mm sparse"
— never relaxed for bands ≥ 3 by any later statement.

**Law:**

- **Band 2: no sparse gate.** The 96 lattice is not engaged at 72–108mm; testing it is a
  pretence (and the shipped default was provably a no-op — §A4). The engine reports, for
  information only, which single node would engage on a sparse garment.
- **Bands ≥ 3: the selected layout must expose a verified sparse pair** — two active nodes
  on one thinning phase, 96mm apart, joined by a supported 24mm capsule. Defaults:
  `mode = ANY` (production records the compatible phase; `FIXED` available per SKU),
  `min_active = 2`, `require_96mm_connected = true`.
- The sparse gate applies to the same transform, scale and layout as the dense check —
  unchanged from the base contract.

Verified consequence: the 120×24 band-3 ribbon keeps its 120mm three-node answer (phase
(2,0) keeps its two outer nodes, 96mm apart, capsule inside the ribbon — tangent, lawful).

### B3. Flap: maxima, not minima; trivial-limb exception reported (supersedes contract §13)

Provenance: Dan 08-11 (grid-laws.md): flap = the shape's overhang beyond the padded magnet
box, per side, and the success test is "**no flap zone greater than 12–24mm** on any side
unless it is a trivial limb". The 12/24 pair is a switch between two lattice quantities,
both kept testable.

**Law:**

- Per side: `flap_s` = overhang beyond the padded magnet bbox (exact rational, unchanged
  measure — this is Dan's ruled measure, bbox is correct here).
- Switches become **within-limit tests**: `within12_s = (flap_s ≤ 12)`,
  `within24_s = (flap_s ≤ 24)`. The 72mm square now passes both with flap 0; a circle at
  band 3 (flap 20/side) fails 12 and passes 24 — exactly the law-book table.
- **Trivial-limb evidence** (new, required by the "unless it is a trivial limb" clause and
  by Dan's cove/antenna concern): for each side exceeding a limit L, the engine tests
  whether a **broad tongue** — a 24mm-wide capsule anchored at an outer-row magnet,
  extending L+1mm beyond the box — is supported. `broadBeyond12_s` / `broadBeyond24_s`.
  - exceeds limit AND broad tongue → genuine oversized flap (**fail**);
  - exceeds limit AND no broad tongue → the overhang is a thin feature —
    **trivial-limb exception: reported, never auto-approved** (the brief's exact words).
- Evenness (|left−right|, |top−bottom|) unchanged — it is L14a's centring yardstick.

### B4. Link capsule: declared v1 law (amends contract §8 wording)

Two magnets are linked **iff** the straight 24mm-wide capsule between their centres is
fully supported. This is deliberately conservative: a curved-but-wide corridor does not
count in v1. Consequence: a fabric bridge that only connects around a bend reads as two
attachment islands. This is now stated law, not a silent implementation shortcut. Revisit
only with a real shape that demands it.

### B5. Performance: no change to the kernel

Measured (this machine, release build): 8,105-vertex trace, validate + solve bands 2 and 3
in 94ms; 1,000-vertex reference 1.7ms/solve. The Necessity Law forbids the spatial index
pixel proposed — no measured need. The one real note: embedders must use the
solve-all-bands entry (validate once), which the CLI already does. The per-band C ABI
re-validation note stands for future mobile work only.

---

## C. New required fixtures (added to the suite)

| Fixture | Required result |
|---|---|
| chamfered octagon (integer circle stand-in), band 2, LAYOUT_FIRST | 94mm, 4 magnets, 4 links |
| same octagon, band 2, SIZE_FIRST | 72mm, pair (policy switch works) |
| same octagon, band 3 | 164mm, full 3×3 square, four corners engaging the 96 phase |
| 72mm square flap | flap 0/side, within12 = within24 = **true** |
| circle at forced 96 (band-2 four-disc) | flap ≈ 12/side… within12 true at exactly 12 (closed) |
| 72×24 ribbon, band 2, sparse defaults | still 72mm pair (band 2 carries no sparse gate) |
| 120×24 ribbon, band 3, sparse pair law | 120mm, 3 nodes — sparse pair verified on phase (2,0) |
| cross/plus shape (arms 24mm), band 2 | vertical pair at 72; left/right flap 24: within24 true, within12 false, **no broad tongue → trivial-limb reported** |
| square, band 4 | 168mm, 16 magnets (regression pin against the "band 4 missing" claim) |

Determinism corpus and all existing fixtures stand, updated only where the flap direction
and selection law change expected values.

---

## B6. Sizes are free — Dan's ruling, 2026-08-12 ~14:5x (supersedes contract §3.2's 12mm ladder)

> "no one restricts the sizes — it is nowhere limited ever — the size is any — the grid is
> fixed — shapes by default will not fall into the specific size, they fall into grid band"

The manufactured size is ANY whole even millimetre (publication law: whole even mm;
nothing below 1mm exists). The 12mm candidate ladder was the admin instrument's
discretisation which the reference package wrongly hardened into "legal sizes". A shape
normalises to its own touch-point; the band is simply the range that size falls into
(`[span(b), span(b+1))`). **The law book's own circle row — band 2 at 92mm, not 96 — is
the confirming witness this addendum originally missed.** Candidate step is now 2mm;
measured cost on the heaviest real trace: 119ms end-to-end.

## B7. The band-span gate is retired — never Dan's law

> "I never said it and never locked as law or limitation."

Contract §6's "layout MUST span the band" was the reference package's invention. Retired
as a default everywhere; kept only as an off-by-default diagnostic filter on the admin
surface.

## B8. 96mm participation is evidence, not a gate (refines §B2)

Dan's word was 96 "participates" from band 3 up — participation is MEASURED AND
PREFERRED, never a reason to refuse a band its answer. Default: the engine reports the
best phase's engagement with every band-3+ result and ranks candidates by it; the strict
pair gate (two active nodes, 96mm apart, connected corridor) is an explicit optional mode
only. L14's dual-density clause was the 08-11 band-2-era success test; the 08-12 rulings
govern. Consequence: every shape now receives one size per band wherever the geometry
itself allows — the only no-fits left are genuine material impossibilities.

## B9. Selection: approximate the fit — Dan's ruling, 2026-08-12 ~15:0x (supersedes §B1's tie-breaks)

> "the logic must approximate the fit — perfect is square precise wrap of each band
> 24/72/120… freeshapes cannot be that perfect by definition — we scale them to create
> more placement options and center and balance it inside the shape"

The square's precise wrap at the band anchor is the perfect case. A free shape scales
within the band range to create more placement options, and the assembly is centred and
balanced inside it. The selection order across each band's whole range (one total order,
Dan's fewest-flap→most-even→snuggest draft made active under the tier principle):

1. strongest support — node count, then verified links, then full square;
2. 96 engagement (more engaging nodes preferred);
3. most even — smallest axis imbalance (L14a's yardstick, exact rationals);
4. fewest flap — smallest worst-side overhang;
5. snuggest — smallest size;
6. deterministic tail (centre bias, template, lexicographic).

Verified: the square canon stays perfect (72/120/168, zero flap, zero imbalance); the
octagon publishes 94/164/198 all perfectly balanced — the full 3×3 square now fits
INSIDE band 3 at 164mm, which the 12mm ladder had pushed out of the band.

## E. Reconciliation with GPT's own review response ("corrected and defended", 14:13)

GPT independently validated pixel's review and produced `MAGFIT_TEAM_REVIEW_VALIDATION.md`
and `MAGFIT_V2_CORRECTION_SPEC.md`. Alignment with this addendum:

- **Agrees, adopted here:** layout-tier-first selection (its circle proof matches §A3);
  band-2 sparse `NOT_ENGAGED` and the vacuity proof (§A4); local flap tongue witnesses
  anchored at outer magnets (§B3's broad-tongue construction is its `C(q,n,h)` capsule);
  the straight capsule kept as explicit conservative v1 law under an honest name (§B4);
  its U-shaped curved-corridor counterexample confirms why the naming matters.
- **One dispute, overruled by evidence GPT did not have:** GPT marks "12/24 was settled
  as a maximum" as *unproven from its record* — its record was only the brief. The law
  book (`_WIP/grid-engine-v3/grid-laws.md`, Dan 08-11 verbatim: "no flap zone **greater
  than** 12–24mm on any side", with a worked table where a 20mm circle flap FAILS the 12
  switch and the zero-flap square passes) settles the direction. The within-limit
  semantics stand; the fields stay factual (`within_12`, `broad_beyond_12`), never a bare
  `pass`, which also satisfies GPT's neutral-naming concern.
- **Noted for later, correctly rejected as blocking now:** its prepared C/Wasm API and
  sweep-line validation requirements target phone embedding; this build's integration
  uses the C++ solve-all-bands path (validates once) and the measured 94ms full-pipeline
  cost at 8,105 vertices (§A7).

## D. Held for Dan (not blocking this build — defaults follow standing rulings)

1. **Selection default.** LAYOUT_FIRST is implemented as the default per the quadrant
   method; SIZE_FIRST is one click away. If Dan intends 72/pair for a circle, it is a
   policy flip, not a rebuild.
2. **Trivial-limb disposition.** The engine reports the exception with evidence; whether
   an excepted side ultimately passes production is Dan's call (the ruling only says
   "reported, not auto-approved").
3. **Manufacturing margin** above nominal 12mm — untouched, per base contract §15.
4. **Butterfly one-product-or-two** — unchanged; the engine reports islands as measured
   fact.
