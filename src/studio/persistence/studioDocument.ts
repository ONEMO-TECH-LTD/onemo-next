import type {
  ArtworkConfig,
  CameraConfig,
  DirectionalLightConfig,
  EnvironmentConfig,
  FaceMaterial,
  BackMaterial,
  FrameMaterial,
  SceneConfig,
  TexturePaths,
} from '@/app/(dev)/prototype/types'

export type ScenePresetStatus = 'draft' | 'published' | 'archived'
export type EffectSubtype = 'edge_trim' | 'plain' | 'tv_retro'
export type SurfaceId = 'face' | 'back' | 'frame'

export interface AssetRef {
  storage: 'local' | 'cloudinary' | 'external'
  path: string
  public_id?: string | null
  version?: string | null
  format?: string | null
}

export interface TextureMapRef {
  asset: AssetRef
  repeat: [number, number]
  offset: [number, number]
  rotation_deg: number
}

export interface SurfaceMaterialProfile {
  surface_id: SurfaceId
  material_type: 'meshStandardMaterial' | 'meshPhysicalMaterial'
  base_color: string
  roughness: number
  metalness: number
  clearcoat: number
  clearcoat_roughness: number
  sheen: number
  sheen_roughness: number
  transmission: number
  thickness: number
  normal_scale: [number, number]
  map?: TextureMapRef | null
  normal_map?: TextureMapRef | null
  roughness_map?: TextureMapRef | null
  metalness_map?: TextureMapRef | null
  ao_map?: TextureMapRef | null
  displacement_map?: TextureMapRef | null
}

export interface CameraPreset {
  id: string
  role:
    | 'create_default'
    | 'create_detail'
    | 'owner_preview'
    | 'public_preview'
    | 'order_preview'
    | 'catalog_hero'
    | 'catalog_alt'
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  near: number
  far: number
  orbit_bounds: {
    min_azimuth: number
    max_azimuth: number
    min_polar: number
    max_polar: number
    min_distance: number
    max_distance: number
  }
}

export interface LightingRig {
  hdri: AssetRef
  hdri_intensity: number
  hdri_rotation_deg: number
  ambient_intensity: number
  exposure: number
  tone_mapping: 'neutral' | 'aces'
  key_light?: {
    intensity: number
    color: string
    position: [number, number, number]
    cast_shadow: boolean
  } | null
  fill_light?: {
    intensity: number
    color: string
    position: [number, number, number]
    cast_shadow: boolean
  } | null
  rim_light?: {
    intensity: number
    color: string
    position: [number, number, number]
    cast_shadow: boolean
  } | null
}

export interface RenderSettings {
  background_color: string
  transparent_background: boolean
  shadow_enabled: boolean
  dpr_min: number
  dpr_max: number
  frameloop: 'always' | 'demand'
  bloom_enabled?: boolean
  bloom_intensity?: number
  bloom_luminance_threshold?: number
  bloom_radius?: number
  vignette_enabled?: boolean
  vignette_offset?: number
  vignette_darkness?: number
}

export interface CapturePreset {
  id: string
  role: 'owner' | 'public' | 'order' | 'catalog'
  camera_preset_id: string
  width_px: number
  height_px: number
  pixel_ratio: number
  format: 'png' | 'jpg' | 'webp'
  quality?: number | null
}

export interface ScenePreset {
  id: string
  slug: string
  name: string
  version: number
  status: ScenePresetStatus
  created_at: string
  updated_at: string
  published_at?: string | null
  archived_at?: string | null
  family: 'effect'
  product_spec_id: string
  payload: {
    target_subtypes: EffectSubtype[]
    surface_materials: Record<SurfaceId, SurfaceMaterialProfile>
    cameras: CameraPreset[]
    lighting_rig: LightingRig
    render_settings: RenderSettings
    capture_presets: CapturePreset[]
    theatre_source?: null
  }
}

export interface StudioOnlyState {
  model_path: string
  artwork: ArtworkConfig
  panel_layout: {
    show_left_dock: boolean
    show_right_dock: boolean
    editing_lights: boolean
    left_dock_width?: number
    right_dock_width?: number
  }
  selection: {
    active_target: 'scene' | 'model' | 'environment' | 'lights' | 'camera' | 'image' | null
  }
  undo_stack: Array<{ id: string; label: string; timestamp: string }>
}

export interface StoredStudioDocument {
  id: string
  slug: string
  name: string
  product_spec_id: string
  target_subtypes: EffectSubtype[]
  latest_saved_version: number
  latest_draft_version: number | null
  published_version: number | null
  archived_versions: number[]
  studio_state: StudioOnlyState
  updated_at: string
}

export interface StudioDocumentSummary {
  id: string
  slug: string
  name: string
  version: number
  status: ScenePresetStatus
  updated_at: string
  published_version: number | null
}

export interface StudioDocument {
  metadata: StoredStudioDocument
  scene_preset: ScenePreset
}

function assetRefFromPath(assetPath: string): AssetRef {
  if (assetPath.startsWith('/assets/')) {
    const format = assetPath.split('.').pop()?.toLowerCase() ?? null
    return {
      storage: 'local',
      path: assetPath,
      format,
    }
  }

  return {
    storage: 'external',
    path: assetPath,
  }
}

function mapTexture(assetPath?: string | null): TextureMapRef | null {
  if (!assetPath) return null
  return {
    asset: assetRefFromPath(assetPath),
    repeat: [1, 1],
    offset: [0, 0],
    rotation_deg: 0,
  }
}

function toSurfaceProfile(
  surfaceId: SurfaceId,
  material: FaceMaterial | BackMaterial | FrameMaterial,
): SurfaceMaterialProfile {
  const baseColor =
    surfaceId === 'face'
      ? '#ffffff'
      : 'color' in material.params
        ? material.params.color
        : '#ffffff'

  return {
    surface_id: surfaceId,
    material_type: 'meshPhysicalMaterial',
    base_color: baseColor,
    roughness: material.params.roughness,
    metalness: 'metalness' in material.params ? material.params.metalness : 0,
    clearcoat: 'clearcoat' in material.params ? material.params.clearcoat : 0,
    clearcoat_roughness:
      'clearcoatRoughness' in material.params ? material.params.clearcoatRoughness : 0,
    sheen: 'sheen' in material.params ? material.params.sheen : 0,
    sheen_roughness:
      'sheenRoughness' in material.params ? material.params.sheenRoughness : 0,
    transmission: 0,
    thickness: 0,
    normal_scale: [
      'normalScale' in material.params ? material.params.normalScale : 1,
      'normalScale' in material.params ? material.params.normalScale : 1,
    ],
    map: mapTexture(material.textures.texture),
    normal_map: mapTexture(material.textures.normal),
    roughness_map: mapTexture(material.textures.roughness),
    displacement_map: mapTexture(material.textures.height),
    ao_map: null,
    metalness_map: null,
  }
}

function cameraPresetFromConfig(camera: CameraConfig): CameraPreset {
  const distance = camera.distance
  const polar = (camera.polarAngle * Math.PI) / 180
  const azimuth = (camera.azimuthAngle * Math.PI) / 180

  return {
    id: 'create-default',
    role: 'create_default',
    position: [
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    ],
    target: [0, 0, 0],
    fov: camera.fov,
    near: 0.001,
    far: 100,
    orbit_bounds: {
      min_azimuth: -180,
      max_azimuth: 180,
      min_polar: 0,
      max_polar: 180,
      min_distance: 0.05,
      max_distance: 5,
    },
  }
}

function directionalLightFromConfig(
  light?: DirectionalLightConfig,
): LightingRig['key_light'] | null {
  if (!light?.enabled) return null
  return {
    intensity: light.intensity,
    color: light.color,
    position: [light.x, light.y, light.z],
    cast_shadow: true,
  }
}

function hdriAssetRef(environment: EnvironmentConfig): AssetRef {
  if (environment.customHdri) {
    return assetRefFromPath(environment.customHdri)
  }

  return {
    storage: 'local',
    path: `preset:${environment.preset}`,
    format: 'preset',
  }
}

export function buildStudioOnlyState(args?: {
  config?: Partial<SceneConfig>
  panelLayout?: Partial<StudioOnlyState['panel_layout']>
  selection?: Partial<StudioOnlyState['selection']>
  undoStack?: StudioOnlyState['undo_stack']
}): StudioOnlyState {
  const config = args?.config
  return {
    model_path: config?.modelPath ?? '/assets/shapes/effect-70mm-step.glb',
    artwork: {
      url: config?.artwork?.url,
      offsetX: config?.artwork?.offsetX ?? 0,
      offsetY: config?.artwork?.offsetY ?? 0,
      scale: config?.artwork?.scale ?? 1,
    },
    panel_layout: {
      show_left_dock: args?.panelLayout?.show_left_dock ?? true,
      show_right_dock: args?.panelLayout?.show_right_dock ?? true,
      editing_lights: args?.panelLayout?.editing_lights ?? false,
      left_dock_width: args?.panelLayout?.left_dock_width ?? 272,
      right_dock_width: args?.panelLayout?.right_dock_width ?? 344,
    },
    selection: {
      active_target: args?.selection?.active_target ?? null,
    },
    undo_stack: args?.undoStack ?? [],
  }
}

export function sceneConfigToScenePreset(input: {
  config: SceneConfig
  id: string
  slug: string
  version: number
  status: ScenePresetStatus
  productSpecId: string
  targetSubtypes: EffectSubtype[]
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  archivedAt?: string | null
}): ScenePreset {
  const { config } = input
  const camera = config.camera ?? {
    fov: 35,
    distance: 0.2,
    polarAngle: 90,
    azimuthAngle: 0,
    enableDamping: true,
    dampingFactor: 0.1,
    autoRotate: false,
    autoRotateSpeed: 2,
  }
  const environment = config.environment ?? {
    preset: 'studio',
    envRotation: 0,
    groundEnabled: false,
    groundHeight: 0,
    groundRadius: 20,
  }
  const lighting = config.lighting ?? {
    key: { type: 'directional', enabled: true, intensity: 1.2, color: '#ffffff', x: 1.6, y: 1.2, z: 1.6, targetX: 0, targetY: 0, targetZ: 0 },
    fill: { type: 'directional', enabled: true, intensity: 0.45, color: '#f3f4f6', x: -1.4, y: 0.9, z: 1.2, targetX: 0, targetY: 0, targetZ: 0 },
    rim: { type: 'directional', enabled: false, intensity: 0.35, color: '#ffffff', x: -1, y: 1.6, z: -1.8, targetX: 0, targetY: 0, targetZ: 0 },
  }

  return {
    id: input.id,
    slug: input.slug,
    name: config.name,
    version: input.version,
    status: input.status,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    published_at: input.publishedAt ?? null,
    archived_at: input.archivedAt ?? null,
    family: 'effect',
    product_spec_id: input.productSpecId,
    payload: {
      target_subtypes: input.targetSubtypes,
      surface_materials: {
        face: toSurfaceProfile('face', config.face),
        back: toSurfaceProfile('back', config.back),
        frame: toSurfaceProfile('frame', config.frame),
      },
      cameras: [cameraPresetFromConfig(camera)],
      lighting_rig: {
        hdri: hdriAssetRef(environment),
        hdri_intensity: config.scene.envIntensity,
        hdri_rotation_deg: environment.envRotation,
        ambient_intensity: config.scene.ambientIntensity,
        exposure: config.scene.exposure,
        tone_mapping: 'neutral',
        key_light: directionalLightFromConfig(lighting?.key),
        fill_light: directionalLightFromConfig(lighting?.fill),
        rim_light: directionalLightFromConfig(lighting?.rim),
      },
      render_settings: {
        background_color: config.colors.bgColor,
        transparent_background: config.scene.transparentBackground ?? false,
        shadow_enabled: config.scene.shadowEnabled ?? true,
        dpr_min: config.scene.dprMin ?? 1,
        dpr_max: config.scene.dprMax ?? 2,
        frameloop: config.scene.frameloop ?? 'always',
        bloom_enabled: config.postprocessing?.bloomEnabled ?? false,
        bloom_intensity: config.postprocessing?.bloomIntensity ?? 0.35,
        bloom_luminance_threshold: config.postprocessing?.bloomLuminanceThreshold ?? 0.7,
        bloom_radius: config.postprocessing?.bloomRadius ?? 0.85,
        vignette_enabled: config.postprocessing?.vignetteEnabled ?? false,
        vignette_offset: config.postprocessing?.vignetteOffset ?? 0.35,
        vignette_darkness: config.postprocessing?.vignetteDarkness ?? 0.55,
      },
      capture_presets: [
        {
          id: 'owner-square',
          role: 'owner',
          camera_preset_id: 'create-default',
          width_px: 1600,
          height_px: 1600,
          pixel_ratio: 1,
          format: 'png',
          quality: null,
        },
        {
          id: 'public-square',
          role: 'public',
          camera_preset_id: 'create-default',
          width_px: 1600,
          height_px: 1600,
          pixel_ratio: config.scene.dprMax ?? 2,
          format: 'webp',
          quality: 92,
        },
        {
          id: 'order-square',
          role: 'order',
          camera_preset_id: 'create-default',
          width_px: 2400,
          height_px: 2400,
          pixel_ratio: config.scene.dprMax ?? 2,
          format: 'png',
          quality: null,
        },
      ],
      theatre_source: null,
    },
  }
}

function pickTexturePath(ref?: TextureMapRef | null) {
  return ref?.asset.path
}

export function studioDocumentToSceneConfig(document: StudioDocument): SceneConfig {
  const { scene_preset: preset, metadata } = document
  const face = preset.payload.surface_materials.face
  const back = preset.payload.surface_materials.back
  const frame = preset.payload.surface_materials.frame
  const camera = preset.payload.cameras[0]
  const lighting = preset.payload.lighting_rig
  const hdriPath = lighting.hdri.path
  const environmentPreset = hdriPath.startsWith('preset:') ? hdriPath.replace('preset:', '') : 'studio'
  const customHdri = hdriPath.startsWith('/assets/') ? hdriPath : undefined

  return {
    name: preset.slug,
    created: preset.created_at,
    modified: preset.updated_at,
    modelPath: metadata.studio_state.model_path,
    face: {
      params: {
        roughness: face.roughness,
        metalness: face.metalness,
        envMapIntensity: 0.1,
        normalScale: face.normal_scale[0],
        bumpScale: 1,
        sheen: face.sheen,
        sheenColor: face.base_color,
        sheenRoughness: face.sheen_roughness,
        colorMultiplier: 1,
      },
      textures: {
        texture: pickTexturePath(face.map),
        normal: pickTexturePath(face.normal_map) ?? '',
        roughness: pickTexturePath(face.roughness_map) ?? '',
        height: pickTexturePath(face.displacement_map) ?? '',
        sheenColor: undefined,
      },
    },
    back: {
      params: {
        color: back.base_color,
        roughness: back.roughness,
        envMapIntensity: 0.1,
        normalScale: back.normal_scale[0],
        bumpScale: 1,
        sheen: back.sheen,
        sheenColor: back.base_color,
        sheenRoughness: back.sheen_roughness,
      },
      textures: {
        texture: pickTexturePath(back.map),
        normal: pickTexturePath(back.normal_map) ?? '',
        roughness: pickTexturePath(back.roughness_map) ?? '',
        height: pickTexturePath(back.displacement_map) ?? '',
        sheenColor: undefined,
      },
    },
    frame: {
      params: {
        color: frame.base_color,
        roughness: frame.roughness,
        metalness: frame.metalness,
        clearcoat: frame.clearcoat,
        clearcoatRoughness: frame.clearcoat_roughness,
      },
      textures: {
        texture: pickTexturePath(frame.map),
        normal: pickTexturePath(frame.normal_map),
        roughness: pickTexturePath(frame.roughness_map),
        height: pickTexturePath(frame.displacement_map),
      } satisfies Partial<TexturePaths>,
    },
    scene: {
      exposure: lighting.exposure,
      ambientIntensity: lighting.ambient_intensity,
      envIntensity: lighting.hdri_intensity,
      background: preset.payload.render_settings.background_color,
      toneMapping: lighting.tone_mapping,
      transparentBackground: preset.payload.render_settings.transparent_background,
      shadowEnabled: preset.payload.render_settings.shadow_enabled,
      dprMin: preset.payload.render_settings.dpr_min,
      dprMax: preset.payload.render_settings.dpr_max,
      frameloop: preset.payload.render_settings.frameloop,
    },
    colors: {
      backColor: back.base_color,
      frameColor: frame.base_color,
      bgColor: preset.payload.render_settings.background_color,
    },
    camera: {
      fov: camera?.fov ?? 35,
      distance: Math.max(
        Math.sqrt(camera.position[0] ** 2 + camera.position[1] ** 2 + camera.position[2] ** 2),
        0.2,
      ),
      polarAngle: 90,
      azimuthAngle: 0,
      enableDamping: true,
      dampingFactor: 0.1,
      autoRotate: false,
      autoRotateSpeed: 2,
    },
    environment: {
      preset: environmentPreset,
      customHdri,
      envRotation: lighting.hdri_rotation_deg,
      groundEnabled: preset.payload.render_settings.shadow_enabled,
      groundHeight: 0,
      groundRadius: 20,
    },
    lighting: {
      key: {
        type: 'directional',
        enabled: Boolean(lighting.key_light),
        intensity: lighting.key_light?.intensity ?? 0,
        color: lighting.key_light?.color ?? '#ffffff',
        x: lighting.key_light?.position[0] ?? 1.6,
        y: lighting.key_light?.position[1] ?? 1.2,
        z: lighting.key_light?.position[2] ?? 1.6,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
      },
      fill: {
        type: 'directional',
        enabled: Boolean(lighting.fill_light),
        intensity: lighting.fill_light?.intensity ?? 0,
        color: lighting.fill_light?.color ?? '#ffffff',
        x: lighting.fill_light?.position[0] ?? -1.4,
        y: lighting.fill_light?.position[1] ?? 0.9,
        z: lighting.fill_light?.position[2] ?? 1.2,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
      },
      rim: {
        type: 'directional',
        enabled: Boolean(lighting.rim_light),
        intensity: lighting.rim_light?.intensity ?? 0,
        color: lighting.rim_light?.color ?? '#ffffff',
        x: lighting.rim_light?.position[0] ?? -1,
        y: lighting.rim_light?.position[1] ?? 1.6,
        z: lighting.rim_light?.position[2] ?? -1.8,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
      },
    },
    artwork: metadata.studio_state.artwork,
    postprocessing: {
      bloomEnabled: preset.payload.render_settings.bloom_enabled ?? false,
      bloomIntensity: preset.payload.render_settings.bloom_intensity ?? 0.35,
      bloomLuminanceThreshold: preset.payload.render_settings.bloom_luminance_threshold ?? 0.7,
      bloomRadius: preset.payload.render_settings.bloom_radius ?? 0.85,
      vignetteEnabled: preset.payload.render_settings.vignette_enabled ?? false,
      vignetteOffset: preset.payload.render_settings.vignette_offset ?? 0.35,
      vignetteDarkness: preset.payload.render_settings.vignette_darkness ?? 0.55,
    },
  }
}

export function summarizeStudioDocument(document: StudioDocument): StudioDocumentSummary {
  return {
    id: document.metadata.id,
    slug: document.metadata.slug,
    name: document.metadata.name,
    version: document.scene_preset.version,
    status: document.scene_preset.status,
    updated_at: document.scene_preset.updated_at,
    published_version: document.metadata.published_version,
  }
}
