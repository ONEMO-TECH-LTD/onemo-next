# CODE vs LEDGER — read-only conformance audit

**What this is:** the current v3.2 code measured row-by-row against `T0-AUTHORITY-LEDGER.md`
(@ `486e8110`). Read-only: no code touched. It converts the ledger into the exact task list
T1–T9 must execute, and it is the evidence QA and Meta can re-walk.

**Verdicts:** **CONFORMS** · **PARTIAL** (implemented in part, or in the wrong position, so the
ruled behaviour is not achieved) · **VIOLATES** (code contradicts a ruled row) · **ABSENT** (ruled
row has no implementation) · **UNGOVERNED** (code exists that no ledger row authorises — must go).

**Revision 2** — QA gate `a361c1aa`: audits the rows I skipped (1.8, 6.4, 6.10), corrects 1.10,
adds the rows the repaired ledger introduced (8A/8B/8C/8D), declares PARTIAL above, and withdraws
the coverage claims until the ledger crosswalk carries them.

**Probed at:** `486e8110` + one uncommitted `judgement.ts` edit that T1 discards.

---

## §1 PHYSICAL CONSTANTS

| Ledger | Verdict | Evidence |
|---|---|---|
| 1.1 24mm cell · 1.3 48mm pitch · 1.4 96 as sparse population | **CONFORMS** | `spec.ts` `basePitchMM` sealed 48, launch pitches 48/96, "never lays a different lattice" |
| 1.2 12mm radius / 24mm disc | **CONFORMS** | `paddingMM` released 12, guarded writer |
| 1.6 legality = whole disc inside, tangency legal | **CONFORMS** | 8 call sites of the exact predicates inside the verbatim core; no rasterizing |
| 1.7 magnet 6/8/10 inside the protected area | **CONFORMS** | released magnet diameters; focal law in core |
| 1.9 scale only, aspect locked, no rotation | **CONFORMS** | `normalizeContour` + `scaleContour`; no rotation path exists |
| 1.10 publish up to next even mm | **CONFORMS** | size step even, sizes published as computed |
| 1.11 size step 2mm (CALIBRATED) | **CONFORMS** | `sizeStepMM: 2` |
| 1.5 sparse hides points, nothing re-centres | **CONFORMS** | 96 is a population of the same lattice; no separate origin |

**§1 is clean.** This is the substrate both audits said to preserve, and the ledger confirms it
row by row.

---

## §2 BANDS AND AXIS CLASSES

| Ledger | Verdict | Evidence |
|---|---|---|
| 2.1 five bands incl. **B5 216–264** | **ABSENT (B5)** | `spec.ts` defines bands 1–4 only. B5 is ruled and unimplemented. |
| 2.3 lower-inclusive / upper-exclusive | **CONFORMS** | `sizeMM < bandCapMM` loop semantics |
| 2.4 axes classified independently | **ABSENT** | no per-axis classification anywhere |
| 2.5 axis class is capacity | **ABSENT** | nothing consumes an axis class |
| 2.6 **no band-count rule** | **VIOLATES** | `targetMagnets` 1/2/0/0 in the band rows **and** a live ranking key that pulls counts toward the target. Directly contradicts Dan's 08-16 ruling. |
| 2.7 B1=1 is a consequence | **VIOLATES** | encoded as a target, i.e. as a rule |

---

## §3 CLASS TAXONOMY AND FRAME HYPOTHESES

| Ledger | Verdict | Evidence |
|---|---|---|
| 3.1 square is the standard; everything derives | **ABSENT** | no class concept; no square/rect/circle control anywhere in code or tests |
| 3.2 frame spans 2n−1 cells · 3.4 frame vocabulary | **ABSENT** | no frame hypothesis object |
| 3.3/3.5/3.6 class standards | **ABSENT** | sizes emerge from a sweep, never from a standard |
| 3.7 free classes inherit then reduce | **PARTIAL / UNGOVERNED** | `shapeStructure` + `structureScore` classify the silhouette (tapered/waisted/…) — the right *intent*, but by whole-shape features, not by inherited frame + material reduction. Ledger 5.6 says thresholds are ENGINEERING; this implementation is a stand-in the ledger does not authorise as final. |

---

## §4 REGISTRATION

| Ledger | Verdict | Evidence |
|---|---|---|
| 4.1 canonical = frame centre on bbox centre | **PARTIAL** | a ±12mm centring gate approximates it; no canonical seat is ever constructed |
| 4.2 parity rule (odd→node, even→spacer) | **ABSENT** | v1's `point/gap` registration exists but is not driven by frame parity |
| 4.3 **canonical is first test, never the winner; mechanics choose** | **PARTIAL** | mechanics do choose (mass-axis key), but there is no canonical candidate to compare against, so "canonical breaks ties" is unimplementable today |
| 4.4 bounded to one 48mm period, no rotation | **CONFORMS** | 2mm sweep is bounded; no rotation |
| 4.5 search representation (ENGINEERING) | **VIOLATES the intent** | a 2mm sweep is sampling, not certified coverage — T3/T4's subject |

---

## §5 SHAPE REPRESENTATIONS AND STRUCTURAL EVIDENCE

| Ledger | Verdict | Evidence |
|---|---|---|
| 5.1 three representations | **PARTIAL** | silhouette ✔; safe core **never materialised** (legality is tested point-by-point); structural graph absent |
| 5.2 safe core by exact erosion, not by approximation | **ABSENT** | no safe-core object exists |
| 5.4 region graph with area/centroid/width/persistence | **ABSENT** | `structure.ts` has scanline features, mirror & single-component predicates, area-above-line — **no components, no persistence** |
| 5.5 strong vs marginal, per size | **ABSENT** | no marginal concept |
| 5.6 thresholds are ENGINEERING | n/a | nothing to govern yet |
| 5.7 final legality on the exact silhouette | **CONFORMS** | every construction re-proved through the exact door |

**This is the largest gap in the engine.** Ledger rows 6.2's *coverage* and *distribution*
criteria cannot exist until §5 does.

---

## §6 MECHANICAL SELECTION — the order, as coded vs as ruled

Ledger 6.2 order: legality → **coverage** → upper gravity mass → unsupported extent → **peel
leverage** → approved pattern → **distribution** → balance → fewer at equivalent support.

Code order, read in sequence from `better()`:
gravity(mass) → bottom limb → strip connectivity → side hold → **band count** → corners class →
symmetry → structure score → fit tier → sparse spread → mass axis → tight → balance → fewer →
exact wrap → smaller size.

| Ledger | Verdict | Evidence |
|---|---|---|
| 6.1 lexicographic, no opaque score | **CONFORMS** | first-difference comparator, no weights |
| 6.2 position 2 **coverage of major regions** | **ABSENT** | no such key |
| 6.2 position 3 upper gravity mass | **CONFORMS (measure)** | `topHangMM` is mass-aware; but it sits at position 1, above a coverage rule that does not exist |
| 6.2 position 4 unsupported extent at the 12/24 switch | **VIOLATES** | bottom/side bounds are fixed at `flapLimbMM` 40; no switch implemented |
| 6.2 position 5 peel leverage | **ABSENT** | no leverage measure |
| 6.2 position 6 approved pattern | **PARTIAL** | template library exists, but the growth door emits ungoverned `win-*` populations |
| 6.2 position 7 distribution across masses | **ABSENT** | emerges accidentally from templates |
| 6.2 position 8 balance / evenness | **VIOLATES position** | evenness is a coarse-bucket tiebreak at the tail, not a first-class criterion |
| 6.2 position 9 fewer at equivalent support | **VIOLATES** | count direction flips by band (`band.stepUp ? fuller : fewer`) — the ledger forbids count winning upward |
| 6.3 more magnets never automatically better | **VIOLATES** | same flip |
| 6.4 centroid is evidence, not the rule | **PARTIAL** | `massAxisOffMM` compares the assembly centre against a mass axis (deepest-material point on asymmetric shapes, mirror axis on symmetric), in coarse buckets, as a mid-rank key. Centroid is therefore *not* the placement rule (conforms in spirit), but it is also **not** the ledger's balance descriptor (8B), and the bucket granularity means near-equal candidates tie arbitrarily. |
| 6.6 flap from the padded grid bbox | **CONFORMS** | `wrap.ts` measures exactly this |
| 6.10 tie tolerances between equivalent arrangements | **ABSENT** | no tolerance concept exists. Comparisons use coarse fixed buckets (12 mm tightness, 6 mm evenness, 3/6 mm axis) which act as *de facto* tolerances but are neither declared, per-descriptor, nor unit-aware — so "equivalent within tolerance" cannot be expressed and both candidates cannot be carried forward. |
| 6.7 flap 12/24 as a tested switch | **ABSENT** | only `flapTightMM 12` as a tier label; no switch, no measurement |
| 6.8 limb exemption measured **and reported** | **VIOLATES** | applied silently; nothing is reported |
| 6.11 snug seat selects the size | **PARTIAL** | tightness exists but at the tail, after spread and structure |
| 6.12 no arbitrary subsets to raise count | **VIOLATES** | the growth door enumerates arbitrary sub-windows |
| 6.13 pattern families incl. diagonal | **CONFORMS** | released templates cover them |
| 6.14 row/column skipping lawful | **CONFORMS** | rect-48×96 skip-mid is in the library |

---

## §7 SIZE AND OFFER POLICY

| Ledger | Verdict | Evidence |
|---|---|---|
| 7.1 **every size evaluated independently** | **VIOLATES** | `sizeFloorMM` and `prevCount` carry the previous band's winner forward; the next band's sweep *starts* above it (`judgement.ts:546`) — a previous heuristic answer truncates a later domain |
| 7.2 all distinct optima returned, one marked | **VIOLATES** | a count-ladder produces at most `optionsPerBand`, and nothing is marked |
| 7.3 distinct = window/scale identity | **VIOLATES** | identity is topology-only; the ladder uses count as the proxy (`:801`) |
| 7.4 refusal legitimate **with a machine-readable reason** | **ABSENT** | no reason exists anywhere; a fallback manufactures an answer instead |
| 7.5 presentation cap after the full set | **VIOLATES** | the cap defines the set rather than presenting it |

---

## §8 OUTPUT CONTRACT, INPUT BOUNDARY, REGISTRY  *(rows added by the repaired ledger)*

| Ledger | Verdict | Evidence |
|---|---|---|
| 8A input boundary (validated simple closed polygon, top direction, size domain, profile versions) | **PARTIAL** | a contour enters through `bridge.ts`; **no validation, no top-direction input, no profile version** on the call |
| 8A.8 holes / disconnected **hard-reject** | **ABSENT** | `Contour` carries a `holes` array and the core walks it; there is no rejection path |
| 8B mechanics registry (formula · direction · units · tolerance · completeness) | **ABSENT** | comparator keys are inline expressions; no descriptor is named, versioned, unit-bearing or tolerance-bearing |
| 8B.1 unsupported-extent definition | **PARTIAL** | the per-side measure exists (`wrap.ts`); the **score**, the exempt-region evidence and the limb reporting do not |
| 8B.2 pattern-permission matrix | **ABSENT** | every template is tried in every band |
| 8C.1 coordinate quantum | **PARTIAL** | Clipper2 integer micron exists in `offset.ts` only; the judge compares raw floats |
| 8C.2 approximation envelope | **ABSENT** | no approximation is used and none is certified — the sweep simply samples |
| 8C.3 vertex budget · 8C.4 perf gates | **ABSENT** | unmeasured; the measured 42.2 s bat solve is the only datum |
| 8C.5 determinism | **PARTIAL** | a determinism fixture exists (byte-identical twice) but no artifact/profile hashing |

Ledger 8D requires: band · exact width/height · scale · axis classes · node frame · registration
offset · pattern ID · node addresses · magnet centres · minimum clearance · supported regions ·
unsupported-extent metrics · gravity result · validation status · decision reasons · both
address and millimetre coordinates · identity hashes.

Code returns: `sizeMM · anchors · candidates · flaps · uncoveredMM · pitchMM · pattern ·
nearestAnchorMM · wrap · topHangMM · sideHangMM · massAxisOffMM · minDepthMM · tier · layout ·
effectContourMM`.

**Verdict: VIOLATES.** Present: size, centres, pattern label, some evidence. **Missing: axis
classes, node frame, registration offset, node addresses, supported regions, gravity result,
validation status, decision reasons, identity hashes** — and `sideHangMM` is an unauthorised
measure the ledger displaced.

---

## §9 UNGOVERNED CODE — exists, no ledger row authorises it → **must go**

| Code | Why it must go |
|---|---|
| `targetMagnets` + its ranking key | Ledger 2.6 — Dan's direct correction |
| Sparse-spread key (`spreadCapMM`) | Ledger 6.2 puts sparseness only at position 9 |
| Count-direction flip (`band.stepUp ? fuller : fewer`) | Ledger 6.3 |
| `sideHangMM` | Displaced (§9 of the ledger) — dimensionally unstable |
| Band-4 40mm hold exception | Displaced — the number was inferred |
| `sizeFloorMM` / `prevCount` cross-band pruning | Ledger 7.1 |
| `maxOffered` count ladder | Ledger 7.3 |
| Phase/sub-window growth door (`win-*`) | Ledger 6.12; ungoverned subsets |
| Heuristic fallback | Ledger 7.4 — nothing may manufacture an answer |
| `isCorners` trump key | Not in the ledger's order at all |
| `probe-winners.test.ts`, `probe-bat4.test.ts`, `B4DEBUG` | Assertion-free residue |

---

## SUMMARY

- **Conforming and preserved:** the whole of §1 (physical law + exact legality), flap measurement,
  the pattern vocabulary, lexicographic form, row-skipping. This is the substrate.
- **Absent (ruled, unbuilt):** B5 · axis/shape classification and frame hypotheses · the safe core
  as an object · the region graph with persistence · coverage · distribution · peel leverage ·
  the 12/24 switch · rejection reasons · bulls-eye marking · most of the output contract.
- **Violating (built against the ledger):** the band-count law · count flipping upward ·
  cross-band pruning · count-as-distinctness · silent limb exemption · fixed 40mm bounds where a
  switch is ruled · the cap defining the answer set.
- **Ungoverned (must go):** eleven mechanisms listed in §9.

**Necessity:** every deletion above is authorised by a ledger row or a displaced-clause entry —
none is taste.

**Sufficiency — claim withdrawn and re-grounded.** Revision 1 asserted "every row" and "no absent
row unassigned"; QA correctly refused that, because it rested on an incomplete ledger. The claim
now rests only on the repaired ledger's §11 crosswalk, which maps each task input to its row.
**What this audit can state on its own evidence:** every ABSENT/PARTIAL/VIOLATES row above names
the task that must resolve it (T2 · T3 · T4 · T5 · T6 · T7), and no row above is left without
one. Whether the *ledger* is complete is the crosswalk's claim to defend, not this audit's.

**Nothing was modified. This audit is evidence for T1–T9, not a licence to start them.**
