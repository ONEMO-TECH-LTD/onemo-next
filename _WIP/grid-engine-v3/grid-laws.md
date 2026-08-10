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
