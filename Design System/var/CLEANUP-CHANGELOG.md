# Figma Variables JSON Cleanup Changelog

**Source:** `ONEMO-WEBB -APP 15 feb figma variables.json`
**Output:** `ONEMO-WEBB-APP-15-feb-figma-variables-CLEANED.json`
**Date:** 2026-02-16
**Total changes:** 140

---

## 7.1 — Unicode Characters (5 changes)

Replace Unicode One Dot Leader (U+2024) with ASCII period (U+002E) in dimension names.
Replace non-ASCII characters in font names with ASCII equivalents.

| # | Field | Collection | Before | After |
|---|-------|------------|--------|-------|
| 1 | name | _Primitives | `Dimensions/0․5 (2px)` | `Dimensions/0.5 (2px)` |
| 2 | name | _Primitives | `Dimensions/1․5 (6px)` | `Dimensions/1.5 (6px)` |
| 3 | name | _Primitives | `Typography/Font Family/Decorative/Crédible` | `Typography/Font Family/Decorative/Credible` |
| 4 | aliasOf | 3. Spacing | `_Primitives::Dimensions/0․5 (2px)` | `_Primitives::Dimensions/0.5 (2px)` |
| 5 | aliasOf | 3. Spacing | `_Primitives::Dimensions/1․5 (6px)` | `_Primitives::Dimensions/1.5 (6px)` |

---

## 7.2 — Double Spaces (1 changes)

Replace double spaces with single spaces in variable names.

| # | Field | Collection | Before | After |
|---|-------|------------|--------|-------|
| 1 | name | _Alias | `Typography/Font-Family/Secondary  - Plain` | `Typography/Font-Family/Secondary - Plain` |

---

## 7.3 — Inconsistent Separators in _Primitives (128 changes)

Replace space-separated path segments with hyphen-separated in `_Primitives` collection to match `_Alias` convention:
- `Font Family` → `Font-Family`
- `Letter Spacing` → `Letter-Spacing`
- `Type Scale` → `Type-Scale`
- `Line Height` → `Line-Height`
- `Font Size` → `Font-Size`

Also updates `aliasOf` references pointing to renamed `_Primitives` variables.

| # | Field | Collection | Before | After |
|---|-------|------------|--------|-------|
| 1 | name | _Primitives | `Typography/Font Family/Basic/Satoshi` | `Typography/Font-Family/Basic/Satoshi` |
| 2 | name | _Primitives | `Typography/Font Family/Basic/Oxanium` | `Typography/Font-Family/Basic/Oxanium` |
| 3 | name | _Primitives | `Typography/Font Family/Basic/Chillax` | `Typography/Font-Family/Basic/Chillax` |
| 4 | name | _Primitives | `Typography/Font Family/Basic/Nippo` | `Typography/Font-Family/Basic/Nippo` |
| 5 | name | _Primitives | `Typography/Font Family/Basic/Jetbrains Mono` | `Typography/Font-Family/Basic/Jetbrains Mono` |
| 6 | name | _Primitives | `Typography/Font Family/Decorative/Electric Blue` | `Typography/Font-Family/Decorative/Electric Blue` |
| 7 | name | _Primitives | `Typography/Font Family/Decorative/Chaumont` | `Typography/Font-Family/Decorative/Chaumont` |
| 8 | name | _Primitives | `Typography/Font Family/Decorative/Pelowlawa` | `Typography/Font-Family/Decorative/Pelowlawa` |
| 9 | name | _Primitives | `Typography/Font Family/Decorative/Array` | `Typography/Font-Family/Decorative/Array` |
| 10 | name | _Primitives | `Typography/Font Family/Decorative/Random` | `Typography/Font-Family/Decorative/Random` |
| 11 | name | _Primitives | `Typography/Font Family/Decorative/Pyxis` | `Typography/Font-Family/Decorative/Pyxis` |
| 12 | name | _Primitives | `Typography/Font Family/Decorative/BT Super` | `Typography/Font-Family/Decorative/BT Super` |
| 13 | name | _Primitives | `Typography/Font Family/Decorative/Striper` | `Typography/Font-Family/Decorative/Striper` |
| 14 | name | _Primitives | `Typography/Font Family/Decorative/Typefesse` | `Typography/Font-Family/Decorative/Typefesse` |
| 15 | name | _Primitives | `Typography/Font Family/Decorative/Modelo` | `Typography/Font-Family/Decorative/Modelo` |
| 16 | name | _Primitives | `Typography/Font Family/Decorative/Anthony` | `Typography/Font-Family/Decorative/Anthony` |
| 17 | name | _Primitives | `Typography/Font Family/Decorative/Half` | `Typography/Font-Family/Decorative/Half` |
| 18 | name | _Primitives | `Typography/Font Family/Decorative/Kollektiiv` | `Typography/Font-Family/Decorative/Kollektiiv` |
| 19 | name | _Primitives | `Typography/Font Family/Decorative/Plantasia Myrtillo` | `Typography/Font-Family/Decorative/Plantasia Myrtillo` |
| 20 | name | _Primitives | `Typography/Font Family/Decorative/Credible` | `Typography/Font-Family/Decorative/Credible` |
| 21 | name | _Primitives | `Typography/Font Family/Decorative/Tanker` | `Typography/Font-Family/Decorative/Tanker` |
| 22 | name | _Primitives | `Typography/Font Family/Decorative/Boxing` | `Typography/Font-Family/Decorative/Boxing` |
| 23 | name | _Primitives | `Typography/Font Family/Decorative/Fun Ghetto` | `Typography/Font-Family/Decorative/Fun Ghetto` |
| 24 | name | _Primitives | `Typography/Font Family/Decorative/New Value` | `Typography/Font-Family/Decorative/New Value` |
| 25 | name | _Primitives | `Typography/Font Family/Decorative/Kobata` | `Typography/Font-Family/Decorative/Kobata` |
| 26 | name | _Primitives | `Typography/Font Family/Decorative/Lobular` | `Typography/Font-Family/Decorative/Lobular` |
| 27 | name | _Primitives | `Typography/Font Family/Decorative/Sniglet` | `Typography/Font-Family/Decorative/Sniglet` |
| 28 | name | _Primitives | `Typography/Font Family/Decorative/Betatrone` | `Typography/Font-Family/Decorative/Betatrone` |
| 29 | name | _Primitives | `Typography/Type Scale/8` | `Typography/Type-Scale/8` |
| 30 | name | _Primitives | `Typography/Type Scale/10` | `Typography/Type-Scale/10` |
| 31 | name | _Primitives | `Typography/Type Scale/12` | `Typography/Type-Scale/12` |
| 32 | name | _Primitives | `Typography/Type Scale/14` | `Typography/Type-Scale/14` |
| 33 | name | _Primitives | `Typography/Type Scale/16` | `Typography/Type-Scale/16` |
| 34 | name | _Primitives | `Typography/Type Scale/18` | `Typography/Type-Scale/18` |
| 35 | name | _Primitives | `Typography/Type Scale/20` | `Typography/Type-Scale/20` |
| 36 | name | _Primitives | `Typography/Type Scale/22` | `Typography/Type-Scale/22` |
| 37 | name | _Primitives | `Typography/Type Scale/24` | `Typography/Type-Scale/24` |
| 38 | name | _Primitives | `Typography/Type Scale/26` | `Typography/Type-Scale/26` |
| 39 | name | _Primitives | `Typography/Type Scale/28` | `Typography/Type-Scale/28` |
| 40 | name | _Primitives | `Typography/Type Scale/32` | `Typography/Type-Scale/32` |
| 41 | name | _Primitives | `Typography/Type Scale/40` | `Typography/Type-Scale/40` |
| 42 | name | _Primitives | `Typography/Type Scale/44` | `Typography/Type-Scale/44` |
| 43 | name | _Primitives | `Typography/Type Scale/48` | `Typography/Type-Scale/48` |
| 44 | name | _Primitives | `Typography/Type Scale/56` | `Typography/Type-Scale/56` |
| 45 | name | _Primitives | `Typography/Type Scale/64` | `Typography/Type-Scale/64` |
| 46 | name | _Primitives | `Typography/Type Scale/72` | `Typography/Type-Scale/72` |
| 47 | name | _Primitives | `Typography/Type Scale/80` | `Typography/Type-Scale/80` |
| 48 | name | _Primitives | `Typography/Type Scale/88` | `Typography/Type-Scale/88` |
| 49 | name | _Primitives | `Typography/Type Scale/96` | `Typography/Type-Scale/96` |
| 50 | name | _Primitives | `Typography/Type Scale/128` | `Typography/Type-Scale/128` |
| 51 | name | _Primitives | `Typography/Type Scale/360` | `Typography/Type-Scale/360` |
| 52 | name | _Primitives | `Typography/Letter Spacing/-100` | `Typography/Letter-Spacing/-100` |
| 53 | name | _Primitives | `Typography/Letter Spacing/-80` | `Typography/Letter-Spacing/-80` |
| 54 | name | _Primitives | `Typography/Letter Spacing/-60` | `Typography/Letter-Spacing/-60` |
| 55 | name | _Primitives | `Typography/Letter Spacing/-40` | `Typography/Letter-Spacing/-40` |
| 56 | name | _Primitives | `Typography/Letter Spacing/-20` | `Typography/Letter-Spacing/-20` |
| 57 | name | _Primitives | `Typography/Letter Spacing/-18` | `Typography/Letter-Spacing/-18` |
| 58 | name | _Primitives | `Typography/Letter Spacing/-16` | `Typography/Letter-Spacing/-16` |
| 59 | name | _Primitives | `Typography/Letter Spacing/-14` | `Typography/Letter-Spacing/-14` |
| 60 | name | _Primitives | `Typography/Letter Spacing/-12` | `Typography/Letter-Spacing/-12` |
| 61 | name | _Primitives | `Typography/Letter Spacing/-10` | `Typography/Letter-Spacing/-10` |
| 62 | name | _Primitives | `Typography/Letter Spacing/-8` | `Typography/Letter-Spacing/-8` |
| 63 | name | _Primitives | `Typography/Letter Spacing/-6` | `Typography/Letter-Spacing/-6` |
| 64 | name | _Primitives | `Typography/Letter Spacing/-4` | `Typography/Letter-Spacing/-4` |
| 65 | name | _Primitives | `Typography/Letter Spacing/-2` | `Typography/Letter-Spacing/-2` |
| 66 | name | _Primitives | `Typography/Letter Spacing/-1` | `Typography/Letter-Spacing/-1` |
| 67 | name | _Primitives | `Typography/Letter Spacing/zero` | `Typography/Letter-Spacing/zero` |
| 68 | name | _Primitives | `Typography/Letter Spacing/+1` | `Typography/Letter-Spacing/+1` |
| 69 | name | _Primitives | `Typography/Letter Spacing/+2` | `Typography/Letter-Spacing/+2` |
| 70 | name | _Primitives | `Typography/Letter Spacing/+4` | `Typography/Letter-Spacing/+4` |
| 71 | name | _Primitives | `Typography/Letter Spacing/+6` | `Typography/Letter-Spacing/+6` |
| 72 | name | _Primitives | `Typography/Letter Spacing/+8` | `Typography/Letter-Spacing/+8` |
| 73 | name | _Primitives | `Typography/Letter Spacing/+10` | `Typography/Letter-Spacing/+10` |
| 74 | name | _Primitives | `Typography/Letter Spacing/+12` | `Typography/Letter-Spacing/+12` |
| 75 | name | _Primitives | `Typography/Letter Spacing/+14` | `Typography/Letter-Spacing/+14` |
| 76 | name | _Primitives | `Typography/Letter Spacing/+16` | `Typography/Letter-Spacing/+16` |
| 77 | name | _Primitives | `Typography/Letter Spacing/+18` | `Typography/Letter-Spacing/+18` |
| 78 | name | _Primitives | `Typography/Letter Spacing/+20` | `Typography/Letter-Spacing/+20` |
| 79 | name | _Primitives | `Typography/Letter Spacing/+40` | `Typography/Letter-Spacing/+40` |
| 80 | name | _Primitives | `Typography/Letter Spacing/+60` | `Typography/Letter-Spacing/+60` |
| 81 | name | _Primitives | `Typography/Letter Spacing/+80` | `Typography/Letter-Spacing/+80` |
| 82 | name | _Primitives | `Typography/Letter Spacing/+100` | `Typography/Letter-Spacing/+100` |
| 83 | name | _Primitives | `Typography/Type Scale/36` | `Typography/Type-Scale/36` |
| 84 | aliasOf | _Alias | `_Primitives::Typography/Font Family/Basic/Satoshi` | `_Primitives::Typography/Font-Family/Basic/Satoshi` |
| 85 | aliasOf | _Alias | `_Primitives::Typography/Font Family/Basic/Chillax` | `_Primitives::Typography/Font-Family/Basic/Chillax` |
| 86 | aliasOf | _Alias | `_Primitives::Typography/Font Family/Decorative/Electric Blue` | `_Primitives::Typography/Font-Family/Decorative/Electric Blue` |
| 87 | aliasOf | _Alias | `_Primitives::Typography/Font Family/Basic/Oxanium` | `_Primitives::Typography/Font-Family/Basic/Oxanium` |
| 88 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/72` | `_Primitives::Typography/Type-Scale/72` |
| 89 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/64` | `_Primitives::Typography/Type-Scale/64` |
| 90 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/56` | `_Primitives::Typography/Type-Scale/56` |
| 91 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/48` | `_Primitives::Typography/Type-Scale/48` |
| 92 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/40` | `_Primitives::Typography/Type-Scale/40` |
| 93 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/36` | `_Primitives::Typography/Type-Scale/36` |
| 94 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/32` | `_Primitives::Typography/Type-Scale/32` |
| 95 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/24` | `_Primitives::Typography/Type-Scale/24` |
| 96 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/20` | `_Primitives::Typography/Type-Scale/20` |
| 97 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/18` | `_Primitives::Typography/Type-Scale/18` |
| 98 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/16` | `_Primitives::Typography/Type-Scale/16` |
| 99 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/14` | `_Primitives::Typography/Type-Scale/14` |
| 100 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/12` | `_Primitives::Typography/Type-Scale/12` |
| 101 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/10` | `_Primitives::Typography/Type-Scale/10` |
| 102 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/80` | `_Primitives::Typography/Type-Scale/80` |
| 103 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/72` | `_Primitives::Typography/Type-Scale/72` |
| 104 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/64` | `_Primitives::Typography/Type-Scale/64` |
| 105 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/56` | `_Primitives::Typography/Type-Scale/56` |
| 106 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/48` | `_Primitives::Typography/Type-Scale/48` |
| 107 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/44` | `_Primitives::Typography/Type-Scale/44` |
| 108 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/40` | `_Primitives::Typography/Type-Scale/40` |
| 109 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/32` | `_Primitives::Typography/Type-Scale/32` |
| 110 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/28` | `_Primitives::Typography/Type-Scale/28` |
| 111 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/26` | `_Primitives::Typography/Type-Scale/26` |
| 112 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/24` | `_Primitives::Typography/Type-Scale/24` |
| 113 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/22` | `_Primitives::Typography/Type-Scale/22` |
| 114 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/18` | `_Primitives::Typography/Type-Scale/18` |
| 115 | aliasOf | _Alias | `_Primitives::Typography/Type Scale/16` | `_Primitives::Typography/Type-Scale/16` |
| 116 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/+10` | `_Primitives::Typography/Letter-Spacing/+10` |
| 117 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/+8` | `_Primitives::Typography/Letter-Spacing/+8` |
| 118 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/+6` | `_Primitives::Typography/Letter-Spacing/+6` |
| 119 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/+4` | `_Primitives::Typography/Letter-Spacing/+4` |
| 120 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/+2` | `_Primitives::Typography/Letter-Spacing/+2` |
| 121 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/+1` | `_Primitives::Typography/Letter-Spacing/+1` |
| 122 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/zero` | `_Primitives::Typography/Letter-Spacing/zero` |
| 123 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/-1` | `_Primitives::Typography/Letter-Spacing/-1` |
| 124 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/-2` | `_Primitives::Typography/Letter-Spacing/-2` |
| 125 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/-4` | `_Primitives::Typography/Letter-Spacing/-4` |
| 126 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/-6` | `_Primitives::Typography/Letter-Spacing/-6` |
| 127 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/-8` | `_Primitives::Typography/Letter-Spacing/-8` |
| 128 | aliasOf | _Alias | `_Primitives::Typography/Letter Spacing/-10` | `_Primitives::Typography/Letter-Spacing/-10` |

---

## 7.4 — Letter Spacing Abbreviation (6 changes)

Normalize `LeSp` to `LeS` in letter spacing alias names for consistency with the 3-character abbreviation convention.

Also updates `aliasOf` references pointing to renamed variables.

| # | Field | Collection | Before | After |
|---|-------|------------|--------|-------|
| 1 | name | _Alias | `Typography/Letter-Spacing/LeSp+10` | `Typography/Letter-Spacing/LeS+10` |
| 2 | aliasOf | 6. Typography | `_Alias::Typography/Letter-Spacing/LeSp+10` | `_Alias::Typography/Letter-Spacing/LeS+10` |
| 3 | aliasOf | 6. Typography | `_Alias::Typography/Letter-Spacing/LeSp+10` | `_Alias::Typography/Letter-Spacing/LeS+10` |
| 4 | aliasOf | 6. Typography | `_Alias::Typography/Letter-Spacing/LeSp+10` | `_Alias::Typography/Letter-Spacing/LeS+10` |
| 5 | aliasOf | 6. Typography | `_Alias::Typography/Letter-Spacing/LeSp+10` | `_Alias::Typography/Letter-Spacing/LeS+10` |
| 6 | aliasOf | 6. Typography | `_Alias::Typography/Letter-Spacing/LeSp+10` | `_Alias::Typography/Letter-Spacing/LeS+10` |

---

## Intentionally NOT Fixed

These issues are handled by the pipeline during transformation, not in the source JSON:

- **7.5 — Parenthetical annotations** (e.g., `(2px)`, `(Bold)`): Intentional in Figma for readability. Pipeline strips them.
- **7.6 — Underscore state separators** (e.g., `text-primary_on-brand`): Intentional in Figma for readability. Pipeline converts them.
- **7.7 — Font style casing** (e.g., `SemiBold` vs `Semi Bold`): Pipeline maps to numeric weights.
- **7.8 — Font-Family slot naming** (e.g., `Primary`, `Secondary - Plain`): Pipeline handles semantic renaming.

---

## Summary

| Category | Changes |
|----------|---------|
| 7.1 Unicode Characters | 5 |
| 7.2 Double Spaces | 1 |
| 7.3 Inconsistent Separators | 128 |
| 7.4 Letter Spacing Abbreviation | 6 |
| **Total** | **140** |
