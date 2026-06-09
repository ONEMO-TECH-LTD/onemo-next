// === Shared types — single source of truth ===
// Used by core/, admin/, user/, and scene config JSON files.
// No duplicate definitions elsewhere.

export interface DesignState {
  offsetX: number
  offsetY: number
  scale: number
}

export interface SceneSettings {
  exposure: number
  ambientIntensity: number
  envIntensity: number
  background: string
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

export interface CameraConfig {
  fov: number
  distance: number
  polarAngle: number
  azimuthAngle: number
  target: [number, number, number]
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

export interface ViewerRendererConfig {
  toneMapping: number
  toneMappingExposure: number
  outputColorSpace: string
  shadowsEnabled: boolean
  shadowType: number
}

export interface ViewerMaterialRole {
  role: string
  meshNames: string[]
  defaults?: {
    color?: string
    roughness?: number
    metalness?: number
    envMapIntensity?: number
    normalScale?: number
    bumpScale?: number
    sheen?: number
    sheenColor?: string
    sheenRoughness?: number
    clearcoat?: number
    clearcoatRoughness?: number
    colorMultiplier?: number
  }
  textures?: {
    map?: string
    normalMap?: string
    roughnessMap?: string
    bumpMap?: string
    sheenColorMap?: string
    [key: string]: string | undefined
  }
  configurable: boolean
  configurableProperties?: string[]
}

export interface ViewerArtworkSlot {
  meshName: string
  role: string
  defaultUrl?: string
  textureChannel: string
}

export interface ViewerProductConfig {
  productType: string
  materialRoles: ViewerMaterialRole[]
  artworkSlot?: ViewerArtworkSlot
}

// The single config object passed to the core viewer
export interface ViewerConfig {
  modelPath: string
  scene: SceneSettings
  colors: ColorConfig
  camera?: CameraConfig
  environment?: EnvironmentConfig
  renderer?: ViewerRendererConfig
  product: ViewerProductConfig
}
