# Conformance — 8017:21218 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 2 |
| Token coverage (styleable) | **25%** (1 var-decls / 4 styleable) |
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
| SVG DESCENDANTS | **FAIL** 🔴 — 2 live · 12 residual bindings · 1 residual layouts |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .stateFrontside · `width: 402px` (css:6)
- .sideIndicator · `width: 32px` (css:11)
- .sideIndicator · `height: 8px` (css:12) → candidates: `--prim-track-pos-8`

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
- 8017:21214 · paddingLeft · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · paddingTop · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · paddingRight · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · paddingBottom · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · rectangleCornerRadii.RECTANGLE_TOP_LEFT_CORNER_RADIUS · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · rectangleCornerRadii.RECTANGLE_TOP_RIGHT_CORNER_RADIUS · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · rectangleCornerRadii.RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · rectangleCornerRadii.RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21214 · layoutMode · baked-auto-layout — auto-layout geometry is baked into the Figma export
- 8017:21215 · size.x · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21215 · size.y · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21216 · size.x · unsupported-node-binding — node binding has no live inline SVG carrier
- 8017:21216 · size.y · unsupported-node-binding — node binding has no live inline SVG carrier

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
