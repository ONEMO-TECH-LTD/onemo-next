# Conformance — 6110:56192 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 6 |
| Token coverage (styleable) | **79%** (15 var-decls / 19 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 5 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **2** ⚠️ DS drift (below) |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 1 exact carriers |
| SVG DESCENDANTS | **FAIL** 🔴 — 1 live · 2 residual bindings · 0 residual layouts |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .stateActive · `width: 48px` (css:2)
- .stateActive · `height: 48px` (css:3)
- .el8 · `font-weight: 500` (css:46)
- .dialFill · `width: 24px` (css:54)
- .dialFill · `height: 38.11px` (css:55)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
- Chillax

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved at frame width)
- .dialReg · `width` = `--sem-dim-fluid-big-m` → resolves **47.37px** but Figma shows **48px** (css:20) — fix the token build or the Figma variable, not the converter
- .dialReg · `height` = `--sem-dim-fluid-big-m` → resolves **47.37px** but Figma shows **48px** (css:21) — fix the token build or the Figma variable, not the converter

## PAINT PARITY — dropped/flattened fills, strokes & gradients (the non-numeric blind spot)
_none — every visible Figma paint reaches the CSS_

## NATIVE TOKEN CARRIERS — exact source identity in emitted CSS
_none — every supported native property keeps its exact live token_

## SVG DESCENDANTS — live colour carriers and named residual semantics
- 6110:56188 · size.x · unsupported-node-binding — node binding has no live inline SVG carrier
- 6110:56188 · size.y · unsupported-node-binding — node binding has no live inline SVG carrier

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
