# react-figma editor → `react-figma-editor` repo — MIGRATION MANIFEST v6

**Author:** @s58-designer · **2026-07-14** · supersedes v5 (`7d42d4bc` / `ed8139da…`) with ONE docs-only correction (V5 census). **PATHSET-v5 and every other v5/v4 provision stand UNCHANGED.** Zero source mutation; no repo; filter-repo approval-held.

## Correction — extension census (was stale inclusive-set counts)
v5 stated `.ts×68 .tsx×8 … = 90` — computed on the OLD canvas-inclusive parent-dir set. Replayed on the exact PATHSET-v5:

**Command (verbatim):**
```
git ls-files -- <PATHSET-v5 entries> | sed -E 's#.*/##; s#.*(\.[^.]+)$#\1#' | sort | uniq -c
```
**Result (replayed 2026-07-14, matches QA's independent replay):**
`.ts×67 · .tsx×7 · .md×5 · .mjs×3 · .cjs×2 · .css×1 · .cts×1 · .json×1 · .gitkeep×1 = **88 files**`

The 6-file literal-scan result, `.cts`/`.css` clean status, `.gitkeep` disposition, count 366, tree assertions, 20-file audit allowlist — all unchanged from v5.
