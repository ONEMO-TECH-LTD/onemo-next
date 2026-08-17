# Engine MVP — three parts, your spec only

Board is fixed. Shape scales. Engine recognises the layout the fabric can hold and returns the size that hugs it. The optimum, verbatim (LS §1.1): the lawful arrangement that covers the shape's major masses with the top held, wrapped so snugly that flap is minimal and evened on all sides, in a coherent approved pattern, with the fewest magnets that achieve that support. Named ideal: four magnets at the outermost corners, discs enveloped to the edge — pair as the floor. The square is the **banding standard** everything derives from (LS §5), not the ideal hug: judging a free shape by how nearly it fills its box is the bbox-as-fabric error PB §4 and §13 forbid.

Reuse current 3.2. No second engine. No rewind.

The **Full spectrum** table is the only normative surface. Sections above it name the three parts. Sections below it execute. Do not restate a rule shorter than the table.

## The three parts

### Spec — numbers you already set

- Cell 24 mm. Protected disc 24 mm. Centre never closer than 12 mm to an edge. Magnets every 48 mm. Size step 12 mm.
- Bands: 24–72 / 72–120 / 120–168 / 168–216 / 216–264 (B5 exists, not sold until you say so). Dominant side is the band. Box = how much board. Fabric = which seats are real.
- Class table: **spectrum §5.1**.
- Approved seatings, **versioned**: single, vertical pair, horizontal pair, L, T, row, column, four corners, larger extensions (PB §10). Diagonal pair is a Dan ruling for pill — keep, sourced there. Library and per-band permissions stay **open** (PB §21.4). Ceiling exactly as spectrum step 3 — application of the ruled §5.1 table, not a closed permission matrix.
- No “this band is N magnets” — Always-true row.
- **Everything not in the two briefs goes.** 28 / 40 / 108 go in Phase 2 (one statement). LS §7 list is today’s inventory, not a ruling; the proposal already deletes the inferred B4 40 mm exception. No substitute number. Open items stay open. **Deleting 40 removes a gate, not the limb exemption.** “Thin hang is allowed and reported” stays (LS §2). While the millimetre is open, the exemption cannot refuse — it reports.
- PB §3 cell type / occupancy / selection: Compute board-model, not extra door output.

### Compute — checks only

Does not know bands, animals, or “prefer a pair.” Scale, aspect locked. Whole disc in fabric (tangency legal). Safe land as spectrum step 5. Lawful region for a named seating. Leftover as spectrum leftover row. Place and prove every disc.

### Logic — recognition, then pick

Does not invent geometry or numbers.

1. Measure the box. Classify each side. Assign the band.
2. Starting frame from the class — **ceiling, exactly as spectrum step 3.**
3. Scale through the band. Every size is a fresh look.
4. Ask compute which library seatings fit inside that ceiling and sit in fabric (step 9).
5. **Centering exactly as spectrum step 7.** Do not restate a shorter version here. Logic states the rule; Compute does the millimetre transform. Do not add origin arithmetic in `judgement.ts`.
6. **Pick exactly as spectrum step 10.**
7. Band answers — exactly as the band table.

## Full spectrum (from the two briefs, nothing else)

If it is not in this list it is not required. If it is in this list it must appear in the execution below. Sources: Product Base (PB) and logic-spec (LS). Product Base outranks LS where they conflict.

**Always true**

| Must be present | Source |
|---|---|
| One simple closed outline in mm. No holes, no split shapes. `top_direction` is required for gravity (PB §15). Today “up” is assumed from the drawing — named, not a second gravity. | PB §15 |
| Do not rotate, mirror, squash, or treat empty box space as fabric. | PB §13 |
| Whole 24 mm disc in fabric. Touching the edge is legal. Magnets only on the 48 mm board. Unlimited board; a 10×10 view is only the screen. | PB §2–3 |
| Box classifies the band. Fabric decides which seats are real. | PB §4, LS §4 |
| Every size is a fresh look. Aspect locked. | PB §12 |
| Math proves. Logic picks. Spec holds numbers. | PB §14, §20, LS §7 |
| The Logic→Math request carries what must be TESTED, never an assumed answer: target size, scale, both axis classes, canonical frame, canonical anchor, permitted translation domain, permitted templates, structural thresholds, gravity direction, required metrics. Math returns evidence only — scaled silhouette, box, safe land + its components, structural measurements, shift, lawful seats, per-seat clearance, region assignment, instantiated patterns, supported/leftover/gravity metrics, and **exact failure reasons**. Every coordinate available as both a board address and exact millimetres. Today's 3.2 split already satisfies this; the row exists so it cannot be silently dropped. | PB §16, §17 |
| No “this band is N magnets.” Count comes from class × band, then fabric may reduce. | LS §3 |
| **Leftover** is minimised (top first). How much is “too much” is **open** — it cannot refuse. Ideal wrap is zero (a square); a free shape approximates. | PB §11.4–5, §21.3 |
| Pick is lexicographic: first rule that separates wins. Not one weighted score. Only law bounds, never multipliers. | PB §11, LS §2 |
| The geometric centre of mass is evidence, not the placement rule. | PB §11 |

**The pipeline (LS funnel 1–10 + PB §18)**

| Step | Must do | Phase |
|---|---|---|
| 1 | Measure the box (width, height). | 2 |
| 2 | Classify each side (1–5). Class from aspect + fill: square-like / tall / wide / circle-oval / free. Band = larger side. | 2 (square/rect/circle). Free = 4 |
| 3 | **Ceiling.** Starting frame from the class. Fabric may reduce, never grow. `n` magnet lines span `2n−1` cells. Not every seat must be filled. | 2 |
| 4 | Scale through the band. | 2 |
| 5 | Safe land = exact 12 mm erosion. Forbidden: box shrink, raster, offset-path joins, vertex-only distance (PB §7.2). | keep compute |
| 6 | **Mass map** — full PB §7.3 graph (ten fields) and PB §8 strong/marginal (five properties each, not edge clearance alone). Tips/limbs not banned by name — only when weak at this size. A thin connector may hold no magnet and still join two masses. Thresholds open (PB §21.2). Final legality always uses the exact silhouette. | 4 (not 2) |
| 7 | **Centering (PB §6 + LS funnel 7).** Frame centre on box centre. Odd count through a magnet; even through the spacer. **Mechanical quality picks the registration** (same §2 order as between seatings). Canonical is the origin and the last tie-break only — first test, not automatic winner. Shift only inside one 48×48 mm period. No rotation. Continuous vs stepped search still open (PB §21.1); keep the existing continuous region. Compute does the millimetre transform. Parity produced here, full stop. Every Phase 1 exam asserts this rule for the frame actually returned. The five PB §6 examples are the worked cases. | 2 |
| 8 | Each board seat: illegal / marginal / strong / selected. | 2 illegal/selected; marginal needs step 6 |
| 9 | **Library (PB §10, §21.4).** Read the pattern the lawful seats already form. A pattern is a coherent arrangement as relative node coordinates on the 48 mm lattice, from the versioned library. Initial families **include** the nine plus larger extensions — not a closed menu. Must not invent a scatter of points to raise the count. When the fabric forms a coherent arrangement not yet in the library, that is an entry to approve and version — not a reject, not a one-off. 96 is two steps on the 48 lattice, no new grid. | 2 (initial); library grows |
| 10 | Pick, first rule that separates: legal → cover real masses → hold the top → less leftover (top first) → peel (number open) → approved pattern → one per distinct mass → **balance (P8, silent — Open)** → fewer magnets if support is equal (**what counts as equal is open — PB §21.5**) → snuggest size. Masses/distribution silent until Phase 4. P8 keeps its slot so it can switch on later without renumbering. | 2 / 4 |

**What each band owes (LS §3)**

| Band | Owes | Phase |
|---|---|---|
| B1 | One disc (geometry). Seat it high. Hug. | 1–2 |
| B2 | Square-like → four. Narrow → pair on the shape’s axis. Hug. Centred (step 7). | 1–2 |
| B3 | The pattern the fabric names. Corners at the extremes; middle row may be empty. | 1–2 rect; 4 free |
| B4 | Same family, grown (48→96 and/or a new row/column). Not the B3 answer looser. At least four is easy. Bottom-heavy lawful. Upper mass may hang as a limb **at this band only**. | 1–2 square; 4 free |
| B5 | Exists (216–264). Not sold until you say so. Engine still evaluates. | hidden band |

A band returns every **different** layout its range unlocks, and marks the one you’d pick by eye. The same seating listed looser is not a second answer. (LS §1.2)

**Cross-band (LS §3) — all four are RULED and all four are in.** Verbatim, LS §3:85-88 [RULED, 08-15/16]: every band answers (honest NONE allowed only when no hold-lawful placement exists) · each band's answer ≥24 mm above the previous · a band never re-offers a lower band's arrangement identity · every band's chips carry more magnets than the band below's top rung.

These were previously filed as open on two grounds; neither survives the source. **(a)** "today's band loop has no state between bands" is the implementation deciding canon — the funnel-discipline rule below forbids exactly that: fix at the step, never reclassify the rule. **(b)** PB §12 does not conflict. Verbatim, PB §12:307: *"No result may be **inferred** from a smaller or larger size **without evaluation**."* That bans inferring an answer; it does not ban comparing bands after each size has been independently evaluated. These four are **offer-assembly** laws applied after evaluation, so the "PB outranks LS where they conflict" tiebreak never fires.

Consequence, and it is why this is not cosmetic: "every band answers" is the exact law today's engine breaks on ten of fourteen released band-answers, and most of those are policy refusals rather than "no lawful placement exists" — which canon does not admit as an honest NONE. Filing it open removes the test that catches the regression.

**Phase 2 task, not a demotion:** the band loop needs inter-band state to express these. Scope is the loop, not the rules.

**Class standards (LS §5.1)** — square is the control; other classes derive (LS §5). Phase 2 must not write four hardcoded rows that can drift apart.

| Class | B1 | B2 | B3 | B4 | B5 (exists, not sold) |
|---|---|---|---|---|---|
| Square | 1 @ 24 | 4 @ 72 | 9 @ 120 | 16 @ 168 | 25 @ 216 |
| Tall rect | 1 | vertical pair **24×72** | 1×3 **or** 2×3 · **72×120** | 2×4 **or** 3×4 · **120×168** | 3×5 **or** 4×5 · **168×216** |
| Wide rect | 1 | horizontal pair **72×24** | 3×1 **or** 3×2 · **120×72** | 4×2 **or** 4×3 · **168×120** | 5×3 **or** 5×4 · **216×168** |
| Circle / oval | 1 @ ~40 | 4 @ 92 | 9 @ 160 | 16 @ 228 | — (derives from square + pad) |

Free classes and the animal exam table are **Step C**. They do not write Phase 2 logic.

**Door output (PB §19).** Yes: band, exact width/height, scale, both axis classes, frame, shift from centre, `selected_pattern_id` (not a door label), board addresses, millimetre centres, smallest edge clearance, leftover, whether the top is held, why this won, `validation_status`. Per-node local cutout coordinates. Structural-region id and supported-region names wait on the mass map.  
No: the machine-readable reason. PB §19 lists **six** and all six stay in the contract — safe core empty · no strong grid node · no approved lawful pattern · upper critical mass unsupported · **excessive unsupported extent** · registration search exhausted.

The reason code and its threshold are different things. The **code** is canon (PB §19). The **millimetre** is open (PB §21.3). While the millimetre is open the extent gate **cannot fire** — leftover is measured, ranked and reported, never a refusal — but the code must remain in the output contract or the engine has no way to express the refusal the day the number is ruled. Same shape as deleting the 40 mm gate without deleting the limb exemption. "No strong grid node" waits on the mass map (step 6) for the same reason: the code exists, the threshold is open (PB §21.2).
Inputs (PB §15): outline, mm, `top_direction`, size domain, size step, grid profile, safety profile, both policy versions.

**Hard exclusions (PB §13)** — never: photo-as-fabric, empty box as fabric, half a disc, off-board magnets, deform, per-part scale, rotate/mirror, kill a feature at every size, more magnets win by count, fake legality with inner boxes.

## Exam ladder

Squares first: the right answer is the **definition** of the standard, not a picture to tune toward.

**A — squares and rectangles.** Must hug. Registration as Phase 1 (PB §6 parity, for the frame actually returned). Mid-band square → four discs @ 72, leftover ~0. Tall mid-band → vertical pair 24×72. Wide → horizontal pair 72×24. Same idea at 120 / 168. Fail = engine wrong. Stop. Do not tune on bats.

**B — circle + the LS §7 counterexample suite.** Canon's suite is exactly wide / tall / circle / spike / notch / mushroom / dumbbell — wide and tall sit in exam A, the rest are here. Its stated purpose is "so no rule is bat-shaped". A **tapered** control belongs here too, named as the LS §5.2 free class it is — not as "triangle", which is not a canon class. **Diamond is out: no canon source in either brief.** Look. Do not hardcode. Do not write the dumbbell's answer in advance.

**C — free cutouts.** Only after A is green. Family, not count. ✅ row moves = defect, stop. Ⓓ row moves = show Dan.

**Funnel discipline (LS §4).** Diagnose at the earliest step (usually 3 or 6, not a ranking tweak at 10). Fix lands there. A miss that is a coherent arrangement not yet in the library is step 9 (Spec), not a step 3/6 recognition miss.

**Before any judge change (LS §8).** (1) which pick-rule, which funnel step? (2) which §5/§6 cells — ✅ stop or Ⓓ show Dan? (3) value in Spec/Logic, measure in Compute? Missing answer = drift.

## Open (not Phase 2)

- Mass map — spectrum step 6. Coverage and “one per distinct mass” silent until then.
- **Balance (LS §2 P8) — DAN OVERRIDE of a RULED clause, 2026-08-17.** Not a canon reading: LS §2:54 marks P8 **RULED** with a full definition, so this is Dan setting canon aside, which only he may do. Recorded as an override so it is never mistaken for a clause of the briefs. **Provenance is a relay, not a captured turn** — the verbatim ruling ("balance is old canon that is missing we need to skip it for now - or clarify it to be added later") appears in the vault only as a lane relay into the grok-qa pane (2026-08-17 :3317, :3379); the nearest Dan-captured corroboration is his 16:42:50 turn approving "balance silent" as the expected content. Pin it to a captured turn or leave it marked relayed — the T0 ledger died on exactly this. **The engineering half needs no override at all:** PB §11:291 "the geometric centroid is evidence, not the placement rule" already forbids the centroid-distance measure from picking, so it comes out of the ranking on canon authority regardless of how the deferral is resolved. Canon defines balance as flap evened on all sides simultaneously, plus mirror on symmetric shapes, plus parity registration — and explicitly not a centroid distance or displacement bound (L14a; PB §11). Older canon, incomplete against the current briefs: not built in Phase 2. Today’s engine still measures the forbidden quantity (`structure.ts` centroid distance) and that measure has picked winners; it comes **out of the ranking** rather than being kept (payload evidence only; it does not pick). P8 holds its slot, silent, until Dan settles the definition. Parity registration still lives in step 7.
- Limb stamp on the screen. Exemption as spec (reports; gate gone).
- PB §21.4 library / permissions — spectrum step 9.
- PB §21.5 — what counts as equal support in step 10.
- `top_direction` as an explicit input.
- LS §8's four shape-specific opens, named rather than absorbed into Step C: bat B4 bulls-eye · butterfly B4 four-sparse vs six-tight · bot B1 44-vs-60 · pill B4 population. Plus poke2's walkthrough (Ⓓ throughout §6).

**Not open — restored to RULED:** the three cross-band laws. They were listed here in error; see the cross-band block above.

## Execution

**Start from:** current 3.2 engine (lead `a5c13b63`; `staging` does not have these files).
**Branch / worktree:** `session62-task/mvp-recognition` at `onemo-next/.claude/worktrees/s62-mvp-recognition`.
**Door:** `solveCutout`.
**Process (not engine spec):** commit + `git status` on every measurement — provenance, the rule that caught dirty-tree gates today.
**Cadence:** one phase, then report. A fail at A is a stop.

**Phase 0 — tree.** Create the worktree. No sweep, no clock.

**Phase 1 — square and rectangle exams.** New exams through the real door. No engine change yet.

| Exam | Outline | Must return |
|---|---|---|
| Square B1 | 24×24 | 1 disc, leftover ~0. Box centre on a magnet node. |
| Square B2 | 72×72 | 4 discs in a square, leftover ~0. Box centre on the empty middle 24 mm cell. |
| Square B3 | 120×120 | 9 discs, leftover ~0. Box centre on the middle magnet node. |
| Square B4 | 168×168 | 16 discs, leftover ~0 |
| Tall B2 | 24×72 | vertical pair, leftover ~0. Box centre at the pair’s midpoint. |
| Wide B2 | 72×24 | horizontal pair, leftover ~0. Box centre at the pair’s midpoint. |
| Tall B3 | 72×120 | column of three **or** 2×3, leftover ~0 |
| Wide B3 | 120×72 | row of three **or** 3×2, leftover ~0 |

These rows **are** the square/rect standard — count **and** registration. Every exam row also asserts the registration PB §6’s parity rule requires for the frame actually returned: odd line count on an axis → box centre through a magnet line; even → through the middle spacer line. The five canon examples are the worked cases of that rule, not a separate list. A right count with the box centre in the wrong place is a fail.

**Phase 2 — spec and logic only.** Keep all `compute/*` and `solveCutout`. Implements spectrum steps 1–5, 7, 9, and step 10 except masses/distribution and P8 balance.

- `spec.ts`: ceiling (step 3); ruled “or”s one cell; circle/oval row; size step 12 mm. Rectangle and circle **derived from the square**. Delete 28 / 40 / 108 and every other value not in the briefs. No substitute leftover or limb millimetre. Writes go through the **guarded writer** (refuse, never clamp; versioned/hashed).
- `judgement.ts`: admit seating iff it fits the ceiling (step 3). Leftover as spectrum leftover row. Centering as step 7 (rule here, transform in Compute). Pick as step 10. **P8 out of the ranking** — the existing centroid-distance measure does not pick (payload evidence only). Library as step 9 (grows; no invented scatter).
- Phase 2 report answers the three LS §8 questions.
- Output: PB §19 fields.

**Done when:** Phase 1 exams green. Observe the seven cutouts before and after the Phase 2 delete (what is refused — not a stopwatch).

**Phase 3 —** B exams. Look. Pipeline fixes only if A still passes.

**Phase 4 —** C exams. If it misses, name the mass-map task (step 6). Do not patch it into Phase 2.

**Phase 5 —** same screen. Seating, size, leftover as a score, limb stamp visible. After the door is right.

## Necessity

- **Necessity — no unnecessary elements.** One statement per rule in the spectrum. Copies collapsed to pointers. Audited against the two briefs 2026-08-17: the square-as-ideal framing and the diamond exam were the only non-canon additions found; both removed. Every remaining element traces to a cited PB or LS clause.
- **Sufficiency — partial** until every spectrum row is delivered in its phase or still named open (mass map, leftover/peel numbers, B5 sold, limb stamp on screen, **balance P8 — Dan override, relayed provenance**, PB §21.4 library, PB §21.5 equal-support threshold, `top_direction`, LS §8's four shape-specific opens + poke2). Phase 1 = square/rect. Phase 3 = circle + tapered control + spike/notch/mushroom/dumbbell. Phase 4 = free-class table; ✅ stop, Ⓓ show Dan. **The three cross-band laws are no longer a sufficiency gap — restored to RULED and owed by the band loop in Phase 2.**

**Canon-conformance audit, 2026-08-17 (both briefs read in full).** Corrections applied: three RULED cross-band laws restored from "open" (LS §3:85-88; the PB §12:307 conflict claim was a misreading of "inferred… without evaluation") · "excessive unsupported extent" and "no strong grid node" restored to the PB §19 refusal contract, with code-exists / threshold-open stated separately · optimum restated from LS §1.1 and the square returned to its role as banding standard rather than ideal hug · diamond exam removed and triangle renamed to the LS §5.2 tapered class · balance relabelled a Dan override with its relayed provenance flagged · PB §16/§17 evaluation-plan and evidence contract given a spectrum row. Verified unchanged and correct: step 10 = LS §2's nine priorities plus the snug selector in exact order · step 3 ceiling = LS §4 step 3 "capacity, never compulsory" + PB §5 · step 7 = LS §2 registration clause + PB §6 "first test, not automatically the final placement" · §5.1 class table exact incl. circle 40/92/160/228 · all ten PB §13 exclusions · all five PB §21 opens named · 28/40/108 deleted with no substitute · square-first ladder matching LS §5's derivation hierarchy.
