# 08 — Manufacturing Pipeline

> From approved DesignSession to immutable ManufacturingPackage.
> Method-specific compilers transform normalized placement into production output.

## Phase: [v3]

## Overview [v3]

```
Trigger (approval / ops compile / order webhook recovery)
  → Load approved DesignSession + pinned ProductSpec + pinned ScenePreset
  → Route to method compiler via ProductSpec.subtype_routes
  → Transform normalized placement → production coordinates
  → Write immutable ManufacturingPackage
  → Store production_asset_ref for Shopify line-item
```

## Construction Methods [v3]

| Method | Subtype | Compiler | Key output |
|--------|---------|----------|-----------|
| A (edge trim) | `edge_trim` | `compileMethodA` | Print raster + cutline SVG + registration JSON |
| B (magnetic caps) | `plain` | `compileMethodB` | Print raster + cap placement + QA preview |
| C (TV retro) | `tv_retro` | `compileMethodC` | Patch raster + frame registration + QA preview |
| Solid | (any, no sublimation) | `compileSolid` | BOM JSON + QA preview |

## Coordinate System Contract [v3]

**Hard rule:** Store normalized placement in print-area coordinates only. Never store raw screen pixels as product truth.

```
Normalized placement (0-1 in print area UV space)
  → Compiler applies: print area bounds + output DPI + bleed + safe inset
  → Production coordinates (pixels at production DPI, mm offsets)
```

## ManufacturingPackage Output Roles [v3]

| Output role | What it is |
|------------|-----------|
| `print_raster` | Final print-ready raster at production resolution |
| `patch_raster` | Image patch for method C (smaller than full face) |
| `cutline_svg` | Die-cut path for shaped/trimmed edges |
| `registration_json` | Physical alignment marks and magnet positions |
| `qa_preview` | Visual preview for QA verification |
| `bom_json` | Bill of materials for solid-color products |

## Version Pinning [v3]

Every ManufacturingPackage records:
- `designRevision` — exact revision compiled from
- `compilerVersion` — which compiler code was used
- Pinned ProductSpec version (via DesignSession)
- Pinned ScenePreset version (via DesignSession)

Old orders are always reproducible from these pins.

## Triggers [v3]

- Approval path (user approves → compile queued)
- Explicit ops compile (admin action)
- Order webhook recovery (if package missing at fulfillment)
