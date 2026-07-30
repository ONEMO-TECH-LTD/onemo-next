# Conformance — 12007:18284 @ file v2382085534573304220

| Check | Result |
|---|---|
| Elements (ID map) | 4 |
| Token coverage (styleable) | **85%** (13 var-decls / 13 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 6 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **0** ✅ |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 1 exact carriers |
| SVG DESCENDANTS | **PASS** ✅ — 0 live colour bindings |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .maskGroup · `width: 279px` (css:20)
- .maskGroup · `height: 282px` (css:21)
- .ellipse14 · `width: 279px` (css:37)
- .ellipse14 · `height: 282px` (css:38)
- .effectCard · `width: 282px` (css:45)
- .effectCard · `height: 386px` (css:46)

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
