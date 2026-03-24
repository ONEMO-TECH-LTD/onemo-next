# Material Preset V1 — Manual Tuning (2026-03-23)

Saved from live tuning session. "Super close to real suede" per Dan.

## Textures
- GSG SuedeBlack 4K PBR set (normal, roughness, height, sheencolor)
- Source: `/Documents/DS Docs/GitHub/0s1sfashion_URP_prototype/Assets/Project/Jane/materials/Suede/`
- No tiling — 4K at 1:1 scale on 7cm surface = ~60px/mm (ClampToEdge)
- Planar UV projection generated at runtime for both face and back

## Face Material (MeshPhysicalMaterial)
```
map: artworkMap
color: (1.5, 1.5, 1.5)        // brightness multiplier
normalMap: suedeNormal
normalScale: (0.14, 0.14)
bumpMap: suedeHeight
bumpScale: 0.00095
roughnessMap: suedeRoughness
roughness: 0.99
metalness: 0
sheen: 0.05
sheenColor: (0.02, 0.015, 0.01)
sheenRoughness: 0.98
envMapIntensity: 0.02
```

## Back Material (MeshPhysicalMaterial)
```
color: (0.0, 0.0, 0.0)        // pure black
normalMap: suedeNormal
normalScale: (0.14, 0.14)
bumpMap: suedeHeight
bumpScale: 0.00095
roughnessMap: suedeRoughness
roughness: 0.99
metalness: 0
sheen: 0.05
sheenColor: (0.015, 0.01, 0.01)
sheenRoughness: 0.98
envMapIntensity: 0.02
```

## Frame Material (MeshPhysicalMaterial)
```
color: (0.015, 0.015, 0.015)
roughness: 0.35
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

## Known Issues
- Front face slightly washed out (light still reflects off surface)
- Bottom half brighter than top due to HDRI angle
- Research suggests: higher sheen (1.0) with dark sheenColor, roughness 0.9, envMapIntensity 0.3 — to be tested as V2
