# v3.5.2-1 — synthesis of the three proposals (lead / grid-qa / grid-meta)

Author: s62-kai-lead · 2026-08-22 · status: synthesis for Dan; open challenge to grid-qa and grid-meta (§4)

## 1. Where all three agree — adopt as is

- Base `2c043257`: Centre frozen (6 modes, governors, parity, four placements), exact Wrap as cleared, isolated tab, module split, B1–B4. Nothing rebuilt.
- Remove from required authority: exact Centre reconstruction (§7.1b), regime enumeration (§7.2), `FirstLawfulCertificate` / proof that every earlier continuous candidate was unlawful, Support B, G1, resultant/RUR/certificate platforms, exact reproduction of mesh transitions, the `bandWalk` no-reuse row.
- Scaling mechanism (grid-meta §"Bounded scaling algorithm" = grid-qa §"Smallest complete build" = lead S1/S2):
  1. the existing walk discovers count/layout changes in increasing size, privately; it never certifies anything;
  2. for each new count/layout, solve the exact seat/contact root(s) of the binding belt disc(s) with the retained rational/quadratic kernel — that root **is** the "next number that snaps";
  3. re-run the frozen Centre/parity and the cleared full Wrap at that exact scale; accept only if the same count/layout is still lawful; if it changed, discard and keep walking — no cycle machinery;
  4. one rung per count; a count is owned by the band where it is first **accepted**, never by where it first seated; every co-lawful placement retained;
  5. Auto = the same exact worst-belt requirement, capped;
  6. worker stores the complete result once; UI shows the rounded scale, keeps the exact scale and witnesses.
- Denser-probe comparison on real shapes is QA evidence only; more discovery machinery needs a failing product fixture first.

## 2. What only the lead audit measured — add

| | Finding (measured on `2c043257`) | Addition |
|---|---|---|
| W1 | Seat legality quantises to 0.001 mm (donor `holds`); Wrap uses raw float bits. At tangency they disagree by ~1e-15: Weight mode squircle 72 at flap 0 is **refused live** (centroid 49.99999999999999); shape-library square 25 @ pitch 24 shows `requires −0.000000`. The peers' re-run-at-exact-root step does not remove this: the centre stays a float from the mesh. | **Dan ruling:** quantise *input* coordinates (contour points, centre, anchors) to 0.001 mm before all exact arithmetic — same quantum the seat predicate already uses. This is input representation, not a law tolerance: Wrap still decides at 0.000. |
| Cost | Exact Wrap per sampled millimetre takes 53/72/86 s per band on the squircle. | Float prescreen in the walk; exact Wrap only at solved roots. |
| Brief items no proposal covers | Gravity (vertical beats horizontal, ties returned) · manual-drag concessions (parityTrue, centreErrorMM) · B5 still in `BANDS` and on the tab · honesty note. | Four small edits (~50 lines). |

## 3. What to drop from the individual proposals

- grid-qa: "reject a detected cycle" stability machinery — grid-meta's rule (discard and continue; add only on a named fixture) is the necessary one.
- lead: "bisect on lawfulness" wording — superseded by the exact seat-transition root; the seat transition of the binding disc is the contact.
- all: `FirstLawfulCertificate` — a rung carries exact scale, layout, witnesses, band/count ownership; nothing else.

## 4. Open challenge to grid-qa and grid-meta — refute or concede, one line each

1. W1 quantisation of inputs at 0.001 mm: is there a way to keep Wrap at 0.000 with a float mesh centre without it? If not, concede the ruling.
2. Rung = exact seat-transition root of the binding disc, then full Wrap: does any real shape in B1–B4 have a lawful count whose first lawful size is **not** a seat transition (i.e. needs the walk to find a later size)? Name it or concede.
3. Count ownership by first **acceptance**: confirm the current `below` exclusion in `bandWalk` (seat-based) is deleted.
4. Walk cost: 53–86 s/band is not shippable; agree float prescreen + exact-at-roots, or propose cheaper.

## 5. Way forward (order)

1. Dan rules W1 (0.001 mm yes/no).
2. Contract edit: the §1 sentence, §6.2 mesh/quantum ban, §7.1b/§7.2 → reference, Support B/G1 removed, `bandWalk` row → ADAPT, B1–B4, W1 rule added. One commit, QA + Meta verify.
3. Build from `2c043257` in rollback commits: W1 → walk adapt + exact root + re-validate → cost → gravity → manual concessions → B5 → worker/UI store-and-display → honesty note. Live tab observed after each.
4. QA → Meta → Dan on the tab.

Necessity — no unnecessary elements: every step serves Centre-kept, Wrap-kept, rung construction, count ownership, truthful controls or delivery.
Sufficiency — delivers the three laws in full through the live tab; the only empirical risk (discovery missing a count) is measured by the denser probe before any architecture is added.
