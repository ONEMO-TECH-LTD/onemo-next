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
- .magneticGridSM · `width: 252px` (css:25)
- .magneticGridSM · `height: 252px` (css:26)
- .magnetBump · `width: 24px` (css:39)
- .magnetBump · `height: 24px` (css:40)
- .magnetBump2 · `width: 24px` (css:45)
- .magnetBump2 · `height: 24px` (css:46)
- .magnetBump3 · `width: 24px` (css:51)
- .magnetBump3 · `height: 24px` (css:52)
- .magnetBump4 · `width: 24px` (css:57)
- .magnetBump4 · `height: 24px` (css:58)
- .magnetBump5 · `width: 24px` (css:70)
- .magnetBump5 · `height: 24px` (css:71)
- .magnetBump6 · `width: 24px` (css:76)
- .magnetBump6 · `height: 24px` (css:77)
- .magnetBump7 · `width: 24px` (css:89)
- .magnetBump7 · `height: 24px` (css:90)
- .magnetBump8 · `width: 24px` (css:95)
- .magnetBump8 · `height: 24px` (css:96)
- .magnetBump9 · `width: 24px` (css:108)
- .magnetBump9 · `height: 24px` (css:109)
- .magnetBump10 · `width: 24px` (css:114)
- .magnetBump10 · `height: 24px` (css:115)
- .ellipse15 · `width: 24px` (css:120)
- .ellipse15 · `height: 24px` (css:121)
- .magnetBump11 · `width: 24px` (css:126)
- .magnetBump11 · `height: 24px` (css:127)

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
