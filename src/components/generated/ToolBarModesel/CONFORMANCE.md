# Conformance — 6138:953 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 14 |
| Token coverage (styleable) | **70%** (27 var-decls / 30 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 10 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **5** ⚠️ DS drift (below) |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 3 exact carriers |
| SVG DESCENDANTS | **PASS** ✅ — 0 live colour bindings |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .toolBarModesel · `border-radius: 9999px` (css:6)
- .modeSelector · `height: 24px` (css:13)
- .maskGroup · `width: 402px` (css:20)
- .maskGroup · `height: 24px` (css:21)
- .frame9 · `width: 402px` (css:36)
- .modes · `width: 402px` (css:49)
- .modes · `height: 24px` (css:50)
- .label2 · `font-weight: 500` (css:78)
- .label4 · `font-weight: 500` (css:104)
- .label6 · `font-weight: 500` (css:130)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
- Chillax

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved at frame width)
- .toolBarModesel · `padding[2]` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:5) — fix the token build or the Figma variable, not the converter
- .frame9 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:37) — fix the token build or the Figma variable, not the converter
- .segment · `width` = `--sem-dim-fluid-big-xl` → resolves **68.19px** but Figma shows **64px** (css:62) — fix the token build or the Figma variable, not the converter
- .segment2 · `width` = `--sem-dim-fluid-big-xl` → resolves **68.19px** but Figma shows **64px** (css:88) — fix the token build or the Figma variable, not the converter
- .segment3 · `width` = `--sem-dim-fluid-big-xl` → resolves **68.19px** but Figma shows **64px** (css:114) — fix the token build or the Figma variable, not the converter

## PAINT PARITY — dropped/flattened fills, strokes & gradients (the non-numeric blind spot)
_none — every visible Figma paint reaches the CSS_

## NATIVE TOKEN CARRIERS — exact source identity in emitted CSS
_none — every supported native property keeps its exact live token_

## SVG DESCENDANTS — live colour carriers and named residual semantics
_none — every exported SVG descendant semantic has a proved live carrier_

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
