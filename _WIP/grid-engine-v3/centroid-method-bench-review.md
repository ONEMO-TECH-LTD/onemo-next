# Centre-method placement solver — QA handoff

Snapshot: `b0869d56` on `session62-task/grid-centroid-method-bench`, based on cleanup snapshot `748f3e99`.

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

Evidence:

- `_WIP/grid-engine-v3/evidence/centroid-methods/full-disc-comparison.png`
- `_WIP/grid-engine-v3/evidence/centroid-methods/solved-max-clearance-b2.png`

No push, merge, production default, automatic cross-method winner, or rotation behavior is included.
