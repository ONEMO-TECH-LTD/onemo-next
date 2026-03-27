// === Shared types — single source of truth ===
// Used by core/, admin/, user/, and scene config JSON files.
// No duplicate definitions elsewhere.

export interface DesignState {
  offsetX: number
  offsetY: number
  scale: number
}

export interface ArtworkConfig {
  url?: string
  offsetX: number
  offsetY: number
  scale: number
}

export interface FaceMaterialConfig {
  roughness: number
  metalness: number
  envMapIntensity: number
  normalScale: number
  bumpScale: number
  sheen: number
  sheenColor: string
  sheenRoughness: number
  colorMultiplier: number
}

export interface BackMaterialConfig {
  color: string
  roughness: number
  envMapIntensity: number
  normalScale: number
  bumpScale: number
  sheen: number
  sheenColor: string
  sheenRoughness: number
}

export interface FrameMaterialConfig {
  color: string
  roughness: number
  metalness: number
  clearcoat: number
  clearcoatRoughness: number
}

export interface SceneSettings {
  exposure: number
  ambientIntensity: number
  envIntensity: number
  background: string
  toneMapping?: 'neutral' | 'aces'
  transparentBackground?: boolean
  shadowEnabled?: boolean
  dprMin?: number
  dprMax?: number
  frameloop?: 'always' | 'demand'
}

export interface TexturePaths {
  texture?: string   // diffuse/color texture
  normal: string
  roughness: string
  height: string
  sheenColor?: string
}

export interface ColorConfig {
  backColor: string
  frameColor: string
  bgColor: string
}

// Complete material = params + textures (per model part)
export interface FaceMaterial {
  params: FaceMaterialConfig
  textures: TexturePaths
}

export interface BackMaterial {
  params: BackMaterialConfig
  textures: TexturePaths
}

export interface FrameMaterial {
  params: FrameMaterialConfig
  textures: Partial<TexturePaths>  // frame may not use all texture slots
}

export interface MaterialPresetConfig {
  name: string
  modified: string
  face: FaceMaterial
  back: BackMaterial
  frame: FrameMaterial
}

export interface SceneConfig {
  name: string
  created: string
  modified: string
  modelPath: string
  face: FaceMaterial
  back: BackMaterial
  frame: FrameMaterial
  scene: SceneSettings
  colors: ColorConfig
  camera?: CameraConfig
  environment?: EnvironmentConfig
  lighting?: LightingConfig
  artwork?: ArtworkConfig
  postprocessing?: PostProcessingConfig
}

export interface CameraConfig {
  fov: number
  distance: number
  polarAngle: number
  azimuthAngle: number
  enableDamping: boolean
  dampingFactor: number
  autoRotate: boolean
  autoRotateSpeed: number
}

export interface EnvironmentConfig {
  preset: string
  customHdri?: string  // path to custom EXR/HDR file (overrides preset)
  envRotation: number
  groundEnabled: boolean
  groundHeight: number
  groundRadius: number
}

export interface DirectionalLightConfig {
  type?: 'directional' | 'point' | 'spot'
  enabled: boolean
  intensity: number
  color: string
  x: number
  y: number
  z: number
  targetX?: number
  targetY?: number
  targetZ?: number
}

export interface LightingConfig {
  key: DirectionalLightConfig
  fill: DirectionalLightConfig
  rim: DirectionalLightConfig
}

export interface PostProcessingConfig {
  bloomEnabled: boolean
  bloomIntensity: number
  bloomLuminanceThreshold: number
  bloomRadius: number
  vignetteEnabled: boolean
  vignetteOffset: number
  vignetteDarkness: number
}

// The single config object passed to the core viewer
export interface ViewerConfig {
  modelPath: string
  face: FaceMaterial
  back: BackMaterial
  frame: FrameMaterial
  scene: SceneSettings
  colors: ColorConfig
  camera?: CameraConfig
  environment?: EnvironmentConfig
  lighting?: LightingConfig
  postprocessing?: PostProcessingConfig
}
