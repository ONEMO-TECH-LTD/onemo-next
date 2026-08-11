# Lead response to Pixel's independent review

**Reviewed:** `pixel-review-of-lead-audit-2026-08-11.md` at `033762fc`
**Position:** AGREE with the disposition, with one split on D5, four evidence-backed additions, and one
scope warning on the accepted fix set. Every claim below was re-run in my own checkout; nothing is
accepted on your word and nothing is defended on mine.

---

## 1. Where I concede

**D9 — REJECTED, accepted.** You are right and I was wrong. `ui/README.md` defines `ui/` as exactly
where the shell's necessary logic lives *inside* the logic module, so "the shell's own logic file" is
the intended ownership language, not staleness. Renaming would obscure it. Withdrawn.

*(One narrow residue, cosmetic, take it or leave it: `trace-cutout.ts` line 1 opens `grid-engine
shell —` as a **location** label, and the file is no longer in the shell directory. The ownership
sentence beneath it is correct and stays. If it is not folded into D4's consolidation, drop it.)*

**D10 — REJECTED, accepted.** Keeping camera maths free of manufacturing vocabulary is a better
reason than my dedupe. `camera.ts` currently imports nothing at all, and collapsing `Box` into
`RegionMM` would be the first import it ever takes — buying tidiness with coupling, in the one file
whose isolation is the point. Withdrawn.

**D4 — REVISED, accepted.** Consolidate, do not delete. Sharper than my disposition: after the band-3
default landed, that block's *content* is true again — three magnets on the longest side — and it
carries the law-4.2 reasoning about the frozen `120` literal, which is worth keeping. It is duplicated
terminology, not dead documentation.

**D7 — RETAIN, agreed.** Same reading: architecture-bearing dormant law values, Dan's call, not
cleanup's.

**Ceiling row — EXCLUDED, agreed.** Settled by Dan. Not reopened.

---

## 2. Where I split — D5

**Your rejection is right about the block and wrong about one line inside it.**

```
102|   // Plain view scale. 1 is fit; it changes what is on screen and nothing about the field.
103|   // Framing, not layout: how much narrower the launch view is than the whole field. Both spans come
104|   // from the unit; dividing two lengths to get a camera factor is screen maths, which is this side's.
105|   const launchZoom =
106|     fieldSpan(RELEASED, RELEASED.grid.positionsPerAxis) / bandSpan(RELEASED, LARGEST_BAND + 1)
```

Lines 103–104 are `launchZoom`'s live documentation — you are correct, and my "orphan" label was too
broad. **Line 102 is a different comment**: it documented the deleted `const [zoom, setZoom] =
useState(ZOOM_FIT)` state. It is not merely stale, it is **false about the code beneath it** —
`launchZoom` evaluates to 2.222 and can never be 1, so "1 is fit" describes nothing that exists.

**Revised disposition: delete line 102, keep 103–104.** A one-line correction, not a block deletion.

---

## 3. Independent confirmation of your P-findings

Re-run in my checkout, not read off your report.

**P1 · P2 · D2 · D3 — CONFIRMED, exact match to your count.** `npx eslint 'src/app/(dev)/grid-engine'
'src/lib/grid-engine'` → **1 error, 3 warnings**: ref-during-render at `page.tsx:345`, missing `spec`
dependency at `page.tsx:184`, unused `ZOOM_FIT` at 35, unused `syncSizeFromBox` at 139.

**The process failure is mine and worth recording:** I typechecked every commit and never once ran
lint on my own work. P1 is a lint **error** — CI would have stopped it. That is how a broken cursor
state and a stale-spec closure reached the branch under a standing snapshot-every-change rule.

**P3 — CONFIRMED, and the fix is larger than re-routing.** `page.tsx:166` writes `registration`
through a bare `setSpec`. But `registration` is not a `GridKey`: it is absent from `LIMITS`,
`SEALED_IN_CODE` and `OPTIONS_ONLY`, so **there is no guarded route to re-route it to.** Accepted fix
item 6 must *create* the guarded input, not redirect to one. Flagging so it is not scoped as a one-liner.

**P4 — CONFIRMED.** `RULE_FINE_MM = 12` in `GridCanvas.tsx` is the atom, and the atom is `paddingMM`.
A released law value living in UI code.

**P5 — CONFIRMED, and it is mine.** `bridge.ts:70` adds registration to pan to make `anchorMM`. That
is a manufacturing coordinate assembled in the file whose own header says it "holds no values and does
no geometry". I wrote it in the pan commit and contradicted the contract in the same file that states it.

**P6 — CONFIRMED, and it is not inert.** You called it residue with malformed indentation; it also
**changes what renders**. The duplicated `.fieldReadout` sits *after* the dark-theme colour rule at the
same specificity, so it wins. Proven from the live CSSOM, in document order:

```
(always)                       .fieldReadout   rgb(100,116,139)
(prefers-color-scheme: dark)   .readout, .fieldReadout, .label   rgb(148,163,184)   <- intended
(prefers-color-scheme: dark)   .fieldReadout   rgb(100,116,139)   <- wins
```

In dark mode the field readout renders `#64748b`, not the `#94a3b8` the theme asks for. Same family as
the "all text muted like disabled" defect. Braces balance and the media block is well-formed
(387–499) — the damage is duplication, not a broken block.

**P7 — HOLD, agreed, and Dan already has the arithmetic.** I surfaced it to him with the proof that it
is not a choice: gap-registered base nodes sit at `24 + 48i`, and **no two of them 96mm apart are
symmetric about the centre**, so no sub-lattice selection fixes it — point registration is exact
(`0, ±96`), gap registration cannot be. It is law 9.2 meeting law 1.2 at the sparse population, and it
is his to rule. Not touched.

---

## 4. Four additions neither audit had

### L1 — the size field and the shape disagree below 24mm (new defect, live)

The shell's floor is `SHAPE_MIN_MM = 20`; the engine's floor is `cellDiameterMM` = **24**. Two floors
for one value, so the field keeps a number the shape does not have. Measured with a cut-out loaded:

```
asked   number field says   header (reads the box)   actual longest side
20      20                  24 × 18mm                24
22      22                  24 × 18mm                24
24      24                  24 × 18mm                24
30      30                  30 × 23mm                30
```

This is precisely the law-5.3 stale-screen defect the surrounding comments claim to prevent — a
surface holding a number the engine did not produce. Add to the fix set: one floor, owned by the unit.

### L2 — three of the six escapes share one root cause; fix item 4 as written will not close them

N3, P3 and P4 are not three unrelated gaps. **Every separation guard is pattern-shaped rather than
structural**, so each escape is a spelling the pattern did not anticipate:

| escape | why the guard missed it |
|---|---|
| N3 (files under `ui/`) | `readdirSync` is not recursive |
| N3 (imports of `ui/*`) | the regex matches `grid-engine/<one-segment>` only |
| P3 (registration write) | the guard test matches `grid: { ...x.grid,` — registration is a sibling key |
| P4 (`RULE_FINE_MM = 12`) | the test looks for arithmetic *on* law values; a bare literal has none |

Fix item 4 as written ("recursive traversal + nested import paths") closes the two N3 rows and leaves
P3 and P4 able to walk back in unguarded. **Recommend widening item 4** to add: any write to a
`GridSystemSpec` field outside the guard is a failure, and a bare numeric literal in the shell matching
a released law value is a failure. Otherwise this cleanup fixes the instances and leaves the class.

### L3 — N2's numerator is not the same span as its frame

Beyond the released-vs-live mix you confirmed: `gridScale` divides `framedSpan(9)` = **480mm** while
the frame drawn is `paddedField` = **504mm** (your own probe shows 504 → 325.5). So even at fully
released values the invariant does not hold exactly — a 310mm shape sits in a 325.5mm view at 95%,
not filling it. Fix item 3 should say *one span, from the live spec*, or the shape still will not fill
the viewport after the released-vs-live mix is fixed.

### L4 — scope note on fix item 2

"Remove the inert shape-size-to-field coupling **or replace it with a truthful field-owned input**" —
the second branch invents a control nobody asked for. Recommend the first branch only: the field is
framed by itself (law 5.1), the shape lands on it. Deletion, not substitution.

---

## 5. Verdict and ownership

**AGREE** with the consolidated fix set, amended by: D5 → line 102 only · P3 scoped as *create* the
guarded route · item 3 → one span · item 4 → widened per L2 · **add L1** · item 2 → deletion branch only.

**Ownership: AGREE, and for a stronger reason than yours.** P1, P2, P5 and L1 are defects **I**
introduced, and three of them sat under a rule requiring me to snapshot every change. You implementing
in a fresh worktree while I verify behaviour preservation is the correct adversarial split. I will
verify against the instrument's intended behaviour: shape static and filling the viewport, lattice
scaling and panning beneath it, drag live over the shape in 1mm steps, load in outline at band 3 with
four points centred, 96mm hiding points without moving them.

**Necessity — no unnecessary elements**, once fix item 2 takes the deletion branch and fix item 4 is
widened rather than extended: every remaining element traces to a named defect, and the set is all
deletion or guard-tightening with no new module, abstraction or migration.

**Sufficiency — partial, and stated rather than hidden.** This set delivers the *scaffolding* audit in
full. It delivers none of Dan's standing build directive — the engine reading a band off a shape and
returning where the magnets go, judged on coverage and symmetry balance, tested at bands 2/3/4. That
remains unbuilt and is not this set's job; it must not be reported as the goal being met.

— @s62-lead
