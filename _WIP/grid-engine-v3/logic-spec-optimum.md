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

**THERE IS NO BAND-COUNT RULE** [RULED — Dan 2026-08-16: "we do not have rule of band 1 = 1
magnet or band 2 having only pair - wrong as square in band 2 is 4 magnets - only narrow
shapes that represent rectangular shape class produce pairs in band 2"]. The count comes from
the **class × band frame** (§5), reduced by material — never from the band alone. B1 = one
magnet is a geometric consequence (under 72mm only one node line fits per axis), not a rule.
The walkthrough's "band 1 and 1 magnet / band 2 and two" lines were per-shape examples of
narrow classes, not band laws.

| Band | The optimum it owes | Source |
|---|---|---|
| **B1** | The 1×1 frame (geometry admits nothing more), seated in the top of the mass (gravity: "if only one magnet can be placed top is preference"), tightly wrapped | RULED (L20, duck walkthrough; count = geometric consequence) |
| **B2** | The class's frame: **square-like → 2×2 four** (the square standard); **narrow/rectangular → the pair**, orientation following the shape's own axis — vertical for standing, horizontal across wings, diagonal for diagonal shapes (same lattice) — snug, centered | RULED (square standard + 08-16 correction; L20 by-example for the narrow classes) |
| **B3** | The shape's **structural pattern revealed**: the arrangement class its material names — apex/T for tapered, corners spanning the waist, narrow rect for standing mass, corner square for blobs, chain for diagonals. Corners at the extremes; mid rows OPTIONAL | RULED (L20 corner-holds + row-skipping rulings) |
| **B4** | The **stepped band**: the same arrangement class grown — "only the lattice step grows" (48→96) AND the grid grows by an extra disc minimum or an entire row/column vs B3. "At least 4 points is easy." Bottom-heavy lawful: "6 or 9 or a variation … more disks at the bottom and less in the top" — the upper mass may hang as a limb (hang bound = limb allowance at this band only). Never band 3's answer re-offered looser | RULED (08-13 + 08-15/16 sessions) |
| **B5** | Exists in the authority doc (216–264). The bat's face+skirt co-registered tight seat (~219) lives here | [OPEN — product call] |

**Cross-band laws** [RULED, 08-15/16]: every band answers (honest NONE allowed only when no
hold-lawful placement exists) · each band's answer ≥24mm above the previous · a band never
re-offers a lower band's arrangement identity · every band's chips carry more magnets than the
band below's top rung.

---

## 4. THE SOLVING FUNNEL — general to specific [RULED — Dan's multi-step method (GPT conversation 08:51/09:31) + Compute System doc §18]

Each step narrows the space; no step may skip ahead. The governing asymmetry, in the ruled
words: **"The band tells us how much grid-space the object occupies. The silhouette tells us
which parts of that grid-space actually contain material."** The bounding box classifies; it
never places magnets.

| Step | From general… | …to specific | Source |
|---|---|---|---|
| 1 | **Bounding box** | width, height, aspect ratio — the rough starting point | RULED ("Match outer bounding box to each band as rough starting point") |
| 2 | **Shape class + axis classes** | each axis classified independently (1–5); class from aspect + fill: **square-like / tall rect / wide rect / circle-oval / free** (free refines at step 6); band = dominant axis class | RULED (§4) |
| 3 | **Frame hypothesis** | class implies the candidate node frame — tall → 1×2 column, wide → 2×1 row, square-like → 2×2 (empty centre), larger bands the same logic at scale (2×3, 3×3 …; n lines span 2n−1 cells). **Capacity, never compulsory** — a square-bbox T still takes the vertical pair its material supports | RULED (§4–§5 + "the other bands can in merit same logic on larger scale") |
| 4 | **Candidate sizes** | scale the silhouette, aspect locked, through the band's range; every size evaluated independently | RULED (§12) |
| 5 | **Safe core** | 12mm full-disc erosion at that size — ears, necks, spikes vanish by geometry, per size, never by label | RULED (§7.2) |
| 6 | **Structural map** | major masses / connectors / peripheral branches; strong vs marginal by width + persistence — the general class refined into the FREE class (tapered / waisted / standing / blob / winged / diagonal) by what the material actually is | RULED (§7.3/§8) |
| 7 | **Registration** | canonical origin = bbox centre + parity (odd count on a node line, even on the spacer); controlled search within one 48mm period; **mechanics choose the registration, canonical breaks ties** | RULED (§6 + review correction) |
| 8 | **Node classification** | every lattice node: illegal / marginal / strong | RULED (§9) |
| 9 | **Pattern recognition** | approved templates instantiated from lawful nodes — the T is *revealed*, not invented | RULED (§10–11) |
| 10 | **Mechanical selection → snug seat** | the §2 order picks among lawful patterns; tight-wrap selects the size; the band's distinct optimals assemble, one bulls-eye marked | RULED (§11 + L20 + L17) |

**Funnel discipline:** a defect is diagnosed at the EARLIEST step that could have caught it (a
wrong arrangement is usually a step-3/6 miss, not a step-10 tuning problem), and a fix lands at
its own step — never as a compensating rule downstream.

---

## 5. STANDARD LAYOUTS AND SIZES — per class, per band

**The derivation hierarchy [RULED — Dan 2026-08-16: "we have banding based on square as
standard - rectangle is derivative and anything else walks from there"]:**

```text
SQUARE  — THE STANDARD. Banding itself is defined by it (24 · 72 · 120 · 168 · 216).
   ↓
RECTANGLE — the first derivative: the square standard applied PER AXIS
            (axis classes combine: a tall B3 is a square-standard 72 axis × a 120 axis).
   ↓
CIRCLE / OVAL — walks from the square: same counts, sizes grown by the padding the
                rounded corners demand (measured: 92 / 160 / 228).
   ↓
FREE CLASSES — walk from the nearest geometric ancestor: the funnel's step-6 structural
               map names the class; the frame hypothesis is inherited from the square/
               rectangle standard at its axis classes; the material then reduces it
               (an L drops to 1+2 by itself — L5). Never invented, always derived.
```

The square is the calibration control; every other class's standard is a stated derivation
from it, so a change to the square standard rederives everything below — nothing carries its
own independent numbers.

### 5.1 The square standard and its derivatives — exact

| Class | B1 | B2 | B3 | B4 | B5 | Derivation |
|---|---|---|---|---|---|---|
| **SQUARE** (the standard) | single · **24** | 2×2 · **72** | 3×3 · **120** | 4×4 · **168** | 5×5 · **216** | ROOT — "measured by squares is the easiest"; span = (n−1)·48 + 2·12 |
| **Tall rectangle** | single | 1×2 column · **24×72** | 1×3 / 2×3 · **72×120** | 2×4 / 3×4 · **120×168** | 3×5 / 4×5 · **168×216** | square standard per axis; layouts follow the long axis |
| **Wide rectangle** | single | 2×1 row · **72×24** | 3×1 / 3×2 · **120×72** | 4×2 / 4×3 · **168×120** | 5×3 / 5×4 · **216×168** | mirror of tall |
| **Circle / oval** | single · ~40 | 2×2 · **92** | 3×3 · **160** | 4×4 · **228** | — | square counts + padding growth (L18 measured; encapsulation variant 102/170/238) |

### 5.2 Free classes — walked from the standards (canon reference sizes from the walkthrough)

| Class (step-6 refinement) | B1 | B2 | B3 | B4 | Source |
|---|---|---|---|---|---|
| **Tapered** (triangle-like: bat) | single in the apex mass (~60) | vertical pair on the axis (~88); small shapes: apex + mid-bottom 2-point | **3 points, utmost corners** (two linked 48 pairs; mid-bottom hidden) / apex + base row (~144–146) | the same class grown on the stepped lattice: apex family + row, 2×3 six variation, bottom-heavy | RULED 14:29:46 + bat walkthrough 12:53 + 08-15/16 B4 session |
| **Waisted** (duck) | single in the head (~60) | vertical head+body pair (~79–84) | **rect 48×96, four corners, mid row SKIPPED** (~152) | grown population (+row/disc) | RULED walkthrough 12:51–12:52 |
| **Standing mass** (bot) | single (44/60 [OPEN]) | vertical pair (~96–98) | **narrow 96×48 four** (wide square acceptable, narrow BETTER) (~144) | longer rectangle / rect + mid row (ruled 236 frame is B5-territory) | RULED 12:57 + 13:02 |
| **Blob** (poke) | single (~40–60) | pair along the long axis (~75–76) | **corner square 96×96** (~123–126) | **four on the 96 grid** (~217) + grown ladder | RULED 12:56 + 13:01 |
| **Winged** (butterfly) | single in the body, dead-centre (~60) | **horizontal wing pair** (~92–97) | four-in-wings corner square (~126–130) | four on the 96 grid (~204–214) | RULED 12:54 + 12:59 |
| **Diagonal** (pill) | single (end-seat physics) | **diagonal pair** — same lattice, no new grid (~79–82) | **diagonal 3-chain PREFERRED** (~138); staggered square strong alternative | grown diagonal population / staggered square | RULED 12:58–13:03 |

**Reading the tables:** layout family + count are the standard; the size is the snug seat the
funnel finds near the canon reference. A class's standard is the step-3 frame hypothesis the
funnel starts from; the material (steps 5–6) may reduce it (L drops to 1+2 by itself — L5),
never inflate it.

---

## 6. THE OPTIMUM PER SHAPE PER BAND — the canon table

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

## 7. LOGIC + COMPUTE = THE ENGINE DESIGN

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
  (KNOWN DELTA: the coded "band count law" — targetMagnets B1=1/B2=2 as a universal ranking
  key — is mis-derived per the 08-16 correction; it must become the class×band frame of §5)
- the selection order of §2, the per-band laws of §3, the offer policy of §1.2
- v3.2 today: `spec.ts` + `logic/judgement.ts` — the ranking re-base to §2's order is the
  known delta (regions in, count last, evenness promoted, bulls-eye marking)

### The acceptance harness
The §4 canon table IS the regression gate: every row an executable fixture through the real
solve door, plus the counterexample suite (wide/tall/circle/spike/notch/mushroom/dumbbell) so
no rule is bat-shaped. A ranking change that moves a ✅ row is a defect; moving a Ⓓ row is a
calibration event to show Dan.

---

## 8. WHAT THIS SPEC SETTLES DAILY

Before any judge change, answer from this document:
1. Which §2 rule does this change implement, at which §4 funnel step?
2. Which §5/§6 cells does it move — and are they ✅ (stop: canon) or Ⓓ (show Dan)?
3. Is the value in LOGIC and the measure in COMPUTE?
If any answer is missing, the change is drift.

**Open register (the only undecided items):** bat B4 bulls-eye · butterfly B4 4-vs-6 ·
bot B1 44-vs-60 · pill B4 population · B5 existence · flap switch 12-vs-24 · peel-leverage
formula · poke2 walkthrough.
