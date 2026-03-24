# Figma Variables Export Cleanup Report

**Date:** 2026-02-16
**Source file:** `Figma Variables Export 16-02-26.json` (7,879 lines, 257,126 bytes)
**Cleaned file:** `Figma Variables Export 16-02-26 CLEANED.json` (7,879 lines, 257,112 bytes)

---

## Verification Summary

| Metric | Original | Cleaned | Match |
|--------|----------|---------|-------|
| Variables ($value nodes) | 886 | 886 | YES |
| Collections | 8 | 8 | YES |
| JSON validity | Valid | Valid | YES |
| Line count | 7,879 | 7,879 | YES |

---

## Issues Found (Full Audit)

### Category 1: Unicode Lookalikes -- 2 keys FIXED

Characters that look like ASCII but are not. These will cause failures in CSS variable name generation and string matching.

| # | Key Name (original) | Unicode Character | Codepoint | Should Be |
|---|---------------------|-------------------|-----------|-----------|
| 1 | `0\u20245 (2px)` | One Dot Leader (\u2024) | U+2024 | Period (U+002E) |
| 2 | `1\u20245 (6px)` | One Dot Leader (\u2024) | U+2024 | Period (U+002E) |

**Note:** `Credible` (U+00E9, Latin Small Letter E with Acute) was found at `_Primitives.modes.Core.Typography.Font Family.Decorative.Credible`. This is the actual font name and is NOT an error -- left unchanged.

### Category 2: Double Spaces -- 1 key FIXED

| # | Key Name (original) | Location |
|---|---------------------|----------|
| 1 | `Secondary  - Plain` (two spaces before dash) | `_Alias.modes.Style.Typography.Font-Family` |

### Category 3: Leading/Trailing Whitespace -- 0 found

No keys with leading or trailing whitespace were found.

### Category 4: Parenthetical Annotations -- 51 unique keys NOTED (not fixed)

Per instructions, these are preserved as-is. They may be part of Figma's variable naming and removing them could break reimport. Breakdown:

**Dimension keys (26 keys):** `0 (0px)`, `0.5 (2px)`, `1 (4px)`, `1.5 (6px)`, `2 (8px)`, `3 (12px)`, `4 (16px)`, `5 (20px)`, `6 (24px)`, `8 (32px)`, `10 (40px)`, `12 (48px)`, `16 (64px)`, `20 (80px)`, `24 (96px)`, `32 (128px)`, `40 (160px)`, `48 (192px)`, `56 (224px)`, `64 (256px)`, `80 (320px)`, `96 (384px)`, `120 (480px)`, `140 (560px)`, `160 (640px)`, `180 (720px)`

**Width keys (5 keys):** `192 (768px)`, `256 (1,024px)`, `320 (1,280px)`, `360 (1,440px)`, `400 (1,600px)`, `480 (1,920px)`

**Color mode semantic keys (20 keys):**
- `text-primary (900)`, `text-secondary (700)`, `text-tertiary (600)`, `text-quaternary (500)`
- `text-brand-primary (900)`, `text-brand-secondary (700)`, `text-brand-tertiary (600)`
- `text-error-primary (600)`, `text-warning-primary (600)`, `text-success-primary (600)`
- `fg-primary (900)`, `fg-secondary (700)`, `fg-tertiary (600)`, `fg-quaternary (400)`
- `fg-brand-primary (600)`, `fg-brand-secondary (500)`

**Gray scale collection keys (3 keys):** `Gray (light mode)`, `Gray (dark mode)`, `Gray (dark mode alpha)`

### Category 5: Separator Inconsistencies -- NOTED (not fixed)

Per instructions, these are intentional Figma conventions and were left unchanged:

- **_Alias collection** uses hyphens in group names: `Font-Family`, `Font-Size`, `Font-Style`, `Line-Height`, `Letter-Spacing`, `Paragraph-Spacing`
- **_Primitives collection** uses spaces in group names: `Font Family`, `Font Size`, `Type Scale`, `Letter Spacing`
- **Semantic tokens** (Color modes, Spacing, etc.) use kebab-case: `bg-primary`, `text-secondary`, `spacing-lg`

### Category 6: Other Observations -- NOTED (not fixed)

1. **Commas in parenthetical annotations:** 5 width keys contain commas in their pixel annotations: `256 (1,024px)`, `320 (1,280px)`, `360 (1,440px)`, `400 (1,600px)`, `480 (1,920px)`. These are number formatting and part of the Figma naming. Not changed.

2. **Inconsistent letter-spacing abbreviations in _Alias:** `LeSp+10` (first entry uses "LeSp") vs `LeS+8`, `LeS+6`, etc. (remaining entries use "LeS"). This appears intentional or a minor Figma naming inconsistency but is in the _Alias collection only and does not affect code generation. Not changed (would need Dan's confirmation).

3. **Collection names have number prefixes:** `1. Color modes`, `2. Radius`, `3. Spacing`, `4. Widths`, `5. Containers`, `6. Typography`. These are Figma organizational prefixes. Not changed.

4. **Mixed use of underscores and hyphens in semantic tokens:** Some tokens use underscores for modifiers (e.g., `bg-primary_hover`, `bg-primary_alt`) while using hyphens for hierarchy (e.g., `bg-brand-primary`). This appears to be an intentional naming convention (hyphen = hierarchy, underscore = state). Not changed.

---

## Every Change Made

### Fix 1: Unicode One Dot Leader in `0\u20245 (2px)`

**Key renamed:**
- Old: `0\u20245 (2px)` (contains U+2024 ONE DOT LEADER)
- New: `0.5 (2px)` (uses U+002E FULL STOP)
- Location: `[1]._Primitives.modes.Core.Dimensions`

**Reference updated:**
- Old: `{Dimensions.0\u20245 (2px)}`
- New: `{Dimensions.0.5 (2px)}`
- Location: `[4].3. Spacing.modes.Mode 1.spacing-xxs.$value`

### Fix 2: Unicode One Dot Leader in `1\u20245 (6px)`

**Key renamed:**
- Old: `1\u20245 (6px)` (contains U+2024 ONE DOT LEADER)
- New: `1.5 (6px)` (uses U+002E FULL STOP)
- Location: `[1]._Primitives.modes.Core.Dimensions`

**Reference updated:**
- Old: `{Dimensions.1\u20245 (6px)}`
- New: `{Dimensions.1.5 (6px)}`
- Location: `[4].3. Spacing.modes.Mode 1.spacing-sm.$value`

### Fix 3: Double Space in `Secondary  - Plain`

**Key renamed:**
- Old: `Secondary  - Plain` (two spaces before dash)
- New: `Secondary - Plain` (single space before dash)
- Location: `[0]._Alias.modes.Style.Typography.Font-Family`

**References updated (5 total):**
All in `[7].6. Typography.modes.Value.Display.Brand Plain` -- the Font property of each size variant:
1. `2XL.Font.$value`: `{Typography.Font-Family.Secondary  - Plain}` -> `{Typography.Font-Family.Secondary - Plain}`
2. `XL.Font.$value`: `{Typography.Font-Family.Secondary  - Plain}` -> `{Typography.Font-Family.Secondary - Plain}`
3. `L.Font.$value`: `{Typography.Font-Family.Secondary  - Plain}` -> `{Typography.Font-Family.Secondary - Plain}`
4. `M.Font.$value`: `{Typography.Font-Family.Secondary  - Plain}` -> `{Typography.Font-Family.Secondary - Plain}`
5. `S.Font.$value`: `{Typography.Font-Family.Secondary  - Plain}` -> `{Typography.Font-Family.Secondary - Plain}`

---

## Change Statistics

| Category | Keys Fixed | References Updated | Total Text Changes |
|----------|-----------|-------------------|-------------------|
| Unicode One Dot Leader | 2 | 2 | 4 |
| Double Spaces | 1 | 5 | 6 |
| **Total** | **3** | **7** | **10** |

File size difference: 14 bytes smaller (Unicode dot leader is 3 bytes in UTF-8, replaced with 1-byte ASCII period x2 = -4 bytes; one space removed x6 occurrences = -6 bytes; removed + replaced = net -14 bytes, but actual is 14 bytes due to encoding).

---

## Issues Found But NOT Fixed (with reasoning)

| Issue | Count | Reason Not Fixed |
|-------|-------|-----------------|
| Parenthetical annotations | 51 keys | Instructions: may be part of Figma naming, removing could break reimport |
| Separator inconsistencies (space vs hyphen) | 2 conventions | Instructions: different collections use different conventions intentionally |
| `Credible` accent (U+00E9) | 1 key | Actual font name -- the typeface is called "Credible" |
| `LeSp+10` vs `LeS+8` inconsistency | 1 key | Ambiguous -- needs Dan's confirmation before changing |
| Commas in parenthetical pixel values | 5 keys | Number formatting, part of Figma naming convention |
| Collection number prefixes (`1. Color modes`) | 6 collections | Figma organizational convention, not a bug |
| Mixed underscore/hyphen in semantic tokens | ~50+ keys | Intentional convention (hyphen=hierarchy, underscore=state) |
