# 10 — Performance Contracts

> Launch budgets, not aspirational targets. Mobile-first constraints.
> Consolidation: U7 (4-level fallback ladder), U8 (still-first pattern), route budgets from P2.
> Source: 3D Scene Experience Brief V2.

## Phase: [Phase 1] budgets defined, enforced throughout

## Route Budgets [Phase 1]

| Budget | Target | Hard stop |
|--------|--------|-----------|
| Scene loaded + interactive | **< 6s** on 4G mobile | **10s** |
| Autosave round-trip | **< 1s** | **3s** |
| Review submission to proof | **< 15s** | **30s** |

## Rendering Budget [Phase 1]

| Budget item | Target | Hard stop |
|------------|--------|-----------|
| Interactive frame rate | **45 fps preferred** | **30 fps floor** on representative mobile |
| GLB visible geometry | **~75k triangles** | Review above **120k** |
| Draw calls | **< 50** | Review above **80** |
| Applied user texture long edge | **1024px** | Do not exceed **1536px** without profiling |
| Static material maps | **1024 sq** | Review above **2048 sq** per map |
| Environment map | **1k for mobile** | Avoid large HDRI payloads |
| Gesture response latency | **< 16ms** (one frame) | Visible lag = trust-breaking |

## Mobile Baseline [Phase 1]

- **375px viewport** is the baseline width (iPhone SE class)
- All controls must be readable and one-handed at 375px
- Touch targets: minimum 44x44px
- No hover-dependent interactions — touch-first

## Fallback Strategy (U7) [Phase 1]

React-Konva stays dead. The projection fallback is a bounded failure mode, not a second editor.

### Level 1: Normal

3D scene loads and renders. Full orbit, gesture, material switching. Demand-based frame loop (`frameloop="demand"`). This is the normal path.

### Level 2: Projection Fallback (D7)

WebGL available but degraded (frame rate below threshold, context lost recovery fails):

```typescript
// create/core/ProjectionFallbackCanvas.tsx
// Face-only projected compose preview from canonical print area
// Numeric controls available for placement adjustment
// Three-quarter and back views use poster stills
interface ProjectionFallbackCanvasProps {
  printArea: PrintArea
  artwork: ArtworkRef
  placement: Placement
  stills: FallbackStill[]            // for non-face views
  onPlacementChange: (p: Placement) => void
}
```

Features:
- Projects face artwork onto 2D representation of the print area
- Allows numeric editing (x, y, scale, rotation via input fields)
- Non-face views (three-quarter, back) rendered as static stills
- Same design state contract — placements commit to the same DesignSession

### Level 3: No 3D

WebGL completely unavailable (old device, disabled, blocked):

- Review shows pre-generated proof images
- User can still complete checkout flow
- No live editing — directed to resume on a capable device

### Detection and Switching

```typescript
function useWebGLHealth() {
  const fpsRef = useRef<number[]>([])
  const contextLostRef = useRef(false)

  // Monitor frame rate over 3-second window
  useFrame((_, delta) => {
    fpsRef.current.push(1 / delta)
    if (fpsRef.current.length > 180) fpsRef.current.shift()
  })

  const averageFps = fpsRef.current.length > 0
    ? fpsRef.current.reduce((a, b) => a + b) / fpsRef.current.length
    : 60

  // Level 1 → Level 2: sustained low FPS
  if (averageFps < 20 && fpsRef.current.length > 60) return 'projection_fallback'
  // Context lost → Level 3
  if (contextLostRef.current) return 'no_3d'
  return 'live'
}
```

## Asset Requirements [Phase 1]

### GLB / Model

- One launch GLB shape per product type (Standard Effect, TV Retro, Cap)
- Mesh naming and slot structure must be stable and documented
- Export contract must use `userData.onemo.*` metadata tags
- Clean material/application boundaries for face, back, frame, hardware
- Mesh manifest hash validates structure hasn't changed (ScenePackageRef)

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

## Demand-Based Frame Loop [Phase 1]

From prototype: `frameloop="demand"` — only render when scene changes (orbit, material update, gesture).

Invalidation triggers:
- Orbit control movement
- Material/color change
- Artwork texture swap
- Resize event
- Camera preset switch

## UX Performance Contracts [Phase 2]

| Interaction | Latency budget | Feedback mechanism |
|-------------|---------------|-------------------|
| Color swatch tap | < 100ms | Optimistic material update (Class 2 state) |
| Artwork drag | < 16ms per frame | Ref-based delta (Class 3 state) |
| Size switch | < 200ms | Variant axis lookup + rerender |
| Save indicator | < 2s after last edit | AutosaveController debounce |
| Review submission | < 500ms response | Action safety envelope blocks double-submit |

See [13-state-management.md](13-state-management.md) for the three-class state model that enforces these budgets.
