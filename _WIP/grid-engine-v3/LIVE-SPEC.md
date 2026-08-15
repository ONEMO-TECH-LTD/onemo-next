# Live engine spec — what the running unit actually uses

Snap-44. Values from `src/lib/grid-engine/spec.ts`. Policies from `select.ts` + `candidates.ts` + `enumerate.ts`. Fit from `measure.ts`.

This is the implemented feed, not a wish list.

---

## 3 — Locked inputs

| Key | Value | Seal |
|---|---|---|
| Lattice pitch | **48 mm** centre to centre | Sealed in code. One lattice. |
| Sparse populate | **96 mm** = every second 48 mm point, same origin | Released option (48 or 96). |
| Disc radius / padding | **12 mm** from centre | Open (admin). Fit = centre interior AND distance to outline ≥ 12. The 24 mm disc **is** the edge protection — no second inset. |
| Field | **9 × 9** seats | Open. |
| Ceiling | **310 mm** | Open. Generator stop. |
| Magnet bodies | 6 mm and 8 mm | Display only. Fit uses the 12 mm radius. |
| Registration default | `point` (a seat on the shape centre) | Released option: `point` or `gap`. Origin of a candidate overrides this per hold. |
| Band size labels | 24–72 / 72–120 / 120–168 / 168–216, **12 mm** steps | Values only. Band does not name the arrangement. |
| Origins searched | 16 seats: 0,12,24,36 mm on each axis (the 12 mm pack). Band 2 also binary-searches the first millimetre a 48 mm pair fits. | |
| Shape scale | Uniform about bbox centre. Longest side = candidate size. | |
| Anchor | bbox centre | |

Write path: `applyGridValue` / `selectPitch` only. Sealed keys refuse every runtime write.

---

## 1 — Math and compute

1. **Scale** the outline so its longest side equals a candidate size.
2. **Lattice** = `origin + n · 48` inside the 9×9 field.
3. **Disc-fit** (BigInt µm, even-odd interior, exact `cross² ≥ r² L` on edges). A site holds iff the 12 mm disc is inside.
4. **Collect** at every 12 mm band size × 16 origins: singles, runs (including diagonal), rectangle-corners, utmost triangle (apex + two base corners). No T, no full windows (those froze the tab).
5. **Band-2 wrap**: smallest millimetre in 72–120 where two 48 mm-neighbour discs hold; emit that off-ladder size.
6. **Propose** ranks the band’s candidates. First pick is index 0. The rest stay on the stepper.

No solve on pan. Pan is a 1 mm shift of the drawn lattice. Band click and stepper reset pan to 0 so the candidate’s own origin is the lattice again.

---

## 2 — Judgement (first pick)

Gravity first (a disc in the top half). Then the band’s arrangement. Then tight wrap. Then centre.

| Band | Arrangement | Then |
|---|---|---|
| 1 | One disc | Smallest size, then clearance nearest 12 mm (flush — the disc already is the pad). |
| 2 | Pair that reaches top and bottom thirds | **Centre of the pair = centre of the shape** (within 12 mm), then smallest size. A lopsided tight pair loses to a centred one. |
| 3 | Extreme hold that covers both masses: 4-corners if they exist, else the 3-corner utmost triangle | **Tight wrap**: first millimetre those four discs hold (not the next 12 mm ladder). Then flush to 12 mm, then centre. |
| 4 | Same class, at least **24 mm** above the band-3 wrap (one cell). Larger hold area wins when it exists. A head-pair four outranks a 3. | Then tight wrap, flush, centre. |

No shape names. Duck gets 4-corners because they cover both masses; bat-woman stays on the 3-corner until a head-pair 4 fits in band 4.

Tight wrap means: do not leave extra material around a hold that already fits. Clearance 12 mm is legal-and-flush. Extra millimetres are flap.
