# .onemo File Format Specification

**Version:** 1
**Decision:** DEC S42-SCENE (2026-03-30)
**Type definitions:** `studio/src/editor/adapter/onemo-format.ts`

## Overview

A `.onemo` file is a ZIP archive containing a complete 3D scene template. It stores everything needed to render a scene identically in both the studio editor and the user-facing configurator.

```
template.onemo (ZIP)
├── scene.glb           # 3D scene graph (GLTFExporter output)
├── studio.json         # renderer settings, environment, product config
└── environment.hdr     # environment map (optional)
```

**Principle:** Three.js scene graph is the single source of truth. No conversion between studio and viewer. Same file, same render, different UI shells.

## scene.glb

The scene graph serialized by Three.js `GLTFExporter`. Contains:

- **Object3D hierarchy** — entities with transforms (position, rotation, scale)
- **Meshes** — geometry + material references
- **Materials** — MeshPhysicalMaterial with PBR properties via glTF extensions:
  - Base PBR: color, metalness, roughness, normal, emissive, occlusion
  - KHR_materials_clearcoat: clearcoat, clearcoatRoughness
  - KHR_materials_sheen: sheenColor, sheenRoughness
  - KHR_materials_transmission: transmission
  - KHR_materials_ior: IOR
  - KHR_materials_iridescence: iridescence, thickness
  - KHR_materials_volume: thickness, attenuationColor, attenuationDistance
  - KHR_materials_specular: specularColor, specularIntensity
  - KHR_materials_dispersion: dispersion
- **Textures** — embedded in the GLB binary or as external references
- **Lights** — via KHR_lights_punctual (directional, point, spot)
- **Cameras** — perspective and orthographic
- **Animations** — clips with keyframes

### What GLB does NOT store

These go in `studio.json` instead:

- Renderer settings (toneMapping, toneMappingExposure, outputColorSpace)
- Shadow configuration (shadowsEnabled, shadowType)
- Background color
- Fog (type, color, density, near/far)
- Ambient light (color, intensity)
- Environment map configuration (file reference, intensity, rotation, ground plane)
- Area lights (RectAreaLight — no glTF representation)
- Editor camera state
- Product-level material role mappings
- Material property overrides for GLTFExporter gaps (anisotropy export not yet supported)

## studio.json

Everything the GLB can't store. This is the sidecar that completes the scene.

### Full schema

```typescript
interface OnemoStudioJson {
  version: 1;
  created: string;           // ISO 8601 timestamp
  modified: string;          // ISO 8601 timestamp
  name: string;              // human-readable scene name

  renderer: {
    toneMapping: number;           // THREE.ToneMapping enum (6 = NeutralToneMapping)
    toneMappingExposure: number;   // default 0.7
    outputColorSpace: string;      // 'srgb' or 'srgb-linear'
    shadowsEnabled: boolean;
    shadowType: number;            // THREE.ShadowMapType enum (2 = PCFSoftShadowMap)
  };

  environment: {
    file: string | null;           // filename in ZIP ('environment.hdr') or null
    preset: string | null;         // drei preset fallback ('studio', 'city', etc.)
    intensity: number;             // environment map intensity (default 1.0)
    rotation: number;              // Y-axis rotation in degrees
    ground: {
      enabled: boolean;
      height: number;
      radius: number;
    };
  };

  scene: {
    backgroundColor: string;       // CSS hex ('#111315')
    fog: 'none' | 'linear' | 'exponential';
    fogColor: string;
    fogNear: number;
    fogFar: number;
    fogDensity: number;
    ambientColor: [number, number, number];  // normalized 0-1
    ambientIntensity: number;
  };

  editorCamera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    near: number;
    far: number;
  };

  product: {
    productType: string;           // e.g., 'effect-70mm'
    materialRoles: Array<{
      role: string;                // 'face' | 'back' | 'frame' | custom
      meshNames: string[];         // mesh names in GLB this role maps to
      defaults?: Record<string, unknown>;  // default material values
      textures?: Record<string, string>;   // default texture paths
      configurable: boolean;       // exposed in user configurator?
      configurableProperties?: string[];   // which props user can change
    }>;
    artworkSlot?: {
      meshName: string;
      role: string;
      defaultUrl?: string;
      textureChannel: string;      // 'map' = diffuse
    };
  };

  materialOverrides?: Record<string, Record<string, unknown>>;
  // Patches for GLTFExporter gaps, keyed by material name
}
```

### Example: Effect 70mm

```json
{
  "version": 1,
  "created": "2026-03-30T16:00:00.000Z",
  "modified": "2026-03-30T16:00:00.000Z",
  "name": "Effect 70mm",
  "renderer": {
    "toneMapping": 6,
    "toneMappingExposure": 0.7,
    "outputColorSpace": "srgb",
    "shadowsEnabled": true,
    "shadowType": 2
  },
  "environment": {
    "file": "environment.hdr",
    "preset": "studio",
    "intensity": 1.0,
    "rotation": 0,
    "ground": { "enabled": false, "height": 0, "radius": 20 }
  },
  "scene": {
    "backgroundColor": "#111315",
    "fog": "none",
    "fogColor": "#000000",
    "fogNear": 1,
    "fogFar": 1000,
    "fogDensity": 0.01,
    "ambientColor": [0.15, 0.15, 0.15],
    "ambientIntensity": 0.5
  },
  "editorCamera": {
    "position": [0, 0.03, 0.2],
    "target": [0, 0, 0],
    "fov": 35,
    "near": 0.001,
    "far": 100
  },
  "product": {
    "productType": "effect-70mm",
    "materialRoles": [
      {
        "role": "face",
        "meshNames": ["PRINT_SURFACE_FRONT", "Face"],
        "defaults": {
          "color": "#ffffff",
          "roughness": 1,
          "metalness": 0,
          "envMapIntensity": 0.1,
          "normalScale": 0.15,
          "bumpScale": 1,
          "sheen": 1,
          "sheenColor": "#1a1a1a",
          "sheenRoughness": 0.8
        },
        "textures": {
          "normalMap": "/assets/materials/ultrasuede/suede-normal.png",
          "roughnessMap": "/assets/materials/ultrasuede/suede-roughness.jpg",
          "bumpMap": "/assets/materials/ultrasuede/suede-height.png"
        },
        "configurable": true,
        "configurableProperties": ["color", "artwork"]
      },
      {
        "role": "back",
        "meshNames": ["BACK", "Back"],
        "defaults": {
          "color": "#080808",
          "roughness": 1,
          "envMapIntensity": 0.1,
          "sheen": 1,
          "sheenColor": "#1a1a1a",
          "sheenRoughness": 0.8
        },
        "textures": {
          "normalMap": "/assets/materials/ultrasuede/suede-normal.png",
          "roughnessMap": "/assets/materials/ultrasuede/suede-roughness.jpg",
          "bumpMap": "/assets/materials/ultrasuede/suede-height.png"
        },
        "configurable": true,
        "configurableProperties": ["color"]
      },
      {
        "role": "frame",
        "meshNames": ["FRAME", "Frame"],
        "defaults": {
          "color": "#0f0f0f",
          "roughness": 0.5,
          "metalness": 0,
          "clearcoat": 0.4,
          "clearcoatRoughness": 0.3
        },
        "configurable": true,
        "configurableProperties": ["color"]
      }
    ],
    "artworkSlot": {
      "meshName": "PRINT_SURFACE_FRONT",
      "role": "face",
      "defaultUrl": "/assets/test-artwork.png",
      "textureChannel": "map"
    }
  }
}
```

## User Configuration (Database JSON)

User designs are NOT .onemo files. They are lightweight JSON stored in a database, referencing a template.

```typescript
interface OnemoUserConfig {
  id: string;
  userId: string;
  templateId: string;          // references the .onemo file
  createdAt: string;
  modifiedAt: string;
  materials: Array<{
    role: string;              // which material role
    color?: string;            // color override
    [key: string]: unknown;    // any other property overrides
  }>;
  artwork?: {
    url: string;               // uploaded artwork path
    position: { x: number; y: number };
    scale: number;
    rotation: number;
  };
}
```

### Example: User design

```json
{
  "id": "design_abc123",
  "userId": "user_456",
  "templateId": "effect-70mm",
  "createdAt": "2026-03-30T16:15:00Z",
  "modifiedAt": "2026-03-30T16:15:00Z",
  "materials": [
    { "role": "face", "color": "#ff0000" },
    { "role": "back", "color": "#000000" },
    { "role": "frame", "color": "#1a1a1a" }
  ],
  "artwork": {
    "url": "/uploads/abc123/artwork.png",
    "position": { "x": 0.02, "y": -0.01 },
    "scale": 1.1,
    "rotation": 0
  }
}
```

To render: load the template .onemo from CDN, apply the user's material overrides to the matching roles, load the artwork texture. The viewer does this on the fly.

## Known GLTFExporter Gaps

These properties have no stable GLTFExporter path and use `materialOverrides` in studio.json:

| Property | Status | Workaround |
|----------|--------|------------|
| Anisotropy (intensity, rotation) | GLTFLoader supports KHR_materials_anisotropy; GLTFExporter does not export it yet | materialOverrides |
| RectAreaLight | No glTF representation (KHR_lights_punctual = directional/point/spot only) | Stored as custom light in studio.json |
| Environment map embedding | KHR_environments proposed but not ratified | Separate file in ZIP |
| outputColorSpace | Not persisted by any format | studio.json renderer settings |
