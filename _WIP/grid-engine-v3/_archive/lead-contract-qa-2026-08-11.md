# Contract QA — `engine-contract.md` @ `e4abd41c`

**Reviewer:** @s62-lead. **Authority read in full before auditing:** `grid-laws.md` (840 lines, all 14
sections + OPEN) and `grid-brief.md` (1,996 lines, six lane sections), plus the inherited v1 book
referenced at laws §preamble. **Not** the builder's summary, **not** current code.

**Verdict: REVISE.** One clause mandates a prohibited mechanism, one over-forbids a lawful one, six
requirements are missing, two are invented, four are unverifiable as written.

---

## BLOCKING — the contract requires the mechanism the charter forbids

### EC-5.2 — REVISE. This is physical-size scanning, written in as a requirement.

> "The engine evaluates every publishable even-millimetre scale inside each band's range."

Dan's charter, verbatim, states this twice — once as law and once as a prohibition:

> "Grid defines size; size never defines grid… **Never scan candidate millimetres to see what grid
> happens to fit.**"
>
> Prohibited: "**Physical-size scanning.**"

(law 14.2; brief 2026-08-11 @s62-meta 08:26)

And law 11.6, Dan 08-10: *"The size is determined by edge to edge optimal matching"* — **"One pass, no
search."**

This is not a wording quibble. The lane already settled it: Pixel challenged the even-mm walk on
exactly this ground on 08-11 at 10:10, Meta conceded at 10:11 — *"your law 11.6 settles the argument
anyway, and it settles it pixel's way"* — an event solver was built, proved against a dense oracle,
and **Meta re-ran the harness itself and countersigned it** at 10:19. The contract, written after that
convergence, re-enshrines the mechanism both lanes discarded.

**Required revision:** EC-5.2 states the *result* — every lawful size in the band is found and none is
missed — and the mechanism is the exact contact-event solve of 11.6, whose intervals are intersected
with the even lattice at publication (below). The even millimetre is the **publication domain, not the
search domain**.

### EC-5.2 also makes EC-6.10 unsatisfiable — internal contradiction.

> **EC-6.10** "Binding magnet and outline edge that set the size."

Correct, and required by 11.6: *"The binding (edge, magnet) pair is also the answer's explanation."* A
scan cannot produce it — it finds a number, never what set it. The contract requires both an
explanation and a method incapable of producing one.

### EC-3.8 — REVISE. Solve and publish are collapsed, and the direction is dropped.

> "All answers publish at lawful even-millimetre steps."

Law 12.3a and inherited v1 3.23, Dan verbatim: *"we need round to the highest number obviously not
lowest because the shape must not be smaller than grid. And this also must round to the next non-odd
number."* **Up, never down.** The contract says "even" and omits "up".

It also omits the refinement Pixel proved and Meta accepted on 08-11: on concave shapes a lawful
window can be **narrower than 2mm**, so publication must take the **first even value inside a lawful
interval** — a blind ceil can round *out* of legality. Meta's countersign cites the worked case
(exact 66.7 publishing at 68).

---

## CONFLICT — one clause forbids what the law permits

### EC-3.3 — REVISE. Over-broad; it outlaws the lawful internal measure.

> "The engine never deforms, independently scales axes, rotates, redraws, smooths, **erodes or
> offsets** the outline."

Law 2.1a forbids *constructing, drawing, exporting or manufacturing* that curve — not measuring with
it. Law 11.5, Dan 08-10: *"From here variants can be built of the shapes internal guaranteed area and
dimensions."* The guaranteed area is lawful **as a measurement**. Meta stated this precisely on 08-11:
*"an internal erosion/clearance set is lawful per 11.5; the UI/manufactured contour must not be
altered."*

**Required revision:** forbid erosion **of the outline** — constructed, drawn, exported, or handed to a
drawing library — and state that the clearance region remains lawful as an internal distance measure
that never touches the contour.

---

## MISSING REQUIREMENTS — six, each traceable to a law

| # | Missing | Authority |
|---|---|---|
| **M1** | **No fail condition for a bunched layout.** §5's only rejections are disc support (5.11), unsupported top (5.12) and flap (5.13). A four-magnet bunch in one lobe that holds its top and leaves no "materially significant" flap passes every stated test. | **Law 3.2** — *"balance outranks minimum size"*, with the 130mm star recorded as rejected **on sight** under 3.1(a). If 3.2 is deliberately deferred to visual testing under 14.10, the contract must **say so**; right now it is silently absent. |
| **M2** | **No checkpoint that law values pass the one guard.** EC-2.2/2.4 say inputs are "guarded" but nothing verifies the writer. | **Law 10.2** — *"Every write to a law value goes through the one guard."* This is the law breached three days running (registration written past it). |
| **M3** | **The oracle is unconstrained.** EC-11.1/11.2 invoke "an independent oracle" with no limits. | The brainstorm's own conclusion, and Pixel's warning verbatim: *"constrain any theory oracle to fixed band, lawful parity/centre, no maximality… unrestricted maximum-point placement would falsely reject lawful product behavior."* An unconstrained oracle optimises the objective **law 14.3 forbids**. |
| **M4** | **No checkpoint on verdict language.** | **Law 13.4** — *"Measured on coverage and symmetry balance. Never on sizes. No millimetre appears in a verdict."* EC-15.12 is close but tests conformance, not the measure. |
| **M5** | **Nothing tests the tight-fit objective.** EC-6.9 reports minimum clearance; no item asks whether the outer cells press the edge. | **Law 2.2**, Dan 08-10: *"look how close the edges of shape to gug the grid 2x2 - so in that case close to optimal is 162mm"*; **9.4** *"it must hug 48mm x4 points"*. Subordinate to balance (3.2) but not absent. |
| **M6** | **The band-selection authority is unstated.** EC-4.7 says bands are evaluated "independently in order: 2, then 3, then 4"; EC-5.1 says the bounding box "establishes the starting band". These are different algorithms. | **Law 13.2**, Dan verbatim: *"the band is auto determined by the bounding box first > after that we need placement"*, and **14.12**: escalate to the next band only when the current one yields nothing. Pick one and cite it. |

---

## INVENTED — two

### EC-8.10 — SHRINK. A worker is a mechanism, not a requirement.

> "Heavy computation runs outside the browser's main UI thread."

Dan's requirement (law 14.6, verbatim) is *"the ui behavior must not be hindered and coupled to instant
calculations… we dont need to calculate anything in flight while i change the grid size or do can vas
moves"*, plus measure mobile Safari. **EC-8.11 already states the requirement** — the interface stays
responsive. Mandating *where* the work runs is an implementation choice promoted to contract, and
necessity law forbids exactly that. Delete 8.10; keep 8.11 and the measurements in 8.13.

### EC-6.14 — REVISE. "Symmetry and balance" as two measures may be an invention.

Law 3.1e defines **symmetry balance** as one thing, judged per cell about the centre lines. The
contract splits it in two without authority. Either cite the split or state it as one measure with the
per-cell method of 3.1e.

---

## UNVERIFIABLE AS WRITTEN — four; the conformance matrix cannot positively confirm these

- **EC-11.6** — "every real cutout has an applied visual record for **every returned candidate**."
  With EC-5.2/5.3 enumerating every size × every lawful placement × six centre methods × two pitches
  × three bands, the candidate count is unbounded. Seven cut-outs × 2 pitches × 3 bands is already 42
  solve-and-capture runs before candidate multiplicity. **State a bound Dan sets, or define the record
  as per-band representative plus every *distinct arrangement*.**
- **EC-5.13** — "a **materially significant** side remains as an asymmetric flap." No definition, no
  authority. Law 3.1(d) says "no large asymmetric region"; *large* was never ruled. This threshold is
  exactly the class law 10.3 forbids ("a number with no author is not law"). **Either Dan rules it or
  it is reported, not enforced.**
- **EC-8.12/8.13** — "Mobile Safari is the performance gate" with no budget (EC-8.14 correctly refuses
  to invent one). Then **no PASS/FAIL is possible** — only a measurement. Mark these `MEASURE`, not
  `PASS`, or the matrix will manufacture a verdict.
- **EC-13.3** — asks Dan to **rule** numeric band thresholds, while EC-13.1 correctly keeps centre
  methods as comparable options. Both are the same class, and **law 14.10** settles it: *"why do i
  need to rule if i never tested the difference in the real life - why noit add all options and
  test?"* Make 13.3 a switch to be tested, like 13.1.

---

## CORRECT AND WELL-SOURCED — recorded so it is not re-litigated

EC-0.1–0.8 (evidence protocol; matches the visual-verification law and 6.3) · EC-1.1–1.4 · EC-2.1–2.8
(2.5 correctly states the ceiling as a **count**, law 12.3) · EC-3.1/3.2/3.4/3.5/3.6 (full-disc
containment, law 11.1/14.5) · **EC-3.7** (pair is the floor, size 1 silent — laws 11.3/10.7, exactly
right) · EC-3.9 (law 10.3/10.4) · EC-4.1/4.2/4.6 (law 9.3a) · EC-4.3/4.4/4.5 (law 10.6a's table) ·
EC-4.8 and EC-5.5–5.10 (**law 14.12's discovered populations, including the pair and the L** — the
strongest part of this contract) · EC-5.4 (blindness, law 4.1) · EC-5.14/5.15/5.16 · EC-6.1–6.13,
6.15–6.17 · EC-7.1–7.11 (law 14.8's visual proof) · EC-8.1–8.3 (law 1.1a) · EC-8.4–8.9, 8.11, 8.13,
8.14 · EC-9.1–9.7 (law 14.9) · EC-10.1–10.14 (10.14 is law 6.9) · EC-11.3–11.5, 11.7–11.10 ·
EC-12.1–12.5 · EC-13.1/13.2/13.4 · EC-14.1–14.6 · EC-15.1–15.13.

---

## VERDICT LINES

**Necessity — shrink:** EC-8.10 (worker mandated as mechanism; EC-8.11 already carries the
requirement) and EC-6.14 (unauthorised split of one measure into two).

**Sufficiency — partial.** Omissions: **M1** law 3.2's bunched-layout rejection · **M2** law 10.2's one
guard · **M3** the oracle's law constraint · **M4** law 13.4's verdict language · **M5** law 2.2/9.4's
tight-fit objective · **M6** law 13.2's band-selection authority. Plus the direction and
interval-intersection of publication, missing from EC-3.8.

**NOT CLEAR.** The contract cannot be signed while EC-5.2 mandates the mechanism the charter prohibits
and EC-6.10 requires an explanation that mechanism cannot produce.

— @s62-lead
