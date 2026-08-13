# Band 1 — 24–72mm · one magnet — RULED (Dan, 2026-08-13)

**The expected result:** the single disc sits fully inside the TOP half of the shape, tightly
wrapped by the material. On the duck: the magnet in the HEAD at 60mm, the head enclosing the disc
nearly edge to edge.

**Why, in law (L20):**
- **Gravity** — a hanging effect must not be held only low with the top unprotected; with one
  magnet, the top half holds "and will not unstick".
- **Tight wrap** — among placements satisfying gravity, prefer the size with minimal flap around
  the held disc. The duck head wrapping the disc is the canon picture.

**The screenshots:**
- `expected-60mm-head-top-tight.png` — CORRECT: 60mm, one magnet panned into the head, top half,
  tight wrap. This is what the engine must PROPOSE on its own.
- `engine-wrong-96mm-centred-head.png` — WRONG (the engine's first green as built, 2026-08-13
  morning): 96mm before anything holds, because the only candidates were centred templates and the
  duck's centre is the neck pinch. At 60mm it reported "0 magnets held" while the head placement
  plainly fit — the candidate set was too small, not the maths wrong.

**Engine consequence:** candidates are EVERY window placement on the lattice (every sub-window at
every offset, deduped by held set) — enumeration precedes selection.
