# AC-A-008 — Framer component-breadcrumb bar, LIVE MEASUREMENT → ONEMO target
**Provenance: expert-live-probed 2026-07-13 · authenticated Framer, project "Powerful Autonomy", NodeCard edit mode (`?node=EHvLPHLQz`) · DOM-exact `getBoundingClientRect` + `getComputedStyle`, CSS px (window 2056×1202 @ dpr 2 — values are CSS px, resolution-independent).** No guessing: every Framer number below is read from the live DOM; target column = same geometry re-skinned with existing DS tokens (skin choice = designer/Dan; geometry = measured).

## A · FRAMER MEASURED (source coordinates)
**Anatomy:** `[🗎 Home]  ›  [◈ NodeCard]` — two chips + SVG chevron, in the FIXED canvas-chrome strip (never pans/zooms).

| Property | Framer measured |
|---|---|
| Bar position | top-left of canvas pane; inset ≈ **12px left / 12px top** from pane origin (bar rect x269 y61 h30; pane origin ≈ x258 y48) |
| Bar height | **30px** (chips are full-bleed height of the bar) |
| Chip height | **30px** |
| Chip padding | **0 10px** (horizontal only; content vertically centered) |
| Chip radius | **8px** (rounded-rect, NOT a full pill) |
| Chip border | none (0px) — fills only |
| Font | **Inter 600 (semibold) 12px**, line-height normal |
| Home chip | bg `rgba(0,0,0,0.05)` (neutral 5%) · text/icon `#888888` · width 74.2px w/ "Home" |
| Component chip | bg `display-p3 0.5333 0.3333 1 / 0.1` (accent @ 10%) · text/icon `#8855FF` (accent) · width 99.3px w/ "NodeCard" |
| Chip icons | **12×12px SVG** (doc-page icon in Home; ◈ component diamond in card chip), inline-start, **10px** from chip left edge (= padding), then text |
| Separator | **SVG chevron 10×10px** (path `m3.25 1.5 2.793 2.793a1 1 0 0 1 0 1.414L3.25 8.5`), color `#888888`, vertically centered, **10px clear gap on EACH side** (chip→10→chevron→10→chip; total inter-chip gap 30px) |
| Behaviors (already-measured law, unchanged by this row) | Home chip click = exit to page · component chip click = component context menu (not nav) · fixed chrome, immobile under pan/zoom |

## B · ONEMO CURRENT @ 8d64fd3 (source: `react-figma/page.tsx` ~L3995-3999)
Container: `top:12 left:12` ✓ (matches Framer inset — keep) · `padding:3` wrapper w/ 1px secondary border + full-radius pill · font **`--sem-type-fluid-label-xs` = 10px** · chips `padding:4px 8px`, `radius-full`, no icons, text separator `›` placeholder-color. Dan's complaint confirmed by numbers: **10px vs Framer 12px/600, chip h≈22px vs 30px, no icons, pill-in-pill wrapper Framer doesn't have.**

## C · CURRENT → TARGET (geometry = Framer-measured; skin = DS tokens, never Framer purple)
| Property | ONEMO current | TARGET (measured geometry, ONEMO skin) |
|---|---|---|
| Bar inset | 12/12 | **keep 12/12** (matches Framer) |
| Wrapper | bordered full-pill wrapper (padding 3) | **REMOVE wrapper chrome** — Framer has bare chips on canvas; if a backdrop is wanted for contrast it's a designer call, not parity |
| Chip height | ~22px | **30px** |
| Chip padding | 4px 8px | **0 10px**, content vertically centered |
| Chip radius | full pill | **8px** → nearest DS token (`--sem-radii-md`-class); full-pill deviates from measured Framer |
| Font | label-xs 10px | **12px semibold** → nearest fluid token ≥12px (label-s class) + weight 600 |
| Home chip skin | bg-secondary/text-secondary | keep neutral family — bg = neutral ~5% layer token, text/icon = `--sem-col-text-secondary` |
| Component chip skin | bg-brand-primary + 1px brand border | **borderless**, bg = brand tint ~10% token, text/icon = brand text token (oklch family — no #8855FF) |
| Icons | none | **12×12 Phosphor-light**: doc/page icon (Home) + diamond/component icon (card chip), 10px inset, icons-law: Phosphor/Figma-extracted only — never hand-drawn SVG |
| Separator | text `›` | **10×10 chevron icon** (Phosphor-light caret-right), `text-secondary`, **10px gap each side** |
| Behaviors | Home exits ✓ · card chip selects frame root | Home exits (keep) · card chip → component menu is `AC-B-*` scope, NOT this row |

**Open (unchanged):** exact token picks (radius/type/bg-layer) = designer's skin authority; this doc fixes the MEASURED geometry so nothing is invented. Dan's pending prominence call (v1.4 §Dan-pending #2) is satisfied by these numbers unless Dan wants larger-than-Framer.
