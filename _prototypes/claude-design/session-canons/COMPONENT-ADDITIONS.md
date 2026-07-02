# Component Additions — to author in Figma (feed to Claude Code)

> Running log of NEW design-system tokens we identify while building.
> **These are UNVERIFIED mock-component tokens** — components don't formally exist yet; names/refs to be confirmed when real components are defined.
> Claude Code consumes this to populate Figma variables programmatically (then re-export → converter → React).
>
> Format per entry: `collection › token-path → {semantic ref or RAW value}` + note.

## A. Component colours — `4.0_Component_Colours` › `creator-editor/*`
Map each Creator-editor surface to a semantic token. Where the value is translucent/material with no semantic source, marked **RAW (needs decision)**.

| token-path | proposed `$value` | note |
|---|---|---|
| `creator-editor/control-ink` | `{fg-secondary}` (or existing `text-editor-icon-fg`) | control icons (undo/redo/perspective/menu) — already exists as `text-editor-icon-fg` |
| `creator-editor/control-ink-active` | `{fg-primary}` (`text-editor-icon-fg_active`) | active control |
| `creator-editor/dock-surface` | `{bg-overlay}` | dock pole #071013 (theme-constant) — verify bg-overlay = brand-black-constant |
| `creator-editor/dock-label` | `{text-brand-secondary}` (`footer-button-fg`) | dock tab labels — already exists |
| `creator-editor/ruler-handle` | `{bg-primary}` (`slider-handle-bg`) | ruler notch — already exists |
| `creator-editor/ruler-handle-border` | `{border-brand}` (`slider-handle-border`) | — |
| `creator-editor/glass-surface` | **RAW** rgba(255,255,255,.62) | glass controls — needs alpha primitive `base/white-a62` or component material |
| `creator-editor/glass-border` | **RAW** rgba(10,13,18,.07) | needs `base/black-a07` |
| `creator-editor/dock-ink-muted` | **RAW** rgba(250,250,250,.55) | needs white-alpha semantic |
| `creator-editor/stage-bezel` | `{grey.?}` dark step | #20252b → map to a grey primitive via alias |
| `creator-editor/viewer-material` | **RAW** radial-gradient | brand-pattern moment — component gradient token |
| `creator-editor/app-stage` | **RAW** gradient + noise | brand-pattern (aluminium stage) |

## B. Effects — `5.0_Effects` › `creator-editor/*`
| token-path | value | note |
|---|---|---|
| `creator-editor/elevation-control` | `0 1px 2px rgba(10,13,18,.12)` | raised glass control |
| `creator-editor/swatch-inset` | inset+drop multi-layer | swatch elevation |
| `creator-editor/stage-elevation` | `0 28px 54px -18px …` | stage shadow |

## C. Static component dimensions — NEW collection `4.1_Component_Dimensions` (proposed)
Static (NON-fluid) internal spacing/sizes so components don't grow with viewport.
Reference alias→primitive dimensions. **Values from current bottom-section.**

| token-path | px | note |
|---|---|---|
| `creator-editor/dock-inset-x` | 12 | dock tab-bar horizontal padding |
| `creator-editor/dock-height` | 61 | tab-bar height (no `--size-*` = 61; nearest 56/72) |
| `creator-editor/tab-min-width` | 56 | = `--size-*` 56 |
| `creator-editor/tab-gap` | 2 | inter-tab gap |
| `creator-editor/control-size` | 40 | close/confirm buttons (no `--size-*` = 40; scale jumps 32→48) |
| `creator-editor/dial-size` | 48 | = `--size-*` 48 |
| `creator-editor/icon-size` | 24 | = `--size-*` 24 |
| `creator-editor/rim-stroke` | 1.5 | dock metallic rim |
| `creator-editor/ruler-track-h` | 34 | ruler band |

### Gaps in the size scale to raise with DS team
- **40px CONFIRMED = semantic→alias MAPPING BUG (not a missing token).** Verified in `figma-variables-2026-03-10.json`: `2.5_Alias_Size` is correct & complete — `2xs→16 · xs→20 · sm→24 · md→32 · lg→40 · xl→48 · 2xl→56 · 3xl→64 · 4xl→72`. But compiled semantic `--size-*` = `2xs→16 · s→24 · m→32 · l→48 · xl→56 · 2xl→72`: semantic **`l` is wired to alias `xl` (48)** instead of alias **`lg` (40)** — the `lg`/40 rung is skipped and every step from `l` up is shifted +1 alias. FIX in Figma `3.x_Semantic_Size`: remap `l → {lg}` (40), and add/realign the higher steps (`xl→{xl}`48, `2xl→{2xl}`56, plus expose `3xl→64`, `4xl→72`) so the semantic scale matches the alias scale 1:1. After fix, editor 40px controls bind to `--size-*-l`. **40px is NOT a missing token — do not author a new one; fix the mapping.**
- **61px** (dock height) genuinely has no rung (alias jumps 56→64) — keep as component dimension or structural literal.
- **Exact Figma diff (`3.6_Semantic_Size`, both `height` & `width`):** `l: {xl}→{lg}` (48→40), `xl: {2xl}→{xl}` (56→48), `2xl: {4xl}→{2xl}` (72→56); descriptions also wrong (match the bug) — fix. Recommended instead: extend semantic to 1:1 with alias names (`2xs`16 `xs`20 `s`24 `m`32 `l`40 `xl`48 `2xl`56 `3xl`64 `4xl`72) so nothing is skipped and 72 stays as `4xl`. USER is remapping in Figma → re-export drops new `tokens/semantic.css` in (do NOT hand-edit the generated CSS). DECISION: semantic↔alias 1:1 BY POSITION (NOT by literal name — keep `s/m/l` on semantic, `sm/md/lg` on alias; the different spelling intentionally distinguishes the layers). ✅ DONE 2026-06-21: Figma remapped by user; CSS mirrored by hand in `tokens/app-tokens.css` + `tokens/semantic.css` (one-time, justified): `--size-*-l 48→40, xl 56→48, 2xl 72→56` (height+width). Names unchanged. Nothing binds `--size-*` yet so render-safe.
- `1.5px` rim, `46/38/30px` device radii — structural literals, likely not tokens.

---
_Append new findings below as we audit more sections (top-section, canvas, status-bar)._
