# 01 — Viewer Shell

> The product-agnostic R3F canvas. Renders any 3D scene with camera, controls, environment, and lighting.
> Both Studio and Create use this shell. Studio wraps it with the editor. Create wraps it with customer controls.

## Phase: [v1]

## Contract [v1]

```typescript
interface ViewerShellProps {
  config: ViewerSceneConfig
  modelUrl?: string
  isEditing?: boolean
  children?: React.ReactNode
  onCreated?: (ctx: ViewerContext) => void
  orbitControlsRef?: React.RefObject<OrbitControls | null>
  onModelReady?: (root: THREE.Object3D) => void
  onRenderReady?: () => void
}

interface ViewerContext {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
}

interface ViewerSceneConfig {
  camera: CameraConfig
  environment: EnvironmentConfig
  renderer: RendererConfig
  scene: SceneConfig
}
```

## What ViewerShell Does [v1]

1. Creates R3F `<Canvas>` with configured dpr, camera, gl settings
2. Mounts `<OrbitControls>` with damping, bounded orbit from config
3. Loads environment (HDR file or drei preset) with intensity, rotation, optional ground projection
4. Syncs renderer settings per frame (tone mapping, exposure, color space, shadows)
5. Sets background color and fog from config
6. Loads GLB model via `useGLTF`, calls `onModelReady` with the root Object3D
7. Renders `children` inside the Canvas — product modules inject their components here
8. Signals `onRenderReady` after first stable frame — used by render factory workers

## What ViewerShell Does NOT Do [v1]

- Material role mapping (product module)
- Artwork texture application (product module)
- Surface discovery (product module)
- User config management (CreateShell / hooks)
- Product-specific UI (ConfigPanel / product module)

## ViewerSceneConfig [v1]

```typescript
interface CameraConfig {
  position: [number, number, number]  // Cartesian, not spherical
  target: [number, number, number]
  fov: number
  near: number
  far: number
  enableDamping: boolean
  dampingFactor: number
}

interface EnvironmentConfig {
  preset?: string           // drei preset name: 'studio', 'city', etc.
  hdriUrl?: string          // custom HDR/EXR file URL
  intensity: number
  rotation: number          // Y-axis degrees
  ground?: {
    enabled: boolean
    height: number
    radius: number
  }
}

interface RendererConfig {
  toneMapping: number       // THREE.ToneMapping enum
  toneMappingExposure: number
  outputColorSpace: string  // 'srgb' or 'srgb-linear'
  shadowsEnabled: boolean
  shadowType: number        // THREE.ShadowMapType enum
}

interface SceneConfig {
  backgroundColor: string   // CSS hex
  ambientColor: [number, number, number]
  ambientIntensity: number
  fog?: {
    type: 'linear' | 'exponential'
    color: string
    near?: number
    far?: number
    density?: number
  }
}
```

## Orbit Bounds Contract [v1]

From the 3D scene experience brief:

| Parameter | Composition mode | Review mode |
|-----------|-----------------|-------------|
| Yaw range | -35 to +35 degrees | Discrete viewpoint chips |
| Roll | None | None |
| Pitch | Bounded | Bounded |
| Pan | None (MVP) | None |
| Orbit release | `motion.create.orbit.drift` (300-400ms smooth deceleration) | N/A (discrete viewpoints) |

Orbit bounds are configurable per camera preset in `ScenePreset.cameras[].orbit_bounds`:

```typescript
interface OrbitBounds {
  min_azimuth: number
  max_azimuth: number
  min_polar: number
  max_polar: number
  min_distance: number
  max_distance: number
}
```

## Camera Presets [v1]

The ScenePreset can define multiple camera presets for different contexts:

| Role | Purpose | Phase |
|------|---------|-------|
| `create_default` | Default workspace view — front three-quarter | v1 |
| `create_detail` | Detail inspection (zoom to material/placement) | v1 |
| `owner_preview` | Camera angle for client-captured continuity preview | v1 |
| `public_preview` | Deterministic camera for controlled public preview | v3 |
| `order_preview` | Deterministic camera for order confirmation | v3 |
| `catalog_hero` | Hero shot for product listings | v3 |
| `catalog_alt` | Alternative angle for product listings | v3 |

## Conversion from ScenePreset [v1]

`ScenePreset` → `ViewerSceneConfig` strips editor-only and product-specific fields:

```typescript
function scenePresetToViewerConfig(preset: ScenePreset): ViewerSceneConfig {
  const defaultCam = preset.payload.cameras.find(c => c.role === 'create_default')
  return {
    camera: {
      position: defaultCam.position,
      target: defaultCam.target,
      fov: defaultCam.fov,
      near: defaultCam.near,
      far: defaultCam.far,
      enableDamping: true,
      dampingFactor: 0.05,
    },
    environment: {
      hdriUrl: preset.payload.lighting_rig.hdri?.path,
      intensity: preset.payload.lighting_rig.hdri_intensity,
      rotation: preset.payload.lighting_rig.hdri_rotation_deg,
    },
    renderer: {
      toneMapping: preset.payload.render_settings.tone_mapping === 'aces'
        ? THREE.ACESFilmicToneMapping
        : THREE.NeutralToneMapping,
      toneMappingExposure: preset.payload.lighting_rig.exposure,
      outputColorSpace: 'srgb',
      shadowsEnabled: preset.payload.render_settings.shadow_enabled,
      shadowType: THREE.PCFSoftShadowMap,
    },
    scene: {
      backgroundColor: preset.payload.render_settings.background_color,
      ambientColor: [1, 1, 1],
      ambientIntensity: preset.payload.lighting_rig.ambient_intensity,
    },
  }
}
```

## Extraction from Prototype [v1]

ViewerShell extracts these pieces from `prototype/core/EffectViewer.tsx`:

| EffectViewer piece | ViewerShell equivalent |
|---|---|
| `CameraConfigSync` component | Built-in (Cartesian position, not spherical conversion) |
| `RendererSettingsSync` component | Built-in per-frame sync |
| `RendererBackgroundSync` component | Merged into renderer sync |
| Canvas + OrbitControls setup | ViewerShell body |
| Environment loading | ViewerShell body |

What stays OUT: `artworkUrl`, `designState`, `EffectModel`, material slot discovery — all product-specific.

## Relationship to Studio [v1]

Studio's `StudioViewport.tsx` currently creates its own Canvas and mounts `EffectViewer`. After migration:
- Studio imports `ViewerShell` from `create/core/`
- Studio wraps it with the PlayCanvas editor UI
- The bridge (`observer-r3f-bridge.ts`) reads from Three.js scene objects inside the ViewerShell

Import path change: `../../../../src/app/(dev)/prototype/core/EffectViewer` → `../../../../create/core`
