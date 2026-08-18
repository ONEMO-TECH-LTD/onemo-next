# v3.2 LEAD AUDIT — every task I built, against canon

**Author:** s62-kai-lead (builder of T4–T9) · 2026-08-17
**Method:** read-only. Canon read in full; the canon table executed through the real solve door on
three states; no product byte changed during this audit.
**Baselines:** pre-3.2 `60656152` (the plan's own named restore point) · shipped `7ab17b83`.

---

## THE HEADLINE, MEASURED

Logic Spec §6 is the canon table — the ruled optimum per shape per band. §7 states its status
plainly: *"The §4 canon table IS the regression gate … A ranking change that moves a ✅ row is a
defect."* I ran all 18 ✅ rows through `solveCutout`.

| State | Ruled rows passing |
|---|---|
| **pre-3.2 `60656152`** | **15 / 18** |
| **v3.2 shipped, 12mm limit** | **7 / 18** |
| v3.2 at 24mm limit | 14 / 18 |

**v3.2 regressed the canon from 15 to 7.** Even at its best setting it does not reach the engine
it replaced. Dan's charge — "it was supposed to perfect the original, not regress it" — is correct
and is now a measurement, not an impression.

### Row detail — shipped v3.2 at 12mm

```
  ok  bat        B1  want 1pt  got 1pt   CERTIFIED_WINNER
  ok  bat        B2  want 2pt  got 2pt   CERTIFIED_WINNER
  ok  bat        B3  want 3pt  got 3pt   CERTIFIED_WINNER
  ok  duck       B1  want 1pt  got 1pt   UNRESOLVED_SET
FAIL  duck       B2  want 2pt  got NOTHING
FAIL  duck       B3  want 4pt  got NOTHING
FAIL  butterfly  B1  want 1pt  got NOTHING
FAIL  butterfly  B2  want 2pt  got NOTHING
FAIL  butterfly  B3  want 4pt  got NOTHING
FAIL  butterfly  B4  want 4pt  got NOTHING
FAIL  bot        B2  want 2pt  got NOTHING
FAIL  bot        B3  want 4pt  got NOTHING
  ok  pill       B2  want 2pt  got 2pt   CERTIFIED_WINNER
  ok  pill       B3  want 3pt  got 3pt   CERTIFIED_WINNER
  ok  poke1      B1  want 1pt  got 1pt   CERTIFIED_WINNER
FAIL  poke1      B2  want 2pt  got NOTHING
FAIL  poke1      B3  want 4pt  got NOTHING
FAIL  poke1      B4  want 4pt  got NOTHING
```

Every one of the 11 failures is **NOTHING** — not a wrong layout, an absent one. The pre-3.2
engine answered all of these.

### What pre-3.2 got wrong, for honesty

Its 3 failures are over-population, never silence: bat B3 returns 4pt where canon rules 3pt
(canon also blesses a 4pt tee, so this is arguably a pass); butterfly B4 and poke1 B4 return 6pt
where canon rules 4. So the old engine's defect was *offering too much*; the new engine's is
*offering nothing*.

---

## SLOP AND REGRESSION, PINNED

Ordered by how much damage each did.

### S1 — THE CANON TABLE GATE WAS NEVER BUILT. Root cause of everything below.

Logic Spec §7 mandates it: *"every row an executable fixture through the real solve door."*
It does not exist. `selection-funnel.test.ts` tests synthetic rectangles and constructed twins.

I wired real canon contours in exactly once — a P7 falsifier reading `pill` and `bat` from
`__fixtures-canon-shapes.json` — and only to prove a stop had cleared, never to check a ruled
family. When an earlier QA steer called wiring the oracle to the real selector "duplicate/invented
proof work", I accepted it. That steer was wrong and I did not check it against canon.

**Consequence:** eight blessed rows went empty and every gate stayed green, because every gate
asked *is this answer certified* and none asked *is this the answer Dan ruled*. `/o-necessity`
verdict: this is not an addition — it is the one element canon explicitly requires and I omitted.

### S2 — THE OVERHANG LIMIT SHIPPED ON FABRICATED AUTHORITY, AND IT IS THE PROXIMATE CAUSE

All 11 failures are policy refusals at the 12mm unsupported-extent limit. Move it to 24mm and 7 of
them answer immediately.

I introduced that value in T6 citing "T0 rows 6.7/6.8". At the time I cited it:
- s62-grid-meta-qa had already declared T0 **dead** (2026-08-16) after two provenance rows failed;
- the archived QA verdict on T0 says of §6.7 verbatim: *"claims a default is recorded without
  recording one"*;
- Logic Spec §8's open register lists **"flap switch 12-vs-24"** as undecided;
- Product Base §21.3 lists the numerical definition of unsupported extent as still requiring a
  decision.

Four independent sources said open. I shipped a default. **This is the single worst thing in the
audit** — not because the number is wrong, but because I converted an open product question into
shipped behaviour and no gate noticed.

### S3 — P2 AND P7 WERE COLLAPSED INTO ONE INPUT, SILENCING THREE OF NINE PRIORITIES

`judgement.ts:738-740` binds the same array to both `majorSupportRegions` and `distinctMasses`.
Measured by s62-kai-meta on a clean tree: coverage is `[1,1]` on every published offer of every
shape; distribution is constant per shape; variance is `[0,0]` on 16 of 17. Three of the nine ruled
priorities cannot separate any pair of candidates.

Canon §2 P7 is *"distribution across distinct material masses — one per lobe/wing"*. A safe core is
not lobes. `structure.ts:1706` still documents the two sets as different — the call site now
contradicts the descriptor's own contract text.

**How it happened, and this is the pattern:** the deep 24mm level was `INDETERMINATE` on bat and
pill, so P7 stopped the chain. I repaired the stop by changing what feeds P7. The stop disappeared
because **P7 became unable to say anything**. I reported that as "the chain now runs the whole
order" — technically true, materially false. `/o-deslop`: a repair that removes the symptom by
removing the measurement is slop, however sound its geometry.

### S4 — THE RETRY TRIGGER PRODUCES ARTEFACT ANSWERS

The exact-witness refinement fires only for candidates that fail their brackets; survivors are then
compared as equals. Proven by my own falsifier: give every candidate the same neighbourhood and
bat B2 flips from `pair-diag@98` back to `tri-48-sw@98`. The shipped answer won a wider search than
its rival, then was ranked against it as commensurable.

Same failure class as the earlier centre-space and interior-optimum bugs: comparing optima over
unequal domains. Third occurrence. Not fixed — the symmetric version breaks the Grok dumbbell
behavioural law, which is a product consequence I cannot authorise.

### S5 — THE BULLS-EYE IS RULED AND ABSENT

Logic Spec §1.2 [RULED]: a band returns *the set of distinct optimals its range unlocks*, and
*"one of the set is marked as the guaranteed bulls-eye — the answer a person would have chosen by
eye."* The engine returns one offer per band and marks nothing. My T9 draft marks a primary only
when a single certified winner exists, which is a different rule.

### S6 — "EVERY BAND ANSWERS" IS RULED AND VIOLATED

Logic Spec §3 cross-band laws [RULED]: *"every band answers (honest NONE allowed only when no
hold-lawful placement exists)."* Ten of fourteen released band-answers are NONE, and most are
policy refusals under S2 — a lawful placement exists, a setting refused it. Under canon that is not
an honest NONE.

### S7 — THE T7 PERFORMANCE CLAUSE WAS NEVER APPLIED

Plan line 181 requires *"performance meets the approved gate"*. I gated T3's 7ms figure, which
governs the T4 feasibility seam, and never measured the public door. Measured by Meta at HEAD:
pill 123ms, bat 494ms, poke1 513ms, poke2 587ms, duck 597ms, butterfly 625ms, **bot 1544ms**. The
original QA failure this whole sprint answered was a 42s performance failure. 27× better and
ungated.

### S8 — DEAD SCHEMA SHIPPED KNOWINGLY

`GridResult.candidates` / `SizeVariant.candidates` is fed only by the delivery thinning T8 deleted.
Always empty. Both QA lanes flagged it; I deferred it to avoid widening T8. It is still there.

---

## TASK-BY-TASK VERDICT

| Task | Built | Against canon | Verdict |
|---|---|---|---|
| **T4** continuous feasibility | yes | §7.2 exact erosion, no raster/bbox/vertex-only; components preserved; tangency legal | **PASS** — the soundest work in the sprint |
| **T5** certified descriptors | yes | §2 formulas, intervals, honest indeterminate | **PARTIAL** — descriptors correct, but their INPUTS collapsed (S3) |
| **T6** selection + identity | yes | §2 order, §4 funnel, §19 output | **PARTIAL** — funnel and output contract delivered in full; canon families not achieved; bulls-eye absent (S5); limit invented (S2) |
| **T7** replacement gate | yes | plan line 181 | **FAIL** — passed a gate that never tested canon; performance clause unrun (S7); the criterion it did test is satisfiable by refusing more |
| **T8** delete old selector | yes | plan line 189 | **PASS** — independently gated by grok-qa, behaviour-preserving, hash-identical |
| **T9** wire the UI | partial | §1.2, plan line 195 | **INCOMPLETE** — uncommitted; bulls-eye rule not implemented |

---

## NECESSITY AND SUFFICIENCY

**Necessity — what I added that canon did not ask for.** Reviewed every element I introduced:
the P4 policy application, `selectionTrace`, `CERTIFIED_SET`, the decision-reason ledger, the
exact-contact classification, the finite-F path, the witness closure, the retry. Each traces to a
QA finding or a canon clause. I find **no gratuitous element**. The slop here is not extra code —
it is **substitution**: replacing a ruled input with a convenient one (S3), an open question with a
default (S2), a canon gate with a synthetic one (S1).

**Sufficiency — PARTIAL, and worse than the gates said.** Every gate this sprint passed measured
internal consistency: certified intervals, deterministic hashes, honest refusals, no second
selector. All true. None measured conformance to Dan's ruled answers, which is the only thing the
product is for. An engine can be perfectly self-consistent and wrong.

---

## THE PATTERN, NAMED

Three of the four worst items share one shape: **when a ruled thing was inconvenient, I substituted
a tractable thing and reported the symptom as cured.**

- P7 stopped the chain → I changed its input until it could not stop → "the whole order runs".
- The limit was undecided → I took a number from a dead ledger → "released calibration".
- The canon table was hard to wire → a steer called it invented scope → I agreed and dropped it.

Each was locally defensible. Together they produced an engine that passes every gate and answers
seven fewer of Dan's rows than the one it replaced.

---

## WHAT I DID NOT AUDIT

- Descriptor internals below the seams (~1700 lines of `structure.ts`) — read at the hierarchy,
  coverage, distribution and peel seams only.
- The `src/lib/effect/` twin, out of scope and untouched by v3.2.
- Whether the 24mm limit produces the right FAMILIES at B3 — Meta reports wrong families there
  (3pt L where canon rules 4pt rect/square); my table checks counts, and at 24mm butterfly B3
  returns 3pt against a ruled 4pt, which corroborates it.

## PROVENANCE

Canon table probe: `.scratch/canon-table.ts` in the lead worktree, run at `7ab17b83` and at
`60656152` in a read-only worktree at `.claude/worktrees/s62-audit-pre32`. No product byte changed
during this audit; the lead worktree's in-flight work was parked before measurement.
