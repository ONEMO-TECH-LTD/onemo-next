# Step 1 and Step 2 — Dan's directives, verbatim

Collated 2026-08-31 at Dan's instruction. Required sources: the s62/lead transcript-vault day-files
for 2026-08-30 and 2026-08-31. Blocks not marked **source gap** match those files after whitespace-
only wrapping. Blocks marked **source gap** were supplied as Dan quotes in the first version of this
sheet but do not occur in either required day-file; they remain visible and cannot govern a CLEAR
until their source is recovered or Dan confirms them. My gloss is marked `→` and is not Dan's.

**This sheet is the scope. A QA gate is scoped to this file, never to a diff.**

---

## STEP 1 — the classifier, the lookup, and the canon into the sweep

### 1.1 · The task, as first given (2026-08-30 15:12)

> "ok focus what is the smallest work now we are entering 3day attempt to just add few additions to
> fine tune current pipeline - i am getting real tired and your endless qa and attempts to build it
> is fucking slop initself. i need the engine post load to size the shape for each mid range value
> in each band and define the class for each and center it after that we feed it into the band
> module and band module must get recommendation from the classifier of optinmal layout to try
> first from the canon using same sweep and full thing and also try next best min magnet count in
> the range and max - if they coincide or anything coincides we show only the single result optimal
> and next best or optimal only"

> "this is task"

### 1.2 · Restated (2026-08-30 15:44)

> "the very first task is actually having the classifiewr loading the shape and identifying the
> class in each band mid trial size and classing them after that centering and the rest - offering
> band sweep the optimal layout first and asking it to get min and max as well"

### 1.3 · The classifier knows NO COUNT (2026-08-30 16:18)

> "classifier must know no count at this step it must just send the sweeper the outter/inner box
> dimensions and in each band - and the look up must digext it and return the optimal layout in
> that band - after centering baked that count is applied as first try in the band sweep using same
> mechanism only and fine tuned scale to make the shape wrapped the grid optimal lyout and if some
> of the magnets fall off it must either scale or shrink to it."

Also (2026-08-30 16:11): counting positions is not the classifier's job —

> "why are we talking about positions whn we are matching the boxes it is not layout stage and
> fitting layout or slicing anything inside this si job of the sweep and band module is it not? and
> wrap module as well"

### 1.4 · The canon is a forced candidate through the SAME sweep (2026-08-30 17:47)

> "i think we are missing the point the engine sweep is correct engine - we are making this optimal
> and min/max to make sure nothing falls through the cracks and optimal must be just forced layout
> that needs to be processed by sweep logic and wrap like anything else fed into it from sweeping
> every 1mm -"

### 1.5 · Wrap is untouchable; wrapping is a RULE not an option (2026-08-30 17:44)

> "ok the wrap can be untouched but the wiring and new scoring may appear that makes it inactive
>
> also what is the optimal logic here and how is it calculated? '/Users/daniilsolopov/Downloads/Screenshot 2026-08-30 at 17.39.47.png'i can see segmented 2 zones and centering but it must provide the fewest option that wraps - so wrapping is not optional it is rule in the formula
>
>
> another thing , so optimal is not managed by the perimeter at all?"

### 1.6 · The rollback, and the scope law (2026-08-30 18:19, via the s63 handoff, verbatim)

> "roll back to the point we can safely call keeper and build canon route into the sweeper and let
> sweeper not run full guess work but fine tune it to fit simple as that the max and min wrap count
> are comparables as fall backs."

> "i actually by logic was forbidding you to build whatever is not mentioned it is not in scope and
> forbidden by default you only build the behavior i do ask not infer each attempt and build extras"

### 1.7 · Plug the canon in — do not give it its own path (2026-08-30, after three rollbacks)

> "i told you to wire directly and make canon just an anchor that plugs in the free search that
> fine tunes"

> "if we provide suggested layout as starting point for optimal search but keep the rest as is for
> the search what the minimum difference we need to make ?"

### 1.8 · Fit smart — not all magnets must fit

> "canon needs to be used as anchor for the search and optimal goal but it must try to fit the
> canon and not all magnets needs to fit we need to fit smart for example max count applied to the
> layout of canon and fit on that basis same max count logic only narrow focus - the max option
> outside of canon remains for optional comparative selection inside the canon we need to show the
> max count fit"

> "in this case - clarifying max count meansd the entire box of the canon applies only removed the
> magnets that do not fit so the optimal canon application will not jump to prior fewer columns or
> rows layout if the inner area and outter area fit the canon already ---- so max means keeping all
> rows and columns selective,ly ommiting areas where shape does not support"

→ **Source gap:** this second block is absent from both required s62/lead day-files.

### 1.9 · Naming

> "by the way you did again what i never asked and named against my will - i asked min and max -
> not fewest and most it is fucking idiotic to name them like that"

### 1.10 · The outer/inner ruler toggle

> "in this case we need to decide if we add toggle as well measurting by outter box or inner - i
> prefer testing both"

### 1.11 · Canon may step DOWN a band (2026-08-31)

> "Canon may come from lower band if none fit in proposed the current and prior band did not use it
> as well means the band la shifted due to mismatch of the shape bbox and actual internal structure"

→ **Source gap:** this block is absent from both required s62/lead day-files. The 2026-08-31 file
records Kai saying the ruling was given and later code/tests implementing it, but does not retain
Dan's own turn.

### 1.12 · Butterfly, as the worked example (2026-08-31)

> "Butterfly is the example here it is either 2x2 at B3 or 3 point upside down triangle or diamond
> wit no top - diagonal s with top 2 points and 1 at the bottom centered"

→ **Source gap:** this block is absent from both required s62/lead day-files.

→ **NARROWED in code if confirmed:** lower-band 2×2 is implemented; the 3-point triangle/diamond
alternative is not. The earlier canon-only rule and this later worked example conflict; presets
cannot be used as a silent reason to discard the more specific example.

### 1.13 · Earlier directives, with supersession stated

- **Superseded by 1.3 and the 16mm removal:** (08-30 00:05) "Repair classification — Derive the ordered grid frame from the union of live
  usable masses. Do not use outer shape bounds, governing mass, aspect ratio, or a 1–5 cap. Keep
  segmentation unchanged." The final classifier knows no count and sends boxes; the deeper mass
  probe was removed.
- (08-30 01:14) "turning what - lock canon without on page orientation remove orientation
  completely leave the locked orientation"
- (08-30 00:40) "check library paghe we have switch that turns lanscape and portrait and i said
  that those toggles must be separate layouts"
- (08-30 14:17) on the 16mm mass depth: "16mm is unnecessary addition invented by you week ago" /
  "remove it"
- (08-30 11:48) "it is mandatory protocol" — QA clearance is not optional on any fix.

### 1.14 · Library surface required by Step 1 — omitted from the first sheet

At 2026-08-30 19:20:

> "can i ask you something first the library ui now shows me flat no band selection only titles
> carrying the band and this is confusing for me also no separation to portrait and landscape it
> was simply removed - what i need is the same exactly ui separation between portrait and landscape
> returned to ui only no other code canges in the catalogue etc and duplicate same band panel that
> separates and filters results per band"

At 2026-08-30 19:35:

> "can we add the same to the library cannon clone legal area measurements"

---

## STEP 2 — the unprotected area, and the holding rules

### 2.1 · The rule, as given (2026-08-30, after the duck/bot screenshots)

> "one rule we need to implement as filter as well and enforcer is the unprotected area and also
> unprotected area holding preferences - means that in order of the general to more specific :
>
> 1. the perimeter side holds are prefered to centers
> 2. extreme apart sides must be held in preference to closest sides top and bottom of the
>    rectangle for instance in portrait and right left in landscape
> 3. corners are prefered to sides
> 4. top unprotected area is prefered to side - gravity law
>
> basically even distruibution with less unprotected areas further from the the protected area than
> 24-48mm is better to be protected and aligned to it especially top side cause the top will by
> gravity will unstick the effect with no magnets."

And the tool named:

> "there is also no indication that it need to force fit tha areasa that are kept unprotected and
> clipper 2 area substraction is out answer that provides answers or we need to build somenthing
> that understands that legal internal area has more than 24mm of grid space unprotected"

→ **Source gap:** this block is absent from both required s62/lead day-files.

### 2.2 · Toggles, and the sequencing

> "i would make it toggles on off and test the results like a filter indeed but first we need to
> actually make the canon wired properly - in this case we need to decide if we add toggle as well
> measurting by outter box or inner - i prefer testing both
>
> and we need to decide if we wire in the clipper 2 unprotected area defender that will enforce the
> filters above as step 2"

### 2.3 · Combined ordering, and gravity's "up" (2026-08-31 09:30)

> "1. I don't know what is the best way to? Just make them apply evenly when on it is on. What is
> the list now and how does it work now?
> 2. Yes"

→ *(2) answers "is the shape's top as drawn the top as worn?" — yes.*

### 2.4 · CORNERS ARE NOT VERTICES (2026-08-31 09:40) — the correction

> "Corners rule is not about the vertex it is about even and balanced distribution similar to
> extremes imagine holding shape like square the best hold in the corners not in middle of each
> side cause this keeps corners unprotected flap. If two top corners hold mid section will not
> flap. On free form shape same thing right and left sides of the top and bottom make it semantic
> corner analogue if the unprotected disk of its material is 24-48mm imagine head is f the batwoman
> it is narrow the top when it is around 24-48mm thick is fine and can be held by one magnet disk
> when it is larger though it becomes more than that an we need to hold it wit min 2 magnets
> ideally side extremes closer to the top - corners. Do you understand the difference. So
> essentially one rule can apply this one any other rules are weaker products of it extreme sides
> is fall back, perimeter is also product of it that makes indirect focus evenly pinning edges
> including corners the priority. Top gap is just same thing we need to pin top to make it hold and
> corner rule here applies and 24-48mm unprotected area is detector"

### 2.5 · Every filter gets a toggle (2026-08-31 09:43)

> "I need toggle for ech filter"

And later, on being asked once too often whether one could be removed:

> "Stop asking me if toggles stay are you doing it in obsession to leave at least something undone
> that depends on me? Toggles all stay I need them. We are building them now why I need to remove
> or delete them?"

→ **Source gap:** this later block is absent from both required s62/lead day-files. The verified
direct instruction immediately above still requires a toggle for each filter.

### 2.6 · The one law as toggle 5, and BALANCE as an enforcer (2026-08-31 09:53)

→ **Context Dan upheld, from Kai at 09:41 (not Dan):** “walk the material's boundary; wherever an
unheld run exceeds one disc's reach, that run needs holds at its extremes — and score an answer by
how much of the boundary is left in runs longer than that. One measure, one toggle.” Without this
proposal, “Your proposal ... is upheld” does not identify what Dan approved.

> "Your proposal to create one rule is upheld do it. But keep the rest for comparison it will be
> universal toggle 5 so that we test what works best.
>
> One more thing the unprotected area must also work with centering for example not in B2 now puts
> 2 magnets to the left side keeping right unprotected. Means centering in the shape would make it
> hold better - we protect top and bottom extremes in the center. This may show left and right
> still slightly unprotected. The balance is if either option provides unprotected result we must
> choose centered even though it is also resulting in unprotected sides we cover extremes rule and
> balance here one large flap remaining lopesided is worse 2 small on each side so centering must
> be also enforcer"

### 2.7 · The UI (2026-08-31 10:14)

> "i do not see the toggles anywhere i see squashed new panel and it is embarrassement that this
> even exist who do you think you are? '/Users/daniilsolopov/Downloads/Screenshot 2026-08-31 at 10.12.22.png'
>
> i need same as centering well build ui on the left side of the panels not text squashed"

> "i need toggled short lables that are blue when on and grey when off"

→ **Source gap:** the short-label/colour block is absent from both required s62/lead day-files.
The verified UI block requires the left-side Centering structure; Kai's later live report records
grey-off/blue-on as built evidence, not as a retained Dan turn.

---

## STANDING LAWS quoted across both steps

- **Only what is asked.** "you only build the behavior i do ask not infer each attempt and build
  extras" · "whatever is not mentioned it is not in scope and forbidden by default"
- **No inventions.** "what we do not need is anything that is invented just on a whim and not
  /o-necessity" · "dude i dont need inventions read the nfucking code base comprehend how it works"
- **Read the code, not my notes.** "do not confuse my notes and status claimed there to current
  state read the codebase" · "read codebase first no assumptions from snippets"
- **QA is mandatory.** "it is mandatory protocol"
- **Precision or stop.** "You must not code opposite or shifted meaning based on my directive it is
  either that precision or you stop. No other code required and functions besides. Only what is
  asked"
