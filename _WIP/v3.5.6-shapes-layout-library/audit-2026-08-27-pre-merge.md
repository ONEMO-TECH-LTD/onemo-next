# Pre-merge audit — shape-layout library — 2026-08-27

Directive: Dan, 2026-08-27 — "run another audit visually in chrome and in code UI/code /library
catalogue format - clean separation ... read yesterday transcript too to see what expected
deliverable is ... we cant merge slop and under deliver ... use /o-necessity and /o-deslop -
and /o-verify /o-visual-verify". Then: "can we for once just do a good job and fix really and
not claim done on assumption?"

Gate order Dan set the same day: **gate 1 is mine** (self-audit + verify + visual-verify on my
own completed work), **gate 2 is @s62-qa**. Authority pinned by reading both day-files end to
end (08-26: 2427 lines · 08-27: 356 lines), not the plan's restatement of its own scope.

This file is the living record and is the ONLY document committed under `_WIP/`. The governed
law and spec live in the source tree (`src/lib/effect/library/`); the proposal and gate-report
history that produced them stays in transcript history, not in the product branch. Every row
below is present truth at the exact head named in section 8.

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

**I committed 2,470 lines of stale planning material beside the fix** — a second law and a
second spec that called themselves LIVE, plus twelve historical gate reports, none referenced by
any source. Shipping a contradicting duplicate of the governed law is the exact slop the law
exists to stop, and it made my own "no unnecessary elements" line false. Deleted; only this
ledger remains.

**I put selection policy in the geometry file to satisfy an ownership gate.** Collapsing the
duplicate `pickLayout`/`selectVariant` was right; parking them in `transforms.ts` — which
declares itself pure geometry — traded a duplication for a wrong owner and passed the count.
They now have their own module, and a gate rejects selection vocabulary reaching transforms.

**I wrote "lint clean" when ESLint reported two warnings.** Zero errors is not clean. Lint is
now run with `--max-warnings 0`, so the word cannot mean anything else.

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
| F2 | selection policy sat in the geometry module | QA re-gate | moving it back fails; transforms may name only frame/layout/view types |
| law | the law's own text could change without its gate | me | editing a heading fails the SHA gate |

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

**Necessity — no unnecessary elements.** Every item my own sweep raised, and every item QA
raised across three gates, is closed in code or corrected above. The branch's own delivery was
part of that: the fourteen stale `_WIP` files are deleted, and `selection-transition.ts` is the
one module added — twenty-five lines that let three callers stop writing the same fact out.
Production code across the whole rework is a net reduction. One element remains by design:

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

**Audited head: caac69709571911e7529727d5bd15d2361fd278a** — every number below re-run at that exact commit, by me.

- effect suite: 40 files, **563 / 563**
- architecture gates: **28**, zero deferred
- `tsc --noEmit`: clean
- scoped ESLint at **`--max-warnings 0`**: exit 0 (not "zero errors")
- catalogue: **163 records × 24/48/96**, identical id set, matcher round-trip 163/163
- shapes: **45** — square 5 · rectangle 12 · diamond 4 · triangle 24
- **eleven mutations run by my own hand, all dead**: the four QA closing-ledger holes, both
  operand orders of the option count, a duplicate spoken chip name, a second placeMM, a second
  pickLayout, the layout-carry dropped, the lone-type answer dropped, selection policy moved
  back into geometry, and the law edited without its hash
- visual gate on 4046 (serving tree confirmed by `lsof`): **35 states** — 0 overflow, 0 overlap,
  0 duplicate printed or spoken names, 0 body sideways-scroll, 0 console errors, Bench returns
  to exactly one viewport

Runtime matcher consumption by the solver remains **pending Dan's authorisation** — the
catalogue contract has landed, nothing consumes it yet.
