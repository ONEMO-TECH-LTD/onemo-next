# Conformance — 12002:4342 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 2 |
| Token coverage (styleable) | **82%** (12 var-decls / 11 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 2 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **1** ⚠️ DS drift (below) |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 0 exact carriers |
| SVG DESCENDANTS | **PASS** ✅ — 0 live colour bindings |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .fcPaint1Fill · `border-radius: inherit` (css:17)
- .label · `font-weight: 500` (css:26)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
- Chillax

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved at frame width)
- .badge · `width` = `--sem-dim-fluid-big-l` → resolves **55.37px** but Figma shows **56px** (css:5) — fix the token build or the Figma variable, not the converter

## PAINT PARITY — dropped/flattened fills, strokes & gradients (the non-numeric blind spot)
_none — every visible Figma paint reaches the CSS_

## NATIVE TOKEN CARRIERS — exact source identity in emitted CSS
_none — every supported native property keeps its exact live token_

## SVG DESCENDANTS — live colour carriers and named residual semantics
_none — every exported SVG descendant semantic has a proved live carrier_

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
