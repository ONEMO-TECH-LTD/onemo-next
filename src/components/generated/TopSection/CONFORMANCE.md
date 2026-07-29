# Conformance — 8018:27668 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 6 |
| Token coverage (styleable) | **92%** (12 var-decls / 13 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 3 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **0** ✅ |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 0 exact carriers |
| SVG DESCENDANTS | **FAIL** 🔴 — 1 live · 2 residual bindings · 1 residual layouts |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .topSection · `width: 402px` (css:8)
- .buttonHomeLogo · `height: 24px` (css:20)
- .styleEffect · `font-weight: 500` (css:38)

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
- 8014:4662 · layoutMode · baked-auto-layout — auto-layout geometry is baked into the Figma export
- 8014:4663 · size.x · unsupported-node-binding — node binding has no live inline SVG carrier
- 8014:4663 · size.y · unsupported-node-binding — node binding has no live inline SVG carrier

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
