# Conformance — 8017:21679 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 4 |
| Token coverage (styleable) | **53%** (8 var-decls / 15 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 7 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **0** ✅ |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 0 exact carriers |
| SVG DESCENDANTS | **PASS** ✅ — 0 live colour bindings |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .stateActive · `width: 71.6px` (css:6)
- .stateActive · `height: 38px` (css:7)
- .iconBox · `gap: 10px` (css:14) → candidates: `--prim-track-pos-10`
- .iconBox · `padding: 0 1px` (css:15)
- .iconBasket · `width: 22px` (css:23)
- .iconBasket · `height: 22px` (css:24)
- .label · `font-weight: 500` (css:34)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
- Chillax

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved at frame width)
_none — every bound token resolves to Figma's own value_

## PAINT PARITY — dropped/flattened fills, strokes & gradients (the non-numeric blind spot)
_none — every visible Figma paint reaches the CSS_

## NATIVE TOKEN CARRIERS — exact source identity in emitted CSS
_none — every supported native property keeps its exact live token_

## SVG DESCENDANTS — live colour carriers and named residual semantics
_none — every exported SVG descendant semantic has a proved live carrier_

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
