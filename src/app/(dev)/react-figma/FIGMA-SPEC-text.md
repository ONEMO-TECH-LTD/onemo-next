# Figma Text/Typography section — canonical spec (extracted from Figma DOM, 2026-07-04)

> Source: figma.com panel, node 4084:26006 ("Effect" TEXT layer), Chrome console DOM walk.
> Extraction method per Dan's rule — no invented UI. This is what E2.2 conforms to.

## Section header
`Typography` — h2 span, `font: 550 11px/16px`, section row 240×40, padding `0 8px 0 16px`,
grid `184px 24px` (label | trailing action). Trailing action = **Type settings** button (24×24)
that opens the Type-settings popover.

## Body (single row, when bound to a text style)
Row 240×32, padding `0 8px 0 16px`. One button 184×24 (`padding: 0 8px 0 0`), grid inside:
`24px [style-icon] · style-name · " · <size>/<lineHeight>"`. For "Effect": icon (Title/Headline
glyph) + `Title/Headline` + ` · 20/20`. Trailing 24×24 slot.

## Alignment row (below type-style)
`Alignment` legend + a fieldset. Horizontal align = segmented (Text align left/center/right/
justified — 4 options). Then vertical-align cluster + a settings toggle (the ⇳ icon, active-blue
when the Type-settings popover is open).

## Type settings popover (opens from the header ⇳)
240px wide dialog. Sections, each a 240×32 row `padding: 0 8px`, options as a segmented control
(labels are the aria — visual is icons):
- **Preview** — 208×120 box, `padding:16px`, radius 5px, sample text `font-size:16px`.
- **Alignment** — Text align: left · center · right · justified.
- **Decoration** — None · Underline · Strikethrough (+ "Underline details" 24×24 button).
- **List style** — No list · Bulleted list · Numbered list.
- **Truncate text** — No truncation · Truncation enabled.
- **Position** (baseline) — Subscript · Normal · Superscript.

## Text-styles picker (opens from the style-name button)
Popover list, grouped by collection with scale rows: each row = `<icon> <name> · <size>/<lineHeight>`.
Groups seen: Display/Brand/Deco (2XL 72/80, XL 64/72, L 56/64, M 48/56, S 40/48), Title (Headline
20/20 …). This is the DS type token catalog — in react-figma this maps to our typography tokens
(E2-B territory); v1 Text section shows the RAW computed type values (Figma's unbound-style form).

## react-figma mapping (E2.2 — CSS truth, unbound form)
A rendered DOM text node always has computed type; we have no Figma "text style" object. So the
wired section shows Figma's **unbound Typography form** — the individual controls — reading:
- font-family  → family field (text)
- font-weight  → weight field
- font-size    → size field (px)
- line-height  → line-height field
- letter-spacing → letter-spacing field
- text-align   → the Alignment segmented control (left/center/right/justify)
Text-STYLE binding to our typography tokens is the token-picker path (E2-B). Content editing = E2.4.
Shell chrome (field 24px/5px radius, Inter 11px, 240 content, `0 8px 0 16px`) matches the existing
sections — Codex conforms the exact section shell when quota returns; wiring lands now against it.
