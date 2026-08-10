# GRID ENGINE v3 — BRIEFS
### Dan's directives, in his words, with the date he gave them · append-only

> This file preserves **what Dan asked for**. The companion [`grid-laws.md`](./grid-laws.md) is what the
> **engine must obey** — law is distilled from here, and a law disputed there is settled here.
>
> **The v1 grid law book still applies in full** — Dan, 2026-08-10: *"plus our law book is still applies
> from the grid-lab v1"*. Its location:
> `onemo-ssot-global/.claude/worktrees/s59-grid-law-main/_ssot-workbench/_briefs/grid-laws.md`
> (1,644 lines, 3 Aug 20:43) with its own companion `briefs.md` (1,704 lines).

---

## 2026-08-09 — the pivot back to v1, and what the engine must be

**On the v2 rebuild:**
> "v2 engine is slop and cancelled - i dont know how and what transcripts you read - were going back to
> the v1 not v2 - v2 is not it it is slop - i told you i need v1 of grid lab 1-3 commits shy from the
> latest commit cause it preseved the working version"

**On the margin band — supersedes laws 2.6 / 2.7 for the size solve:**
> "margin offset is cosmetically wrong - scale is the only part must be applied"

**On what he actually needs:**
> "i need simple math engine that takes grid and scales the shape to wrap the grid"

**On the padding, correcting an oversimplification:**
> "it is not that simple read the law book we have the magnet padding as well of 10mm from center of
> each magnet"

**On the scope — and on being given opinions he did not ask for:**
> "the problem with both of you - i dont ask your opinion on building second grid-lab - i have precise
> request and narrow enegine need the grid-lab is prototype that has noodle soup inside i need small
> module computing the grid based on my law specifically for the cutoutlab shapes"

> "i build 100000 gridlabs untill i get it right"

**On judging the work after repeated failure:**
> "we need to learn what is wrong and confusing and soup and slop in cureent gridlab - i tested 40
> versions and none delivers what i asked - how do i judge that work ? trusting after 40 attepts of
> failure ?"

**On the yardstick — correcting an attribution:**
> "Where is where are never the yardstick yeah I already said it. I didn't know where you got it from
> and it was your understanding. It's not me."

*(Context: the agent had made Dan's published numbers — 68/116/164, 88/156/224 — the scoreboard, then
described that as something Dan had set. He had not. His own law already says a green square is
silence, not a pass.)*

**On the model to aim for:**
> "we need to simplify and almost train determenistic and logical model almost like determenistic ai"

---

## 2026-08-10 — the canvas, the field, and the balance law

**On the deliverable:**
> "we need to build canvas for this - it must be manufacturing precision SVG millimeter based engine
> grid-lab compressed simplified and corrected no slop no baggage - learning from prior mistakes -
> module that will adapt to any shape correctly and can be plugged in to the cuotut module as well"

> "we need to create infinite canvas that is based on the grid variations"

**On the field itself, with the Figma reference:**
> "i made the grid with 48mm columns and rows - magnetic points wrapped in 20mm frame and having 6mm
> and 8mm magnet circles inside"

*Figma: ONEMO DS v2.3.6, node `14247-29777`. Measured from the file — MAG cells step every 480 units
(48mm), each cell 200 units (20mm), **10 Figma units = 1mm**.*

> "if we use any shape it is clear what variety can be in there"

**On generating the sizes — the manual method to be automated:**
> "star can be positioned on 1 48mm column and 2 rows or 2x2 which is optimal the second 2x2 was
> scaled by eye - so we need system that makes sure the scaling happens to encapsulate at minimum
> viable size to grid"

> "star encapsulates 2x2 grid with breathing space to the edges - this is fine but not optimal"

> "the size of bounding box of the star is 228mm now"

> "look how close the edges of shape to gug the grid 2x2 - so in that case close to optimal is 162mm size"

*Measured from the Figma file: the star is 1620 units = **162.0mm**, 5 points, inner ratio 0.381966,
corner radius 9.2mm, rotation 0.*

**On the star being a stand-in, not a subject:**
> "this shows the logic not fucking design of the radius of the star- star is mock shape for demo it
> can be million others"

> "i am showing you manual work of how i would do this as human to generate sizes optimal to the grid
> scaling cutout shapes in locked aspect ratio to the grid"

**On shape-blindness and input-adaptivity:**
> "we need any shape x grid language in the engine and full logic be blind to prior sizes and shapes
> if i change the inputs to the grid spacing and margins the engine must be adapting to anything"

**On the architecture — the unit and its subs:**
> "now we need to use /o-necessity and /o-deslop to design the internal canvas tool for this first and
> build the clean engine module for pure computing with logic with all value math input variables that
> control and feed the engine as separate spec module - 1 unit 2 subs engine and logic system"

> "3rd is admin ui shel neutral canvas that has ui separate bridge that wires in the logic unit to
> drive the engine - ui is for admin testing - the grid engine unit with logic must be portable for
> later integration into cutout lab and web app"

**On balance and symmetry — the rule that decides which layout is right:**
> "what may seem logical on paper and mathematically correct may miss the law of balance and simetry -
> my examples are manual examples not pixel perfect - i showed exagerated space between edges and
> magnets and tight version with edges almost touching each magnet circle - --- the grid 2x2 must be
> centered and symetrical from each side of the shape plus follow logic of where material is and is
> not available - plus our law book is still applies from the grid-lab v1 - the gravity rules of
> magnets having support on the top side to hold top side and not make only 1 row at the bottom -
> centering and balancing so there is no flap and assymetric free uncovered by magnets surface -
> perfect shape x grid match is 4 points balanced and symetrically centerd on the shape"

*This is the answer to the question the v1 law book left open as **O3** — which lattice points a
population takes and where the lattice registers. It is a ruling, not an inference.*

**On working method:**
> "also do not rush building what i am not asking - think and talk to me and ask permission before acting"

> "talk to me and do only what i ask no building anything untill we align"

---

## 2026-08-10 afternoon — the canvas, the guard, the zoom, and the separation

*Source: `__TRANSCRIPT VAULT/claude/s62/lead/2026-08-10/_day.md`, read in full. Verbatim, chronological.*

### The viewport and the surface

**12:47 — copy the Cutout Lab's viewport, don't invent one:**
> "Make viewport fixed like I. The out lab exactly the canvas with magnets is infinite procedural in case we scale the shape in and out the canvas stays adaptable and shows more magnets the viewport just fix render window and can vas is like figma canvas in a way. Check cutout viewport logic"

**12:50 — mobile is the gate:**
> "Straight away try building the admin panel mobile first we are making it for mobile must be tested on mobile"

**12:56 — three corrections at once:**
> "why is it dark theme make it adaptable to the system and also why is it full screen - i asked to repeat cutout viewport and design for mobile specifically 402px iphone standard"

**12:58 / 13:07 — the canvas size, asked twice:**
> "the viewport is pretty match 402x402"

> "also did you see 402x402 viewport for the canvas message - focus ffs!"

**13:11 — responsive, with the ceiling from the design system:**
> "add spacing and make the page responsive dude - 402 is iphione standard that scales to the page fill height and max width of 800px or whatever it is in our design system"

### The guard — values are sealed, not tuned

**13:06:**
> "we dont need sliders these must be admin sealed values touched onece - so make an expandale menu with value input fields and lock/unlock function for each so they are not changed accidentally and make it lockable in code as well so they are never under risk of being changed accidentally - we need the guard"

**13:15:**
> "the pop up or drop down menu must show each entry and lock sign i can unlock and change value"

**13:17 — on an unattributed constant:**
> "tolerance 0.05mm - who invented this?"

### The canvas itself

**13:09:**
> "canvas must be clean from controls and labels"

**13:47 — the notepad's ink:**
> "5% visibility"

**13:32 — on repeatedly-ignored asks, and the field's limits:**
> "also fucking pay attention i give you tasks to do you ignore me - why nothing now shows what i asked above you basically did nothin in full that i repeatedly asked - notepad grid - zoom indicator of sizes and also now the the 9x9 grid is fit to the viewport we need to give it space make some padding same like 40mm each side so we can see that grid has limits and it is full zoom out scale"

**13:36 — the standing verification demand:**
> "i do not see the grid did you verify fully what you did in code and visually?"

### The field size

**13:20 → 13:21:**
> "if we set max 310 the canvas must show at least 48mm 10x10 points grid"

> "actually 9x9 is enough"

### 48 / 96 — one lattice, thinned

**13:24:**
> "48mm/96 mm does not work it must be removing points - skipping to show every second to match 96mm"

**13:26:**
> "so the 48mm/96mm swith keeps size of the canvas just hides 48mm distnce points and shows only 96mm distance so the grid will be 4 colums by 4 rows= 96mm grid =9x9 48mm grid"

### Zoom

**13:49 — one grid size per stop:**
> "make zoom to work showing only 9x9>8x8>7x7 etc with max padsding before next larger row shows up"

**13:52 — the shape never moves:**
> "zoom must zoom on the center not side ways the object shape is in center always"

**14:09 — zoom changes nothing about the drawing:**
> "also with zoom the circle proportions change - why ? the zoom is page view zoom nothing is influenced by it the circle must retain the scale"

**14:13 — the protocol violation named:**
> "i feel like the ui logic of zooming is influencing the math and grid itself --- you violated the protocol to solve and find short cut for ui zoom"

**14:15:**
> "make the fucking zoom - regular zoom"

### Registration — where the lattice sits against the shape

**13:54:**
> "however the 4 parts of 4x4 48mm points are not in the center so we need to adapt to each grid to make the shape center to the 4x4 or at least 1 column x 2 rows single 2 point"

**14:00 — the 96mm defect:**
> "wait it is fucking slop - how is it possible that you switch to 96mm and circle no longer has 4 points of 96mm that previously shown in the 48mm grid ? - the shape must be showing centered as in previous case to the 4 96mm latice"

**14:01 — the conditional offer:**
> "if we need to add 1row and column to make that work we can make the grid 10x10"

**14:03:**
> "but the fit button overrides it now and centers wrongly to 1 96mm ppoint and not the 4 96mm points"

**14:07:**
> "it must hug 48mm x4 points"

**14:25 — the default was never his to change:**
> "who gave you permission to change the default grid ?"

### The separation — ruled three times, tightening each time

**13:28:**
> "remember no logic in ui - ui can have separate logic file by necessity only the rest must be in the logic system sub module"

**14:15:**
> "stop wiring compute to logic layer and logic and compute to ui layer"

**14:17 — the four invariants, verbatim:**
> "The invariants that make it real, not a diagram:
>
> The unit imports nothing from React, Next, or a stylesheet — portability is testable, not asserted.
>
> The UI does screen maths only — pixels, camera, aspect. Never grid maths.
>
> Every write to a law value goes through the one guard.
>
> Direction of travel is one-way: shell → bridge → unit. The unit never reaches back."

**To @s62-meta — the split, ruled exactly:**
> "no math in the logic - engine has all compute - logic can hold and feed key values only and the rest of the logic bridging the engine to any ui or other modules with logic"

### Controls

**14:24:**
> "shape size can be slider as well and input field must react on enter post input"

### Review discipline

**To @s62-meta:**
> "i want you to monitor and verify each step - for the protocol of the sdeparation"

> "every qa must follow /o-necessity and /o-deslop discipline"

### Tolerance — struck

**14:2x — on the 0.05mm constant, after it was traced to an unattributed literal:**
> "tolerance is not required, it affects nothing, we have no tolerance, everything must sit on the exact sizing"

### Rows and columns are a law value

**14:2x:**
> rows and columns become a released, guarded law input — editable in the panel, not a constant in the engine

---

## 2026-08-10 · 14:5x — THE AUTOMATIC FIT BRIEF
*Dan, to lead and meta both. Verbatim.*

**On the state and what comes next:**
> "So do we have UI shell now and everything separated and ready to be endowed with logic and compute?
> And we need to understand how we're gonna do this."

**On the behaviour he wants — this is the product definition of the engine:**
> "if I, for example, place a shape and pull the kind of, like, imaginary handles to scale it and snap
> it to the edges to be snapped to the magnet, this is the behavior I want to have with any shape.
> whether it's geometric or other. So, basically, we need to first understand how to make it automatic.
> Yeah? Means that any shape will have the outline optimal, and we defined what optimal is."

**On how to answer:**
> "let's discuss how we can do it and do it without unnecessary fucking reporting or, you know, talk.
> Yeah? Just to the point how the math will work and how it will be automatic and fail proof."

**On not repeating the failure — the 130mm star as the named counter-example:**
> "I wanna repeat previous over engineering problems or previous failed attempts, I need either for you
> to come up with the compute arithmetics and detection, smart detection, which means that your previous
> attempt with hundred thirty millimeters on the star shape is the example of the arithmetic is not
> working if symmetry is not unbalanced, is not taken into account. So we need to take this into account."

**On prior art — research before inventing:**
> "if we have something that can be used and already built as a compute engine for this by third parties,
> as open source was something that is even not open source we can read and approximate and reuse for our
> own logic, then let's fucking do it. So we don't... so we get research as inspiration if no solution
> available, but we need to go online and research what it could be. because I'm pretty sure it's nothing
> difficult there. Yeah? Nothing that has not been invented already."

**Routing:**
> "this was meant to be to be sent to lead, and to be honest for both, to consider… you need to share
> this brief and save this brief to the briefs in linear and otherwise."

---

## 2026-08-10 · afternoon — DAN'S OWN MODEL. He derived it; it reproduces the canon.

**On the padding, reframed — the nodes come first, the magnets are incidental:**
> "what is the problem to think about 10mm as just padding for offset. If there was no magnets and padding there would be nodes 48mm apart in a lattice. The … connected nodes create shape geometrically if each line or node offsets outward it creates technical limits for any shape not to cross unless it snaps to the next available offset node point and line connecting nodes. So square fitting this will be calculated as 4 nodes connected - 48mm square offset by 20mm 68 square hugging the inner limits of connected nodes. Same for circle plus 10mm to the existing 10mm to account for radii of the circle making it 88mm circle. Free shapes and sticker outlines are complex shapes at first but internal limits of edges can be geometrically normalised to hold squares/rectangles and circles and ovals - and those are simple to calculate as above"

**On symmetry — it is a fold, not a detection:**
> "Symmetry is not a problem either it is folding the shape mid point 24 or 48mm depends on which grid dense or 96mm sparse - each side is mirror that can be individually treated left side can show 2point match and right side cannot we offset the side that does not fit till it does and bring the scale ratio to another side half way cause the center it will move shape to the side a bit"

**On the two folds:**
> "the mirroring top bottom and left right a can be adapted … calculating the scale % for each and normalising to the center to produced global %"

**On narrow shapes — the count adapts:**
> "not all will fit 4points in set size range if I want shape no bigger than 100mm for instance if it is narrow like 50 mm 4 points will not fit we use in this case 1 column not 2 and normalise and fold half on the longest axis vertical or horizontal only - this way 2 magnets 48mm or 96mm apart will be snug fit into the shape and hold it perfectly without need of 4magnets"

**On scaling up:**
> "Larger sizes will have more supporting grid points at the perimeter - for instance 120mm plus will have 3-4 grid points depending on on the 48-96mm layout so this logic scales same way"

**On density — this removes population selection entirely:**
> "Interior is not my concern we can produce full grid making sure the perimeter edges are held the inner points can be made to be ignored later or ignored at manufacturing selectively for now we use full grid density"

**On pace:**
> "One problem at a time"

---

*Verified by @s62-meta before recording. Dan's node-offset formula reproduces the entire published canon
from two lines of arithmetic — square `(n−1)·48 + 20` gives 68/116/164/212/260/308; circle
`(n−1)·48·√2 + 20` gives 88/156/224. The fold model was tested on a lopsided shape (70/90) and both
sides land exactly on target after scaling and shifting by half the difference. The narrow-tower case
was tested: 50mm wide under a 100mm cap gives 1 column × 2 rows on the 48mm grid, as he stated.*

**On the reverse construction — magnets first, shape second:**
> "In terms of logic as well as we inverses it we can reverse as well imagine magnetic grid with 4 points the 20mm circle (10mm from center ) padding — if center measured on the x and y axis of the circles each will produce boundary nodes for shape to touch"

> "On the outside top and side of the circle"

*Verified. For a SQUARE outline the outward top/side of each padding disc bind exactly: ±34 → 68mm.
For a ROUND outline they do not — a circle through those same points is 68mm and CUTS the corner discs
by 9.94mm; what binds a circle is the corner disc's outermost radial point, 24√2 + 10 = 43.94 → 87.88 → 88.
General form: the shape touches the outermost point of each disc IN THE DIRECTION ITS OWN EDGE FACES.
A square's edges face along the axes so top/side bind; a circle's edge faces radially so the diagonal binds.
Which point wins is decided by the outline, never chosen. Same four magnets, same four discs, outline
swapped: square 68 · circle 88 · 2:1 oval 144.9×72.4 · 3:1 oval 209.8×69.9 · triangle side 148.2.*

**On pace:**
> "One problem at a time"

> "Save the ideas all in the briefs file and let's brainstorm now how the algorithm in the simplest way can be implemented"

---

## 2026-08-10 · late afternoon — THE PAIR, AND THE END OF SIZE INPUTS

**On decimals — nothing fractional reaches fabric:**
> "it cannot cut by 9.94 it must not be possible to have uneven numbers we cannot cut decimals of fabric"

*(Context: the 9.94 was a counterexample showing why a square's top/side construction fails on a circle,
not a produced size. Confirmed: every shipped number is whole and even; the square never produces a
decimal at all, and only the circle does because a 48mm square's diagonal is irrational.)*

**On the count — the shape decides it, not a size cap. Meta was told this was a red flag:**
> "this is ambiguous! The shape siz is not dictated by input like 100mm grid dictates the size so you
> asking this is red flag of you understanding shit."
>
> "If shape is narrow it uses minimum 1column of 2rows if normal closer to square or circle 4 minimum
> L shape by definition will have 1 + 2 - as well as any triangle"

**On how size is determined — stated as already-repeated:**
> "The size is determined by edge to edge optimal matching I repeated it 100 times if this is not clear
> and you still posing open questions you must resign"

**On the unit of measure:**
> "You already came up with good method on the top of the inverse logic with nodes and mirror method -
> pair is the unit of measure here"

**THE PAIR, defined — this is the atom of the whole system:**
> "Pair means shape must be minimum 20mm thick and 68 mm tall. And at those node points 48mm apart each
> shape must have material on the inside to capture 20mm circle. Period"

**On generating the variants:**
> "From here variants can be built of the shapes internal guaranteed area and dimensions"

**On there being no such thing as a failing size:**
> "when you say fails means you have an option to set size freely - you can select range the size is
> calculated based on shape + grid matching - there cannot be fail sizes it is not possible from the
> algorithm. Is that clear. You keep fucking setting sizes when you must focus on the algorithm of shape
> and grid matching."

**The law, flat:**
> "No size inputs may exist"

**On what size IS:**
> "Size is final value we manufacture form as dimension of the shape with locked aspect"

**On the ceiling — a grid count, never a millimetre:**
> "Sizes in terms of max can be defined by max grid columns and rows covered by a shape in our case we
> create engine to match our 9x9 grid as max grid after we validate stable engine works we cap the grid
> to specific number"

*Measured: the old 310mm ceiling is exactly 7 across (308mm) — it was always a grid count in millimetre
costume. A 9x9 cap reaches 404mm square / 564mm circle at 48mm pitch, and 788 / 1108 at 96mm.*

**On pace and on documenting:**
> "One problem at a time"
> "Keep the briefs logged fill the gap between last brief and now read your transcript also extracts laws and spec as well"

---

## 2026-08-10 · evening — THE 12mm ATOM

**On quadrants, and on what the test actually is:**
> "each is quadrant is square - because shape has bounding geometric box still using geometry so breaking
> down the shape by squares as quadrants should work if we need we can equalise and make the padding 24mm
> half of the 48mm if it helps"

> "But we don't need the square we have nodes at the center of each cell that needs guaranteed padding of
> 10mm or 12mm"

> "12mm padding =24mm full magnet circle = cell"

**The reasoning — 12mm is the system's atom:**
> "12 mm agrees with the grid better cause it is like 16px REM standard in the web dev - we have 12mm atom
> the entire grid steps in that size"

**Set live in the panel:**
> "changed it in the locked padding now"

*Verified. With a 12mm atom the whole system is whole multiples of one unit — padding 1 atom, magnet spot
2, half pitch 2, pitch 4, sparse pitch 8 — and the rectangular ladder becomes 72 · 120 · 168 · 216 · 264 ·
312, which is 6 · 10 · 14 · 18 · 22 · 26 atoms. At 10mm padding NONE of 68/116/164/212 is a multiple of 12,
so the system has no common step. 12 is also even, so a rectangular size can never violate the whole-and-even
rule and publication has nothing to correct there.*

*Measured costs, stated plainly: every size grows 4mm, and across 8 random blobs 3 of 17 magnet positions
were lost (~18%). The atom does not reach the circle — its diagonal carries the √2, so round shapes land on
92 / 160 / 228 and only the third is a multiple of 12. No atom can fix that; the round-up rule covers it.*

*Cell-as-test was FALSIFIED and is not adopted: substituting a square cell for the circular spot disagrees
with the exact disc test on 4-5 of 8 blobs at 10mm padding, and still 1 of 8 at 12mm. The cell is the frame
— it fixes where nodes sit and gives the registration (node at cell centre = fold between nodes = even
count; node at cell corner = fold through a node = odd count). The hold test stays the disc, which is one
distance calculation and already free.*

**STATUS: 12mm is live in the running panel only. The released spec still says `paddingMM: 10`.
Making it law is a one-line change to the released spec, which is a build action and is HALTED.**

**On the circle landing off the atom — closed:**
> "fine circle can be 92 but we dont really care as we have grid led shape sizing and rounding system to
> the next even number that can be divided by 2"

*So the governing publication rule is EVEN, not atom. The 12mm atom is a CONSEQUENCE for rectangular
outlines, never a requirement on any shape. A round outline publishes at 92 / 160 / 228 and that is
correct, not a compromise. No attempt should ever be made to force circles onto the 12 step — it would
require a per-rung fudge (4.12mm, 8.24mm, 0.35mm...), which is a lookup table and is forbidden by 4.1.*

**LOCKED DECISION — 12mm padding:**
> "decided for 12mm padding - locked decision change the logic in laws and briefs and in the code"

**On the smallest band:**
> "silent size is number 1 it can be coded in too we just not gonna show it in the ui selector or default
> minimum untill product eveolves to need it"

*Applied: `paddingMM: 12` in the released spec; law 10.6 records the atom and the measured cost (~18% of
magnet positions on free shapes, +4mm on every size); law 10.7 records silent size 1. The pair's own numbers
move with it — minimum 24mm thick and 72mm tall, capturing a 24mm circle. The rule itself is unchanged.*
