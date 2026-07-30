# Conformance — 12016:11147 @ file v2382085534573304220

| Check | Result |
|---|---|
| Elements (ID map) | 9 |
| Token coverage (styleable) | **13%** (2 var-decls / 16 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 14 (worklist below) |
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
- .property1Small · `gap: 10px` (css:4) → candidates: `--prim-track-pos-10`
- .property1Small · `padding: 18px` (css:5)
- .property1Small · `width: 288px` (css:6)
- .property1Small · `height: 288px` (css:7)
- .magneticGridSM · `width: 252px` (css:26)
- .magneticGridSM · `height: 252px` (css:27)
- .magnetBump · `width: 32px` (css:40)
- .magnetBump · `height: 32px` (css:41)
- .magnetBump2 · `width: 32px` (css:46)
- .magnetBump2 · `height: 32px` (css:47)
- .magnetBump3 · `width: 32px` (css:59)
- .magnetBump3 · `height: 32px` (css:60)
- .magnetBump4 · `width: 32px` (css:65)
- .magnetBump4 · `height: 32px` (css:66)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
_none_

## TOKEN VALUE PARITY — DS drift (Figma raw vs token resolved in authored context)
_none — every bound token resolves to Figma's own value_

## PAINT PARITY — dropped/flattened fills, strokes & gradients (the non-numeric blind spot)
_none — every visible Figma paint reaches the CSS_

## NATIVE TOKEN CARRIERS — exact source identity in emitted CSS
_none — every supported native property keeps its exact live token_

## SVG DESCENDANTS — live colour carriers and named residual semantics
_none — every exported SVG descendant semantic has a proved live carrier_

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
