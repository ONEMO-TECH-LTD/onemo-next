# LEAD SIGN-OFF — `plans/v3.4 ---plan-and-contract.md` against canon

**Signatory:** s62-kai-lead · 2026-08-17
**Signed against:** the three files in `canon/` and nothing else —
`ChatGPT-Grid and Band Logic-20260816-1022.md` (the founding GPT Pro conversation, moved into canon
today), `ONEMO … Product Base and Logic Architecture.md` (PB), `logic-spec-optimum.md` (LS).
**Not** R3-specs (Dan: donor). **Not** `FINAL-CONSOLIDATED-PROPOSAL.md` (superseded). **Not** the
pre-3.2 board.
**Plan signed:** in full, **170 lines, sha1 `54638fef287142fb`**.
**Independence:** written before reading `audit/grok-qa-plan-signoff.md`. This is my own verdict, not
a countersignature of anyone's.

---

## VERDICT — CLEAR on both axes

**Necessity — no unnecessary elements.**
**Sufficiency — delivers the canon in full**, with every deferral named in the Open register rather
than dropped.

> **Scope of that CLEAR, stated so it is not over-read:** this is a verdict on the *plan as a
> contract against canon* — every canon requirement has a plan element or a named open. It is **not**
> a verdict on the build. The plan's own sufficiency line (`:170`) correctly stays *partial* until
> each row is actually delivered in its phase. Both are true at once and they measure different
> things.

### First pass, and the correction

I first signed sha1 `72ec209c6ae2bc0d` (168 lines) with **shrink: one** / **partial: three**. That
was a stale copy — two of the three were already fixed in bytes newer than the ones I read, and grok
folded the third on receiving my note. Re-hashed and re-verified against `54638fef287142fb`:

| # | Recorded against `72ec209c` | State at `54638fef` |
|---|---|---|
| 1 | `:3` *"Ideal hug is a filled square"* | **Resolved, and better than I proposed.** The opener is now LS §1.1's optimum, closing *"The box classifies; it never places magnets. Size is the output."* That is the founding conversation's thesis stated directly. Dan's zero-flap square is preserved where it belongs — the leftover row at `:52`, as a score rather than a definition. |
| 2 | LS §8's five shape opens + PB §16/§17 absent | **Resolved.** `:124` names all five individually as Step C, and carries the precision I asked for — *"The bulls-eye rule is at the band table; this is the open item."* `:125` names PB §16/§17 with the right reason: *"so the spectrum's 'not in this list → not required' cannot drop them."* `:170` updated. |
| 3 | `:18` *"the two briefs"* | **Resolved.** Now *"the three canon files"*, matching `:37`. |

**Drift check on the delta:** 168 → 170 lines, the two additions being `:124-125`, plus the opener
rewritten in place. I re-verified every clause I had certified sound; all intact.

---

## The two folds — both landed, both correct

**F1, cross-band.** `:83` now carries all four LS §3 laws under one `[RULED]` tag, states the PB §12
reading correctly (*"bans inferring a size from a neighbour without evaluating it — not comparing
published answers after every size has been judged"*), and names inter-band state as a **Phase 2
build** rather than grounds to reclassify a ruling. Carried through to `:150`, `:153` and the
sufficiency line (`:170` at current bytes); removed from the Open register. This is the fold I care most about —
*"every band answers"* is the law the shipped engine breaks ten times in fourteen, and it is now a
build task instead of an open question.

**F2, refusal reasons.** `:97` now lists all six PB §19 reasons, with *"present, unfireable"* on the
two that were missing and the split stated explicitly: the **reason** is canon, the **number** is
open, and the code exists so it can fire the day Dan sets the millimetre. That is the same
distinction the plan already made correctly for the 40 mm gate, now applied consistently.

---

## The three recorded items — all resolved at `54638fef`, kept for the record

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

## PB §16/§17 — resolved at `:125`; the reasoning is kept because it is the general rule

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
different pattern. That discipline earned its keep twice on this sign-off: once catching that I had
read a stale copy, and once when my own re-verification reported the step-3 ceiling clause missing —
a false negative caused by writing `\|` inside a `grep -E` pattern. The clause was present at `:16`
and `:62` the whole time. Three false negatives on this sprint came from bounded reads — `cut -c150`,
`head -8`, and a missing trailing newline — and two of them nearly produced a fabrication verdict
against a real Dan turn. I did not accept any citation from another lane without checking it at
source, including the two corrections that landed in my favour.
