import type { MaterialPresetConfig, TexturePaths } from '@/app/(dev)/prototype/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value)
}

function isTexturePaths(value: unknown, { requireBaseMaps }: { requireBaseMaps: boolean }): value is Partial<TexturePaths> {
  if (!isRecord(value)) return false
  if (!isOptionalString(value.texture) || !isOptionalString(value.sheenColor)) return false

  if (requireBaseMaps) {
    return isString(value.normal) && isString(value.roughness) && isString(value.height)
  }

  return (
    (value.normal === undefined || isString(value.normal)) &&
    (value.roughness === undefined || isString(value.roughness)) &&
    (value.height === undefined || isString(value.height))
  )
}

export function sanitizeMaterialPresetName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function collectMaterialPresetAssetPaths(config: MaterialPresetConfig) {
  const assetPaths = new Set<string>()

  const addTexturePaths = (textures: Partial<TexturePaths>) => {
    for (const value of Object.values(textures)) {
      if (typeof value === 'string' && value.startsWith('/assets/')) {
        assetPaths.add(value)
      }
    }
  }

  addTexturePaths(config.face.textures)
  addTexturePaths(config.back.textures)
  addTexturePaths(config.frame.textures)

  return [...assetPaths]
}

export function validateMaterialPresetConfig(value: unknown): value is MaterialPresetConfig {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.modified) &&
    isRecord(value.face) &&
    isRecord(value.face.params) &&
    isNumber(value.face.params.roughness) &&
    isNumber(value.face.params.metalness) &&
    isNumber(value.face.params.envMapIntensity) &&
    isNumber(value.face.params.normalScale) &&
    isNumber(value.face.params.bumpScale) &&
    isNumber(value.face.params.sheen) &&
    isString(value.face.params.sheenColor) &&
    isNumber(value.face.params.sheenRoughness) &&
    isNumber(value.face.params.colorMultiplier) &&
    isTexturePaths(value.face.textures, { requireBaseMaps: true }) &&
    isRecord(value.back) &&
    isRecord(value.back.params) &&
    isString(value.back.params.color) &&
    isNumber(value.back.params.roughness) &&
    isNumber(value.back.params.envMapIntensity) &&
    isNumber(value.back.params.normalScale) &&
    isNumber(value.back.params.bumpScale) &&
    isNumber(value.back.params.sheen) &&
    isString(value.back.params.sheenColor) &&
    isNumber(value.back.params.sheenRoughness) &&
    isTexturePaths(value.back.textures, { requireBaseMaps: true }) &&
    isRecord(value.frame) &&
    isRecord(value.frame.params) &&
    isString(value.frame.params.color) &&
    isNumber(value.frame.params.roughness) &&
    isNumber(value.frame.params.metalness) &&
    isNumber(value.frame.params.clearcoat) &&
    isNumber(value.frame.params.clearcoatRoughness) &&
    isTexturePaths(value.frame.textures, { requireBaseMaps: false })
  )
}
