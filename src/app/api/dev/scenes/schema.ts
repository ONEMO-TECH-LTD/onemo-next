import type {
  ArtworkConfig,
  BackMaterial,
  CameraConfig,
  ColorConfig,
  DirectionalLightConfig,
  EnvironmentConfig,
  FaceMaterial,
  FrameMaterial,
  LightingConfig,
  PostProcessingConfig,
  SceneConfig,
  SceneSettings,
  TexturePaths,
} from '@/app/(dev)/prototype/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value)
}

function isTexturePaths(value: unknown, { requireBaseMaps }: { requireBaseMaps: boolean }): value is Partial<TexturePaths> {
  if (!isRecord(value)) return false

  if (!isOptionalString(value.texture)) return false
  if (!isOptionalString(value.sheenColor)) return false

  if (requireBaseMaps) {
    return isString(value.normal) && isString(value.roughness) && isString(value.height)
  }

  return (
    (value.normal === undefined || isString(value.normal)) &&
    (value.roughness === undefined || isString(value.roughness)) &&
    (value.height === undefined || isString(value.height))
  )
}

function isSceneSettings(value: unknown): value is SceneSettings {
  return (
    isRecord(value) &&
    isNumber(value.exposure) &&
    isNumber(value.ambientIntensity) &&
    isNumber(value.envIntensity) &&
    isString(value.background)
  )
}

function isColorConfig(value: unknown): value is ColorConfig {
  return (
    isRecord(value) &&
    isString(value.backColor) &&
    isString(value.frameColor) &&
    isString(value.bgColor)
  )
}

function isFaceMaterial(value: unknown): value is FaceMaterial {
  return (
    isRecord(value) &&
    isRecord(value.params) &&
    isNumber(value.params.roughness) &&
    isNumber(value.params.metalness) &&
    isNumber(value.params.envMapIntensity) &&
    isNumber(value.params.normalScale) &&
    isNumber(value.params.bumpScale) &&
    isNumber(value.params.sheen) &&
    isString(value.params.sheenColor) &&
    isNumber(value.params.sheenRoughness) &&
    isNumber(value.params.colorMultiplier) &&
    isTexturePaths(value.textures, { requireBaseMaps: true })
  )
}

function isBackMaterial(value: unknown): value is BackMaterial {
  return (
    isRecord(value) &&
    isRecord(value.params) &&
    isString(value.params.color) &&
    isNumber(value.params.roughness) &&
    isNumber(value.params.envMapIntensity) &&
    isNumber(value.params.normalScale) &&
    isNumber(value.params.bumpScale) &&
    isNumber(value.params.sheen) &&
    isString(value.params.sheenColor) &&
    isNumber(value.params.sheenRoughness) &&
    isTexturePaths(value.textures, { requireBaseMaps: true })
  )
}

function isFrameMaterial(value: unknown): value is FrameMaterial {
  return (
    isRecord(value) &&
    isRecord(value.params) &&
    isString(value.params.color) &&
    isNumber(value.params.roughness) &&
    isNumber(value.params.metalness) &&
    isNumber(value.params.clearcoat) &&
    isNumber(value.params.clearcoatRoughness) &&
    isTexturePaths(value.textures, { requireBaseMaps: false })
  )
}

function isCameraConfig(value: unknown): value is CameraConfig {
  return (
    isRecord(value) &&
    isNumber(value.fov) &&
    value.fov > 0 &&
    value.fov < 180 &&
    isNumber(value.distance) &&
    value.distance > 0 &&
    isNumber(value.polarAngle) &&
    isNumber(value.azimuthAngle) &&
    isBoolean(value.enableDamping) &&
    isNumber(value.dampingFactor) &&
    isBoolean(value.autoRotate) &&
    isNumber(value.autoRotateSpeed)
  )
}

function isEnvironmentConfig(value: unknown): value is EnvironmentConfig {
  return (
    isRecord(value) &&
    isString(value.preset) &&
    isOptionalString(value.customHdri) &&
    isNumber(value.envRotation) &&
    isBoolean(value.groundEnabled) &&
    isNumber(value.groundHeight) &&
    isNumber(value.groundRadius) &&
    value.groundRadius > 0
  )
}

function isDirectionalLightConfig(value: unknown): value is DirectionalLightConfig {
  return (
    isRecord(value) &&
    (value.type === undefined || value.type === 'directional' || value.type === 'point' || value.type === 'spot') &&
    isBoolean(value.enabled) &&
    isNumber(value.intensity) &&
    value.intensity >= 0 &&
    isString(value.color) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.z) &&
    (value.targetX === undefined || isNumber(value.targetX)) &&
    (value.targetY === undefined || isNumber(value.targetY)) &&
    (value.targetZ === undefined || isNumber(value.targetZ))
  )
}

function isArtworkConfig(value: unknown): value is ArtworkConfig {
  return (
    isRecord(value) &&
    isOptionalString(value.url) &&
    isNumber(value.offsetX) &&
    isNumber(value.offsetY) &&
    isNumber(value.scale) &&
    value.scale > 0
  )
}

function isLightingConfig(value: unknown): value is LightingConfig {
  return (
    isRecord(value) &&
    isDirectionalLightConfig(value.key) &&
    isDirectionalLightConfig(value.fill) &&
    isDirectionalLightConfig(value.rim)
  )
}

function isPostProcessingConfig(value: unknown): value is PostProcessingConfig {
  return (
    isRecord(value) &&
    isBoolean(value.bloomEnabled) &&
    isNumber(value.bloomIntensity) &&
    isNumber(value.bloomLuminanceThreshold) &&
    isNumber(value.bloomRadius) &&
    isBoolean(value.vignetteEnabled) &&
    isNumber(value.vignetteOffset) &&
    isNumber(value.vignetteDarkness)
  )
}

export function sanitizeSceneName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function collectSceneAssetPaths(config: SceneConfig) {
  const assetPaths = new Set<string>()

  const addTexturePaths = (textures: Partial<TexturePaths> | undefined) => {
    if (!textures) return

    for (const value of Object.values(textures)) {
      if (typeof value === 'string' && value.startsWith('/assets/')) {
        assetPaths.add(value)
      }
    }
  }

  if (config.modelPath.startsWith('/assets/')) {
    assetPaths.add(config.modelPath)
  }

  addTexturePaths(config.face.textures)
  addTexturePaths(config.back.textures)
  addTexturePaths(config.frame.textures)

  if (config.environment?.customHdri?.startsWith('/assets/')) {
    assetPaths.add(config.environment.customHdri)
  }

  if (config.artwork?.url?.startsWith('/assets/')) {
    assetPaths.add(config.artwork.url)
  }

  return [...assetPaths]
}

export function validateSceneConfig(value: unknown): value is SceneConfig {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.created) &&
    isString(value.modified) &&
    isString(value.modelPath) &&
    isFaceMaterial(value.face) &&
    isBackMaterial(value.back) &&
    isFrameMaterial(value.frame) &&
    isSceneSettings(value.scene) &&
    isColorConfig(value.colors) &&
    (value.camera === undefined || isCameraConfig(value.camera)) &&
    (value.environment === undefined || isEnvironmentConfig(value.environment)) &&
    (value.lighting === undefined || isLightingConfig(value.lighting)) &&
    (value.artwork === undefined || isArtworkConfig(value.artwork)) &&
    (value.postprocessing === undefined || isPostProcessingConfig(value.postprocessing))
  )
}
