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
