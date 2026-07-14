# figma-to-code C4 (3 measured deltas) — s58-lead Meta Verdict

Reviewer: Kai (s58-lead). Requested by @s58-expert. HEAD `91a8310`. Both halves attempted per mandate.
Method: code = gates + layered-card mutation battery + parity math/drift verification + single-source
trace; visual = fetched the real Figma render + rendered the live converted route + eyeball fidelity.
Findings → @s58-expert.

## CODE HALF — rigorous, clean
- ✅ Gate: 34/34, approximations **0**, census/canon/reverse/conformance OK on BOTH convert and check;
  determinism byte-identical (hash A==B); pristine check exit 0.
- ✅ **bgBorderDecls is the single source both directions** — declsFor (emit.mjs:210) AND reverse
  geomOf (reverse.mjs:64) call the same `bgBorderDecls`; the comment + code confirm the
  check-IR≠convert-IR drift class is closed *architecturally* for the whole bg/border property family
  (not just guarded). No other emit path hand-derives background/border.
- ✅ **Layered-card mutation battery — all fire** (attacked rectangle49, the gradient card):
  swap `background-clip` order → reverse FAIL; `border` transparent→#ff0000 → reverse FAIL; drop the
  gradient layer from the multi-layer `background-image` → reverse FAIL. The exact-gradient-ring is
  fully reverse-guarded.
- ✅ **Parity evaluator verified correct + drift-detecting** (the retraction is trustworthy):
  golden parity = 0 (DS clean). The 2 locking tests are non-tautological — test 1: `clamp(1rem,
  1rem+2cqi,2rem)` @ W=400 → 16+8=24 matches Figma 24 → 0 rows (exercises clamp/cqi math); test 2:
  `2rem`=32 ≠ Figma 24 → exactly 1 row with `resolved:32, figma:24` + ⚠️ marker. So the evaluator
  provably DETECTS drift with correct numbers and doesn't false-positive → "0 on golden" (and the
  retracted dial-gap hypothesis, 24.0005≈24 within 0.5px) is trustworthy. Math objectively right
  (rem×16, cqi×frameW/100, clamp middle-term eval, 0.5px threshold). *(My black-box drift test hit an
  unused primitive `--prim-dim-0` → 0 rows — a bad target on my part, not an evaluator gap; the unit
  tests cover the real path.)*

## VISUAL HALF — conducted (not skipped), qualitatively confirmed
- Fetched the real Figma render via `/v1/images` (node 4084:25997, scale 2 → **804×1742**).
- Rendered + captured the LIVE converted route `:3077/converted/editor-402-…`. Eyeball vs Figma:
  **faithful** — glass dome, the **rounded gradient card border** (C4.2's exact deliverable, visibly
  present), the Porsche fill, the Add/Shape/Effect/Tune/Edit dock, the ruler/carousel, the ✕·Effect·✓
  top bar all render correctly and match the golden layout. No breakage, no missing gradient ring, no
  interior 10px shift (C4.1 border-box origin holds visually).
- **Honest limit on the pixel-%:** my browser-tool capture is a downscaled full-window screenshot
  (the 402-wide screen sits in a sub-region + an annotation overlay), NOT pixel-aligned to the
  expert's instrumented `:3077` diff pipeline. Feeding it to `visual-diff.mjs` would produce a
  *misalignment-dominated* number, not a real fidelity measurement — worse than an honest qualitative
  pass. I therefore confirm the render is faithful and the C4 deltas visibly render (which is exactly
  what regresses if C4.1/C4.2 broke), but I did NOT independently reproduce the 9.56→4.49 pixel-figure.
  That trajectory is the expert's instrument; my eyeball is consistent with high fidelity (single-digit
  mismatch plausible). **If a lead-produced pixel-% is required to satisfy the mandate, point me at the
  exact `:3077` screenshot step and I'll run it through the tool** — my ad-hoc capture can't pixel-match.

## Findings
### F1 · MED · SPEC not synced to C4 (SPEC==code, meta-ask)
§3.5/§4 do NOT mention the new normative rules: the **layered exact-gradient ring** (background-origin
border-box, layered fills→padding-box over stroke-gradient→border-box, transparent border, per-layer
size/position/clip) and the **TOKEN VALUE PARITY** conformance section. The SPEC is the contract +
meta-QA checklist — new mapping rules must live there. **Answer to your ask: yes, fold both.**

## Verdict
**Code: PASS (rigorous).** **Visual: conducted + qualitatively faithful** (deltas render, no
regression) — but I have NOT produced an independent pixel-% (transparent why; instrument-dependent).
**F1 MED:** SPEC sync. Per your own mandate ("no PASS without measured visual numbers"), I'm not
stamping an unqualified PASS on the visual — I give you: code rigorously clean + visual confirmed
faithful by eye + the exact reason I can't reproduce your pixel-number, and an offer to run your
instrumented capture step. Fold F1 (SPEC) and tell me if you want me to run your `:3077` capture for a
lead pixel-figure; Codex's measured visual verdict stands independent.
