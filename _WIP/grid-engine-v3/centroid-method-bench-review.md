# Centre-method placement solver — QA handoff

Snapshot: `af3268c9` on `session62-task/grid-centroid-method-bench`, based on cleanup snapshot `748f3e99`.

## Delivered

The admin bench now runs the same traced outline through six centre constructions:

1. axis-aligned bounding-box centre
2. minimum-area oriented bounding-box centre
3. polygon area centroid
4. perimeter-weighted boundary centroid
5. vertex mean
6. maximum-clearance interior point

For every method it computes bands 2, 3 and 4 end to end:

- derive point/gap registration from band parity;
- generate the actual populated lattice positions, including the accepted asymmetric 96mm thinning;
- scale about the selected centre without rotation or stretching;
- require every complete magnet support disc to remain inside the silhouette;
- exhaust every publishable even size from the unit-owned minimum through the released ceiling;
- return the first lawful size without assuming containment is monotonic;
- report minimum support clearance and clearance spread as raw comparison evidence;
- return no answer when no lawful size exists.

The result matrix appears below the existing admin controls. Each lawful answer is clickable: it
selects that centre, applies the computed parity registration through the guard, and sets the exact
computed size on the live canvas. No method is promoted to a production default and no cross-method
winner is manufactured; the still-unruled product weighting between coverage, balance and size is
kept out of the computation.

Oriented-box remains available for a possible future rotation mode but currently translates only.

The shape remains fixed and fully framed when methods change. The selected centre moves the lattice
under it and composes with manual grid pan. Real-image testing caught and removed the earlier wrong
integration, which translated and cropped the artwork instead.

Lead's non-gating review input exposed two further defects, both reproduced and fixed before Meta QA:

- the search stopped at obsolete `maxSizeMM=310`; it now derives the 9x9 base-lattice field ceiling
  (408mm) from `positionsPerAxis`, `basePitchMM` and padding;
- the solver scaled the traced outline to the requested size while the UI resized the image box to
  that size. Transparent margins made the computed and applied geometry different. The solver now
  searches the exact box-longest-side quantity that the UI publishes and applies.

An unrecognised centre-method string now throws instead of silently running maximum-clearance.

## Independent checks requested

Attack these specifically:

- full 24mm-disc containment, not centre-point containment;
- actual 48/96 lattice coordinates and parity registration;
- concave shapes where legality can enter and leave as size grows;
- winding invariance and asymmetric/hollow outlines;
- click-through agreement between result, selected method, size and visible placement;
- absence of a hidden winner/default or invented coverage-balance weighting.

## Builder evidence

- Grid-engine suite: 33/33 passed.
- TypeScript: passed.
- Scoped ESLint: passed.
- Production Next build: passed; `/grid-engine` generated.
- Square controls: bands 2/3/4 resolve to 72/120/168mm.
- Input mutations: padding 6/18 resolves band 2 to 60/84mm; 96mm thinning resolves to 168mm on
  the unchanged lattice rather than silently recentering its surviving points.
- Asymmetric L fixture: box band 2 resolves to 216mm; area resolves to 138mm.
- Narrow unsatisfiable fixture returns no answer.
- Live alpha L-cutout: five balance-like centres have no lawful B2/B3/B4 under 310mm; maximum
  clearance resolves B2=160mm and B3=266mm. Clicking B2 visibly applied max-clearance, gap
  registration and 160mm on the real Grid Engine page.

### Real cut-outs through upload → tracer → solver → clickable placement

- `BOT.png`: B2 box 184, oriented 184, area 154, perimeter 144, vertices 150, maximum-clearance
  162mm. B3 266/266/228/226/226/278mm. B4 360/356/402/404/402/394mm. Smallest lawful B2:
  perimeter.
- `DUCK.png`: only maximum-clearance produces lawful answers: B2 210mm, B3 362mm. No B4.
- `BAT-WOMAN.png`: B2 box 258, oriented 260, area 258, perimeter 248, vertices 260,
  maximum-clearance 194mm. B3 perimeter 406mm and
  maximum-clearance 332mm; other B3 and all B4 have no answer. Smallest lawful B2: maximum-clearance.
- `BUTTERFLY.png`: B2 box 130, oriented 128, area 216, perimeter 154, vertices 158,
  maximum-clearance 208mm. B3 box/oriented/perimeter/vertices/max-clearance resolve to
  332/330/374/380/350mm; area and all B4 have no answer. Smallest lawful B2: oriented box.

These real cases falsify a universal “smallest-size” centre: three different methods win that one
metric across four shapes. They do not settle product balance/coverage precedence; they provide the
live alternatives Dan asked to judge before any method is promoted.

Evidence:

- `_WIP/grid-engine-v3/evidence/centroid-methods/full-disc-comparison.png`
- `_WIP/grid-engine-v3/evidence/centroid-methods/solved-max-clearance-b2.png`
- `_WIP/grid-engine-v3/evidence/centroid-methods/real-bot-{matrix,solved}.png`
- `_WIP/grid-engine-v3/evidence/centroid-methods/real-duck-{matrix,solved}.png`
- `_WIP/grid-engine-v3/evidence/centroid-methods/real-bat-woman-{matrix,solved}.png`
- `_WIP/grid-engine-v3/evidence/centroid-methods/real-butterfly-{matrix,solved}.png`

No push, merge, production default, automatic cross-method winner, or rotation behavior is included.
