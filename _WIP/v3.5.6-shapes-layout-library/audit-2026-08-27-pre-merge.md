# Pre-merge audit — shape-layout library — 2026-08-27

Directive: Dan, 2026-08-27 — "run another audit visually in chrome and in code UI/code /library
catalogue format - clean separation ... read yesterday transcript too to see what expected
deliverable is ... we cant merge slop and under deliver ... use /o-necessity and /o-deslop -
and /o-verify /o-visual-verify". Then: "can we for once just do a good job and fix really and
not claim done on assumption?"

Gate order Dan set the same day: **gate 1 is mine** (self-audit + verify + visual-verify on my
own completed work), **gate 2 is @s62-qa**. Authority pinned by reading both day-files end to
end (08-26: 2427 lines · 08-27: 356 lines), not the plan's restatement of its own scope.

This file is the living record and is committed with the branch. Every row below is present
truth at the head named at the bottom.

---

## 1 · What I got wrong, on the record

**My CLEAR on `29a22073` was false.** QA's closing ledger named four surviving mutations; I
reproduced all four myself and the architecture suite stayed 25/25 green on each. Every one was
a gate reading a *spelling* rather than the rule it advertises.

**Two of my own audit dispositions were wrong.** I marked `canonicalTriangleId` and
`registryIntegrity` KILL on reference counts alone. Both are live gates: the first proves the
literal corpus equals the independently derived 79-triangle universe; the second is spy-driven
with a real failure mode. Corrected — they stay.

**My first probe of my own new LAW 1 gate passed**, because my own numeric-literal exclusion
skipped it. A weak probe is not a passing gate. Re-probed properly; it fails.

**I reported nine items instead of fixing them.** That was the substance of Dan's "fix really"
— an audit that hands its findings on has not fixed anything. All actionable items below are
now closed in code.

---

## 2 · Gate holes closed (each with a frozen self-proof)

| # | hole | found by | proof it is dead |
|---|---|---|---|
| C1 | a registered zone-0 contract file could carry runtime code | QA | declarations gate derives from the zone, not a copy of two file names |
| C2 | catalogue `nodesMM` could be emptied at 24 and 96 (48 manifest intact) | QA | every record at every pitch equals an independent build through the class contract |
| C3 | "one resolution" was counted in the page, never in the producer | QA | call counts on `surface.ts` for all three services |
| C4 | the size gate stripped `?` but not `!` | QA | the exact `Math.max/Math.min` real-path mutation |
| Q1 | the LAW 14 gate read one operand order (`1 === x.length` passed) | QA gate 2 | both orders, both probed |
| Q2 | duplicate *spoken* chip names went undetected (only printed ones were swept) | QA gate 2 | a name collapsing to its type fails, naming the pair |
| L14 | LAW 14's first clause was machine-checkable, ungated, **and broken live** — the panel counted its types to grey out a lone chip | me | the library answers `disabled`; an AST gate rejects option-counting in the shell |
| F7 | two orientation chips read identically (`mirror diagonal ↘` / `↗`) | Dan's screenshot | swept over every block of every class × type × variant |
| F6b | moving the lone-type decision left the ANSWER untested — deleting it kept 560 green | me | every class held to it |
| F6a | the documented admin layout-carry, the one tolerated fallback in the library, had **no test** | me | both halves: it carries when it can, falls back when it cannot |

---

## 3 · Duplications collapsed — four facts that were each written twice

| fact | was | now |
|---|---|---|
| lattice → mm (the y-flip) | `materialize.ts` for the canvas **and** `triangle-class.ts` for the chip label — the disagreement that put a 120×120 chip on a 135×135 shape | one `placeMM` in `geometry.ts` |
| mm → lattice (a click) | a **third** copy in `authoring.ts`, which the new gate found immediately | `nodeAtMM`, beside its inverse |
| `pickLayout` | `selection.ts` **and** a private copy in `registry-class.ts` (zone 3 may not reach zone 5) | zone 2, both import it |
| `selectVariant` | `selection.ts` **and** hand-written as `openVariant` in `triangle-class.ts` | zone 2, the hand-written copy deleted |
| the materialised record | assembled three times, twelve fields each | one builder; only outline, layout name, error and seed differ |

Production code: **−8 lines net** (80 added, 88 deleted) across seven files. The triangle's
outline recipe is now one constant, so the chip and the canvas cannot be measured differently.

---

## 4 · Deliverable ledger vs the definition of done (2026-08-26)

| DoD clause (Dan's words) | verdict | evidence re-derived by me |
|---|---|---|
| 5 commits landed, every architecture gate green, **zero deferred** | PASS | 28 gates, 0 todo |
| every entry classifies at 24/48/96 and round-trips the matcher to its own id | PASS | 163 × 3 pitches, 163/163 each |
| the record is self-contained at every pitch | PASS | caller-equality against an independent build |
| nothing changes on screen — the 45 shapes render as now | PASS | 45 shapes; 35 live states walked |
| catalogue is the frozen classifier input format | PASS | V1, 12 keys, Equal<> type gate, identity manifest, data-only |
| "compatible is not integrated" status honest | PASS | law §15 + spec §7; the solver still does not consume the matcher |
| triangle catalogue as ruled | PASS | Pyramid 2 · Arrowhead 1 · Mountain 4 · Needle 1 · Wedge 9 · Flag 7 = 24; Flag holds exactly the seven sizes Dan named |
| adding a class = one package + one registry line | PASS | an unregistered package fails; families derived from CLASS_SPECS |

---

## 5 · /o-visual-verify

Serving tree confirmed by `lsof` on port 4046 — the tree Dan's own tab is on. Chrome extension
bridge is down; declared Playwright fallback against the same server.

**35 states** — four classes, all six triangle Type tabs, every Frame chip inside each type, and
square 4×4 on the 96mm spacing. Every button in every block measured for text-vs-box, pairwise
overlap and duplicate reading.

    overflow 0 · overlap 0 · duplicate labels 0 · body sideways-scroll 0
    console errors none · Bench returns to exactly one viewport

---

## 6 · /o-necessity

**Necessity — no unnecessary elements.** Every item my own sweep raised is closed in code or
corrected above. One element remains by design:

- `boundaryOf` is declared, threaded and called, and no class supplies it. It is the stated
  mechanism for the next shapes Dan named — H and double-T (08-26: "H can be done as square
  circle as well"). **KEEP-FLAGGED against that named phase**, not speculative surface.

**Sufficiency — delivers the directive in full.** Every DoD clause is covered by a named
element with re-derived evidence; the visual and code halves of the directive both ran.

---

## 7 · One product question, not a defect

**Square 4×4 on the 96mm spacing is the only registry population that is not view-symmetric.**
Its clockwise-walked ring is a pinwheel, so it offers two orientations (`0°` and
`mirror horizontal`) while the other fifteen square populations offer none — one chip in the
square tab grows an Orientation row the others do not have. The population is correct: it is the
balanced pairing Dan asked for on 08-26. Whether that row should show is his call.

---

## 8 · State

563 tests · 28 architecture gates, zero deferred · tsc clean · scoped lint clean ·
163 records × 3 pitches · 45 shapes · 35 live states · 0 visual issues · 0 console errors ·
**nine mutations run by my own hand, all dead.**
