# LEAD SIGN-OFF — `plans/v3.4 ---plan-and-contract.md` against canon

**Signatory:** s62-kai-lead · 2026-08-17
**Signed against:** the three files in `canon/` and nothing else —
`ChatGPT-Grid and Band Logic-20260816-1022.md` (the founding GPT Pro conversation, moved into canon
today), `ONEMO … Product Base and Logic Architecture.md` (PB), `logic-spec-optimum.md` (LS).
**Not** R3-specs (Dan: donor). **Not** `FINAL-CONSOLIDATED-PROPOSAL.md` (superseded). **Not** the
pre-3.2 board.
**Plan read:** in full, 168 lines, sha1 `72ec209c6ae2bc0d`.
**Independence:** written before reading `audit/grok-qa-plan-signoff.md`. This is my own verdict, not
a countersignature of anyone's.

---

## VERDICT

**Necessity — shrink: one item.** Line `:3`'s framing.
**Sufficiency — partial: three items.** LS §8's five shape-specific opens · PB §16/§17 · the stale
"two briefs" scope rule at `:18`.

**I can sign, and I am signing with those three recorded rather than blocking on them.** None is a
defect in what the plan builds; all three are register/scope bookkeeping, and each is a one-line fix.
Nothing in the plan asserts a rule canon does not carry.

---

## The two folds — both landed, both correct

**F1, cross-band.** `:83` now carries all four LS §3 laws under one `[RULED]` tag, states the PB §12
reading correctly (*"bans inferring a size from a neighbour without evaluating it — not comparing
published answers after every size has been judged"*), and names inter-band state as a **Phase 2
build** rather than grounds to reclassify a ruling. Carried through to `:150`, `:153` and the
sufficiency line at `:168`; removed from the Open register. This is the fold I care most about —
*"every band answers"* is the law the shipped engine breaks ten times in fourteen, and it is now a
build task instead of an open question.

**F2, refusal reasons.** `:97` now lists all six PB §19 reasons, with *"present, unfireable"* on the
two that were missing and the split stated explicitly: the **reason** is canon, the **number** is
open, and the code exists so it can fire the day Dan sets the millimetre. That is the same
distinction the plan already made correctly for the 40 mm gate, now applied consistently.

---

## The three recorded items

### 1. `:3` — *"Ideal hug is a filled square. Free shapes approximate that."* · necessity

Acknowledged in review but not folded, and the third canon file makes it sharper than when I first
raised it. The phrase is genuinely Dan's — I verified the turn — but it is half of his sentence. The
whole of it: *"the fit is 0 flap ideally like square — **but free shapes are not perfect so we can
allow to approximate the max possible fit, not base the engine on the flap min-max rule** — zoom the
fuck out see the intent."*

Against the **founding conversation**, now canon, this is the one sentence in the plan pointing the
wrong way. That document's entire thesis is that the box must not decide: *"The band tells us how
much grid-space the object occupies. The silhouette tells us which parts of that grid-space actually
contain material,"* and *"the bounding box is useful for size and aspect-ratio classification, but it
should not be the thing deciding the magnet layout."* LS §1.1 defines the optimum properly and makes
the square the **banding standard**, not the target shape. As the plan's opening line, box-fill is
what a builder reads first.

**Fix:** keep Dan's sentence whole, and put LS §1.1's optimum next to it. One paragraph, no deletion.
The plan's body is already right — `:48` states box-classifies / fabric-decides correctly.

### 2. LS §8's five shape-specific opens are not in the Open register · sufficiency

LS §8 names its open register as *"the only undecided items"* — eight of them. The plan carries three
(B5 at `:79`, peel at `:69`, the flap/leftover millimetre at `:52`). Verified absent by unbounded
grep of the whole file: **bat B4 bulls-eye · butterfly B4 four-sparse-vs-six-tight · bot B1
44-vs-60 · pill B4 population · poke2's unwalked row.**

To be precise about one of them: the **bulls-eye rule** is present and correct at `:81` (*"marks the
one you'd pick by eye"*, LS §1.2). What is missing is the open *item* — which of bat B4's two
candidates is the bulls-eye. Different thing.

These are Step C shapes, so nothing in Phase 1–2 turns on them. But a register that claims to be
complete and carries three of eight will be read as settling the other five.

**Fix:** five bullets in the Open list.

### 3. `:18` says *"the two briefs"* where canon is three · sufficiency

`:37` was updated to *"from the three canon files"* and `:39` names all three. `:18` — the rule that
governs what gets deleted from `spec.ts` — still says **two**. Verified: those are the only two
occurrences in the file.

Small, but it is the plan's own scope rule, and the third file is the one that carries the founding
intent rather than the mechanics. A builder applying `:18` literally would delete against two
documents.

**Fix:** one word.

---

## PB §16/§17 — recorded, and I do not hold the sign-off on it

Zero references in the file, verified unbounded. PB §16 (the EvaluationPlan Logic sends: target size,
scale, both axis classes, canonical frame and anchor, permitted translation domain, permitted
templates, structural thresholds, gravity direction, required metrics) and PB §17 (the
GeometryEvidence Math returns, including **exact failure reasons**, with every coordinate available
as both a board address and exact millimetres).

The plan's spectrum declares itself *"the only normative surface"* and *"if it is not in this list it
is not required"* — so an unlisted requirement is unprotected by the plan's own rule. Today's 3.2
split satisfies both sections, which is why this is bookkeeping and not a build gap. I am folding it
into item 2's fix rather than raising it as a fourth.

---

## What I checked and found sound — do not re-open

Against all three canon files, in full:

- **Step 10** is LS §2's nine priorities plus the snug-seat selector, in exact order, no substitutions.
- **Step 3 ceiling** — *"fabric may reduce, never grow"* — is LS §4 step 3's *"capacity, never
  compulsory"* and PB §5's *"does not require every node to be populated."* This is the clause the
  shipped engine inverted and the single reason it regressed; the plan states it correctly and `:16`
  explicitly refuses a closed permission matrix.
- **Step 7 registration** matches PB §6 (*"first test, not automatically the final placement"*),
  LS §2's registration clause, and the founding conversation's *"canonical seed, not a compulsory
  final location"* — including mechanical quality choosing and canonical as last tie-break only.
- **Step 5 safe land** carries PB §7.2's exact forbidden list — box shrink, raster, offset-path
  joins, vertex-only distance — which is also the conversation's own warning against *"an agent
  taking shortcuts with bounding boxes, vertices, or sampled edge points."*
- **Step 9** is recognition, not invention: *"read the pattern the lawful seats already form."* That
  is the conversation's *"revealed by the material occupancy of the silhouette on the regular grid"*
  and its ordering — registration says where the lattice is, occupancy says which nodes the shape can
  carry, mechanics says which are used.
- **Step 6** carries PB §7.3's ten fields and PB §8's five properties each, with the connector rule
  (*"may hold no magnet and still join two masses"*) that both PB §8 and the conversation insist on.
- **§5.1 class table** exact, including the circle row 40 / 92 / 160 / 228 and the ruled "or"s.
- **All ten PB §13 hard exclusions** present, none softened.
- **All five PB §21 opens** named and routed.
- **28 / 40 / 108 deleted with no substitute**, and the limb exemption correctly survives as
  report-not-gate.
- **Square-first exam ladder** matches LS §5's derivation hierarchy — the square is the control, so
  the exams cannot be tuned on animals. The founding conversation's *"measured by squares is the
  easiest… this applies to any polygon"* is the same idea.
- **Balance** held silent with the centroid measure taken out of ranking — which PB §11's *"the
  geometric centroid is evidence, not the placement rule"* requires independently of Dan's deferral.

---

## Method note

Every absence claim above was verified by unbounded grep of the whole file, then re-checked with a
different pattern. Three false negatives on this sprint came from bounded reads — `cut -c150`,
`head -8`, and a missing trailing newline — and two of them nearly produced a fabrication verdict
against a real Dan turn. I did not accept any citation from another lane without checking it at
source, including the two corrections that landed in my favour.
