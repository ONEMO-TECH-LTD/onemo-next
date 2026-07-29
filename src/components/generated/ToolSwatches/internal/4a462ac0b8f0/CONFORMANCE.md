# Conformance — 8019:1570 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 13 |
| Token coverage (styleable) | **87%** (22 var-decls / 23 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 3 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **20** ⚠️ DS drift (below) |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 1 exact carriers |
| SVG DESCENDANTS | **PASS** ✅ — 0 live colour bindings |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .swatchMasked · `width: 402px` (css:8)
- .swatchMasked · `height: 32px` (css:9)
- .alpha · `width: 402px` (css:23)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
_none_

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved at frame width)
- .alpha · `height` = `--sem-dim-fluid-big-xs` → resolves **34.09px** but Figma shows **32px** (css:24) — fix the token build or the Figma variable, not the converter
- .swatchRow · `gap` = `--sem-dim-fluid-standard-m` → resolves **17.05px** but Figma shows **16px** (css:35) — fix the token build or the Figma variable, not the converter
- .dial · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:42) — fix the token build or the Figma variable, not the converter
- .dial · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:43) — fix the token build or the Figma variable, not the converter
- .dial2 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:48) — fix the token build or the Figma variable, not the converter
- .dial2 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:49) — fix the token build or the Figma variable, not the converter
- .dial3 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:54) — fix the token build or the Figma variable, not the converter
- .dial3 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:55) — fix the token build or the Figma variable, not the converter
- .dial4 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:60) — fix the token build or the Figma variable, not the converter
- .dial4 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:61) — fix the token build or the Figma variable, not the converter
- .dial5 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:66) — fix the token build or the Figma variable, not the converter
- .dial5 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:67) — fix the token build or the Figma variable, not the converter
- .dial6 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:72) — fix the token build or the Figma variable, not the converter
- .dial6 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:73) — fix the token build or the Figma variable, not the converter
- .dial7 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:78) — fix the token build or the Figma variable, not the converter
- .dial7 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:79) — fix the token build or the Figma variable, not the converter
- .dial8 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:84) — fix the token build or the Figma variable, not the converter
- .dial8 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:85) — fix the token build or the Figma variable, not the converter
- .dial9 · `width` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:90) — fix the token build or the Figma variable, not the converter
- .dial9 · `height` = `--sem-dim-fluid-standard-xl` → resolves **26.09px** but Figma shows **24px** (css:91) — fix the token build or the Figma variable, not the converter

## PAINT PARITY — dropped/flattened fills, strokes & gradients (the non-numeric blind spot)
_none — every visible Figma paint reaches the CSS_

## NATIVE TOKEN CARRIERS — exact source identity in emitted CSS
_none — every supported native property keeps its exact live token_

## SVG DESCENDANTS — live colour carriers and named residual semantics
_none — every exported SVG descendant semantic has a proved live carrier_

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
