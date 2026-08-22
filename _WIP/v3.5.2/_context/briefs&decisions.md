# Tangency and scaling — briefs and decisions

Status: context record only. This file does not amend the v3.5.2 canon.

## Decision brief

The flap law and its exact-contact construction were settled before the v3.5.1 rebuild contract:

1. Flap `0` means exact contact between a perimeter-belt disc and the supplied outline. It is not blanket material coverage and it admits no hidden tolerance.
2. A configured flap allowance enlarges the permitted disc boundary by that exact amount. Fixed flap refuses a layout whose worst belt-disc requirement exceeds the allowance. Auto returns the smallest required allowance within its cap.
3. Tangency is constructed, not accepted approximately: solve the disc/outline contact equation and carry the resulting exact scale and `ContactWitness`. Rounded millimetres are display only.
4. Magnet-quantity scaling exposes one rung per new magnet count at the count's exact centred-and-wrapped contact scale. A count owned below does not repeat above worn loose.
5. Centre is the existing rigid base law. Wrap and scaling compose on top; they do not redefine Centre.

The exact Wrap law was implemented and independently QA+Meta cleared at product commit `2c043257a57bcc4184f90081f6b0f3c3e4706eb0`. Scaling was not implemented at that point.

## Verified decision lineage

### 18 August — tangency and band/count semantics established

- The released square standards were identified as `24 / 72 / 120mm`, with the shape outline tangent to the 24mm spot discs.
- Searching only 5mm or 1mm sizes was identified as the reason exact tangent sizes could be skipped.
- A band variant was reduced to a distinct magnet count at its snuggest size, with no repeated count in later bands.

Source: `__TRANSCRIPT VAULT/claude/s62/lead/2026-08-18/_day.md`, especially lines 3381–3581 and 4750–4785.

### 19 August — product meaning of flap settled

Dan's ruling at 18:32:

- zero flap is contact, not coverage;
- one edge contact is sufficient for a disc; square-corner pockets do not invalidate the fit;
- the flap allowance is an invisible margin around the discs;
- snapping travels between contact sizes, with one stop per magnet count/layout.

The same-day implementation demonstrated flap-0 rungs and allowance-shifted rungs, plus one-count-per-rung and cross-band suppression. The claim made that day that seat legality alone made a separate Wrap measurement unnecessary was later falsified: seating does not prove that every required belt disc obeys the allowance. That implementation shortcut is not authority.

Source: `__TRANSCRIPT VAULT/claude/s62/lead/2026-08-19/_day.md`, lines 1529–1604 and 1640–1665.

### 20 August — three-law product and exact contact construction settled

Dan's 10:31 directive:

- Centre rules already carried the first law;
- add only Wrap and Magnet-quantity scaling as equal sibling laws;
- scale only to the next magnet count that snaps while centred and wrapped;
- clone Centre rules into a third comparison mode before deleting anything.

Dan's 13:49 and 14:00 rulings made `0 = 0.000…`, `1 = 1.000…`, with no policy tolerance. At 14:37 Dan rejected the invented representability blocker. The correction at contract commit `3c18f6ee` was the lean construction:

- solve the contact equation for the rung scale;
- retain an exact root/contact witness;
- use the existing band walk only to discover reachable candidate counts;
- never let a size quantum or approximate gap decide the Wrap law.

Sources:

- `__TRANSCRIPT VAULT/claude/s62/lead/2026-08-20/_day.md`, lines 884–915 and 1381–1504.
- `__TRANSCRIPT VAULT/codex/s62/grid-qa/2026-08-20/_day.md`, lines 1140–1178.

### 20 August — identified scope expansion

After `3c18f6ee`, Grid-QA successively required:

- coupled Centre/scale regimes;
- proof that no narrow regime was skipped;
- all-root isolation including equal-end-sign and double-root cases;
- Centre-identity transitions;
- interval-Newton/Krawczyk, deflation and exact-resultant escape paths;
- proof that every earlier continuous candidate was absent or unlawful.

Lead incorporated each finding through `8d17780c`. The original 99-line plan at `452c1246` became 315 lines: 241 additions and 25 deletions. These additions strengthened the directive from exact accepted rungs to exhaustive mathematical completeness over the continuous scale domain. Dan did not require that stronger product promise.

Source: `__TRANSCRIPT VAULT/codex/s62/grid-qa/2026-08-20/_day.md`, lines 1159–1259.

### 21 August — exact Wrap closed independently

At `2c043257`:

- every required belt disc was measured against the complete supplied contour, including holes;
- flap `0` required proved exact contact;
- loose near-misses refused;
- all co-binding witnesses were retained;
- Fixed and Auto used the exact worst-belt requirement;
- Auto returned the exact minimum, not the cap;
- truth dots came only from stored witnesses;
- Centre remained frozen at zero and positive flap.

Source: `__TRANSCRIPT VAULT/claude/s62/lead/2026-08-21/_day.md`, lines 382–413.

## Current canon assessment

### Correct and retained

The current master contract correctly records:

- exact flap law and Auto minimum: `v3.5.2-master-contract.md:13`;
- exact new-count contact scale and no cross-band repeats: line 14;
- `ContactWitness`: lines 282 onward;
- fixed-size exact Wrap and witness-only truth dots: lines 399–407;
- T3 sequencing that freezes Centre, builds Wrap, freezes Centre+Wrap, then adds scaling: lines 865–880.

These clauses must remain.

### Over-constrained and not necessary for the ruled product

The current contract also requires:

- exact reconstruction of all Centre evidence through inward-offset arrangements, integrals and medial-axis certification: lines 616–627;
- complete six-family continuous regime decomposition: lines 629–642;
- a `FirstLawfulCertificate` proving every earlier regime/root candidate absent or unlawful;
- the surgical sub-plan's exact emulation of every transition in the frozen 2mm/800-point Centre mesh: `T3-surgical-execution-subplan.md:100–138`.

These requirements are the source of the scaling overbuild. They are not implied by exact flap contact. They convert “return the exact contact scale for each next lawful count” into “prove global absence over every real scale and every possible Centre/topology branch.”

The canon is also internally tense: the master exact-algorithm reference says no Centre mesh or decimation (`v3.5.2-master-contract.md:618–625`), while operative T3 freezes the 2mm `safeSegments` Centre baseline during Wrap/scaling (`:867–877`). The surgical sub-plan then adds a narrow precedence mechanism to reproduce that frozen mesh exactly. This is recovery complexity caused by the stronger proof demand, not part of the original three-law product decision.

## Lean scaling correction

The minimum complete product mechanism is:

1. Keep the Wrap-clear implementation and `ContactWitness` algebra unchanged.
2. Keep the accepted Centre implementation frozen.
3. Use the existing band walk only as candidate count/layout discovery. Its millimetre step is not contact truth and never certifies a rung.
4. For each newly discovered count/layout, solve the exact supplied-segment contact equation.
5. Re-evaluate the candidate at that exact scale with the frozen Centre/parity law and cleared exact Wrap law.
6. Accept only centred-and-wrapped candidates; retain their exact witnesses and every co-lawful layout.
7. Emit one rung per count and remove counts already owned by a lower band.
8. Derive Auto from the same exact worst-belt Wrap requirement.
9. Probe the real B1–B4 shapes for a missed count. Add a narrower discovery correction only if a named fixture proves one is missed.

The product promise should be:

> Each newly available magnet count is returned once across B1–B4 at its exact solved contact scale, with the accepted Centre result and exact Wrap witness.

It should not promise exhaustive proof over all continuous Centre/topology regimes unless Dan explicitly makes that a separate product requirement.

## Decisions for the next canon correction

- **KEEP:** exact supplied-boundary contact equations, Rational/Algebraic contact scales, `ContactWitness`, Fixed/Auto worst-belt law, co-binding witnesses, one-count-per-rung and cross-band suppression.
- **KEEP FROZEN:** Centre rule/governor/parity behavior and the Wrap-clear result.
- **REMOVE FROM REQUIRED SCALING AUTHORITY:** full continuous Centre reconstruction, universal regime completeness, all-earlier-candidate proof, general topology/resultant/RUR/certificate platforms and exact reproduction of every frozen-mesh transition.
- **RESTORE:** `3c18f6ee`'s separation between candidate discovery and exact contact truth—discovery may search; the law is decided only by the solved contact scale and exact re-evaluation.
- **MEASURE BEFORE ADDING:** any claimed missed-count or narrow-regime failure on real B1–B4 product shapes.

Necessity: shrink the global Centre/regime proof programme; every retained element directly serves Centre, exact Wrap, exact rung construction or count ownership.

Sufficiency: the lean mechanism delivers the three ruled laws in full. Its only open empirical risk is candidate discovery missing a real count; that risk requires a measured fixture before additional architecture is authorized.
