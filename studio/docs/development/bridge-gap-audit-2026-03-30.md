# Full Bridge Gap Audit — Code-Verified

**Date:** 2026-03-30
**Task:** KAI-3962
**Brief:** 37.91 (KAI-3961)
**Method:** Direct code verification of every L1 item in audit-spec.md against actual bridge code in `studio/src/editor/adapter/`

---

## Section 7: Scene Settings

| # | Feature | Blueprint | Code Status | Evidence | Gap? |
|---|---------|-----------|-------------|----------|------|
| 7.1 | Save scene (Ctrl+S) | WIRED | **WIRED** | effect-viewer-mount.tsx:415 — `saveSceneByName()` | No |
| 7.2 | Load scene (Ctrl+O) | WIRED | **WIRED** | effect-viewer-mount.tsx:392 — `loadSceneByName()` | No |
| 7.3 | Undo | WIRED | **WIRED** | Observer history stack | No |
| 7.4 | Redo | WIRED | **WIRED** | Observer history stack | No |
| 7.5 | Fog settings | VERIFY | **MISSING** | No `sceneSettings.on` listener in bridge. Fog UI exists in rendering.ts but pushes to hidden PlayCanvas app only | **P0** |
| 7.6 | Ambient light settings | VERIFY | **MISSING** | Same — ambient color UI exists, no bridge listener | **P0** |
| 7.7 | Skybox/Environment | VERIFY | **MISSING** | Skybox cubemap picker exists, no HDRI file picker. No bridge listener | **P0** |
| 7.8 | Rendering (tonemapping, exposure) | VERIFY | **LOAD-ONLY** | `applySceneSettings()` at line 2595 pushes to Three.js, but only called at scene load (line 999). No `sceneSettings.on('*:set')` for live editing | **P1** |
| 7.9-7.11 | Create/Open/Duplicate scene | VERIFY | **WIRED** | effect-viewer-mount.tsx has scene list + create/load | No |
| 7.12 | Physics gravity | VERIFY | **STUB** | Physics panel exists, no physics engine wired | P2 |

## Section 8: Materials

| # | Feature | Blueprint | Code Status | Evidence | Gap? |
|---|---------|-----------|-------------|----------|------|
| 8.1 | Texture transform | WIRED | **WIRED** | material-mapper.ts handles texture offset/repeat | No |
| 8.3 | AO | WIRED | **WIRED** | line 324 — `aoMapIntensity` | No |
| 8.4 | Diffuse | WIRED | **WIRED** | line 319 — `color` | No |
| 8.5 | Metalness | WIRED | **WIRED** | line 339 — `metalness` | No |
| 8.6 | Roughness | WIRED | **WIRED** | line 344 — `roughness` + shininess conversion | No |
| 8.7 | Anisotropy | VERIFY | **WIRED** | line 383 — `anisotropy` + `anisotropyRotation` | No |
| 8.8 | Specular workflow | VERIFY | **WIRED** | line 372 — `specularColor` + `specularIntensity` | No |
| 8.9 | Emissive | WIRED | **WIRED** | line 396 + 401 — `emissive` + `emissiveIntensity` | No |
| 8.10 | Opacity/blend | WIRED | **WIRED** | line 406 — `opacity`, `alphaTest`, `alphaToCoverage`, `blendType` | No |
| 8.11 | Normals | WIRED | **WIRED** | line 355 — `normalScale` + `bumpScale` | No |
| 8.12 | Parallax | VERIFY | **PARTIAL** | `bumpScale`/`heightMapFactor` handled (line 362), but no true parallax shader | P2 |
| 8.13 | Clear coat | VERIFY | **WIRED** | lines 414-435 — `clearcoat`, `clearcoatRoughness`, `clearcoatNormalScale` | No |
| 8.14 | Sheen | VERIFY | **WIRED** | lines 437-461 — `sheen`, `sheenColor`, `sheenRoughness` | No |
| 8.15 | Refraction/Transmission | VERIFY | **WIRED** | lines 463-483 — `transmission`, `ior`, `dispersion`, `thickness`, `attenuationColor`, `attenuationDistance` | No |
| 8.16 | Iridescence | VERIFY | **WIRED** | lines 485-502 — `iridescence`, `iridescenceIOR`, `iridescenceThicknessRange` | No |
| 8.17 | Environment/reflectivity | VERIFY | **WIRED** | line 504 — `envMapIntensity` | No |
| 8.18 | Lightmap | VERIFY | **MISSING** | No `lightMap`/`lightMapIntensity` handling in material-mapper | P2 |
| 8.19 | Render state (depth/cull/fog/tonemap) | VERIFY | **WIRED** | lines 509-532 — `depthTest`, `depthWrite`, `cull`, `fog`, `toneMapped` | No |
| 8.20 | UV Channel selector | VERIFY | **MISSING** | No UV channel handling | P2 |
| 8.21 | Color channel selector | VERIFY | **MISSING** | No channel extraction shader | P2 |
| 8.22 | Vertex color | VERIFY | **WIRED** | line 534 — `updateVertexColorMode` for 16 vertex color paths | No |

**Material mapper actual write paths: ~35 distinct property paths with real Three.js API calls.**

## Section 9: Lights

| # | Feature | Blueprint | Code Status | Evidence | Gap? |
|---|---------|-----------|-------------|----------|------|
| 9.1-9.3 | Dir/Point/Spot | WIRED | **WIRED** | light-mapper.ts:93-115 | No |
| 9.4 | Area light | VERIFY | **PARTIAL** | `RectAreaLight` shape detected (line 86) but no live shape switching (line 205) | P2 |
| 9.5 | Color | WIRED | **WIRED** | line 133 | No |
| 9.6 | Intensity | WIRED | **WIRED** | line 139 | No |
| 9.7 | Range | WIRED | **WIRED** | line 149 | No |
| 9.8 | Cone angles | WIRED | **WIRED** | line 159 | No |
| 9.9 | Cast shadows | WIRED | **WIRED** | line 144 | No |
| 9.10 | Shadow resolution | VERIFY | **WIRED** | line 180 | No |
| 9.11 | Shadow bias | VERIFY | **WIRED** | lines 189, 194 | No |
| 9.12 | Shadow distance | VERIFY | **WIRED** | line 199 | No |
| 9.13 | Shadow intensity | VERIFY | **SKIPPED** | In `NO_THREE_EQUIVALENT_LIGHT_PATHS` — no Three.js per-light shadow intensity | P3 |
| 9.14 | Falloff mode | VERIFY | **WIRED** | line 154 | No |
| 9.15 | Cookie texture | SKIPPED | **SKIPPED** | In `NO_THREE_EQUIVALENT_LIGHT_PATHS` | P3 |
| 9.16-9.17 | Bake/Clustered | SKIPPED | **SKIPPED** | Removed | P3 |

## Section 10: Camera

| # | Feature | Blueprint | Code Status | Evidence | Gap? |
|---|---------|-----------|-------------|----------|------|
| 10.1 | Perspective | WIRED | **WIRED** | camera-mapper.ts:30 | No |
| 10.2 | Ortho + height | VERIFY | **PARTIAL** | `orthoHeight` handled (line 121) but projection switching skipped (line 6) | P2 |
| 10.3 | FOV | WIRED | **WIRED** | line 106 | No |
| 10.4-10.5 | Near/Far | WIRED | **WIRED** | lines 111, 116 | No |
| 10.6 | Clear color | VERIFY | **STORED** | line 86 — stores in userData, doesn't apply to renderer | P2 |
| 10.7 | Viewport rect | VERIFY | **STORED** | line 133 — userData only | P2 |
| 10.8 | Layers | VERIFY | **STORED** | line 138 — userData only | P2 |
| 10.9 | Priority | VERIFY | **STORED** | line 128 — userData only | P2 |
| 10.10 | Frustum culling | VERIFY | **STORED** | line 101 — userData, not `camera.frustumCulling` | P2 |

## Section 12: Component Bridges

| # | Component | Code Status | Evidence | Classification |
|---|-----------|-------------|----------|----------------|
| 12.1-12.7 | Render/Light/Camera | **WIRED** | Real Three.js objects, bidirectional sync | Core — working |
| 12.8 | Script | **STUB** | script-mapper.ts:29 — `userData.script` only | P3 |
| 12.9 | Collision | **WIRED** | collision-mapper.ts:74 — wireframe LineSegments | Working visual |
| 12.10 | Rigidbody | **STUB** | rigidbody-mapper.ts:35 — `userData.rigidbody` only | P3 |
| 12.11 | Anim | **WIRED** | anim-mapper.ts:121 — `THREE.AnimationMixer` | Working |
| 12.12 | Animation | **WIRED** | animation-mapper.ts:139 — `THREE.AnimationMixer` | Working |
| 12.13 | Sound | **WIRED** | sound-mapper.ts:52 — `THREE.PositionalAudio`/`THREE.Audio` | Working |
| 12.14 | AudioListener | **WIRED** | audiolistener-mapper.ts — `THREE.AudioListener` | Working |
| 12.15 | Particle | **WIRED** | particle-mapper.ts:146 — `THREE.Points` + simulation | Working |
| 12.16 | Element | **WIRED** | element-mapper.ts:130 — `THREE.Sprite` | Working |
| 12.17 | Sprite | **WIRED** | sprite-mapper.ts:98 — `THREE.Sprite` | Working |
| 12.18 | Screen | **STUB** | wireframe only via bridge-utils | P3 |
| 12.19 | GSplat | **WIRED** | gsplat-mapper.ts:120 — `THREE.Points` (point cloud fallback) | Working |
| 12.20 | Button | **STUB** | button-mapper.ts:47 — `userData.button` only | P3 |
| 12.21 | Layout group/child | **STUB** | userData only + wireframe | P3 |
| 12.22 | Scrollview | **STUB** | userData only + wireframe | P3 |
| 12.23 | Zone | **WIRED** | zone-mapper.ts:31 — wireframe LineSegments | Working visual |
| 12.24 | Model (legacy) | **WIRED** | model-mapper.ts — redirects to render path | Working |

---

## GAPS SUMMARY

### P0 — Core editing broken

1. **Scene settings have no live-editing bridge** — background color, fog, ambient light, environment/HDRI controls exist in the Rendering panel but changes go to the hidden PlayCanvas canvas, not Three.js. No `sceneSettings.on('*:set')` listener in bridge.
2. **No background color control** — exists in .onemo format but no UI field in any panel
3. **No HDRI environment file picker** — can load programmatically via `bridge.loadEnvironment()` but no UI to browse/select/drop HDR files
4. **No environment intensity/rotation controls in UI** — exists in .onemo format, no panel field
5. **15 irrelevant PlayCanvas settings panels cluttering the settings view** — Engine, Asset Import, Batch Groups, Loading Screen, Import Map, External Scripts, Input, Localization, Network, Scripts Loading Order, Project Settings History, Layers

### P1 — Important features that only work at load time

6. **Tonemapping + exposure + gamma** — `applySceneSettings()` pushes to Three.js renderer at scene load, but no live listener when user changes them in the Rendering panel

### P2 — Partial / nice-to-have

7. Camera projection switching (perspective ↔ ortho)
8. Camera clear color, viewport rect, layers, priority, frustum culling — stored in userData, not applied
9. Area light shape switching
10. Lightmap support — no `lightMap`/`lightMapIntensity` in material mapper
11. UV channel selector, color channel selector
12. Parallax mapping — uses bump scale, not true parallax shader
13. Physics gravity — panel exists, no physics engine

### P3 — Correctly excluded or stub-only

14. Cookie textures — no Three.js equivalent
15. Shadow intensity per light — no Three.js equivalent
16. Bake/clustered lighting — removed (PlayCanvas-specific)
17. Script runtime — stored only (correct for editor)
18. Rigidbody, Screen, Button, Layout, Scrollview — stubs (2D UI paradigm mismatch)

---

## Root Cause

The L1 code audit verified adapter wiring paths but never checked the reverse direction: does changing a value in the PlayCanvas UI inspector push it to Three.js? The pattern is visible in the code:

- **Entity observers**: `observer.on('*:set', handlePathChange)` at line 2381 — **live editing works**
- **Material observers**: `observer.on('*:set', ...)` at line 1369 — **live editing works**
- **Scene settings observer**: **No listener exists anywhere in the bridge** — live editing broken

Every auditor should have caught this by comparing the subscription pattern across observer types.

## Fix

KAI-3957 covers P0 items 1-5 and P1 item 6: strip irrelevant panels, rework RENDERING for R3F scene properties, add `sceneSettings.on('*:set')` listener in the bridge.
