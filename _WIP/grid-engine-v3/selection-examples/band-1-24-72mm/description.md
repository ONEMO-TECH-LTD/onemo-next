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

## The full B1-1MAG set (Dan, 2026-08-13 12:36–12:37, all at 60mm, all panned placements)

Every shape gets its one-magnet answer at 60mm. The engine's centred candidate (dashed ring) fails
on every one of them; the correct placement (solid disc, panned by Dan) exists on the same lattice:

- `expected-60mm-head-top-tight.png` — **DUCK**: the head, top half, tightly wrapped.
- `expected-batwoman-60mm-head-top.png` — **BAT-WOMAN**: the head/upper body, top half — gravity's
  preference where the material allows it.
- `expected-poke1-60mm-head-centre.png` — **POKE1**: the round head-centre — the disc sits fully
  wrapped where the shape is widest.
- `expected-butterfly-60mm-body.png` — **BUTTERFLY**: the body between the wings — the only region
  that takes a full disc; availability overrides the top preference when the top cannot hold one.
- `expected-pill-60mm-centre.png` — **PILL**: the centre of the diagonal capsule — fully inside,
  wrapped by the width.

**The reading across all five:** the single magnet sits FULLY INSIDE the material, top-biased where
the shape offers a top hold (duck, bat-woman), and at the widest full-disc region otherwise
(butterfly body, pill centre, poke head). Gravity is the preference, availability is the constraint,
tight wrap picks the size.
