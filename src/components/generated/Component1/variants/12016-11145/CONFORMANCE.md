# Conformance — 12016:11145 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 19 |
| Token coverage (styleable) | **6%** (2 var-decls / 32 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 30 (worklist below) |
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
- .property1Large · `gap: 10px` (css:4) → candidates: `--prim-track-pos-10`
- .property1Large · `padding: 18px` (css:5)
- .property1Large · `width: 288px` (css:6)
- .property1Large · `height: 288px` (css:7)
- .magneticGridSM · `width: 252px` (css:26)
- .magneticGridSM · `height: 252px` (css:27)
- .magnetBump · `width: 24px` (css:40)
- .magnetBump · `height: 24px` (css:41)
- .magnetBump2 · `width: 24px` (css:46)
- .magnetBump2 · `height: 24px` (css:47)
- .magnetBump3 · `width: 24px` (css:52)
- .magnetBump3 · `height: 24px` (css:53)
- .magnetBump4 · `width: 24px` (css:58)
- .magnetBump4 · `height: 24px` (css:59)
- .magnetBump5 · `width: 24px` (css:71)
- .magnetBump5 · `height: 24px` (css:72)
- .magnetBump6 · `width: 24px` (css:77)
- .magnetBump6 · `height: 24px` (css:78)
- .magnetBump7 · `width: 24px` (css:90)
- .magnetBump7 · `height: 24px` (css:91)
- .magnetBump8 · `width: 24px` (css:96)
- .magnetBump8 · `height: 24px` (css:97)
- .magnetBump9 · `width: 24px` (css:109)
- .magnetBump9 · `height: 24px` (css:110)
- .magnetBump10 · `width: 24px` (css:115)
- .magnetBump10 · `height: 24px` (css:116)
- .ellipse15 · `width: 24px` (css:121)
- .ellipse15 · `height: 24px` (css:122)
- .magnetBump11 · `width: 24px` (css:127)
- .magnetBump11 · `height: 24px` (css:128)

## REFUSED — design cleanup worklist


## APPROXIMATIONS — lossy-but-deliberate (visible, never silent)
_none — every converted value is exact_

## FONTS USED — must exist in the app build (fallback = silent visual drift)
_none_

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
