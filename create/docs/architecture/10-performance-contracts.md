# 10 — Performance Contracts

> Launch budgets, not aspirational targets. Mobile-first constraints.
> Source: 3D Scene Experience Brief V2.

## Phase: [v1] budgets defined, enforced throughout

## Rendering Budget [v1]

| Budget item | Target | Hard stop |
|------------|--------|-----------|
| Interactive frame rate | **45 fps preferred** | **30 fps floor** on representative mobile |
| GLB visible geometry | **~75k triangles** | Review above **120k** |
| Draw calls | **< 50** | Review above **80** |
| Applied user texture long edge | **1024px** | Do not exceed **1536px** without profiling |
| Static material maps | **1024 sq** | Review above **2048 sq** per map |
| Environment map | **1k for mobile** | Avoid large HDRI payloads |
| Scene startup | Feels fast (no empty frame stare) | Still-first / live-upgrade if conspicuous |
| Gesture response latency | **< 16ms** (one frame) | Visible lag = trust-breaking |

## Mobile Baseline [v1]

- **375px viewport** is the baseline width (iPhone SE class)
- All controls must be readable and one-handed at 375px
- Touch targets: minimum 44x44px
- No hover-dependent interactions — touch-first

## Asset Requirements [v1]

### GLB / Model

- One launch GLB shape per product type (Standard Effect, TV Retro, Cap)
- Mesh naming and slot structure must be stable and documented
- Export contract must use `userData.onemo.*` metadata tags
- Clean material/application boundaries for face, back, frame, hardware

### UV / Texture

- Artwork-bearing region: predictable UV behavior for gesture placement
- Applied texture must align with canonical placement before review
- Texture seams must not cross the primary visible artwork zone in MVP

### Material Presets

| Material | roughness | metalness | clearcoat | Normal map |
|----------|-----------|-----------|-----------|-----------|
| Ultra suede | 0.85-0.95 | 0 | 0 | Suede grain (matte, textured) |
| Velvet | 0.75-0.85 | 0 | 0 | Velvet pile |
| Semi-gloss | 0.3-0.5 | 0 | 0.3-0.5 | Smooth with slight texture |
| Gloss | 0.1-0.2 | 0 | 0.7-1.0 | Smooth/mirror-like |
| Leather (back) | 0.7-0.85 | 0 | 0 | Leather grain |

Each material = different texture files, not code changes.

## Fallback Strategy [v1]

| Condition | Fallback |
|-----------|----------|
| WebGL unavailable | Static fallback stills (4 views minimum) |
| Scene startup slow | Still-first, live scene upgrade when ready |
| Texture load fails | Render without artwork, show upload prompt |
| Environment load fails | Use drei preset fallback |
| Frame rate drops below 24fps | Reduce texture resolution, disable shadows |

## Demand-Based Frame Loop [v1]

From prototype: `frameloop="demand"` — only render when scene changes (orbit, material update, gesture).

Invalidation triggers:
- Orbit control movement
- Material/color change
- Artwork texture swap
- Resize event
- Camera preset switch
