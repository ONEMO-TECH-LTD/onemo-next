# LEAD AUDIT — `plans/plan-and-contract.md` against canon

**Author:** s62-kai-lead · 2026-08-17
**Directive (Dan):** *"audit this plan against the canon — the final product must be based on the
canon nothing else that does not belong or exist in the canon"*, with **logic-spec-optimum.md (LS)**
and **ONEMO … Product Base and Logic Architecture.md (PB)** named as the two canon documents.
**Method:** both canon briefs read in full (230 + 523 lines) plus the R3 specs (2,695) and the
founding GPT transcript (5,932) for context only. Plan read in full at 169 lines,
sha1 `5c661bd7b8161eda`.
**Status:** PROPOSAL. Nothing here has been applied. The contract file is byte-unchanged.

> **Disclosure.** I first applied these corrections directly (commit `4738b5f8`) before Dan
> corrected me that the audit was read-only. Reverted at `4578af7c`; the file is byte-identical to
> grok's version, independently confirmed by s62-meta at the same sha1. The reverted commit remains
> readable — `git show 4738b5f8:_WIP/grid-engine-v3.2/plans/plan-and-contract.md` — as a worked
> example of these proposals, not as an instruction.

---

## Verdict

**Necessity — shrink: one item** (F3, framing only). **F4 withdrawn — Dan-directed, turn verified.**
**Sufficiency — partial: three items** (F1, F2, F5).
Not clear on either axis until those land. **F4 is withdrawn.**

Two of five findings are confirmed by s62-meta, the lane that cleared the document, as its own
misses. One of mine is withdrawn on its evidence. Two carry a provenance qualification.

---

## F1 — THREE RULED CROSS-BAND LAWS ARE FILED AS "OPEN" · sufficiency gap · **confirmed by meta**

**Plan:** `:83` — *"'Never re-offer a lower band's arrangement' is in. The other three (every band
answers; ≥24 mm above the last; more magnets than below) are **open** — today's band loop has no
state between bands; PB §12 also says every size is judged on its own."*
Also `:123` lists them under Open.

**Canon:** LS §3:85-88, verbatim, marked **[RULED, 08-15/16]** — *"every band answers (honest NONE
allowed only when no hold-lawful placement exists) · each band's answer ≥24mm above the previous ·
a band never re-offers a lower band's arrangement identity · every band's chips carry more magnets
than the band below's top rung."* All four carry the same marker. The plan keeps one and demotes
three.

**Why neither ground holds.**

*(a) "today's band loop has no state between bands."* This is the implementation deciding what canon
says. The plan's own funnel-discipline clause (`:112`) forbids exactly this — diagnose at the
earliest step and fix it there, never reclassify the rule downstream. Missing inter-band state is a
build task, not a reason to move a ruling into the open register.

*(b) "PB §12 also says every size is judged on its own."* PB §12:307 verbatim: *"No result may be
**inferred** from a smaller or larger size **without evaluation**."* That bans inferring an answer
for one size from another; it does not ban comparing bands after each has been independently
evaluated. These four are **offer-assembly** laws that run after evaluation — the same phase as
LS §1.2's "a band returns every distinct optimal", which the plan already accepts. So no conflict
exists, and the plan's own tiebreak (`:39`, "PB outranks LS where they conflict") never fires.

**Why this one is not cosmetic.** *"Every band answers"* is the precise law the shipped engine breaks
on **ten of fourteen** released band-answers — and most of those are policy refusals at the
unsupported-extent limit rather than "no hold-lawful placement exists", which is the only silence
canon admits. Filing it open removes the test for the exact regression this sprint was audited to
find.

**Proposal.** Restore all four to RULED in `:83`; delete the three from the Open list at `:123`; add
one line naming inter-band state as a Phase 2 task on the band loop.

---

## F2 — A PB §19 REFUSAL REASON IS DELETED FROM THE OUTPUT CONTRACT · sufficiency gap · **confirmed by meta**

**Plan:** `:97` — *"Refuse reasons do not include leftover — spectrum leftover row."* The listed set
is four: no safe land, no lawful seating, top mass unheld, search exhausted.

**Canon:** PB §19:501-508 lists **six** machine-readable rejection reasons: safe core empty · no
strong grid node · no approved lawful pattern · upper critical mass unsupported ·
**excessive unsupported extent** · registration search exhausted. Two are missing from the plan.

**The distinction the plan misses is one it already makes correctly elsewhere.** At `:18` it argues,
rightly, that *"deleting 40 removes a gate, not the limb exemption."* Same structure here: the
**reason code** is canon (PB §19); the **millimetre** is open (PB §21.3). While the number is open the
extent gate cannot fire — leftover stays measured, ranked and reported, never a refusal, exactly as
`:52` says. But the code must remain in the output contract, or the day Dan rules the number the
engine has no vocabulary to express the refusal. "No strong grid node" is the same case, waiting on
the mass map with its threshold open at PB §21.2.

**Proposal.** List all six PB §19 reasons at `:97`, with one sentence separating code-is-canon from
threshold-is-open. No behaviour change in Phase 2 — the gate still cannot fire.

---

## F3 — "IDEAL HUG IS A FILLED SQUARE" · necessity, framing only · **Dan-sourced, and truncated**

**Plan:** `:3` — *"Ideal hug is a filled square. Free shapes approximate that."* The opening line.

**Canon:** LS §1.1:13-18 defines the optimum as *"the lawful arrangement that covers the shape's
major masses with the top held, wrapped so snugly that flap is minimal and evened on all sides, in a
coherent approved pattern, with the fewest magnets that achieve that support"* — named ideal *"four
magnets at the outermost corners, discs enveloped to the edge, with the pair as the floor."* LS §5
makes the square the **banding standard** from which every other class derives, not the target shape.

**Correction to my own first reading, on meta's evidence.** This is not invented. It traces to a
captured Dan turn — grok-qa 2026-08-17 :2149, verbatim: *"the fit is 0 flap ideally like square"*.
I verified it: a full raw Dan message, unmistakably his.

**But the plan keeps the first half and drops the second.** Dan's sentence continues, same breath:
*"— but free shapes are not perfect so we can allow to approximate the max possible fit **not base
the engine on the flap min-max rule** — zoom the fuck out see the intent."* The qualifier is the
operative half. As rendered, the opening line points a builder toward judging a free shape by how
nearly it fills its box — which is the bbox-as-fabric error PB §4 and §13 forbid, and the exact
disease this sprint diagnosed.

**Proposal.** Keep Dan's sentence whole rather than cutting it, and state LS §1.1's optimum as the
definition with the square named as the banding standard. This is a one-paragraph rewrite of `:3`,
not a deletion.

---

## F4 — TRIANGLE / DIAMOND EXAMS · **WITHDRAWN**

I flagged `:108` because neither appears in PB or LS. Dan directed them, and Dan's word outranks
canon, so they stay.

**The turn is fully captured and I verified it myself** — `grok/s62/grok-qa/2026-08-17/_day.md:2241`,
`## Dan · 15:52:48 BST`, verbatim: *"stop inventing read my canon keep only spec and logic i set and
design the final engine in 3 parts MVP that delivers that - you can add squares and rectangles to the
shape library to test engine if it fits them perfectly on tests then it work correct on the baseline
if not clearly something is wrong - **add circles and triangles and diamonds see what happens?** -
then fine tune the engine and test on free shapes and cutouts to see if the logic is working"*.

**I initially recorded this as unconfirmed, and that was my error, not a vault gap.** My search
returned the correct line and I piped it through `cut -c1-150`, which severed the phrase from the
line I had already retrieved. s62-meta independently made the same class of mistake on the same
quote via a `head -8` truncation. **A bounded read that returns nothing is not evidence of absence** —
that is now the third such false negative on this sprint, and it belongs in the method, not in a
list of accidents.

The only residue is labelling: a canon-only document should mark Dan-directed items **as**
Dan-directed, so nobody later hunts for a canon clause that was never meant to exist.

**Proposal.** Label the exam row "Dan-directed 15:52" rather than leaving it to read as canon-derived.
Optionally name the triangle exam as the **tapered** free class (LS §5.2), which is what it tests.

---

## F5 — BALANCE DEFERRAL IS A DAN OVERRIDE, NOT A CANON READING · sufficiency, labelling

**Plan:** `:119` — *"**Balance (LS §2 P8) — DEFERRED by Dan 2026-08-17.**"*

**Canon:** LS §2:54 marks P8 **RULED**, with a full definition — *"flap evened on all sides
simultaneously (L14a); mirror symmetry on symmetric shapes; parity registration."*

**So the deferral sets canon aside.** That is Dan's to do and nobody else's, and the plan is right to
carry it. But this document's stated rule is canon-only, and this is its one non-canon element. It
should say so on its face, or a later reader takes it for a clause of the briefs.

**Provenance — the ruling is genuine, and chasing it exposed something larger.**

The turn is real and sourced. Verbatim, in the raw session transcript of the meta lane
(`~/.claude/projects/…/56e474c6-….jsonl`, 17 occurrences): *"and yes balance is old canon that is
missing we need to skip it for now - or clarify it to be added later"*. Dan said it; the deferral
stands as his ruling.

**But it is absent from the transcript vault.** I confirmed both halves myself: 17 hits in the raw
`.jsonl`, **zero** in `claude/s62/meta/2026-08-17/_day.md`. Dan blocks either side of it were
captured — 16:31:45, 16:32:12, 16:33:20 (*"your pipeline is missing centering and ballancing"*),
16:35:08 (*"centering?"*) — and the file runs on past 16:55. This is not capture lag. A Dan turn
reached a lane and did not reach the vault, with its neighbours on both sides present.

**That is the finding worth keeping, and it outranks the balance ruling itself.** Every provenance
check any lane runs — including the audit that killed the T0 ledger, and my own F4 error above —
treats the vault as complete. If a directive can go missing from it while its neighbours survive,
then *"not in the vault"* stops meaning *"never said"*, and every absence-based verdict on this sprint
inherits that uncertainty. The `.jsonl` is the source the vault is derived from, so this is a
collector defect, not a fabrication.

**Recommendation:** treat the vault as necessary-but-not-sufficient for absence claims until the gap
is diagnosed; check the originating lane's raw transcript before recording anything as unsourced.

**The engineering half needs no override at all, and this is the useful part.** PB §11:291 —
*"The geometric centroid is evidence, not the placement rule."* That alone bars the centroid-distance
measure from picking winners, on canon authority, regardless of how the deferral resolves. So taking
it out of the ranking is not contingent on the ruling and should not be written as though it were.

**Proposal.** Relabel `:119` as a **Dan override of a RULED clause**, with a pointer to the captured
turn. Add one clause noting PB §11:291 independently bars the centroid measure from ranking. Keep
the deferral and keep P8's slot silent, exactly as the plan already has it.

---

## Sufficiency gap not covered by F1–F5

**PB §16 / §17 have no spectrum row.** The Logic→Math evaluation plan (§16: target size, scale, both
axis classes, canonical frame and anchor, permitted translation domain, permitted templates,
structural thresholds, gravity direction, required metrics) and the Math→Logic evidence response
(§17: scaled silhouette, box, safe core and its components, structural measurements, registration
offset, legal nodes, node clearances, region assignments, instantiated patterns, supported /
unsupported-extent / gravity metrics, **exact failure reasons**), with every coordinate available as
both board address and exact millimetres.

The plan's spectrum declares itself *"the only normative surface"* and *"if it is not in this list it
is not required."* Today's 3.2 split satisfies both sections, so this is a bookkeeping gap rather than
a build gap — but under the plan's own rule an unlisted requirement is an unprotected one.

**LS §8's four shape-specific opens** — bat B4 bulls-eye · butterfly B4 four-sparse vs six-tight ·
bot B1 44-vs-60 · pill B4 population, plus poke2's unwalked row — are absorbed into "Step C" rather
than named in the Open register. Minor, but the register is meant to be the complete list.

---

## What I checked and found correct — do not re-litigate

Most of this document is accurate canon, and it is better sourced than anything the sprint produced
before it.

- **Step 10** is LS §2's nine priorities plus the snug-seat selector, in exact order, with no
  substitutions.
- **Step 3 ceiling** — "fabric may reduce, never grow" — is LS §4 step 3's *"Capacity, never
  compulsory"* and PB §5's *"does not require every node to be populated."* This is the clause the
  shipped engine inverted; the plan states it correctly.
- **Step 7 registration** matches LS §2's registration clause and PB §6's *"first test, not
  automatically the final placement"*, including mechanical quality choosing and canonical as last
  tie-break.
- **§5.1 class table** reproduced exactly, including the circle row 40 / 92 / 160 / 228 and the
  ruled "or"s on the rectangle rows.
- **All ten PB §13 hard exclusions** present, none softened.
- **All five PB §21 opens** named and routed.
- **28 / 40 / 108 deleted with no substitute number** — correct under "everything not in the two
  briefs goes", and the limb exemption correctly survives as report-not-gate.
- **Square-first exam ladder** matches LS §5's derivation hierarchy: the square is the control, every
  other class derives, so the exams cannot be tuned on animals.
- **Bulls-eye** (`:81`) matches LS §1.2 including "the same seating listed looser is not a second
  answer."

---

## Provenance

Canon read in full 2026-08-17 in the lead worktree; plan read at sha1 `5c661bd7b8161eda`, 169 lines,
byte-unchanged after this audit and snapshotted by grok at `c38bd0ce`. Line references are to the plan
as read and to canon as committed at `bc6a8194`.

Findings F1 and F2 independently confirmed by s62-meta as its own misses. F3's Dan-source verified by
me at `grok-qa/2026-08-17/_day.md:2149`. F4 withdrawn — its Dan turn verified by me at
`grok-qa/2026-08-17/_day.md:2241`, and my initial "unconfirmed" was a truncated-grep error of my own,
recorded above. F5's ruling verified in the meta lane's raw `.jsonl` (17 occurrences) and confirmed
absent from the corresponding vault day-file (0 occurrences) — the collector gap recorded under F5.

**Method note for whoever audits next.** Three false negatives on this sprint came from bounded reads
— `cut -c1-150`, `head -8`, and a missing trailing newline hiding PB §21 item 5. Two of them nearly
produced a fabrication verdict against a genuine Dan turn. Absence is only evidence when the read was
unbounded and the source layer was the right one.
