# Figma UI3 — specs extracted from Dan's authenticated Figma tab (2026-07-05)
Source: figma.com, ONEMO DS v2.3.1 file, live DOM measurement + real-click navigation. For E6.4 FigmaField / E6.12 Text / KAI-9356 Publish state. NO INVENTED VALUES — everything below was read from Figma's own DOM/CSS tokens.

## Input field (value fields, variables table + inspector)
- Container: **24px height**, border-radius **5px** (grouped segments split radius, e.g. `5px 0 0 5px`), background **rgb(245,245,245)**, flex align-center, **no border at rest**.
- Inner `<input>`: transparent bg, 0 padding, no border, color **rgba(0,0,0,0.898)**.
- Table-style rows: 40px height, padding `0 8px 0 12px`.

## Primary button (Share/Publish class)
- Enabled: bg **#0D99FF** (`--color-bg-brand`), text **#FFF** (`--color-text-onbrand`), radius 5px, height 32px, font 11px/450, no border.
- **Disabled: bg #D9D9D9 (`--color-bg-disabled`), text rgba(0,0,0,0.3) (`--color-text-disabled`), icon rgba(0,0,0,0.3) (`--color-icon-disabled`, confirmed on live disabled glyph), border-disabled #E6E6E6, cursor default, opacity stays 1 — NO fade.**
- Other tokens read: `--color-bg-disabled-secondary #B3B3B3`.

## Text node inspector (text layer selected — measured live)
Sections order: **Position** (Alignment segs · X/Y · Rotation+flip) → **Layout** (Resizing: `W 60 |Hug|` + `H 20 |Hug|` — value + mode label INSIDE the field) → **Appearance** (Opacity · Corner radius) → **Typography** → **Fill** (style pill e.g. `grey/12`) → **Stroke** → **Effects** → **Export**.

## Typography section (styled text; 120px tall)
- Row 1: **text-style pill** — button `[T icon] Title/Headline · 20/20` (style name · size/line-height), full width; adjacent icon-buttons: **Detach style**, **Type settings**.
- Row 2: label "Alignment" + **6 radio segments** (~29px each): LEFT/CENTER/RIGHT + TOP/CENTER/BOTTOM.
- Unstyled text (no shared style): family dropdown row + weight-name dropdown & size row replace the pill (not yet measured — select a style-less text node in CONVERTER FIXTURES to measure; residual).

## Type settings popover (styled variant, measured live)
Column ~340px: **Preview** area → rows: **Alignment** (4 segs) · **Decoration** (none/Underline/Strikethrough + more) → **List style** (none/bullet/numbered) · **Truncate text** → **Position** (default/superscript/subscript). Unstyled variant additionally carries the full font detail fields (residual to measure).

## Variables table (Figma variables view)
- Left rail: Collections list (name + count), Groups sub-list (All + per-group counts).
- Table: Name | per-mode value columns (Light/Dark), hex swatch + HEX text (originals), 40px rows.
- SSOT export shape (repo `storybook/design-system/variables/figma-export.json`): `[{ "<coll>": { modes: { "<Mode>": { <group…>: { <leaf>: {$type,$value,$scopes,$hiddenFromPublishing} } } } } }]` — collections array of 20; HEX originals; scopes incl. FONT_FAMILY etc.

## Figma UI3 file menu (extracted live from Dan's tab, 2026-07-05 — real click on the filename caret)
- Menu list width **200px**; rows **24px** tall, padding `0 8px`; shortcut text right-aligned in-row (e.g. `Export… ⇧⌘E`); chrome = the standard dark menu (same #1e1e1e / r13 / menu shadow already used by our shell menus).
- **Exact labels + order** (ONEMO DS file): `Show version history` · `Publish library…` · `Export… ⇧⌘E` · `Add to sidebar` · `Create branch…` · `File color profile` · `Duplicate` · `Rename` · `Move file…` · `Move to trash`.
- Editor mapping (build-file menu): Show version history → disabled (E6.9 backend pending) · Publish library… → commitOverrides · Create branch… → disabled (branch investigation = Kai) · Duplicate/Rename/Move to trash → disabled honest-tooltips until backend ops land · plus our RECENTS list section above the actions (localStorage) and the Finder-style "Open build folder…" entry.

## Framer Link section (from Dan's screenshot 14.00.38 — authoritative for anatomy)
- Section header: **"Link"** bold, left; **"+"** action at right (adds the link row).
- Row: muted label **"Link To"** left column; right column = rounded field, placeholder **"Page or URL…"**.
- Behavior (Framer semantics Dan asked to borrow): the field accepts an internal page (offer the pages list as suggestions) OR a raw URL; once a link is set, show an "Open in new tab" toggle row (maps to wrap-jsx-link `newTab`) and the + becomes remove/−.
- Visual language: OUR Figma chrome (FigmaField + Sec header pattern) — Framer supplies structure/behavior, not pixel styling (Dan: "borrow the behavior and function").
- Server contract (live at 1ead0f4): `wrap-jsx-link { file, line, col, href, newTab? }` — element already <a>/Link → in-place update; else wraps with `display:'contents'` (no layout shift). 422 on non-web hrefs.

## Component canvas / components anatomy (extracted 2026-07-07 from Dan's authenticated Figma tab — DOM + CSS custom properties; canvas-rendered geometry flagged)

### Component purple tokens (Figma's OWN CSS custom properties, read live — authoritative)
- `--color-icon-component` = `#8638E5` — component icons (layers rail) AND component label text
- `--color-text-component` = `#8638E5` — same value, text usage
- `--color-bg-component` = `#9747FF` — component accent/solid fills (badges, active component chrome)
- `--color-border-component` = `#E4CCFF` — light purple border (component frame outlines in UI surfaces)
- `--color-icon-component-secondary` = `#A38CC0` · `--color-bg-component-secondary` = `#7C2BDA`
- Selection (non-component): `--color-bg-selected` = `#E5F4FF`, `--color-border-selected` = `#0D99FF`

### Layers rail rows (DOM-measured)
- Row height **32px**, font **11px/400**, default ink `rgba(0,0,0,0.898)`, row bg `#fff`.
- Component rows: same metrics, ink swaps to `--color-text-component` (#8638E5) + `layerComponent` icon in `--color-icon-component`. Selected row: bg `#E5F4FF`; border/focus `#0D99FF`.
- Variant child rows: same 32px row chrome, one indent step deeper (Figma indents ~16px/level in the tree), component-purple ink inherited.

### Gallery frame / category chrome — CANVAS-RENDERED (WebGL, not DOM-measurable; use tokens + these UI3 conventions, do NOT invent beyond them)
- Component/component-set outline on canvas: 1px `#9747FF` (component accent); component-set container = DASHED `#9747FF` outline enclosing all variants; variants sit INSIDE the one dashed parent container (shared outline), not separate purple frames each.
- Canvas label above a component frame: 11px, `#8638E5` ink (same as our current figcaption — keep).
- Canvas background: `#F5F5F5` (matches our gallery bg — keep).
- Not measurable from DOM: exact label→frame gap and variant-to-variant gap on canvas. Use our existing gallery spacing (8px label gap, 32px frame gap) — flag as convention-not-measured in your self-validation; do not present as measured.

### Design⇄Components toggle chrome
- No Figma-native equivalent control exists in UI3 (Figma's Design/Prototype header tablist was REMOVED from our shell per Dan). Style the toggle with the already-extracted UI3 field/tab language: FIELD bg `#F5F5F5` container r7, selected segment = white pill r5 + `0 1px 3px rgba(0,0,0,0.12)`, 11px/500, selected ink .898 / unselected MUTE — this is the treatment already shipped at 0bca3d3; keep, it composes measured tokens only.
