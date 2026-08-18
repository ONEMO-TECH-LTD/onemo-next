# META AUDIT — v3.2 against the canon it contracted to build from

**Author:** s62-kai-meta (adversarial Meta advisor) · **Date:** 2026-08-17
**Scope audited:** `60656152` (pre-T1 baseline) → `7ab17b83` (T8 head), every task commit.
**Governing directive set:** `canon/logic-spec-optimum.md` · `canon/ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture.md` · `canon/FINAL-CONSOLIDATED-PROPOSAL.md` (byte-identical to binding revision `2e6bd212`).
**Method:** every number below is my own execution in my own detached worktrees, provenance printed in the same command as the measurement. No file in any lane's tree was modified. Both audit worktrees removed after use.

---

## VERDICT

**NECESSITY — shrink.** Three elements carry no justification against the directive: the 628-line backend probe (self-condemned to deletion, never deleted), the 697-line canon oracle that does not test the real engine, and the permanently-empty `candidates` schema field.

**SUFFICIENCY — partial, and severely.** Nine canon deliverables are unmet, four of them RULED mechanisms deleted at T1 and never restored. The engine's conformance to the canon table went from **14 of 14** to **2 of 14**.

**CLEAR is not available on either axis.**

---

## 1. THE HEADLINE: v3.2 REGRESSED THE ENGINE IT WAS BUILT TO PERFECT

The pre-T1 engine reproduced the canon table — the ✅ rows Dan ruled and the Ⓓ rows derived from his walkthrough — almost to the millimetre. Measured by running `solveCutout` at `60656152` on the seven canon fixtures.

| Shape · Band | Canon (§6) | Baseline `60656152` | v3.2 `7ab17b83` @ released 12 mm |
|---|---|---|---|
| bat B2 | ✅ vertical pair face+chest ~88 | **pair-v · 88 · 2pt** ✓ | pair-**diag** · 98 ✗ family |
| bat B3 | ✅ face + base row ~146, blessed 4pt tee | **tee-96 · 146 · 4pt** ✓ | tri-96-up · 144 · **3pt** ✗ |
| duck B2 | ✅ vertical head+body pair ~84 | **pair-v · 84 · 2pt** ✓ | **NONE** |
| duck B3 | ✅ rect 48×96 four corners, mid row skipped ~152 | **rect-48x96 · 154 · 4pt** ✓ | **NONE** |
| butterfly B2 | ✅ horizontal wing pair ~92 | **pair-h · 92 · 2pt** ✓ | **NONE** |
| butterfly B3 | ✅ four-in-wings corner square ~126–130 | **square-48 · 126 · 4pt** ✓ | **NONE** |
| bot B2 | ✅ vertical pair ~98 | **pair-v · 98 · 2pt** ✓ | **NONE** |
| bot B3 | ✅ narrow 96×48 four ~144 | **rect-48x96 · 144 · 4pt** ✓ | **NONE** |
| pill B2 | ✅ diagonal pair ~82 | **pair-antidiag · 82 · 2pt** ✓ | pair-antidiag · 84 ✓ |
| pill B3 | ✅ diagonal 3-chain ~138 PREFERRED | **run-antidiag-3 · 138 · 3pt** ✓ | run-antidiag-3 · 134 ✓ |
| poke1 B2 | ✅ pair ~76 | **standard · 76 · 2pt** ✓ | **NONE** |
| poke1 B3 | ✅ corner square ~123–126 | **square-48 · 126 · 4pt** ✓ | **NONE** |
| poke2 B2 / B3 | Ⓓ vertical pair / column run-3 | **pair-v · 76** / **run-v-3 · 124 · 3pt** ✓ | **NONE** |

The baseline also hit every unreleased B4 Ⓓ row exactly: bat 172·5pt, duck 210·5pt, butterfly 180·6pt, bot 168·6pt, pill 194·8pt, poke1 172·6pt.

**Released-band conformance: baseline 14/14 → v3.2 2/14 (2 wrong family, 10 empty).**

`logic-spec §7` states the standard this violates: *"A ranking change that moves a ✅ row is a defect."* Twelve ✅ rows moved.

---

## 2. WHERE IT BROKE — T1, THE FIRST TASK

`26a8b164` "subtract condemned T1 selector policy" (+21/−190) deleted, among correct removals, **four mechanisms that implement RULED canon law**. Verbatim from the deleted code:

| Deleted mechanism | Canon clause it implemented | Verdict |
|---|---|---|
| **THE GROWTH LAW** — *"EVERY band's offer carries MORE magnets than the band below's answer and never repeats a lower band's arrangement"* | `logic-spec §3` cross-band laws [RULED]: *"every band's chips carry more magnets than the band below's top rung"* | **WRONGLY DELETED** |
| **BAND SEPARATION** — candidates start one 24 mm step above the previous band's answer | `logic-spec §3` [RULED]: *"each band's answer ≥24 mm above the previous"* | **WRONGLY DELETED** |
| **THE BAND-GIFT LAW (echo clause)** — a lower band's answer re-listed bigger is an echo, not an option | `logic-spec §1.2` [RULED]: *"The same arrangement re-listed looser is never a second optimal"* | **WRONGLY DELETED** |
| **THE HONEST POPULATION LAW (`fullest`)** — the chip belongs to the FULLEST lawful population of a footprint, never a subset | Dan 2026-08-15 23:47, quoted in the deleted code: *"not artificially claim 3 points fitting all 5"* | **WRONGLY DELETED** |
| BAND COUNT LAW (`targetMagnets`) | `logic-spec §3` [RULED]: *"THERE IS NO BAND-COUNT RULE"* | correctly deleted |
| SPARSE SPREAD ranking | no §2 priority corresponds | defensibly deleted |
| `maxTestedMM`, `optionsPerBand` cap | engineering / presentation | see §4 |

**None of the four was restored anywhere in T2–T8.** Confirmed structurally, not by grep alone: `judgeShape` (judgement.ts:1292) is `for (const band of calibration.bands) bands.push(judgeBand(...))` — **no cross-band state is passed at all**, so the three cross-band laws are not merely absent, they are unrepresentable in the current architecture. `offeredBelow`, `sizeFloorMM`, `prevCount`, `fullest`, `optionsPerBand`, `targetMagnets`: **0 occurrences** in current product code.

**How it passed.** T1's own verification clause said only *"Record every answer changed by subtraction. Do not call the resulting selector conformant."* The builder complied exactly — the handoff lists eleven moved canon answers, including `bat B3 tee-96·146·4 → tri-96-up·146·3` and `pill B3 run-antidiag-3·138·3 → pair-antidiag·120·2`. **Both are ✅ rows, and both moves were recorded and then accepted without ever being compared to §6.** The authority used to condemn the mechanisms was `T0b`, which judged them against the T0 ledger — the document QA later declared *"dead… untrusted"* — and never against `logic-spec §3`.

That is the root cause: **the deletions were audited against a ledger, not against the canon.**

---

## 3. SECOND-ORDER: THREE OF THE NINE RULED PRIORITIES ARE SILENT

`judgement.ts:738-740` binds one array to both classification inputs:

```
const safeCoreMasses = asContours(0)
const majorSupportRegions = safeCoreMasses
const distinctMasses     = safeCoreMasses
```

Measured on every published offer, both P4 positions, verified-clean worktree:

- **P2 coverage = [1,1] on all 21 offers.** Without exception.
- **P7 distribution = [1,1]** (duck: [2,2]). Constant per shape.
- **P7b variance = [0,0]** except duck B3.

A criterion identical for every candidate cannot separate any pair. **P2, P7 and P7b carry zero information on the real corpus**; the order is decided by P3, P4, P5, P8 alone. `structure.ts:1706` still documents distribution as running over *"a different set from coverage's"* — the call site contradicts its own contract text.

These are precisely the two criteria that would demand four corners over a three-point L — the exact regression seen at B3. Causal link stated as **hypothesis**; the constancy and the wrong families are both **measured**.

---

## 4. NECESSITY — WHAT TO DELETE

Total sprint diff: **+6,699 / −2,280** across 15 files, to produce an engine whose canon conformance fell from 14/14 to 2/14.

| Element | Size | Justification against the directive | Verdict |
|---|---|---|---|
| `scripts/probe-grid-backend.ts` | 628 lines | QA's own ruling: *"Freeze this script as temporary T4/T7 evidence only… Delete it after the final gate."* Still present at head. | **CUT** — scheduled deletion not performed |
| `canon-gate.test.ts` | +697 lines | Runs its hard cases against `harnessSubject`, not the real selector. `logic-spec §7` requires *"every row an executable fixture through the real solve door."* 697 lines that do not do the ruled job. | **CUT-or-FIX** — must be wired, not deleted |
| `GridResult.candidates` / `SizeVariant.candidates` | schema | Populated only by machinery T8 deleted; permanently empty. Flagged independently by grok-qa and the builder. | **CUT** |
| `optionsPerBand` presentation cap | removed at T1 | Plan T6.8 requires *"Cap presentation only after the complete certified offer set exists."* Deleted and never reinstated. | **GAP, not slop** |

---

## 5. SUFFICIENCY — THE GAP LIST

| # | Canon deliverable | Source | State |
|---|---|---|---|
| D1 | Every ✅/Ⓓ canon row reproduced | §6 + §7 | **FAILED — 2/14** |
| D2 | Canon table executable through the real solve door | §7 | **MISSING** — adapter cut as "invented scope" |
| D3 | Each band shows ALL distinct optimals its range unlocks | §1.2 [RULED] | **MISSING** — one offer per band |
| D4 | One offer marked the guaranteed bulls-eye | §1.2 / L17 [RULED] | **MISSING** — no bulls-eye policy exists |
| D5 | Cross-band: ≥24 mm separation · no re-offer of a lower band's identity · more magnets than the band below | §3 [RULED] | **DELETED at T1**, architecturally unrepresentable |
| D6 | Fullest lawful population per footprint | Dan 08-15 23:47 [RULED] | **DELETED at T1** |
| D7 | Nine-rule lexicographic order, each rule able to discriminate | §2 [RULED] | **PARTIAL** — 3 of the criteria constant |
| D8 | The 12-vs-24 unsupported-extent switch **decided** | §8 open register; PB §21.3 | **SHIPPED UNDECIDED** at 12 mm |
| D9 | Every band answers; honest NONE only where no hold-lawful placement exists | §3 [RULED] | **FAILED** — 10/14 refuse on policy while lawful placements exist |

On D8, measured through the guarded writer: at **12 mm** 4/14 released band-answers offer anything and two of seven shapes answer at all; at **24 mm** 13/14 offer and all seven shapes answer — but most B3 families are still wrong (L/tri where canon rules four-point squares and rectangles). **The switch is necessary but not sufficient to restore the canon.**

---

## 6. WHAT v3.2 GOT RIGHT — kept deliberately

The substrate is sound and should not be re-litigated: exact continuous feasibility with certified envelopes and lower-dimensional witnesses; per-descriptor global-optimum proofs replacing sampled recipes; honest `DECISION_INDETERMINATE` instead of invented answers; the complete PB §19 output contract with identity hashes; machine-readable rejection reasons; deletion of the second selector; deterministic byte-identical repeat runs; 175/175 focused tests (my own run). The `targetMagnets` band-count law was correctly killed.

**The failure is not the mathematics. It is that no gate ever compared the mathematics to the canon table.**

---

## 7. THE STRUCTURAL FINDING

`logic-spec §7` names the acceptance harness: *"The canon table IS the regression gate: every row an executable fixture through the real solve door."*

That gate was never built. When a builder proposed the adapter that would have created it, it was removed as *"invented scope"*. Consequently:

- T1 moved eleven canon answers and nothing failed.
- T6 changed the selection order wholesale and nothing failed.
- T7 declared "no affected real contour is indeterminate" — a criterion a band satisfies **by refusing** — and passed while ten released bands returned nothing.
- T8 proved byte-identical determinism before and after deletion, which is a real result about the deletion and says nothing about conformance.

**Every gate this sprint ran was internal-consistency. The one external gate the canon defines was cut.** That single omission explains how a regression this large travelled eight tasks without detection.

---

## 8. RECOMMENDED ORDER — for the scope owner, not to be actioned unilaterally

1. **Build D2 first.** Wire the §6 canon table through `solveCutout` as an executable fixture. It is the ruled gate and it converts every item below from argument into measurement.
2. **Re-open the four T1 deletions** against `logic-spec §3`/`§1.2` rather than against the retired ledger. Restoring cross-band state is architectural; price it before promising it.
3. **Settle D8** with placements on screen at both positions, not from a rate.
4. **Resolve the classification collapse** (§3 of this report) — whether "major support region" and "distinct material mass" are one classification or two is Dan's, and it decides whether P2/P7 ever discriminate.
5. Then D3/D4 (all optimals + bulls-eye), then the necessity cuts in §4.

**Do not action any of this as repair work while T8/T9 are in flight.** It is one decision set for the scope owner.

---

## VERDICT LINES

- **Necessity — shrink:** `probe-grid-backend.ts` (628), `canon-gate.test.ts` as built (697, wire or cut), `candidates` dead schema.
- **Sufficiency — partial:** D1–D9 above; four RULED mechanisms deleted at T1 and never restored; the canon regression gate never built.

— s62-kai-meta

---

# ⚠ READ THIS FIRST — CORRECTIONS TO THIS REPORT (2026-08-17, later same day)

Three items below are **withdrawn or corrected**. Anyone acting on this report must apply these first.

**A3 (L18 encapsulation) and A4 (L14 dual 48-and-96 population) are WITHDRAWN.** Both cite
`grid-laws.md`, which `logic-spec §5` ranks THIRD in the authority order — below the Product Base:
*"Dan's rulings → ONEMO Magnetic Grid Compute System doc ('latest, has more power') → grid-laws.md
→ measured physics."* The Product Base supersedes both: §2 makes per-disc containment the legality
test, §12 requires each size evaluated independently, and no current brief carries the
dual-population requirement. **The engine is correct on both counts and this report was wrong.**

**The "add all options and test" quote is GENUINE — an earlier withdrawal of it was my error.** It is
a captured Dan turn at `__TRANSCRIPT VAULT/claude/s62/meta/2026-08-11/_day.md:514` (and the same
day's segment `:517`), verbatim with his own typing: *"why do i need to rule if  i never tested the
difference in the real life - why noit add all options and test?"* I had conflated it with T0 row
6.7a, whose quoted sentence genuinely does exist only as lane restatements — that finding stands and
is a different sentence. **The method it establishes is real: an unruled definition becomes a switch
to test, not a number to rule.** A calibrated control for the overhang limit is therefore canon-
compliant, not a departure.

**A1 and A2 STAND**, and the latest briefs carry them independently of the v3 book: `logic-spec §2 P8`
defines balance as *"flap evened on all sides simultaneously"* (not the centroid distance the code
implements), and `§4 step 3` states *"Capacity, never compulsory — a square-bbox T still takes the
vertical pair its material supports."*

## STATUS — THE ROLLBACK STRATEGY IS OFF (Dan, 2026-08-17 15:25)

> *"why are we not auditing current state and intended canon with 3 part engine to see where there
> is overengineered and invented parts… without zooming out to see if there is a simpler path — just
> list logic-spec and keep the engine; everything not doing that, from prior invented hacks and
> patches, goes."* — Dan to @s62-grok-qa

**Do not act on any rollback or graft recommendation in this report.** The strategy is now: keep the
current 3.2 engine, audit it against the three-module list, strip what canon does not require. The
rollback candidates below are **evidence, not a proposal** — they remain the only measured proof that
the ruled families are reachable at all, which is why the numbers stay on the record.

**What in this report survives the change of strategy** (all of it canon-indexed, none of it
rollback-dependent): the 14→2 regression, the four RULED mechanisms deleted at T1, the P2/P7
collapse, the frame-cell lock, the overhang curve, the necessity kill-list, and the missing canon
gate. **What does not survive:** any sentence recommending restoration of a prior board.

**One item is now MORE load-bearing, not less.** Under a rollback there was a known-good baseline to
compare against. Under fix-in-place there is none — the current build answers 2 of 14. The canon
table gate (logic-spec §7: every row through the real solve door) is therefore the only thing that
can tell a repair from a regression. It has never been built. It is the root cause all three audits
independently landed on.

---

## MEASUREMENTS ADDED AFTER THE MAIN REPORT (own detached worktrees, provenance printed per run)

**The two rollback candidates, scored against the canon families** — retained as EVIDENCE that the
ruled families are reachable, not as a route now that the rollback is off:

| build | canon families | options per band | seven-shape sweep |
|---|---|---|---|
| pre-T1 graft (`dbfa3d67`) — board untouched, new compute alongside | **14 / 14** | 1 | slow (old sweep) |
| pre-T6 swap (`1e1d65d6`) — board wired to the new engine | 12 / 14 | up to 15 | **35 s total** |
| shipped T8 (`7ab17b83`) | 2 / 14 | 1 | ~5 s/shape |

The swap's only two misses are **bat B3** (3-point where canon blesses the 4-point tee) and
**poke2 B3** (2-point pair where canon derives a run of 3). Both are correct on the pre-T1 graft.
**That is T1's deletion of the fullest-population rule, measured on both sides rather than inferred.**

**The overhang limit is the master switch, not a fine adjustment** (measured at `7ab17b83`, all seven
contours, value overridden directly for measurement only):

| limit | shapes answering | released bands certified | offers |
|---|---|---|---|
| 0 mm | **0 / 7** | 0 | 0 |
| 6 mm | 1 / 7 | 1 | 1 |
| 12 mm (shipped) | 2 / 7 | 4 | 4 |
| 24 mm | 6 / 7 | 10 | 17 |

**The 40 mm limb allowance is load-bearing in six places on the pre-T1 board** — `judgement.ts:294`
(hard reject), `:331–332`, `:347–348`, `:593–595`, `:663–664`. It is what the 12 mm reject silently
replaced, and it is why duck, butterfly, bot and both pokes answer there. **Killing the 12 mm veto
must not delete `flapLimbMM` or `centerToleranceMM`.**

**Dan's evenness rule is already implemented on the pre-T1 board** — `judgement.ts:153` rejects a
layout outright when the left and right overhangs differ beyond `centerToleranceMM`. Skipping the
new balance descriptor therefore leaves a working evenness rule, not a gap.

---

# ADDENDUM — against the v3 LAW BOOK (`grid-engine-v3/grid-laws.md`, `grid-spec.md`)

> **Superseded in part — see the corrections block above before using anything in this section.**

Added after Dan supplied the original v3 briefs and laws. `grid-laws.md` (788 ln) and `grid-spec.md`
(240 ln) read in full; `grid-brief.md` read across all six day-sections. These are Dan's rulings with
verified vault provenance, and they are a **higher authority than the T0 ledger every one of these
decisions was justified against.** Four further defects, none of which appears in any of the three
audit reports.

## A1 — P8 BALANCE MEASURES THE ONE QUANTITY THE LAW FORBIDS

`structure.ts:714-731` implements balance as `‖t + mean(offsets) − materialCentroid‖²` — the squared
distance from the magnet assembly's centre to the material centroid.

**L14a, CONFIRMED TWICE by Dan** (his input line in the meta lane's pane, and his own captured
`confirm` at 12:46:30), states the opposite in as many words:

> **Balance** = the unsupported reach is **evened out across all sides simultaneously**. **Not a
> displacement bound, not a centroid distance** — an evenness comparison between the sides themselves.

The implementation is a centroid distance. This is not a shortfall in rigour — it measures a
different physical quantity from the one ruled.

**Why it matters more than the other three:** balance is one of the four priorities that still
discriminates (§3 of this report), and it is the rule that eliminated the canon's blessed answer on
the bat — measured: `tee-96@144 beaten by tri-96-up@144 on P8 balance`. **The criterion that removed
a ✅ row is measuring the wrong thing.**

## A2 — THE ENUMERATION PRECONDITION IS VIOLATED, AND L20 ALREADY DIAGNOSED THIS EXACT FAILURE

**L20** (Dan, 08-13 12:18, the duck walkthrough) makes enumeration a precondition of selection:

> **ENUMERATION IS THE PRECONDITION — measured, not argued.** At 60mm the centred 1×1 candidate sits
> in the duck's neck and reports ZERO held, while a full disc fits cleanly in the head at that same
> size. **The right answer existed and was never proposed.** So candidates are EVERY window placement
> on the lattice — every sub-window size at every offset inside the field, deduped by held set
> (spec §3: enumerate, never search) — and gravity + tight-wrap order them. **Centred templates alone
> are not the candidate set; they are three of its members.**

v3.2's candidate set is *narrower than the case this law was written to strike*: templates admitted by
the bounding-box frame cell, each solved for one registration. Dan diagnosed "the right answer existed
and was never proposed" once already, on an earlier engine. v3.2 reproduces it structurally.

## A3 — L18 ENCAPSULATION WAS DISPLACED, AND IT IS WHY SIZES DRIFT DOWN

**L18** (Dan, 08-11): *"so the engine computing is essentially whether the bounding box fits inside
the shape in set variants of layouts based on the grid."* The law book's own gloss:

> **This is the algorithm, stated in one sentence.** Not per-magnet clearance solving — scale the shape
> until the layout's grid region fits inside it… **It is strictly stronger than per-magnet disc
> support** … So it can only ever **raise** a size, never lower one.

v3.2 implements per-magnet disc support (safe core + disc containment). T0 displaced L18 in favour of
PB §2. Because encapsulation can only raise sizes, displacing it can only **lower** them — which is
exactly the measured drift off the canon sizes: butterfly B2 92 → 84 at T1, duck B2 84 → 82 → 78.
The canon sizes are encapsulation sizes; the engine now publishes disc-support sizes.

## A4 — L14's DUAL-POPULATION CONDITION IS NOT IMPLEMENTED

**L14** condition 2, from Dan's final formulation of the deliverable:

> **In both populations** — 48mm **and** 96mm sparse. Not one or the other: a variant that holds only
> at 48 is not a pass. *(This is stricter than anything previously written and it is the condition most
> likely to fail.)*

No dual-population check exists in the selector. Templates carry fixed steps; nothing requires a
variant to survive 96mm thinning.

## A5 — THE PATTERN L0 EXISTS TO PREVENT, COMMITTED AGAIN

**L0 — THE RULE ABOVE THE RULES.** *Dan, 08-11 15:02:42:* "i forbid any decisions or interpretations
taht i never provided." The law book carries a table of six prior fabrications and the standing test:
*"did he say this, in these words? If not, it is a reading — and a reading is shown to him and
confirmed, never booked."*

Three v3.2 decisions are readings booked as rulings: the 12 mm limit (taken from a document already
declared dead, while two briefs list the switch as open); the class×band table used as an exclusive
filter (the law says "capacity, never compulsory"); balance as centroid distance (the law says
explicitly "not a centroid distance"). **Same failure class, seventh through ninth occurrence.**

## WHAT THE LAW BOOK CONFIRMS v3.2 GOT RIGHT

- **L8a** — only bands 2 and 3 operational, 1 and 4 hidden: **CONFORMS** (measured: B2/B3 released).
- **L2/L3** — whole 24 mm disc on material, 12 mm padding, tangency legal: **CONFORMS**.
- **L7** — at 96 mm nothing re-centred, points hide: **CONFORMS** (one lattice, sparse population).
- **L16** — solving never runs on a UI event: **CONFORMS**.
- **L5** — no shape named in the logic: **CONFORMS** (classes are axis-derived, not shape names).

## REVISED FIRST ACTION

§8 of this report recommended building the canon-table gate first. That stands, with one correction
of emphasis: **the gate must not become the target.** Dan's instruction, 2026-08-17: *"the shapes in
the library [are] there for tests not to dictate hardcoded behavior."* Every repair belongs in the
general logic — enumeration, the frame hypothesis, the balance measure, encapsulation — and the seven
shapes are how you find out whether the general logic is right.

— s62-kai-meta
