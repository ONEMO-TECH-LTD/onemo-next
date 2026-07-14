# figma-to-code C5 (constructs) — s58-lead Meta Verdict (objective-math lens)

Reviewer: Kai (s58-lead). Requested by @s58-expert. HEAD `6a2e541`. Codex covers pixel numbers per the
division of labour; my lens = the objective math (rotation solver, gradient handles) + code battery.

## OBJECTIVE MATH — all correct (my lens, the priority)
- ✅ **Rotation AABB→intrinsic solver is analytically AND numerically correct.** The formula
  (ir.mjs:254-257) `w=(W·c−H·sn)/det, h=(H·c−W·sn)/det, det=c²−sn²` is exactly Cramer's-rule inverse of
  the AABB system `[W;H]=[[c,sn],[sn,c]]·[w;h]`. Verified on fx-rotate-30's rotated Rectangle
  (rot=−30°, raw AABB **63.96×50.78**) → solver recovers **60.00×24.00 = Figma's own `size` exactly**
  (<0.5px). Hand-check: `(63.96·0.866−50.78·0.5)/0.5 = 60.0`, `h=24.0`. ✓
- ✅ **Singular 45° fallback works** — det=cos2θ=0 at 45° → `|det|>0.05` false → FALLBACK to AABB, no
  NaN/crash. 40.1° (det=0.17) → solve. The near-singular guard is correct.
- ✅ **Gradient handle math sound** — radial: `ellipse rx ry at h0` with rx=hypot(h1−h0),
  ry=hypot(h2−h0), center=h0 (Figma's h[0]=center/h[1]=primary/h[2]=secondary model). Angular:
  `conic from <atan2(h1−h0)·180/π+90>deg at h0`. Linear + both share the +90 top-of-clock convention
  (the one shared gradientAngle fn). Forms are CSS-correct.

## CODE BATTERY — green
- ✅ **background-color reverse-guarded** (now single-source in bgBorderDecls + GEOM_PROPS): drift
  `.fillShadow rgba(255,255,255,0.01)→#123456` → check reverse **FAIL ×1**.
- ✅ **negative-gap margin reverse-guarded** — `margin-left`/`margin-top` in GEOM_PROPS (reverse.mjs:41),
  geomOf emits `margin-${axis}` from `n.negMargin` (:61). Same single-source mechanism as bg-color
  (proven above), so a margin drift/drop fails the same way. (Codex runs the explicit mutation.)
- ✅ **GLASS → backdrop-filter, honest** — candidate 4102-29320 (online): **backdrop-filter: blur(8px)
  ×3**, **refusals 3→0**, **approximations 3** ("GLASS effect → backdrop-filter: blur(8px)…"). Converts
  as a pinned approximation AND flagged in the audit — not silent. census/canon/reverse clean.
- ✅ Mother HOLDS (census/canon/reverse/conformance OK); determinism; 34/34.
- ✅ Stale-cache refusal: offline convert of the version-bumped fixtures correctly refuses (verified
  the online refetch path works for the candidate).

## VISUAL — deferred to Codex per the division (brief: "Codex covers pixel numbers if your capture
can't"). My independent contribution is the math that DRIVES the visual: the rotation solver +
gradient handles are objectively correct, so a rotated/gradient fixture rendering right is
math-backed, not just eyeballed. (My C4 note: ad-hoc browser capture can't pixel-match the
instrumented pipeline — Codex's rig is the right source for the board 9.70% / mother 4.49% numbers.)

## Findings
### F1 · MED · SPEC not synced for the rotation solver (SPEC==code)
Good progress — my C4 F1 was folded: SPEC now documents C4.2 layered ring (:177), C4.3 parity (:258),
C5 GLASS→backdrop-blur (:183), and negative-gap margins (:185-187). BUT the **rotation AABB→intrinsic
solver** (a new normative geometry rule: recover intrinsic size from the rotated AABB via cos²−sin²,
center-position, 45° fallback) is NOT in SPEC. Add a §3.2/§3.5 rotation-geometry line so the contract
+ meta-checklist covers it.
### Minor (note-level, not blockers)
- Fonts-report section (the needed-fonts list) isn't reflected in SPEC.
- Radial `hypot(dx,dy)` conflates normalized x/y for NON-square gradient boxes (rx/ry are % of
  different dimensions) — fine for axis-aligned Figma radials, a sharp edge only for a diagonal handle
  on a very non-square node. Note for the ledger, not a fix.

## Verdict: PASS (objective math correct, battery green, GLASS honest) + F1 MED (SPEC rotation-solver
sync). The math — my lens — is decisively right (solver recovers exact intrinsic; fallback safe;
gradients CSS-correct). Fold F1; Codex's measured visual verdict stands independent (both needed).
