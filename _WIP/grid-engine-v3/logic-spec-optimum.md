# LOGIC SPEC — THE OPTIMUM, PER SHAPE, PER BAND

**Status:** Focus document + engine design anchor. Every clause marked:
**[RULED]** = Dan's words (source cited) · **[DERIVED]** = reading shown for veto · **[OPEN]** = named, undecided.
**Authority order:** Dan's rulings → ONEMO Magnetic Grid Compute System doc ("latest, has more power") → grid-laws.md → measured physics.

---

## 1. THE DEFINITION OF OPTIMUM

### 1.1 At one scale [RULED — composed from L14/L14a/L15/L20 + 2026-08-16 definition session]

The optimum is the **lawful arrangement that covers the shape's major masses with the top held,
wrapped so snugly that flap is minimal and evened on all sides, in a coherent approved pattern,
with the fewest magnets that achieve that support.**

Its named ideal: **four magnets at the outermost corners, discs enveloped to the edge** (L15),
with the pair as the floor (L4). Dan, 14:45:19: *"system must select the optimal by how fewer
flap it has — if it is harmonious and centered and how snug it fits the bounding box of set
mag layout."*

### 1.2 Per band [RULED — Dan 2026-08-16: "each band must show within its size range all optimal sizes and layouts if range permits — not just 1 if there are more"]

A band's optimum is the **set of distinct optimals its size range unlocks** — distinct means
the grid genuinely grew (more magnets, next window), each at its own snug seat. The same
arrangement re-listed looser is never a second optimal. One of the set is **marked as the
guaranteed bulls-eye** (L17): the answer a person would have chosen by eye; everything else is
returned, not hidden.

### 1.3 The intent that governs both [RULED — GPT conversation, 08-15 morning]

> *"Given ONEMO's predefined magnetic architecture, determine how this shape must be sized so
> that it legitimately participates in that architecture."*

The grid is fixed; the shape scales to conform. Arrangements are **revealed by material
occupancy on the grid**, never invented by an optimizer.

---

## 2. THE SELECTION ORDER — lexicographic, no numeric weights [RULED — Compute System doc §11: "lexicographic, not one opaque score"]

Priority = position. First rule that separates two candidates decides. The only numbers are
law bounds, never multipliers.

| P | Rule | Source |
|---|---|---|
| 1 | **Full geometric legality** — whole 24mm disc on material, on-lattice, no overlap, tangency legal | RULED (L2/L3, §2) |
| 2 | **Coverage of major support regions** — every substantial mass holds a magnet; a band that cannot cover them has no answer there (escalate) | RULED (§11.2 + L20 escalation: "the 4 does not fit and 3 leaves flap in the head → better to scale to band 3") |
| 3 | **Support of the upper gravity-critical mass** — measured as hanging MASS, not tip reach | RULED (L20 gravity-first; mass-aware measure DERIVED, landed 08-16, bat ears case) |
| 4 | **Reduction of unsupported extent** — per-side flap vs the 12–24mm switch; trivial limb exempt AND reported | RULED (L14, O-2a) |
| 5 | **Reduction of peel/flap leverage** | RULED (§11.5) — [OPEN: numerical definition, register PD] |
| 6 | **Coherent approved pattern** — versioned library; never arbitrary subsets to raise count | RULED (§10) |
| 7 | **Distribution across distinct material masses** — one per lobe/wing | RULED (§11.7) |
| 8 | **Balance** — flap evened on all sides simultaneously (L14a); mirror symmetry on symmetric shapes; parity registration | RULED |
| 9 | **Fewer magnets when support is equivalent** — sparse preferred (L8b) | RULED (§11.9: "more magnets do not automatically produce a better result") |
| — | **Size selector: the snug seat** — tightest wrap of the winning arrangement | RULED (L20 tight-wrap, L11 hug) |

**Registration:** mechanical quality chooses the registration; canonical (bbox-centre + parity)
is the origin and the final tie-break only. [RULED — carried through all three R3 review rounds]

---

## 3. THE BANDS — what each owes [RULED unless marked]

Bands: B1 24–72 · B2 72–120 · B3 120–168 · B4 168–216 · B5 216–264 (§4; B5 product-parked
[OPEN]). Band = dominant axis class; each axis classified independently (tall B2 ≠ wide B2 ≠
square B2 — axis class is CAPACITY, never a compulsory layout).

| Band | The optimum it owes | Source |
|---|---|---|
| **B1** | ONE magnet, seated in the top of the mass (gravity: "if only one magnet can be placed top is preference"), tightly wrapped | RULED (L20, duck walkthrough) |
| **B2** | THE PAIR, orientation following the shape's own axis — vertical for standing, horizontal across wings, diagonal for diagonal shapes (same lattice) — snug, centered | RULED (L20 by-example, six shapes) |
| **B3** | The shape's **structural pattern revealed**: the arrangement class its material names — apex/T for tapered, corners spanning the waist, narrow rect for standing mass, corner square for blobs, chain for diagonals. Corners at the extremes; mid rows OPTIONAL | RULED (L20 corner-holds + row-skipping rulings) |
| **B4** | The **stepped band**: the same arrangement class grown — "only the lattice step grows" (48→96) AND the grid grows by an extra disc minimum or an entire row/column vs B3. "At least 4 points is easy." Bottom-heavy lawful: "6 or 9 or a variation … more disks at the bottom and less in the top" — the upper mass may hang as a limb (hang bound = limb allowance at this band only). Never band 3's answer re-offered looser | RULED (08-13 + 08-15/16 sessions) |
| **B5** | Exists in the authority doc (216–264). The bat's face+skirt co-registered tight seat (~219) lives here | [OPEN — product call] |

**Cross-band laws** [RULED, 08-15/16]: every band answers (honest NONE allowed only when no
hold-lawful placement exists) · each band's answer ≥24mm above the previous · a band never
re-offers a lower band's arrangement identity · every band's chips carry more magnets than the
band below's top rung.

---

## 4. THE OPTIMUM PER SHAPE PER BAND — the canon table

Sizes wobble lawfully with calibration; the FAMILY is the canon. ✅ = frame ruled/blessed by
Dan · Ⓓ = derived by law, awaiting his eyes/veto · [OPEN] = named conflict.

| Shape | B1 | B2 | B3 | B4 |
|---|---|---|---|---|
| **bat** (tapered, mirror-symmetric) | ✅ single on the face (~60) | ✅ vertical pair face+chest (~88) — "my B2 is 2 disks" | ✅ face + base-row support (~146; blessed 4pt tee 08-16; ruled 3pt "utmost corners" triangle acceptable) | Ⓓ grown grid: spine+skirt 5pt (~172) and the 2×3 six (~206, head as limb). [OPEN: which is the bulls-eye — B4's dead zone means face+skirt co-registration only returns at ~219/B5] |
| **duck** (waisted, asymmetric) | ✅ single in the head (~60) | ✅ vertical head+body pair (~84) | ✅ rect 48×96, four corners, mid row SKIPPED (~152) | Ⓓ grown population 5pt (~210) |
| **butterfly** (winged, mirror-symmetric) | ✅ single in the body, dead-centre | ✅ horizontal wing pair (~92) | ✅ four-in-wings corner square (~126–130) | ✅ four on the 96 grid (ruled 214) · Ⓓ tighter 6pt (~180) exists — [OPEN: 4-sparse vs 6-tight, §11.9 says fewer at equal support] |
| **bot** (standing mass, mirror-symmetric) | [OPEN: tight 44 vs ruled 60 dead-centre] | ✅ vertical pair (~98) | ✅ narrow 96×48 rect, exact (~144) | Ⓓ the rect grown by its entire mid row = six (~168); ruled 236 frame is beyond the band |
| **pill** (diagonal capsule, asymmetric) | Ⓓ single (end-seat is physics; ruled centre seat impossible at B1 sizes) | ✅ diagonal pair (~82) — "for diagonals better to use diagonal" | ✅ diagonal 3-chain (~138) — ruled PREFERRED over the pair | Ⓓ grown diagonal population (~194 8pt) — [OPEN: likely over-populated vs §11.9; the staggered square is the ruled alternative] |
| **poke1** (full blob) | ✅ single (~40) | ✅ vertical head-body pair (~76) | ✅ corner square (~123–126) | ✅ four on the 96 grid (ruled 217) · Ⓓ ladder 6pt·172 / 7pt·204 / 8pt·210 verified on bench |
| **poke2** (blob profile, unwalked) | Ⓓ single | Ⓓ vertical pair | Ⓓ column run-3 | Ⓓ grown 4→6→7 ladder |

---

## 5. LOGIC + COMPUTE = THE ENGINE DESIGN

**The split** [RULED — "neutral computation in the math engine … values editable but locked in
the logic engine"]:

### COMPUTE owns (neutral geometry, zero product knowledge)
- exact legality: full-disc containment, tangency legal, no rasterizing
- the safe core (12mm erosion — search evidence only; direct containment is the sole proof)
- the structural region graph: major masses / connectors / peripheral branches, local width,
  **persistence across sizes** (strong vs marginal)
- registration transforms + the parity frame; feasible-translation regions as intersected
  shifted safe-cores (continuous/certified-conservative — never a mm sweep)
- neutral measures: clearances, directional extents, hanging-mass areas, moments, wraps
- v3.2 today: `compute/` (v1 core, byte-verbatim) + `compute/structure.ts` — the region graph
  and feasibility math are the two missing pieces (Step 1/Step 2 of the assembly plan)

### LOGIC owns (values + policy, zero geometry)
- the released profile: pitch 48/96, padding 12, bands, counts, bounds (12/24/28/40/108),
  templates, thresholds — guarded writers, refuse-never-clamp, versioned/hashed when released
- band/axis classification, frame hypotheses, pattern permissions
- the selection order of §2, the per-band laws of §3, the offer policy of §1.2
- v3.2 today: `spec.ts` + `logic/judgement.ts` — the ranking re-base to §2's order is the
  known delta (regions in, count last, evenness promoted, bulls-eye marking)

### The acceptance harness
The §4 canon table IS the regression gate: every row an executable fixture through the real
solve door, plus the counterexample suite (wide/tall/circle/spike/notch/mushroom/dumbbell) so
no rule is bat-shaped. A ranking change that moves a ✅ row is a defect; moving a Ⓓ row is a
calibration event to show Dan.

---

## 6. WHAT THIS SPEC SETTLES DAILY

Before any judge change, answer from this document:
1. Which §2 rule does this change implement, at which position?
2. Which §4 cells does it move — and are they ✅ (stop: canon) or Ⓓ (show Dan)?
3. Is the value in LOGIC and the measure in COMPUTE?
If any answer is missing, the change is drift.

**Open register (the only undecided items):** bat B4 bulls-eye · butterfly B4 4-vs-6 ·
bot B1 44-vs-60 · pill B4 population · B5 existence · flap switch 12-vs-24 · peel-leverage
formula · poke2 walkthrough.
