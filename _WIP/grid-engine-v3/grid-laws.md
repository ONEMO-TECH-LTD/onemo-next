# GRID ENGINE v3 — LAW
### What the engine must obey · 2026-08-09 → 2026-08-10 · living document

> **This book does not replace the v1 grid law book. It inherits it.**
> Dan, 2026-08-10: *"plus our law book is still applies from the grid-lab v1"*.
> Inherited in full: `onemo-ssot-global/.claude/worktrees/s59-grid-law-main/_ssot-workbench/_briefs/grid-laws.md`
> — the lattice, the atoms, padding from the magnet centre, the even-millimetre publication, the
> mask/spacing/pattern separation, the manufacturing projection. **Nothing there is repealed except
> where a clause below says so explicitly.**
>
> This book records only what is **new or newly decided** for v3.
> Provenance on every entry: **DAN** — his words, quoted, settled only by a different utterance ·
> **DERIVED** — engineering formalisation of a Dan ruling, settled by showing the derivation wrong.
> Companion: [`grid-brief.md`](./grid-brief.md) — his directives verbatim.

---

## 1 · The unit

**1.1 — Three parts. The unit is two of them, and the unit is what travels.** *DAN, 08-10*
> "1 unit 2 subs engine and logic system" · "3rd is admin ui shel neutral canvas that has ui separate
> bridge that wires in the logic unit to drive the engine - ui is for admin testing - the grid engine
> unit with logic must be portable for later integration into cutout lab and web app"

**1.1a — THE SPLIT, ruled exactly.** *DAN, 08-10, verbatim:*
> "no math in the logic - engine has all compute - logic can hold and feed key values only and the
> rest of the logic bridging the engine to any ui or other modules with logic"

| | holds | never holds |
|---|---|---|
| **Engine** | **ALL compute.** Every calculation without exception | no values of its own |
| **Logic** | (a) holds and feeds the key values · (b) the bridging logic wiring the engine to any UI or any other module | **no maths at all** |
| **Admin UI shell** | layout, controls, presentation state | renders; computes nothing |

**Engine + logic is one portable unit.** It carries no browser, no framework, no screen assumption,
because it is going into the Cutout Lab and the web app later. The shell exists so Dan can test; it
is not the product.

**The bridge is not a fourth part and it is not UI-side.** It is the logic sub's second job, and it
**travels with the unit** — because "any ui or other modules" means the Cutout Lab and the web app
each drive the engine through it rather than each writing their own wiring. *(This closes O-A.)*

**Test of the split:** if a line performs arithmetic, it is engine — wherever it currently sits.

**1.2 — The prototype is not the base.** *DAN, 08-09*
> "the grid-lab is prototype that has noodle soup inside"

v3 is not built on the grid-lab, does not extend `grid-core.ts`, and inherits none of its code.

---

## 2 · Sizing

**2.1 — Scale is the only transform. Aspect is locked.** *DAN, 08-09 / 08-10*
> "margin offset is cosmetically wrong - scale is the only part must be applied" ·
> "scaling cutout shapes in locked aspect ratio to the grid"

**Supersedes v1 laws 2.6 and 2.7 for the size solve.** No margin band participates in sizing. A
cut-out's proportions are part of its identity and are never altered — width and height are never
independently adjustable. *(This is the exact defect measured in the old engine, where a circle, a
3:1 oval and an 8:1 sliver all returned the identical ladder.)*

**2.1a — THE SHAPE IS UNTOUCHABLE. Nothing is ever shrunk, eroded, offset or redrawn.** *DAN, 08-10,
stated three times in fifteen minutes because the engine kept implying otherwise:*
> "we are not shrinking anything we are scaling proportionately and we start at bands as i asked already
> as fine tune steps use scaling and other methodologies we discussed"
>
> "this was ale=ways the case and repeated it many times "The shape is untouchable. The user's outline
> and its proportions are locked. We never deform it, never stretch it, never redraw it. The only thing
> we ever do to it is scale it up or down, aspect locked.""
>
> "locked proportions only scaling  was repeated 100 times today"

**And on the internal restatement that caused the confusion** — *DAN, 08-10:*
> "what is erroded region and what is it for precisely i still do not understand the purpose of the
> clipper - we filtered clear methodology simple - we need to place magnets - clipper is svg powered
> engine for drawing the shapes - we are not drawing the shapes here what is it for?"

**Padding is an ENLARGEMENT OF THE MAGNET, never a reduction of the shape.** Each magnet centre carries
a 12mm safe radius, so it occupies a 24mm disc that must sit wholly on fabric (10.6, 11.1). The
equivalent phrasing — "a 12mm no-go band just inside the outline where no magnet centre may sit" — is
the *same rule seen from the shape's side*, and is an internal convenience only.

**No such curve is ever drawn, exported, manufactured or handed to a drawing library.** Constructing it
as a polygon is what produced the two-boundaries defect: candidates generated from an approximated curve,
scored against exact distance. **The hold test is the exact distance from the node to the outline
(11.1). Nothing else is required, and nothing may modify the outline.**

**2.2 — Optimal is tight: no breathing space between the magnet cells and the edge.** *DAN, 08-10*
> "star encapsulates 2x2 grid with breathing space to the edges - this is fine but not optimal" ·
> "look how close the edges of shape to gug the grid 2x2 - so in that case close to optimal is 162mm"

A larger size that holds the same magnets is **legal but wasteful**. The optimal size for a given
layout is the one where the outer cells press against the shape's edge. This is v1's zero-flap rule
stated as the sizing objective.

**2.3 — But smallest is NOT the rule. Balance decides first. See §3.** *DERIVED from 3.1*

---

## 3 · Balance and symmetry — the rule that chooses the layout

**3.1 — THE BALANCE LAW.** *DAN, 08-10, verbatim:*
> "what may seem logical on paper and mathematically correct may miss the law of balance and simetry"
>
> "the grid 2x2 must be centered and symetrical from each side of the shape plus follow logic of where
> material is and is not available"
>
> "the gravity rules of magnets having support on the top side to hold top side and not make only 1 row
> at the bottom"
>
> "centering and balancing so there is no flap and assymetric free uncovered by magnets surface"
>
> "**perfect shape x grid match is 4 points balanced and symetrically centerd on the shape**"

**This closes v1's open item O3** — which lattice points a population takes and where the lattice
registers. It is Dan's ruling, given directly, not inferred.

**Four bindings, each independently live:**

**(a) Centred and symmetrical on every side.** The layout sits centred on the shape with even
relationship to each side — not pushed into whichever lobe happens to be fattest.

**(b) Material-aware.** Magnets go where material actually is, and not where it is not. A layout that
places magnets over a gap between limbs is not a layout.

**(c) Gravity — the top must be held.** *(v1 law 5.8 restated and extended.)* A layout that supports
only the bottom row leaves the top to fall away. Support at the top is required, not preferred.

**(d) No flap, no orphaned area.** No large asymmetric region of the shape left uncovered by magnets.

**3.1e — SYMMETRY BALANCE IS MEASURED PER QUADRANT, ABOUT THE CENTRE LINES. Never as an average.**
*DAN, 08-10, defining the measure he named in the build directive:*
> "the center lines vertically and horizontaly dividing a shape to judge each cell on the coverage of
> the magnet"

Draw the vertical and horizontal centre lines through the shape. They divide it into four regions. The
measure is **whether each region holds magnets** — this is 3.1(a) *"centered and symetrical from each
**side** of the shape"* stated as arithmetic, and it is the same fact as 3.1(d) seen per region.

**Why an average is the wrong instrument, and it is not theoretical:** the distance between the
magnets' mean position and the shape's centre is **exactly zero** for two magnets sitting diagonally
opposite — while two of the four quadrants hold nothing. *Measured instance: on a real 2972-point
traced contour at band 3, the engine returned 2 magnets with a centroid balance of 1.1mm and it was
reported as near-perfect. Two magnets that close to centred are opposite one another, so half the shape
was unheld and the measure could not see it.*

A layout is balanced when every quadrant carrying material also carries support.

**3.1f — THE FOLD IS HOW THE CENTRE LINES ARE FOUND. It is not a sizing method.** *DAN, 08-10:*
> "The fold was used as hypothetical folding the shape in half to determine center lines vertically"

Fold the shape in half — that is the centre. Two folds give the vertical and horizontal centre lines,
and those lines give the quadrants of 3.1e. That is the fold's entire job, and it has no failure mode.

**Recorded so it is not misread later:** an elaboration *on top of* the fold — scale each side until its
magnet fits, then average the four scales to size the shape — was built and **falsified on 8 of 8 free
shapes (undersized 18–65%; folding on the guaranteed area instead still failed 4 of 8)**. That invention
failed. The fold did not. It measures reach along the axes, which is meaningless for sizing a free shape,
but exact for locating a centre. Do not revive the sizing version, and do not discard the fold because of
it.

**3.2 — Balance outranks minimum size.** *DERIVED from 3.1*
Where a tighter size exists but is asymmetric, the balanced layout wins and the tighter one is
discarded. **Measured instance, recorded so the class is recognisable:** on Dan's 162mm star the
mathematically smallest four-magnet fit is **130mm**, achieved by bunching the four magnets into one
lobe. It is arithmetically correct and it is rejected on sight under 3.1(a).

*Sizing is therefore: choose the balanced layout under §3, then apply §2.2 to it.*

---

## 4 · Blindness

**4.1 — No prior sizes, no shape names, anywhere in the logic.** *DAN, 08-10*
> "any shape x grid language in the engine and full logic be blind to prior sizes and shapes"

68 · 116 · 164 and 88 · 156 · 224 are what 48mm spacing and 10mm padding happen to produce. They are
**outputs**. The engine holds no table of them, no test tuned toward them, and no branch on shape
identity. *(v1 law 8.8 as an architectural duty.)*

**4.2 — Change an input and everything re-derives.** *DAN, 08-10*
> "if i change the inputs to the grid spacing and margins the engine must be adapting to anything"

Every value arrives from the logic sub. Changing spacing, padding or the ceiling re-derives every
result with no code change. *(v1 laws 8.7 / 8.10.)*

**4.3 — The acceptance is mutation, not matching.** *DERIVED from 4.1, 4.2 and v1 law 8.11*
A build is judged by: change the inputs and does everything move coherently · does it work on an
unseen asymmetric concave outline · rotate the shape and does the layout rotate with it. **A green
square or circle is silence, not a pass.** Dan's published numbers are one column of that table,
never the target.

---

## 5 · The canvas

**5.1 — The field is the world; the shape lands on it.** *DAN, 08-10*
> "we need to create infinite canvas that is based on the grid variations" ·
> "i made the grid with 48mm columns and rows - magnetic points wrapped in 20mm frame and having 6mm
> and 8mm magnet circles inside"

An infinite lattice of cells — 48mm spacing, each cell the 20mm padding square carrying its 6mm or
8mm magnet. A shape is placed onto it. The magnets it gets are the cells it lawfully covers.
*Reference: Figma ONEMO DS v2.3.6, node `14247-29777`; measured at 10 Figma units per millimetre.*

**5.2 — Millimetre-true, manufacturing precision.** *DAN, 08-10*
> "it must be manufacturing precision SVG millimeter based"

One SVG user unit is one millimetre. What is on screen is the manufacturing drawing; there is no
conversion between what Dan looks at and what is cut.

**5.3 — The canvas computes nothing.** *DERIVED*
It holds no number the engine did not just return, so a stale view is structurally impossible.
*(This is the defect where a landed, correct fix was invisible on screen for a day.)*

**5.4 — The variations are the controls.** *DERIVED from 5.1*
Spacing · pattern · mask · which layout. Each is an input to the unit, surfaced as a control, and
never inferred from another. *(v1 law 4.7e — one control, one job.)*

---

## 6 · Method

**6.1 — Design before build; ask before acting.** *DAN, 08-10*
> "do not rush building what i am not asking - think and talk to me and ask permission before acting" ·
> "talk to me and do only what i ask no building anything untill we align"

**6.2 — Necessity and deslop are design instruments here, not review afterthoughts.** *DAN, 08-10*
> "we need to use /o-necessity and /o-deslop to design the internal canvas tool for this first"

**6.3 — Every QA runs the necessity and deslop discipline.** *DAN, 08-10*
> "every qa must follow /o-necessity and /o-deslop discipline"

Both verdict lines are mandatory — necessity ("no unnecessary elements" / "shrink: X") **and** sufficiency
("delivers in full" / "partial: X"). CLEAR only when both are clean.

**6.4 — Verification is code AND eyes, every time.** *DAN, 08-10*
> "i do not see the grid did you verify fully what you did in code and visually?"

**6.5 — A default is not the builder's to set.** *DAN, 08-10*
> "who gave you permission to change the default grid ?"

*(Context: `registration: 'gap'` was promoted to a released default for the whole system. Dan's balance
rule says a **layout** should be four-point-centred; that is a layout the engine SELECTS, not the
grid's standing state. Promoting a selection to a default is a scope decision, and it is Dan's.)*
A layout the engine should choose may never be promoted to the system's standing state.

**6.6 — Formulas are defended and proven BEFORE any code exists.** *DAN, 08-10*
> "We need to create and defend formulas and prove them on real test before we build anything it is pure
> match and geometry and arithmetic"

**6.7 — Nothing is approximated or invented where real maths or working code exists.** *DAN, 08-10*
> "i dont want you approximating it if we have the read math to copy or ready code somewhere that is
> working - no vibe coding or approximating - unless it is planned and a necessity"

An approximation is permitted only when it is **planned, named as a necessity, and stated** — never
introduced silently, and never described as exact. *(Measured instance: an approximated boundary was
labelled "the complete event set" and lost the canonical 2x2.)*

**6.8 — The lane does its own research. A sub-agent is an extra, never the source.** *DAN, 08-10*
> "i suggest research is done by you diligently and subagent is independent extra"

**6.9 — The basic geometries are NOT the work.** *DAN, 08-10, naming it as drift:*
> "and again the geometric shapes are static - we precalculate them easy - we need robust freeshape
> algorithm we keep talking about problems of the basic shapes and it is drifting into the opposite
> direction"

Squares and circles are static and precalculated. **A defect found only on a circle or a square is not
a blocking defect** — at a band size those outlines are exactly tangent to their magnets by construction,
so their placement window is near-zero (measured: 0.059mm for the 92mm circle, exactly zero for the 72mm
square) and they are the least representative case in the system. *(This law was breached by QA and by
the builder simultaneously, for over an hour, on the 92mm circle.)*

**6.10 — Internal tests are not the test. Nothing is proven until a real cut-out is on screen.**
*DAN, 08-10*
> "your internal tests are fine but we need to test on the real thing - we need to wire cutout lab to
> generate the shape and see how the shape is covered essentially unless we do that all is good theory"
>
> "We must test on odd random blobs and outlines ideally"

Synthetic fixtures are a proxy and are named as such. The gate is a real traced contour, its magnets
visible, judged by eye against what Dan would have done by hand.

---

## 7 · The field and the canvas surface

**7.1 — The field floor is nine lattice positions.** *DAN, 08-10*
> "if we set max 310 the canvas must show at least 48mm 10x10 points grid" → "actually 9x9 is enough"

**7.2 — The field must visibly END.** *DAN, 08-10*
> "we need to give it space make some padding same like 40mm each side so we can see that grid has
> limits and it is full zoom out scale"

**7.2a — The margin is DERIVED, not chosen.** *DAN, 08-10*
> "make zoom to work showing only 9x9>8x8>7x7 etc with max padsding before next larger row shows up"

The largest padding that still excludes the next position is the bare gap between two cells:
**pitch − cell**. A flat 40mm is wider than that gap, which is why every stop kept showing nine.

**7.3 — Fixed render window, procedural infinite field.** *DAN, 08-10*
> "Make viewport fixed like … the cutout lab exactly. the canvas with magnets is infinite procedural
> in case we scale the shape in and out the canvas stays adaptable and shows more magnets the viewport
> just fix render window"

The box never grows; the view adapts to the content's extent. Copied from the Cutout Lab, not invented.

**7.4 — 402 × 402, the iPhone standard, scaling to the design system's own ceiling.** *DAN, 08-10*
> "the viewport is pretty match 402x402" · "also did you see 402x402 viewport for the canvas message
> - focus ffs!" · "add spacing and make the page responsive dude - 402 is iphione standard that scales
> to the page fill height and max width of 800px or whatever it is in our design system"

**Mobile is the gate, not a breakpoint** — "we are making it for mobile must be tested on mobile".
Theme follows the system; no forced dark. The shell is scaffolding — the studio's visual design comes
from Figma and this invents none of it.

**7.5 — The canvas carries nothing but the drawing.** *DAN, 08-10*
> "canvas must be clean from controls and labels"

**7.6 — The notepad is TWO levels, copied from the file.** *DAN, 08-10*
> "5% visibility"

A 1mm grid and the 48mm columns/rows, both at low ink. *(A 10mm level was invented and deleted: 48 is
not a multiple of 10, so that level can never pass through a magnet centre — permanent noise fighting
the lattice.)* A level whose line is wider than its own cell floods to a wash and must drop out.

---

## 8 · Zoom

**8.1 — Zoom is a plain view scale and it touches NOTHING.** *DAN, 08-10*
> "the zoom is page view zoom nothing is influenced by it the circle must retain the scale" ·
> "make the fucking zoom - regular zoom"

**8.2 — The shape is always centred; zoom is centre-preserving.** *DAN, 08-10*
> "zoom must zoom on the center not side ways the object shape is in center always"

**8.3 — UI MAY NOT REACH THE MATHS.** *DAN, 08-10, and it is named as a protocol violation:*
> "i feel like the ui logic of zooming is influencing the math and grid itself --- you violated the
> protocol to solve and find short cut for ui zoom"

*(Measured instance, recorded so the class is recognisable: registration was derived from the zoom
stop, so every press physically moved the lattice 24mm under the shape and the field count flipped
between 9 and 10. A view concern was in charge of the geometry.)*
**No view concept may be an input to engine arithmetic.** Not a stop, not a scale, not a pixel.

---

## 9 · Registration — where the lattice sits against the shape

**9.1 — Registration is a property of the LAYOUT, never of a view.** *DERIVED from 8.3 and 3.1*

**9.2 — Parity decides it, and nothing else.** *DAN, 08-10*
> "however the 4 parts of 4x4 48mm points are not in the center so we need to adapt to each grid to
> make the shape center to the 4x4 or at least 1 column x 2 rows single 2 point"

An **even** run — the 2×2 and the 4×4 his balance rule calls the perfect match — requires the shape's
centre to fall in the **gap** between magnets. An **odd** run requires a magnet at the centre. There is
no third option and nothing is chosen: the count decides the registration.

**9.3 — The offset is half the POPULATED pitch, not half the base lattice.** *DAN, 08-10, by defect:*
> "how is it possible that you switch to 96mm and circle no longer has 4 points of 96mm … the shape
> must be showing centered as in previous case to the 4 96mm latice"

At 96mm the gap the shape must centre in lies between two **populated** magnets; half a base step lands
back on one of them. Measured: `basePitchMM/2` gives a run of 2 at `[-72, 24]`, centre −24 — off. And
`pitchMM/2` gives `[-48, 48]`, centre 0. **Identical at 48mm, which is why the fault was invisible
until the input changed** — the exact failure class §4.3 exists to catch.

**9.4 — The shape hugs its points; the size is the engine's answer.** *DAN, 08-10*
> "it must hug 48mm x4 points"

A four-point layout is a **size** result, not a registration one. At 48mm the circle that hugs exactly
four points is 88mm; at 96mm it is 156mm. Choosing that size by hand and reading it off the canvas is
the engine's job undone.

**9.5 — 9×9 and four-point centring are mutually exclusive.** *DERIVED from 9.2 — OPEN, see O-D*
Gap registration produces an even run; nine is odd. A field spanning nine positions carries **eight**
magnets under gap registration. Adding a tenth row to make the number read nine is tuning the display
to hide the law, and is forbidden — but which of the two Dan sees is his ruling, not a derivation.

---

## 10 · The guard

**10.1 — Law values are sealed, touched once, and guarded at two levels.** *DAN, 08-10*
> "we dont need sliders these must be admin sealed values touched onece - so make an expandale menu
> with value input fields and lock/unlock function for each so they are not changed accidentally and
> make it lockable in code as well so they are never under risk of being changed accidentally - we
> need the guard"

> "the pop up or drop down menu must show each entry and lock sign i can unlock and change value"

Code-level seal always wins over the surface lock. A refused write returns the spec **unchanged plus a
reason** — refusals are visible, never clamped and never swallowed.

**10.2 — ONE writer. No exceptions, no side doors.** *DAN, 08-10*
> "Every write to a law value goes through the one guard."

*(A second writer that bypasses the guard while the surface still labels the value "sealed" is a
contradiction on the surface Dan tests, not a convenience.)*

**10.3 — A number with no author is not law.** *DAN, 08-10*
> "tolerance 0.05mm - who invented this?"

A literal read out of engine source and written back into a law book as a "measured fact" is still a
literal. It may not sit in the released spec, and it may not be presented as canon. If a real
manufacturing tolerance exists it comes from the factory, with provenance.

---

**10.4 — There is NO tolerance. Everything sits on exact sizing.** *DAN, 08-10*
> "tolerance is not required, it affects nothing, we have no tolerance, everything must sit on the
> exact sizing"

**Supersedes v1 fact F11 entirely.** `toleranceMM` is struck from the spec, the guard, the released
values and the panel. No quantum, no rounding allowance, no epsilon dressed as law. *(F11 was itself
the defect named in 10.3 — a source literal promoted to a "measured fact" by being read back.)*

**10.5 — The field's size is a law input, not an engine constant.** *DAN, 08-10*
Rows and columns (`positionsPerAxis`, released at 9) are a released, guarded value the admin can edit
through the one writer — not a number the engine holds. *(This is 1.1a applied: a value in the engine
was the engine holding a value of its own.)*

**10.6 — PADDING IS 12mm. THE SYSTEM STEPS IN 12mm ATOMS.** *DAN, 08-10, LOCKED:*
> "12 mm agrees with the grid better cause it is like 16px REM standard in the web dev - we have 12mm atom
> the entire grid steps in that size"
>
> "decided for 12mm padding - locked decision"

**Supersedes the inherited v1 law 2.1 (10mm from the magnet centre, 20mm spot).** Padding is **12mm**, so
the spot is **24mm** — exactly half the 48mm pitch.

| | | |
|---|---|---|
| padding | 12mm | **1 atom** |
| magnet spot | 24mm | 2 atoms |
| half pitch | 24mm | 2 atoms |
| pitch | 48mm | 4 atoms |
| sparse pitch | 96mm | 8 atoms |

**Consequences, measured before the decision:**
- The rectangular ladder becomes 72 · 120 · 168 · 216 · 264 · 312 — **6 · 10 · 14 · 18 · 22 · 26 atoms.**
  At 10mm padding *none* of 68/116/164/212 was a multiple of 12, so the system had no common step at all.
- 12 is even, so a rectangular size **can never violate the whole-and-even rule** — publication has nothing
  to correct there.
- **Cost, measured on 8 random free shapes: 3 of 17 magnet positions lost (~18%), and every size grows 4mm.**
  Some free shapes will hold three magnets where 10mm would have held four. This was known and accepted.
- The atom does **not** reach round outlines — the diagonal carries the √2, so circles land on 92 / 160 / 228.
  That is correct, not a compromise (see 12.3a).

**10.6a — THE CELL IS THE MODULE. The frame is integer arithmetic, not floating point.** *DAN, 08-10:*
> "we moved to 12mm even to create each magnet as grid cell that matches the steps of the grid - 24mm
> two cells create 48mm single 4 point square no gaps it is Lego essentially"

12mm padding makes each magnet a **24mm cell**, and the 48mm pitch is **exactly two cells**. Verified:

```
band   span      in cells    magnets occupy cells
  2     72mm   =  3 cells        1, 3
  3    120mm   =  5 cells        1, 3, 5
  4    168mm   =  7 cells        1, 3, 5, 7
  5    216mm   =  9 cells        1, 3, 5, 7, 9
```

Every band is an **odd** number of cells — `span = 24·(2n−1)` — so a middle cell always exists, the
centre lines of 3.1e fall on it, and magnets occupy **alternate cells**. **Registration is therefore not
computed at all: it is which cells are occupied** (9.2 restated in whole units).

**This removes the floating-point failure class from the frame.** *(Measured instance: the defect that
lost the canonical 2x2 was a magnet clearing by 0.007mm — a float knife-edge. In cell units there is no
margin to be on the wrong side of: three cells, magnets at one and three.)* The outline remains
continuous, so the hold test still measures true distance (11.1) — but the band, the magnet positions
and the registration are integers.

**Round outlines stay off the cell** by the √2 of the diagonal (91.88mm = 3.83 cells) — correct, and
already covered by 12.3a.

**10.7 — Size 1 is silent.** *DAN, 08-10*
> "silent size is number 1 it can be coded in too we just not gonna show it in the ui selector or default
> minimum untill product eveolves to need it"

The ladder is **coded from one magnet upward** so the arithmetic is continuous, but the selector offers only
**2, 3, 4** — the product range. A single magnet lets the shape pivot (11.3) and is never offered. It exists
so that a later product needing it requires no change.

---

## 11 · The pair — the unit of measure

**11.1 — THE PAIR IS THE ATOM.** *DAN, 08-10, verbatim:*
> "pair is the unit of measure here"
>
> "Pair means shape must be minimum 20mm thick and 68 mm tall. And at those node points 48mm apart each
> shape must have material on the inside to capture 20mm circle. Period"

*Stated at 10mm padding. **Under the locked 12mm (10.6) the same rule reads: minimum 24mm thick and 72mm
tall, capturing a 24mm circle.** The rule is unchanged — it is 2×padding thick and pitch+2×padding tall —
only the value it resolves to moved.*

**The whole test is one thing:** at both nodes, is there material holding the full 20mm circle. The 20mm
thickness and the 68mm length are not separate checks — they are what that test *means* geometrically.
Verified at the limit: 20 x 68 holds; 19.9 wide fails; 67.9 tall fails.

**11.2 — Everything is pairs about the fold, optionally plus a centre.** *DERIVED from 11.1 and 9.2*
A pair straddles the fold; a centre point sits on it. So the fold's position is not a rule to apply — it
is simply whether a centre exists. **This generates the entire published ladder and nothing else does:**

| pairs | centre | across | fold | square | circle |
|---|---|---|---|---|---|
| 1 | no | 2 | between | 72 | 92 |
| 1 | yes | 3 | through | 120 | 160 |
| 2 | no | 4 | between | 168 | 228 |
| 2 | yes | 5 | through | 216 | 296 |
| 3 | no | 6 | between | 264 | 364 |

*(at the locked 12mm padding — 10.6)*

**11.3 — One pair is the floor.** *DERIVED from 11.1*
Below one pair there is a single magnet, and a single magnet lets the shape pivot. Any product must hold
at least one pair, so at least one axis must reach **72mm** at 48mm pitch (**120mm** at 96mm).

**11.4 — The arrangement follows the shape's own form.** *DAN, 08-10*
> "If shape is narrow it uses minimum 1column of 2rows if normal closer to square or circle 4 minimum
> L shape by definition will have 1 + 2 - as well as any triangle"

*Measured, and it needs no shape classification: given a 2x2, an L-shape drops to 1+2 by itself because
the fourth position has no fabric under it. Nothing anywhere names an L, a triangle or a tower.*

**11.5 — The variants come from the internal guaranteed area.** *DAN, 08-10*
> "From here variants can be built of the shapes internal guaranteed area and dimensions"

The guaranteed area is the shape reduced by the padding — the region where a 20mm circle can sit. Its two
dimensions generate every arrangement the shape supports. Past that point the outline's form no longer
matters; only what it guarantees does.

**11.6 — Size is set by edge-to-edge matching.** *DAN, 08-10*
> "The size is determined by edge to edge optimal matching"

Every edge of the shape and every magnet form a pair of constraints; the tightest demand sets the size.
One pass, no search. **The binding (edge, magnet) pair is also the answer's explanation** — the engine can
always name what set the size.

---

## 12 · No size inputs

**12.1 — NO SIZE INPUT MAY EXIST.** *DAN, 08-10, verbatim:*
> "No size inputs may exist"
>
> "there cannot be fail sizes it is not possible from the algorithm"

There is no cap, target, range or test size **inside the unit**. A shape is never "too small" — it scales
until it holds. *(Same defect class as 10.3/10.4: a number constraining the answer without deriving from
the shape or the grid.)*

**12.1a — This law binds the UNIT, not the admin shell. The ceiling and the admin size control are
correct.** *DAN, 08-10, ruling directly against a QA finding:*
> "these two are not slop they are correct - we just edit 10mm to 12mm it is not such problems as you
> theatrically state"

**Strikes the earlier derived clause**, which read *"Retires `maxSizeMM` from the spec and the size
control from the shell."* That was an inference, never Dan's ruling, and it contradicts 12.3 and 10.7:

- **`maxSizeMM` IS the ceiling of 12.3** — Dan's 9x9 cap, currently written in millimetres. The work is
  to express it as a **count**, never to delete it.
- **The admin shell is explicitly NOT the unit** (§1.1 — "scaffolding so you can test. It does not
  ship"). A test-size field on the scaffolding is not a size input to the engine.

*(Recorded because the struck clause produced the same false finding repeatedly, from more than one
reviewer. A derived consequence may never outrank the ruling it was derived from.)*

**12.2 — Size is the OUTPUT.** *DAN, 08-10*
> "Size is final value we manufacture form as dimension of the shape with locked aspect"

**The contract, both ends:** IN — the shape's form, the pitch, the padding. OUT — the manufactured
dimensions (one number, aspect locked) and the magnet positions. Nothing about size crosses inward.

**12.3 — The ceiling is a GRID COUNT, never a millimetre.** *DAN, 08-10*
> "Sizes in terms of max can be defined by max grid columns and rows covered by a shape in our case we
> create engine to match our 9x9 grid as max grid after we validate stable engine works we cap the grid
> to specific number"

**9x9 for now**, tightened once the engine is proven stable. *Measured: the old 310mm ceiling was exactly
7 across (308mm) — always a grid count in millimetre costume, which is why it never sat right. A 9x9 cap
reaches 404mm square / 564mm circle at 48mm, and 788 / 1108 at 96mm. Note the cap binds differently per
outline, and per pitch — it may need to be per-pitch rather than global.*

**12.3a — The atom is a consequence, never a requirement.** *DAN, 08-10*
> "fine circle can be 92 but we dont really care as we have grid led shape sizing and rounding system to
> the next even number that can be divided by 2"

Publication rounds up to the next **even** number. That a 12mm padding makes every RECTANGULAR size a whole
number of 12mm atoms is a consequence of the arithmetic, not a rule any shape must satisfy. A round outline
publishes at 92 / 160 / 228 — off the atom, and correct. **Forcing circles onto the atom would need a
per-rung fudge (4.12 / 8.24 / 0.35mm) — a lookup table, forbidden by 4.1.**

**12.4 — The handle steps the ladder; it does not set a size.** *DERIVED from 12.1, 12.2*
Dragging picks which arrangement, and the size is whatever that arrangement costs. A size that is not an
engine output cannot be reached, because no such position exists.

---

## 13 · THE METHOD — the product, end to end

**13.1 — THE METHOD, in Dan's own sentence.** *DAN, 08-10, verbatim:*
> "the method is > user defines locked shape > our grid engine under the hood produces the best sizing in
> the chosen band range > we tell user the size of the shape exactly on this basis but we need to be dead
> sure 100% mathematical certainty - so we do not change shapes for user we do not deform it sets the
> band we scale up or down to match the shape locked proportions to the grid band"

Read as a contract:

| | |
|---|---|
| **the user gives** | a locked outline — form only, proportions fixed |
| **the engine gives** | the size to manufacture, and where the magnets sit |
| **the engine never** | deforms, stretches, redraws or reshapes anything (2.1a) |
| **the only transform** | scale up or down, aspect locked (2.1) |
| **the standard** | 100% mathematical certainty — not "close", not sampled, not tuned |

**13.2 — ORDER OF OPERATIONS.** *DAN, 08-10, verbatim:*
> "the band is auto determined by the bounding box first  > after that we need placement with engine
> providing the coordinates"

1. **Band** — read off the shape's bounding box. Not chosen by a person, not searched for.
2. **Placement** — the engine returns the magnet coordinates.
3. **Size** — what that match measures, published under 12.2 and rounded under 12.3a.

**13.3 — The band is the STARTING POINT, and scaling fine-tunes from it.** *DAN, 08-10:*
> "we dont need to start with no size we defined our size bands already so the bounding box of the shape
> can be approximated at the starting point to classic size for example with the longest box side equal
> 96mm+24mm yeah? and after that the algorithm can just gne tune using the candidate algorithm or mirror
> (correctly formulated) and scale the shape to cover the grid"

**Both halves are binding.** Seeding at a band without the scaling step leaves a shape sitting at an
arbitrary size, which is how "band 2 holds nothing" appears — a fail size, forbidden by 12.1.

**13.4 — HOW THE BUILD IS JUDGED.** *DAN, 08-10, the build directive, verbatim:*
> "build the algorithm for the engine and test it - use /o-necessity and /o-deslop and remember to apply
> our laws and decisions so you do not drift in the 102 time to measure against sizes and measure against
> coverage and symetry balance - test each band 2/3/4 --- no vibecoding on assumptions - consult the
> sources read the code and math text books and articles describing the metod and follow precise
> theory/formulas and methodology."

- **Measured on coverage and symmetry balance. Never on sizes.** No millimetre appears in a verdict.
- **Every band — 2, 3 and 4 — is tested and reported.**
- **Both necessity lines are required** (6.3), and the method is sourced (6.7), researched by the lane
  (6.8), on real shapes (6.10).
- **Precedence, from 3.1:** balance leads. Dan's own sentence makes coverage its consequence, not its
  rival — *"centering and balancing **so there is no flap** and assymetric free uncovered by magnets
  surface"*. A ranking that leaves either measure unable to decide fails this clause.

---

# OPEN

Nothing here may be decided by inference.

**O-B — Where does the admin canvas live?** A route inside the cutout worktree, or its own surface.

**O-C — Curve identity.** Carried forward from v1 unresolved: tessellation currently changes a discrete
outcome (a 124-point versus 240-point circle changes a 260mm layout from 18 to 22 magnets). Needs a
stability contract or a ruling on what the product definition is.

**O-D — Nine across, or four-point centring?** They are arithmetically exclusive (§9.5). Gap
registration yields an even run, so a nine-position field carries eight magnets; a magnet at the
centre yields nine but is the "1 point" layout Dan rejected. **Interim state: registration default is
back to `point`, so the field reads 9x9** — the four-point layout is something the engine SELECTS for a
shape, never the grid's standing state (§6.5). What remains open is what the admin surface shows by
default once the engine can select.

*v1's O3 is CLOSED by §3.1. O-A is CLOSED by §1.1a.*
