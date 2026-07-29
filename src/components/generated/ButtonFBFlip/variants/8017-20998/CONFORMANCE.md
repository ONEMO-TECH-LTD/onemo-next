# Conformance — 8017:20998 @ file v2381318852839647833

| Check | Result |
|---|---|
| Elements (ID map) | 5 |
| Token coverage (styleable) | **80%** (13 var-decls / 15 styleable) |
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
| NATIVE TOKEN CARRIERS | **PASS** ✅ — 2 exact carriers |
| SVG DESCENDANTS | **FAIL** 🔴 — 1 live · 0 residual bindings · 1 residual layouts |
| **FIDELITY MATRIX** | **PASS** ✅ |
| Missing assets | 0 |


## RAW values — bind-token worklist
- .rotate · `width: 16px` (css:21)
- .rotate · `height: 16px` (css:22)
- .label · `width: 52px` (css:31)
- .back · `font-weight: 500` (css:40)

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
- 8017:21000 · layoutMode · baked-auto-layout — auto-layout geometry is baked into the Figma export

## CASCADE AUDIT — full prim→alias→sem chain, both modes
_none — every token bottoms out to a literal in light AND dark_
