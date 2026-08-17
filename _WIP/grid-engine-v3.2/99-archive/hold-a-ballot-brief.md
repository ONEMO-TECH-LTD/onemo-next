# Hold A ballot — 27 decisions in plain language

Source: `DOCS/R3/00-system-contract` §15 (the register). Locked rows (your own words) need nothing. Every row below is yours to approve, amend or answer. Reply by PD number — "approve all Group A except…" works.

## Group A — proposed values, recommend APPROVE AS PROPOSED (18 rows)

These are the engineering team's concrete proposals. Each is reversible policy inside an immutable versioned profile — changing one later means a new profile version, not rework.

| PD | The question | Proposed answer | Why approve |
|---|---|---|---|
| 07 | Where exactly does one band end and the next begin? | Each band includes its lower edge, excludes its upper (B1 24–71.99, B2 72–119.99, … B5 216–264 incl.) | Every size lands in exactly one band; reference sizes start their band |
| 08 | What sizes does a customer get offered? | Steps of 12mm on the dominant side, 24–264mm | Finite, fast, matches the grid rhythm |
| 09 | Which size does each band show the customer? | The smallest accepted size in the band (rest kept in diagnostics) | One clear offer per band, nothing discarded |
| 10 | Is the board finite? | Internally unlimited; the editor shows a 10×10 chess-labeled window | Avoids edge bugs, keeps your chess-board UX |
| 14 | How far may the shape slide against the grid? | Within one 48mm tile around the centred start, per axis | One tile covers every distinct alignment; more is redundant |
| 15 | How is the final placement chosen? | Best mechanical placement wins; "closest to centre" only breaks true ties | This is the fix that protects your B1 head-anchor rule |
| 16 | How does the engine see shape structure? | The layered safe-zones method (12/16/20/24mm depth analysis) | Neutral geometry, no shape-guessing, filters ears/necks naturally |
| 18 | Which magnet layouts exist in v1? | single, vertical/horizontal pair, L, row-of-3, column-of-3, T, 2×2 square | Smallest set covering everything you demonstrated |
| 20 | The exact scoring rules (formulas, order, tolerances) | The 10-step table in the logic spec §11.2 | Your physical reasoning as executable math; canon-tested, QA-tested |
| 21 | Which way is "up" for gravity? | Editor-canvas up, fixed, not user-settable in v1 | Stable reference; revisit only if wearable orientation ≠ canvas |
| 22 | What happens with holes/multi-part shapes? | Rejected with a clear machine-readable reason (v1) | Honest rejection beats silently ignoring a hole. Letters/rings wait for v2 |
| 23 | How are circles banded? | By bounding box like everything else; actual fit decides lawful magnets | Preserves your "circles need padding" rule without special cases |
| 24 | Long/rectangular shapes? | Mixed frames (1×3, 2×3…) are first-class, per-axis slide | Required for your rectangle examples |
| 25 | Manufacturing coordinate precision? | 0.01mm | Fine enough for cutting, coarse enough for stable hashing |
| 26 | How accurate must the approximate math be? | Within a quarter of 0.01mm, always erring safe | Guarantees errors stay below anything manufacturable |
| 31 | Speed/size budgets? | Engine ≤250KB, full solve ≤16ms typical (hard caps 500KB/50ms) | Provisional gates the backend probe must beat; not shipping targets |
| 33 | What magnet data does fulfilment add? | Diameter, thickness, tolerances — only where they affect geometry/assembly | Keeps the engine pure, the physical spec complete |
| 37 | Does a square shape force 4 corner magnets? | No — band is capacity, not obligation; a square-boxed T can use a vertical pair | Matches your intent; the earlier language risked forcing 2×2 |

## Group B — open questions only you can answer (9 rows)

| PD | The question | My recommendation | What hangs on it |
|---|---|---|---|
| 04 | Does ONEMO actually have a 96mm sparse magnet grid as product fact? You never said it in this conversation — it came from carried-over context. | Confirm if real, else reject | If confirmed: which alternate nodes (PD-34); if rejected: rows retire |
| 17 | The numeric thresholds separating "structural" from "marginal" regions | Don't pick numbers now — authorize calibration against the Batwoman fixture + counterexamples, values return to you at profile approval | Wrong numbers = ears treated as anchors or shoulders ignored |
| 19 | Which layouts are allowed in which bands | Same: authorize a proposed matrix derived from canon, returned for approval | Determines what customers can get per size |
| 27 | A placement exists but is finer than 0.01mm precision — hide it, show as marginal, or refine? | Hide in v1 (simplest honest behaviour) | Edge-case UX only |
| 29 | The official Batwoman test shape | Export the outline from the Effects Studio and bless it; I handle intake | Unblocks the regression suite and threshold calibration |
| 34 | (Only if 04 confirmed) which alternate-node origin(s) are allowed | Defer until 04 is answered | — |
| 35 | Max outline complexity (vertex cap) and who simplifies over-budget shapes | Studio simplifies before submission; cap set from the backend probe's measurements, not guessed | Mobile speed guarantee |
| 36 | Is "B1 is always possible" a product guarantee for every shape? | Interpret as: B1 offered when a disc genuinely fits at a B1 size; extreme slivers may honestly start at B2+ | A universal guarantee would force distorted tiny offers |
| 38 | Is 12mm the clearance that must survive manufacturing tolerances, or nominal with accepted risk? | Post-tolerance minimum (safer product); needs your cut + placement tolerance numbers to compose the verification radius | Physical safety margin of every unit ever made |

## Not on your ballot

Backend choice (TypeScript vs WASM) — resolved by the measured probe after Hold A clears; you approve only the constraints it must satisfy (PD-31, already above).

## After your reply

Approvals freeze into the versioned `onemo-magnetic-v1` profile → backend probe runs → implementation begins. Unanswered Group B rows block only what depends on them; 04/34 and 27 could be parked without blocking the probe, but 17/19/29/38 sit on the critical path to a production profile.
