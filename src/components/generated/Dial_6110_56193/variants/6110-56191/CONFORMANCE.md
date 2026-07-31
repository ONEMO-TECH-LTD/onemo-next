# Conformance — 6110:56191 @ file v2382085534573304220

| Check | Result |
|---|---|
| Elements (ID map) | 5 |
| Token coverage (styleable) | **73%** (8 var-decls / 11 styleable) |
| Unresolved `var(--…)` | **0** ✅ |
| RAW values | 4 (worklist below) |
| REFUSED nodes | 0 (design cleanup below) |
| APPROXIMATIONS | 0 (lossy-but-deliberate, listed below) |
| RAW SOURCE EVIDENCE | **PASS** ✅ |
| PAINT PROJECTION EVIDENCE | **PASS** ✅ |
| TOKEN VALUE PARITY | **0** ✅ |
| PAINT PARITY (fills/strokes/gradients) | **0** ✅ |
| EFFECT PARITY (drop/inner shadows) | **0** ✅ |
| CASCADE (prim→alias→sem · both modes) | **0** ✅ |
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 1 exact carriers |
| SVG DESCENDANTS | **FAIL** 🔴 — 1 live · 2 residual bindings · 0 residual layouts |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .stateNewValue · `width: 48px` (css:2)
- .stateNewValue · `height: 48px` (css:3)
- .dialFill · `width: 24px` (css:36)
- .dialFill · `height: 38.11px` (css:37)

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
- 6110:56182 · size.x · unsupported-node-binding — node binding has no live inline SVG carrier
- 6110:56182 · size.y · unsupported-node-binding — node binding has no live inline SVG carrier

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
