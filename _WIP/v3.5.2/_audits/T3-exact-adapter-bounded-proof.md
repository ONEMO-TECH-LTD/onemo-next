# Bounded exact-adapter proof — result (s62-kai-lead, 2026-08-22)

Base: `2c043257` (checkout `onemo-next/.claude/worktrees/s62-lead-clean-2c043257`). Disposable probe: `evidence/exact-adapter-proof-2c043257.test.ts` (run with vitest in that checkout; no product code changed). Governing synthesis: `../_proposals/v3.5.2-1 simplify and complete proposal/s62-grid-meta-final-joint-recommendation.md` (SHA 74f03edb…).

## Limitation (closed by B1)

The disposable probe recovered the selection identities (mesh indices, island index sums, placement, lattice k) from report decimals by rounding, which validates the reconstruction formulas on the fixtures but not the emitted-identity dataflow. Canon B1 step 2 makes the frozen Centre path emit `NumericSelection` directly; fixture 12 re-runs these cases from the emitted identities with a report-decimal perturbation mutation as a mandatory gate. The probe also covered outer boundaries only; fixture 17 (holed exact scaling) is a mandatory B1 gate.

## Proof gates

| Gate | Result | Evidence |
|---|---|---|
| Box, Weight, Core, Deep, Top, Masses×4 governors preserve the numeric selection; chosen centre/phase/anchors reconstructed exactly from supplied bits | **PASS** | squircle 72, heart 108, squircle 120 × 9 policies: centre/anchor error 0 for Box and every mesh mode; ≤ 9e-14 for Weight (float centroid vs exact shoelace). Mesh centre = `minX·s − 2 + 2·ix`; Core = area-weighted mean of island sample means; phase = `(centre − min [+24]) mod 48`; anchors = `min + phase + k·48`. No expression platform: rational arithmetic only. |
| square 25 @ pitch 24 — one exact verdict, fixed = rung | **PASS** | exact anchor = float anchor `[16.861…]`; exact gap **0** (tangent to one edge), seat legal → lawful at flap 0. Float path refuses (`−8.9e-16`) — the W1 defect reproduced. Rung view: constant-offset anchor vs moving right edge gives the root **s = 24** (the square-24 standard). |
| Weight squircle 72 — identical exact verdict and evidence in fixed and rung paths | **PASS** | both paths: seat illegal, required `−8.06e-16` (same exact rational), refused. Per-disc contact roots differ (71.78… vs 72) — supplied bits are asymmetric, as grid-qa/meta found. |
| Diamond — irrational contact root carried exactly | **PASS** | Box count-1 binding root is `interior` seg 0: polynomial `[64071998…, 0, −97565350…]`, isolating width < 1e-40, s* ≈ 39.0224; just above the root the disc is legal with gap 1.5e-39. Kernel = one quadratic root isolator (disposable copy), no resultants. |
| One Masses mesh branch reconstructs from sample identity | **PASS** | squircle 120 Masses/all governors: centre error 0, anchors error 0. |
| Restoring approximate seat admission breaks seat/Wrap identity | **PASS** | square 25 @ 24: float (micron seat + raw-bit Wrap) = refused; exact = lawful. |

## Product-law note (superseded as a blocker — Grid-Meta authority correction, 2026-08-22)

Under bit-exact law on the supplied flattened bytes, **the reference squircle at 72 mm is refused at flap 0 in every centre mode**: its four corner discs sit `2.4e-14 mm²` inside the 12 mm clearance (`d² − 144 = −2.398e-14`). The current tab shows it lawful only because (a) seat legality rounds to 0.001 mm and (b) the float-scaled contour happens to round the other way. Whether a flattened curve is "tangent" at flap 0 is therefore decided by its supplied bits. Under the revised canon both fixed inspection and rung validation consume one exact construction (normalized boundary × scale, emitted selection identities), so they cannot diverge; the float-scaled path that passes squircle 72 today is superseded evidence, not an allowed final behaviour.

Disposition: master §7.1 (supplied bytes are law, no rounding or tolerance) already binds option B; the finding is recorded as expected behaviour, not a blocker. Option A remains available to Dan only as a later explicit product amendment. Options, for the record:
- **A. Touch rule on the exact value:** lawful iff exact gap ≤ flap + `TOUCH_MM` (proposal 0.001 mm, the existing seat quantum), evaluated on unrounded geometry. Geometry stays continuous (diamond root unaffected); one rule for fixed and rung; squircle 72 lawful; a 0.002 mm gap refuses. This is a verdict tolerance, which the master currently forbids.
- **B. Bit-exact:** squircle/curves never rung at flap 0; users see the reference squircle refused at flap 0 and lawful under Auto at `0.000000000000024 mm`. Contract unchanged on this point.

Adapter proof: **PASS, direct, no platform.** Canon revised on this basis (master v3.5.2-1).
