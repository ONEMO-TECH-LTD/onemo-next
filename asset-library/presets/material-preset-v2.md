# Material Preset V2 — Research + Tuning (2026-03-23)

## Textures
- GSG SuedeBlack 4K PBR set (normal, roughness, height, sheencolor)
- 1:1 scale, no tiling, ClampToEdgeWrapping
- Planar UV projection generated at runtime for face and back

## Face Material (MeshPhysicalMaterial)
```
map: artworkMap
color: (1.0, 1.0, 1.0)
normalMap: suedeNormal
normalScale: (0.15, 0.15)
bumpMap: suedeHeight
bumpScale: 1.0
roughnessMap: suedeRoughness
roughness: 1.0
metalness: 0
sheen: 1.0
sheenColor: (0.1, 0.1, 0.1)
sheenRoughness: 0.8
envMapIntensity: 0.1
```

## Back Material (MeshPhysicalMaterial)
```
color: (0.0, 0.0, 0.0)
normalMap: suedeNormal
normalScale: (0.15, 0.15)
bumpMap: suedeHeight
bumpScale: 1.0
roughnessMap: suedeRoughness
roughness: 1.0
metalness: 0
sheen: 1.0
sheenColor: (0.1, 0.1, 0.1)
sheenRoughness: 0.8
envMapIntensity: 0.1
```

## Frame Material (MeshPhysicalMaterial)
```
color: (0.015, 0.015, 0.015)
roughness: 0.5
metalness: 0
clearcoat: 0.4
clearcoatRoughness: 0.3
```

## Scene
```
toneMapping: NeutralToneMapping
toneMappingExposure: 0.7
Environment: "studio" preset, intensity 1.0
ambientLight: 0.5
camera: position [0, 0, 0.2], fov 35
background: #ffffff
```
