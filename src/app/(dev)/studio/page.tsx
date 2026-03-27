'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import dynamic from 'next/dynamic'
import { useGesture } from '@use-gesture/react'
import type { ArtworkConfig, CameraConfig, ColorConfig, DesignState, EnvironmentConfig, LightingConfig, SceneConfig, TexturePaths, ViewerConfig } from '../prototype/types'
import { createEffectStudioRegistry } from '@/studio/controls/registry/effectStandard'
import { buildStudioOnlyState, type ScenePresetStatus } from '@/studio/persistence/studioDocument'
import type { StudioOutputPayload } from '@/studio/preset/types'
import { InspectorPanel } from '@/studio/panels/InspectorPanel'
import { LibraryPanel } from '@/studio/panels/LibraryPanel'
import { StudiosPanel } from '@/studio/panels/StudiosPanel'
import { STUDIO_THEME, primaryButtonStyle, secondaryButtonStyle } from '@/studio/theme'

const EffectViewer = dynamic(() => import('../prototype/core/EffectViewer'), { ssr: false })

type MaterialKey = 'face' | 'back' | 'frame'

interface AssetDirectoryState {
  models: Record<string, string>
  hdris: Record<string, string>
  artworks: Record<string, string>
  materialSets: Array<{
    name: string
    textures: Partial<TexturePaths>
  }>
  materialPresets: string[]
  loaded: boolean
}

interface SceneEntry {
  id: string
  slug: string
  name: string
  modified: string
  status: ScenePresetStatus
  version: number
  publishedVersion: number | null
}

interface StudioShellLayoutState {
  showLeftDock: boolean
  showRightDock: boolean
  leftDockWidth: number
  rightDockWidth: number
}

type StudioLayoutPresetId = 'balanced' | 'viewport' | 'lighting'

interface StudioLayoutPresetDefinition {
  label: string
  layout: StudioShellLayoutState
}

interface StudioLayoutStorageState extends Partial<StudioShellLayoutState> {
  selectedLayoutPreset?: StudioLayoutPresetId
  isEditingLights?: boolean
  layoutPresets?: Partial<Record<StudioLayoutPresetId, Partial<StudioShellLayoutState>>>
}

type DockSide = 'left' | 'right'

interface DockResizeState {
  side: DockSide
  startX: number
  startLeftDockWidth: number
  startRightDockWidth: number
}

const INITIAL_DESIGN: DesignState = { offsetX: 0, offsetY: 0, scale: 1.0 }
const MIN_SCALE = 1.0
const MAX_SCALE = 4.0
const DRAG_SENSITIVITY = 0.001
const SCROLL_SENSITIVITY = 0.002
const STUDIO_LAYOUT_STORAGE_KEY = 'onemo-studio-layout:v1'
const DEFAULT_LEFT_DOCK_WIDTH = 220
const DEFAULT_RIGHT_DOCK_WIDTH = 300
const MIN_DOCK_WIDTH = 180
const MIN_VIEWPORT_WIDTH = 400
const SHELL_HORIZONTAL_PADDING = 0
const SHELL_COLUMN_GAP = 0
const STUDIO_LAYOUT_PRESET_ORDER: StudioLayoutPresetId[] = ['balanced', 'viewport', 'lighting']
const DEFAULT_LAYOUT_PRESET: StudioLayoutPresetId = 'balanced'
const STUDIO_LAYOUT_PRESET_DEFINITIONS: Record<StudioLayoutPresetId, StudioLayoutPresetDefinition> = {
  balanced: {
    label: 'Balanced Shell',
    layout: {
      showLeftDock: true,
      showRightDock: true,
      leftDockWidth: DEFAULT_LEFT_DOCK_WIDTH,
      rightDockWidth: DEFAULT_RIGHT_DOCK_WIDTH,
    },
  },
  viewport: {
    label: 'Viewport Focus',
    layout: {
      showLeftDock: false,
      showRightDock: false,
      leftDockWidth: DEFAULT_LEFT_DOCK_WIDTH,
      rightDockWidth: DEFAULT_RIGHT_DOCK_WIDTH,
    },
  },
  lighting: {
    label: 'Lighting Review',
    layout: {
      showLeftDock: false,
      showRightDock: true,
      leftDockWidth: DEFAULT_LEFT_DOCK_WIDTH,
      rightDockWidth: 360,
    },
  },
}

function clampDockWidthForViewport(requestedWidth: number, oppositeDockWidth: number) {
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth
  const maxWidth =
    viewportWidth -
    SHELL_HORIZONTAL_PADDING * 2 -
    SHELL_COLUMN_GAP * 2 -
    MIN_VIEWPORT_WIDTH -
    Math.max(0, oppositeDockWidth)
  const boundedMaxWidth = Math.max(0, maxWidth)
  const boundedMinWidth = Math.min(MIN_DOCK_WIDTH, boundedMaxWidth)
  return Math.round(Math.min(boundedMaxWidth, Math.max(boundedMinWidth, requestedWidth)))
}

const DEFAULT_COLORS: ColorConfig = {
  backColor: '#080808',
  frameColor: '#0f0f0f',
  bgColor: '#000000',
}

const DEFAULT_CAMERA: CameraConfig = {
  fov: 42,
  distance: 0.24,
  polarAngle: 90,
  azimuthAngle: 0,
  enableDamping: true,
  dampingFactor: 0.1,
  autoRotate: false,
  autoRotateSpeed: 2,
}

const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  preset: 'studio',
  envRotation: 0,
  groundEnabled: false,
  groundHeight: 0,
  groundRadius: 20,
}

const DEFAULT_LIGHTING: LightingConfig = {
  key: { type: 'directional', enabled: true, intensity: 1.2, color: '#ffffff', x: 1.6, y: 1.2, z: 1.6, targetX: 0, targetY: 0, targetZ: 0 },
  fill: { type: 'directional', enabled: true, intensity: 0.45, color: '#f3f4f6', x: -1.4, y: 0.9, z: 1.2, targetX: 0, targetY: 0, targetZ: 0 },
  rim: { type: 'directional', enabled: false, intensity: 0.35, color: '#ffffff', x: -1.0, y: 1.6, z: -1.8, targetX: 0, targetY: 0, targetZ: 0 },
}

const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
  modelPath: '/assets/shapes/effect-70mm-step.glb',
  face: {
    params: {
      roughness: 1.0,
      metalness: 0,
      envMapIntensity: 0.1,
      normalScale: 0.15,
      bumpScale: 1.0,
      sheen: 1.0,
      sheenColor: '#1a1a1a',
      sheenRoughness: 0.8,
      colorMultiplier: 1.0,
    },
    textures: {
      normal: '/assets/materials/ultrasuede/suede-normal.png',
      roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
      height: '/assets/materials/ultrasuede/suede-height.png',
    },
  },
  back: {
    params: {
      color: DEFAULT_COLORS.backColor,
      roughness: 1.0,
      envMapIntensity: 0.1,
      normalScale: 0.15,
      bumpScale: 1.0,
      sheen: 1.0,
      sheenColor: '#1a1a1a',
      sheenRoughness: 0.8,
    },
    textures: {
      normal: '/assets/materials/ultrasuede/suede-normal.png',
      roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
      height: '/assets/materials/ultrasuede/suede-height.png',
    },
  },
  frame: {
    params: {
      color: DEFAULT_COLORS.frameColor,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    },
    textures: {},
  },
  scene: {
    exposure: 0.7,
    ambientIntensity: 0.5,
    envIntensity: 1.0,
    background: DEFAULT_COLORS.bgColor,
  },
  colors: DEFAULT_COLORS,
  camera: DEFAULT_CAMERA,
  environment: DEFAULT_ENVIRONMENT,
  lighting: DEFAULT_LIGHTING,
  postprocessing: {
    bloomEnabled: false,
    bloomIntensity: 0.35,
    bloomLuminanceThreshold: 0.7,
    bloomRadius: 0.85,
    vignetteEnabled: false,
    vignetteOffset: 0.35,
    vignetteDarkness: 0.55,
  },
}

const MATERIAL_TEXTURE_SLOTS: Record<MaterialKey, Array<keyof TexturePaths>> = {
  face: ['texture', 'normal', 'roughness', 'height', 'sheenColor'],
  back: ['texture', 'normal', 'roughness', 'height', 'sheenColor'],
  frame: ['texture', 'normal', 'roughness', 'height'],
}

function cloneLightingConfig(lighting: LightingConfig): LightingConfig {
  return {
    key: { ...lighting.key },
    fill: { ...lighting.fill },
    rim: { ...lighting.rim },
  }
}

function cloneDesignState(designState: DesignState): DesignState {
  return {
    offsetX: designState.offsetX,
    offsetY: designState.offsetY,
    scale: designState.scale,
  }
}

function buildArtworkConfig(artworkUrl: string | undefined, designState: DesignState): ArtworkConfig {
  return {
    url: artworkUrl,
    offsetX: designState.offsetX,
    offsetY: designState.offsetY,
    scale: designState.scale,
  }
}

function buildArtworkStateFromScene(config: Partial<SceneConfig>) {
  return {
    artworkUrl: config.artwork?.url,
    designState: cloneDesignState({
      offsetX: config.artwork?.offsetX ?? INITIAL_DESIGN.offsetX,
      offsetY: config.artwork?.offsetY ?? INITIAL_DESIGN.offsetY,
      scale: config.artwork?.scale ?? INITIAL_DESIGN.scale,
    }),
  }
}

function cloneViewerConfig(config: ViewerConfig): ViewerConfig {
  return {
    modelPath: config.modelPath,
    face: {
      params: { ...config.face.params },
      textures: { ...config.face.textures },
    },
    back: {
      params: { ...config.back.params },
      textures: { ...config.back.textures },
    },
    frame: {
      params: { ...config.frame.params },
      textures: { ...config.frame.textures },
    },
    scene: { ...config.scene },
    colors: { ...config.colors },
    camera: config.camera ? { ...config.camera } : undefined,
    environment: config.environment ? { ...config.environment } : undefined,
    lighting: config.lighting ? cloneLightingConfig(config.lighting) : undefined,
    postprocessing: config.postprocessing ? { ...config.postprocessing } : undefined,
  }
}

const BASELINE_FLOAT_EPSILON = 1e-6

function areNumbersEffectivelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= BASELINE_FLOAT_EPSILON
}

function areBaselineValuesEqual(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return areNumbersEffectivelyEqual(left, right)
  }

  if (Object.is(left, right)) {
    return true
  }

  if (left === null || right === null) {
    return left === right
  }

  if (typeof left !== 'object' || typeof right !== 'object') {
    return false
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!areBaselineValuesEqual(left[index], right[index])) {
        return false
      }
    }

    return true
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])

  for (const key of keys) {
    const leftValue = leftRecord[key]
    const rightValue = rightRecord[key]
    if (!areBaselineValuesEqual(leftValue, rightValue)) {
      return false
    }
  }

  return true
}

function areDesignStatesEqual(left: DesignState, right: DesignState) {
  return areBaselineValuesEqual(left, right)
}

function areViewerConfigsEqual(left: ViewerConfig, right: ViewerConfig) {
  return areBaselineValuesEqual(left, right)
}

function buildViewerConfigFromScene(config: Partial<SceneConfig>): ViewerConfig {
  const resolvedScene: ViewerConfig['scene'] = {
    ...DEFAULT_VIEWER_CONFIG.scene,
    ...config.scene,
  }
  const enforcedDprMin = Math.max(2, resolvedScene.dprMin ?? 2)
  const enforcedDprMax = Math.max(enforcedDprMin, resolvedScene.dprMax ?? 2)

  const resolvedCamera: CameraConfig = {
    ...DEFAULT_CAMERA,
    ...config.camera,
  }
  const isLegacyFlatCamera =
    Math.abs(resolvedCamera.fov - 35) <= BASELINE_FLOAT_EPSILON &&
    Math.abs(resolvedCamera.distance - 0.2) <= BASELINE_FLOAT_EPSILON &&
    Math.abs(resolvedCamera.polarAngle - 90) <= BASELINE_FLOAT_EPSILON &&
    Math.abs(resolvedCamera.azimuthAngle) <= BASELINE_FLOAT_EPSILON
  const nextCamera = isLegacyFlatCamera
    ? {
        ...resolvedCamera,
        fov: DEFAULT_CAMERA.fov,
        distance: DEFAULT_CAMERA.distance,
      }
    : resolvedCamera

  return {
    ...cloneViewerConfig(DEFAULT_VIEWER_CONFIG),
    ...(config.modelPath ? { modelPath: config.modelPath } : {}),
    ...(config.face ? { face: config.face } : {}),
    ...(config.back ? { back: config.back } : {}),
    ...(config.frame ? { frame: config.frame } : {}),
    scene: {
      ...resolvedScene,
      dprMin: enforcedDprMin,
      dprMax: enforcedDprMax,
    },
    colors: { ...DEFAULT_VIEWER_CONFIG.colors, ...config.colors },
    camera: nextCamera,
    environment: { ...DEFAULT_ENVIRONMENT, ...config.environment },
    lighting: cloneLightingConfig({
      ...DEFAULT_LIGHTING,
      ...config.lighting,
      key: { ...DEFAULT_LIGHTING.key, ...config.lighting?.key },
      fill: { ...DEFAULT_LIGHTING.fill, ...config.lighting?.fill },
      rim: { ...DEFAULT_LIGHTING.rim, ...config.lighting?.rim },
    }),
    postprocessing: { ...DEFAULT_VIEWER_CONFIG.postprocessing!, ...config.postprocessing },
  }
}

function cloneShellLayoutState(layout: StudioShellLayoutState): StudioShellLayoutState {
  return {
    showLeftDock: layout.showLeftDock,
    showRightDock: layout.showRightDock,
    leftDockWidth: layout.leftDockWidth,
    rightDockWidth: layout.rightDockWidth,
  }
}

function isLayoutPresetId(value: unknown): value is StudioLayoutPresetId {
  return typeof value === 'string' && value in STUDIO_LAYOUT_PRESET_DEFINITIONS
}

function resolveShellLayoutState(
  value: Partial<StudioShellLayoutState> | null | undefined,
  fallback: StudioShellLayoutState,
): StudioShellLayoutState {
  return {
    showLeftDock: typeof value?.showLeftDock === 'boolean' ? value.showLeftDock : fallback.showLeftDock,
    showRightDock: typeof value?.showRightDock === 'boolean' ? value.showRightDock : fallback.showRightDock,
    leftDockWidth: typeof value?.leftDockWidth === 'number' ? value.leftDockWidth : fallback.leftDockWidth,
    rightDockWidth: typeof value?.rightDockWidth === 'number' ? value.rightDockWidth : fallback.rightDockWidth,
  }
}

export default function StudioPage() {
  const [viewerConfig, setViewerConfig] = useState<ViewerConfig>(() => cloneViewerConfig(DEFAULT_VIEWER_CONFIG))
  const [savedBaselineConfig, setSavedBaselineConfig] = useState<ViewerConfig>(() => cloneViewerConfig(DEFAULT_VIEWER_CONFIG))
  const [savedBaselineArtworkUrl, setSavedBaselineArtworkUrl] = useState<string | undefined>()
  const [savedBaselineDesignState, setSavedBaselineDesignState] = useState<DesignState>(() => cloneDesignState(INITIAL_DESIGN))
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>()
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingLights, setIsEditingLights] = useState(false)
  const [designState, setDesignState] = useState<DesignState>(() => cloneDesignState(INITIAL_DESIGN))
  const [sceneNames, setSceneNames] = useState<string[]>([])
  const [sceneEntries, setSceneEntries] = useState<SceneEntry[]>([])
  const [currentScene, setCurrentScene] = useState('default')
  const [sceneDraftName, setSceneDraftName] = useState('default')
  const [didBootstrapScene, setDidBootstrapScene] = useState(false)
  const [pendingBaselineSync, setPendingBaselineSync] = useState(false)
  const [showLeftDock, setShowLeftDock] = useState(true)
  const [showRightDock, setShowRightDock] = useState(true)
  const [leftDockWidth, setLeftDockWidth] = useState(DEFAULT_LEFT_DOCK_WIDTH)
  const [rightDockWidth, setRightDockWidth] = useState(DEFAULT_RIGHT_DOCK_WIDTH)
  const leftDockWidthRef = useRef(leftDockWidth)
  const rightDockWidthRef = useRef(rightDockWidth)
  const activeDockResizeRef = useRef<DockResizeState | null>(null)
  const [activeDockResize, setActiveDockResize] = useState<DockSide | null>(null)
  const [selectedLayoutPreset, setSelectedLayoutPreset] = useState<StudioLayoutPresetId>(DEFAULT_LAYOUT_PRESET)
  const hydratedShellLayoutRef = useRef<Partial<StudioShellLayoutState> | null>(null)
  const [assets, setAssets] = useState<AssetDirectoryState>({
    models: { 'effect-70mm-step': DEFAULT_VIEWER_CONFIG.modelPath },
    hdris: { studio: 'studio' },
    artworks: {},
    materialSets: [],
    materialPresets: [],
    loaded: false,
  })
  const [materialPresetDraftName, setMaterialPresetDraftName] = useState('default-material')
  const [outputPayload, setOutputPayload] = useState<StudioOutputPayload | null>(null)
  const [outputLoading, setOutputLoading] = useState(false)
  const [outputError, setOutputError] = useState<string | null>(null)
  const [shellActionStatus, setShellActionStatus] = useState<string | null>(null)
  const shellActionStatusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    leftDockWidthRef.current = leftDockWidth
  }, [leftDockWidth])

  useEffect(() => {
    rightDockWidthRef.current = rightDockWidth
  }, [rightDockWidth])

  const clampDockWidth = useCallback(
    (side: DockSide, width: number, oppositeDockWidth: number) => {
      const fallbackWidth = side === 'left' ? DEFAULT_LEFT_DOCK_WIDTH : DEFAULT_RIGHT_DOCK_WIDTH
      const requestedWidth = Number.isFinite(width) ? width : fallbackWidth
      return clampDockWidthForViewport(requestedWidth, oppositeDockWidth)
    },
    [],
  )

  const announceShellAction = useCallback((message: string) => {
    setShellActionStatus(message)
    if (shellActionStatusTimeoutRef.current !== null) {
      window.clearTimeout(shellActionStatusTimeoutRef.current)
    }
    shellActionStatusTimeoutRef.current = window.setTimeout(() => {
      setShellActionStatus(null)
      shellActionStatusTimeoutRef.current = null
    }, 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (shellActionStatusTimeoutRef.current !== null) {
        window.clearTimeout(shellActionStatusTimeoutRef.current)
      }
    }
  }, [])

  const applyShellLayout = useCallback((layout: Partial<StudioShellLayoutState>) => {
    if (typeof layout.showLeftDock === 'boolean') setShowLeftDock(layout.showLeftDock)
    if (typeof layout.showRightDock === 'boolean') setShowRightDock(layout.showRightDock)
    const candidateLeftDockWidth =
      typeof layout.leftDockWidth === 'number' ? layout.leftDockWidth : leftDockWidthRef.current
    const candidateRightDockWidth =
      typeof layout.rightDockWidth === 'number' ? layout.rightDockWidth : rightDockWidthRef.current
    const nextLeftDockWidth = clampDockWidth('left', candidateLeftDockWidth, candidateRightDockWidth)
    const nextRightDockWidth = clampDockWidth('right', candidateRightDockWidth, candidateLeftDockWidth)
    leftDockWidthRef.current = nextLeftDockWidth
    rightDockWidthRef.current = nextRightDockWidth
    setLeftDockWidth(nextLeftDockWidth)
    setRightDockWidth(nextRightDockWidth)
  }, [clampDockWidth])

  const handleDockResizeStart = useCallback(
    (side: DockSide) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      activeDockResizeRef.current = {
        side,
        startX: event.clientX,
        startLeftDockWidth: leftDockWidthRef.current,
        startRightDockWidth: rightDockWidthRef.current,
      }
      setActiveDockResize(side)
    },
    [],
  )

  const refreshScenes = useCallback(async () => {
    const response = await fetch('/api/dev/scenes')
    const data = await response.json()
    const entries = (data.entries ?? []) as SceneEntry[]
    setSceneNames(entries.map((entry) => entry.slug))
    setSceneEntries(entries)
    return { scenes: entries.map((entry) => entry.slug), entries }
  }, [])

  const refreshAssets = useCallback(async () => {
    const [modelsResponse, environmentsResponse, materialsResponse, artworksResponse, materialPresetsResponse] = await Promise.all([
      fetch('/api/dev/assets?type=shapes'),
      fetch('/api/dev/assets?type=env'),
      fetch('/api/dev/assets?type=materials'),
      fetch('/api/dev/assets?type=artwork'),
      fetch('/api/dev/material-presets'),
    ])

    const modelsData = await modelsResponse.json()
    const environmentsData = await environmentsResponse.json()
    const materialsData = await materialsResponse.json()
    const artworksData = await artworksResponse.json()
    const materialPresetsData = await materialPresetsResponse.json()
    const nextModels: Record<string, string> = {}

    for (const item of modelsData.models ?? []) nextModels[item.name] = item.path

    const nextHdris: Record<string, string> = { studio: 'studio' }
    for (const item of environmentsData.hdris ?? []) nextHdris[item.name] = item.path

    const nextArtworks: Record<string, string> = {}
    for (const item of artworksData.artworks ?? []) nextArtworks[item.name] = item.path

    setAssets({
      models: Object.keys(nextModels).length ? nextModels : { 'effect-70mm-step': DEFAULT_VIEWER_CONFIG.modelPath },
      hdris: nextHdris,
      artworks: nextArtworks,
      materialSets: (materialsData.materials ?? []).map((item: { name: string; textures: Partial<TexturePaths> }) => ({
        name: item.name,
        textures: item.textures,
      })),
      materialPresets: materialPresetsData.presets ?? [],
      loaded: true,
    })
  }, [])

  useEffect(() => {
    try {
      const persistedLayout = window.localStorage.getItem(STUDIO_LAYOUT_STORAGE_KEY)
      if (!persistedLayout) return

      const parsed = JSON.parse(persistedLayout) as StudioLayoutStorageState
      const nextSelectedPreset = isLayoutPresetId(parsed.selectedLayoutPreset)
        ? parsed.selectedLayoutPreset
        : DEFAULT_LAYOUT_PRESET
      const hasLegacyPresetState =
        parsed.layoutPresets !== undefined && typeof parsed.layoutPresets === 'object' && parsed.layoutPresets !== null
      const presetFallback = STUDIO_LAYOUT_PRESET_DEFINITIONS[nextSelectedPreset].layout
      const rootShellLayout = hasLegacyPresetState
        ? cloneShellLayoutState(presetFallback)
        : resolveShellLayoutState(parsed, presetFallback)
      const persistedEditingLights = hasLegacyPresetState
        ? false
        : typeof parsed.isEditingLights === 'boolean'
          ? parsed.isEditingLights
          : false

      setSelectedLayoutPreset(nextSelectedPreset)
      setIsEditingLights(persistedEditingLights)
      hydratedShellLayoutRef.current = rootShellLayout
      applyShellLayout(rootShellLayout)
    } catch {
      // Ignore malformed persisted layout and keep the live defaults.
    }
  }, [applyShellLayout])

  useEffect(() => {
    const syncDockWidthsToViewport = () => {
      setLeftDockWidth((currentWidth) =>
        clampDockWidth('left', currentWidth, showRightDock ? rightDockWidthRef.current : 0),
      )
      setRightDockWidth((currentWidth) =>
        clampDockWidth('right', currentWidth, showLeftDock ? leftDockWidthRef.current : 0),
      )
    }

    syncDockWidthsToViewport()
    window.addEventListener('resize', syncDockWidthsToViewport)
    return () => {
      window.removeEventListener('resize', syncDockWidthsToViewport)
    }
  }, [clampDockWidth, showLeftDock, showRightDock])

  useEffect(() => {
    if (!activeDockResize) return

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = activeDockResizeRef.current
      if (!resizeState) return

      if (resizeState.side === 'left') {
        const delta = event.clientX - resizeState.startX
        const nextDockWidth = clampDockWidth(
          'left',
          resizeState.startLeftDockWidth + delta,
          showRightDock ? rightDockWidthRef.current : 0,
        )
        leftDockWidthRef.current = nextDockWidth
        setLeftDockWidth(nextDockWidth)
        return
      }

      const delta = resizeState.startX - event.clientX
      const nextDockWidth = clampDockWidth(
        'right',
        resizeState.startRightDockWidth + delta,
        showLeftDock ? leftDockWidthRef.current : 0,
      )
      rightDockWidthRef.current = nextDockWidth
      setRightDockWidth(nextDockWidth)
    }

    const handlePointerEnd = () => {
      activeDockResizeRef.current = null
      setActiveDockResize(null)
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [activeDockResize, clampDockWidth, showLeftDock, showRightDock])

  useEffect(() => {
    const currentShellLayout: StudioShellLayoutState = {
      showLeftDock,
      showRightDock,
      leftDockWidth,
      rightDockWidth,
    }

    window.localStorage.setItem(
      STUDIO_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...currentShellLayout,
        isEditingLights,
        selectedLayoutPreset,
      }),
    )
  }, [isEditingLights, leftDockWidth, rightDockWidth, selectedLayoutPreset, showLeftDock, showRightDock])

  useEffect(() => {
    if (!pendingBaselineSync) return

    let cancelled = false
    let secondFrame = 0

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (cancelled) return
        setSavedBaselineConfig(cloneViewerConfig(viewerConfig))
        setSavedBaselineArtworkUrl(artworkUrl)
        setSavedBaselineDesignState(cloneDesignState(designState))
        setPendingBaselineSync(false)
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame)
      }
    }
  }, [artworkUrl, designState, pendingBaselineSync, viewerConfig])

  const saveScene = useCallback(async (name: string): Promise<boolean> => {
    try {
      const sceneName = name.trim() || 'default'
      const payload: SceneConfig = {
        name: sceneName,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        modelPath: viewerConfig.modelPath,
        face: viewerConfig.face,
        back: viewerConfig.back,
        frame: viewerConfig.frame,
        scene: viewerConfig.scene,
        colors: viewerConfig.colors,
        camera: viewerConfig.camera ?? DEFAULT_CAMERA,
        environment: viewerConfig.environment ?? DEFAULT_ENVIRONMENT,
        lighting: viewerConfig.lighting ?? DEFAULT_LIGHTING,
        artwork: buildArtworkConfig(artworkUrl, designState),
        postprocessing: viewerConfig.postprocessing ?? DEFAULT_VIEWER_CONFIG.postprocessing,
      }

      const response = await fetch('/api/dev/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: payload,
          studioState: buildStudioOnlyState({
            config: payload,
            panelLayout: {
              show_left_dock: showLeftDock,
              show_right_dock: showRightDock,
              editing_lights: isEditingLights,
              left_dock_width: leftDockWidth,
              right_dock_width: rightDockWidth,
            },
            selection: {
              active_target: null,
            },
          }),
        }),
      })

      const saved = await response.json()
      if (!response.ok) return false

      const nextBaseline = buildViewerConfigFromScene(payload)
      setSavedBaselineConfig(cloneViewerConfig(nextBaseline))
      setSavedBaselineArtworkUrl(payload.artwork?.url)
      setSavedBaselineDesignState(cloneDesignState(designState))
      setCurrentScene(saved.summary?.slug ?? sceneName)
      setSceneDraftName(saved.summary?.name ?? sceneName)
      await refreshScenes()
      return true
    } catch {
      return false
    }
  }, [artworkUrl, designState, isEditingLights, leftDockWidth, refreshScenes, rightDockWidth, showLeftDock, showRightDock, viewerConfig])

  const loadScene = useCallback(async (name: string, options?: { preferHydratedShellLayout?: boolean }) => {
    const response = await fetch(`/api/dev/scenes/${name}`)
    if (!response.ok) return

    const loaded = await response.json()
    const config = loaded.scene as SceneConfig
    const nextConfig = buildViewerConfigFromScene(config)
    const nextArtwork = buildArtworkStateFromScene(config)
    const studioState = loaded.document?.metadata?.studio_state
    setViewerConfig(nextConfig)
    setSavedBaselineConfig(cloneViewerConfig(nextConfig))
    setArtworkUrl(nextArtwork.artworkUrl)
    setSavedBaselineArtworkUrl(nextArtwork.artworkUrl)
    setDesignState(nextArtwork.designState)
    setSavedBaselineDesignState(cloneDesignState(nextArtwork.designState))
    const hydratedShellLayout = options?.preferHydratedShellLayout
      ? hydratedShellLayoutRef.current
      : null

    if (hydratedShellLayout) {
      applyShellLayout(hydratedShellLayout)
    } else if (options?.preferHydratedShellLayout) {
      // No localStorage layout found during bootstrap — use the selected layout preset
      // instead of the scene's persisted layout (which may have stale hidden-dock state).
      const presetLayout = STUDIO_LAYOUT_PRESET_DEFINITIONS[selectedLayoutPreset]?.layout
      if (presetLayout) {
        applyShellLayout(presetLayout)
      }
    } else if (studioState?.panel_layout) {
      applyShellLayout({
        showLeftDock: studioState.panel_layout.show_left_dock,
        showRightDock: studioState.panel_layout.show_right_dock,
        leftDockWidth: studioState.panel_layout.left_dock_width,
        rightDockWidth: studioState.panel_layout.right_dock_width,
      })
      if (typeof studioState.panel_layout.editing_lights === 'boolean') {
        setIsEditingLights(studioState.panel_layout.editing_lights)
      }
    }
    setCurrentScene(loaded.summary?.slug ?? name)
    setSceneDraftName(loaded.summary?.name ?? name)
    setPendingBaselineSync(true)
  }, [applyShellLayout, selectedLayoutPreset])

  const publishScene = useCallback(async () => {
    const response = await fetch(`/api/dev/scenes/${currentScene}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    })
    if (!response.ok) return

    await refreshScenes()
    await loadScene(currentScene)
  }, [currentScene, loadScene, refreshScenes])

  const archiveScene = useCallback(async (slug: string) => {
    const response = await fetch(`/api/dev/scenes/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    })
    if (!response.ok) return

    const refreshed = await refreshScenes()
    const fallbackScene = refreshed.scenes.find((entrySlug) => entrySlug !== slug) ?? refreshed.scenes[0]
    if (fallbackScene) {
      await loadScene(fallbackScene)
    }
  }, [loadScene, refreshScenes])

  useEffect(() => {
    if (didBootstrapScene) return

    let cancelled = false

    void (async () => {
      const sceneData = await refreshScenes()
      await refreshAssets()
      if (cancelled) return

      const availableScenes = sceneData.scenes ?? []
      const nextBootstrapScene = availableScenes.includes(currentScene) ? currentScene : availableScenes[0]
      if (nextBootstrapScene) {
        await loadScene(nextBootstrapScene, { preferHydratedShellLayout: true })
      }
      if (!cancelled) {
        setDidBootstrapScene(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentScene, didBootstrapScene, loadScene, refreshAssets, refreshScenes])

  const resetScene = useCallback(() => {
    setViewerConfig(cloneViewerConfig(savedBaselineConfig))
    setArtworkUrl(savedBaselineArtworkUrl)
    setDesignState(cloneDesignState(savedBaselineDesignState))
    setSceneDraftName(currentScene)
  }, [currentScene, savedBaselineArtworkUrl, savedBaselineConfig, savedBaselineDesignState])

  const handleArtworkFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/dev/assets/upload?type=artwork', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    if (!data.path) return

    await refreshAssets()
    setArtworkUrl(data.path)
    setDesignState(cloneDesignState(INITIAL_DESIGN))
  }, [refreshAssets])

  const handleAssetUpload = useCallback(async (type: 'shapes' | 'env', file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/dev/assets/upload?type=${type}`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    if (!data.path) return

    await refreshAssets()

    if (type === 'shapes') {
      setViewerConfig((previous) => ({ ...previous, modelPath: data.path }))
      return
    }

    setViewerConfig((previous) => ({
      ...previous,
      environment: {
        ...previous.environment!,
        preset: 'studio',
        customHdri: data.path,
      },
    }))
  }, [refreshAssets])

  const handleTextureUpload = useCallback(async (material: MaterialKey, slot: keyof TexturePaths, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/dev/assets/upload?type=materials&folder=${material}&slot=${slot}`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    if (!data.path) return

    await refreshAssets()

    setViewerConfig((previous) => ({
      ...previous,
      [material]: {
        ...previous[material],
        textures: {
          ...previous[material].textures,
          [slot]: data.path,
        },
      },
    }) as ViewerConfig)
  }, [refreshAssets])

  const updateMaterialTexture = useCallback((material: MaterialKey, slot: keyof TexturePaths, value: string) => {
    setViewerConfig((previous) => ({
      ...previous,
      [material]: {
        ...previous[material],
        textures: {
          ...previous[material].textures,
          [slot]: value,
        },
      },
    }) as ViewerConfig)
  }, [])

  const updateLightTransform = useCallback((key: 'key' | 'fill' | 'rim', patch: Partial<LightingConfig['key']>) => {
    setViewerConfig((previous) => ({
      ...previous,
      lighting: {
        ...previous.lighting!,
        [key]: {
          ...previous.lighting![key],
          ...patch,
        },
      },
    }))
  }, [])

  const applyMaterialSet = useCallback((material: MaterialKey, textures: Partial<TexturePaths>) => {
    setViewerConfig((previous) => ({
      ...previous,
      [material]: {
        ...previous[material],
        textures: {
          ...previous[material].textures,
          ...textures,
        },
      },
    }) as ViewerConfig)
  }, [])

  const saveMaterialPreset = useCallback(async (name: string) => {
    const presetName = name.trim() || 'default-material'
    await fetch('/api/dev/material-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: presetName,
        modified: new Date().toISOString(),
        face: viewerConfig.face,
        back: viewerConfig.back,
        frame: viewerConfig.frame,
      }),
    })

    setMaterialPresetDraftName(presetName)
    await refreshAssets()
  }, [refreshAssets, viewerConfig.back, viewerConfig.face, viewerConfig.frame])

  const loadMaterialPreset = useCallback(async (name: string) => {
    const response = await fetch(`/api/dev/material-presets/${name}`)
    if (!response.ok) return

    const preset = await response.json()
    setViewerConfig((previous) => ({
      ...previous,
      face: preset.face,
      back: preset.back,
      frame: preset.frame,
    }))
    setMaterialPresetDraftName(preset.name)
  }, [])

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((previous) => ({
          ...previous,
          offsetX: previous.offsetX + dx * DRAG_SENSITIVITY,
          offsetY: previous.offsetY - dy * DRAG_SENSITIVITY,
        }))
      },
      onPinch: ({ offset: [scale], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((previous) => ({
          ...previous,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)),
        }))
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (!isEditing) return
        event.preventDefault()
        setDesignState((previous) => ({
          ...previous,
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, previous.scale - dy * SCROLL_SENSITIVITY)),
        }))
      },
    },
    {
      drag: { enabled: isEditing },
      pinch: { enabled: isEditing, scaleBounds: { min: MIN_SCALE, max: MAX_SCALE } },
      wheel: { enabled: isEditing },
      eventOptions: { passive: false },
    },
  )

  const hdriValue = useMemo(
    () => viewerConfig.environment?.customHdri ?? viewerConfig.environment?.preset ?? 'studio',
    [viewerConfig.environment],
  )

  const sceneOptions = useMemo(
    () => (sceneEntries.length ? sceneEntries : [{ id: 'default', slug: 'default', name: 'default', modified: '', status: 'draft', version: 1, publishedVersion: null }]).map((entry) => ({ label: entry.name, value: entry.slug })),
    [sceneEntries],
  )

  const modelOptions = useMemo(
    () => Object.entries(assets.models).map(([label, value]) => ({ label, value })),
    [assets.models],
  )

  const hdriOptions = useMemo(
    () => Object.entries(assets.hdris).map(([label, value]) => ({ label, value })),
    [assets.hdris],
  )



  const hasUnsavedChanges = useMemo(
    () =>
      !areViewerConfigsEqual(viewerConfig, savedBaselineConfig) ||
      artworkUrl !== savedBaselineArtworkUrl ||
      !areDesignStatesEqual(designState, savedBaselineDesignState),
    [artworkUrl, designState, savedBaselineArtworkUrl, savedBaselineConfig, savedBaselineDesignState, viewerConfig],
  )

  const currentSceneEntry = useMemo(
    () => sceneEntries.find((entry) => entry.slug === currentScene) ?? null,
    [currentScene, sceneEntries],
  )

  const sceneMeta = useMemo(
    () =>
      Object.fromEntries(
        sceneEntries.map((entry) => [
          entry.slug,
          {
            status: entry.status,
            version: entry.version,
          },
        ]),
      ),
    [sceneEntries],
  )

  const effectiveLeftDockWidth = useMemo(
    () => (showLeftDock ? clampDockWidth('left', leftDockWidth, showRightDock ? rightDockWidth : 0) : 0),
    [clampDockWidth, leftDockWidth, rightDockWidth, showLeftDock, showRightDock],
  )

  const effectiveRightDockWidth = useMemo(
    () => (showRightDock ? clampDockWidth('right', rightDockWidth, showLeftDock ? leftDockWidth : 0) : 0),
    [clampDockWidth, leftDockWidth, rightDockWidth, showLeftDock, showRightDock],
  )

  const materialGroups = useMemo(
    () => ([
      { key: 'face', label: 'Face', textures: viewerConfig.face.textures, slots: MATERIAL_TEXTURE_SLOTS.face },
      { key: 'back', label: 'Back', textures: viewerConfig.back.textures, slots: MATERIAL_TEXTURE_SLOTS.back },
      { key: 'frame', label: 'Frame', textures: viewerConfig.frame.textures, slots: MATERIAL_TEXTURE_SLOTS.frame },
    ] as const),
    [viewerConfig.back.textures, viewerConfig.face.textures, viewerConfig.frame.textures],
  )

  const studioRegistry = useMemo(
    () => createEffectStudioRegistry({
      getConfig: () => viewerConfig,
      setConfig: setViewerConfig,
      currentScene,
      sceneDraftName,
      setSceneDraftName,
      sceneOptions,
      modelOptions,
      hdriOptions,
      onLoadScene: loadScene,
      onSaveScene: async (name) => {
        await saveScene(name)
      },
      onResetScene: resetScene,
      onTextureUpload: handleTextureUpload,
      onAssetUpload: handleAssetUpload,
      layout: {
        showLeftDock,
        showRightDock,
        selectedLayoutPreset,
        layoutPresetOptions: STUDIO_LAYOUT_PRESET_ORDER.map((id) => ({
          label: STUDIO_LAYOUT_PRESET_DEFINITIONS[id].label,
          value: id,
        })),
        setShowLeftDock,
        setShowRightDock,
        onSelectLayoutPreset: (value) => {
          if (!isLayoutPresetId(value)) return
          setSelectedLayoutPreset(value)
          applyShellLayout(STUDIO_LAYOUT_PRESET_DEFINITIONS[value].layout)
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentScene, handleAssetUpload, handleTextureUpload, hdriOptions, loadScene, modelOptions, resetScene, saveScene, sceneDraftName, sceneOptions, selectedLayoutPreset, setShowLeftDock, setShowRightDock, showLeftDock, showRightDock, viewerConfig, applyShellLayout, setSelectedLayoutPreset],
  )

  const handleQuickSave = useCallback(() => {
    void (async () => {
      const didSave = await saveScene(sceneDraftName || currentScene || 'default')
      announceShellAction(didSave ? 'Studio saved' : 'Save failed')
    })()
  }, [announceShellAction, currentScene, saveScene, sceneDraftName])

  const handleResetScene = useCallback(() => {
    resetScene()
    announceShellAction(hasUnsavedChanges ? 'Scene reset to saved state' : 'Scene already matches saved state')
  }, [announceShellAction, hasUnsavedChanges, resetScene])

  const handleLayoutPresetSelect = useCallback(
    (presetId: StudioLayoutPresetId) => {
      const nextLayout = STUDIO_LAYOUT_PRESET_DEFINITIONS[presetId].layout
      setSelectedLayoutPreset(presetId)
      applyShellLayout(nextLayout)
      announceShellAction(`Layout preset applied: ${STUDIO_LAYOUT_PRESET_DEFINITIONS[presetId].label}`)
    },
    [announceShellAction, applyShellLayout],
  )

  const refreshOutputSnapshot = useCallback(
    async (sceneName?: string) => {
      const selectedScene = sceneName?.trim() || currentScene || 'default'
      setOutputLoading(true)
      setOutputError(null)

      try {
        const response = await fetch(`/api/dev/output?scene=${encodeURIComponent(selectedScene)}`)
        const payload = (await response.json()) as StudioOutputPayload | { error?: string }

        if (!response.ok) {
          const errorMessage =
            'error' in payload && typeof payload.error === 'string'
              ? payload.error
              : 'Failed to load output payload'
          throw new Error(errorMessage)
        }

        setOutputPayload(payload as StudioOutputPayload)
      } catch (error) {
        setOutputError(error instanceof Error ? error.message : 'Failed to load output payload')
      } finally {
        setOutputLoading(false)
      }
    },
    [currentScene],
  )

  const handleRefreshWorkspace = useCallback(() => {
    void (async () => {
      await Promise.all([
        refreshScenes(),
        refreshAssets(),
        refreshOutputSnapshot(),
      ])
      announceShellAction('Workspace refreshed')
    })()
  }, [announceShellAction, refreshAssets, refreshOutputSnapshot, refreshScenes])

  const handleExportStudioState = useCallback(async () => {
    const response = await fetch(`/api/dev/output?scene=${encodeURIComponent(currentScene)}`)
    const payload = (await response.json()) as StudioOutputPayload | { error?: string }
    if (!response.ok) {
      const errorMessage =
        'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'Failed to export output payload'
      setOutputError(errorMessage)
      announceShellAction('Export failed')
      return
    }

    setOutputPayload(payload as StudioOutputPayload)
    setOutputError(null)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `studio-${currentScene}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    announceShellAction(`Exported studio-${currentScene}.json`)
  }, [announceShellAction, currentScene])

  useEffect(() => {
    if (!didBootstrapScene) return
    void refreshOutputSnapshot()
  }, [currentScene, didBootstrapScene, refreshOutputSnapshot, sceneEntries])

  if (!didBootstrapScene) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          gap: 12,
          padding: 20,
          boxSizing: 'border-box',
          background: STUDIO_THEME.shellBackground,
          fontFamily: STUDIO_THEME.fontFamily,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 12px',
            minHeight: 52,
            background: STUDIO_THEME.baseBackground,
            border: STUDIO_THEME.border,
            borderRadius: STUDIO_THEME.baseBorderRadius,
            boxShadow: `0 2px 4px ${STUDIO_THEME.baseShadow}`,
            color: STUDIO_THEME.baseForeground,
          }}
        >
          <div style={{ display: 'grid', gap: 2 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: STUDIO_THEME.labelForeground }}>
              ONEMO Browser Studio
            </div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Loading saved studio state…</div>
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: STUDIO_THEME.labelForeground }}>
            Bootstrapping
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(240,244,248,0.92))',
            borderRadius: STUDIO_THEME.baseBorderRadius,
            border: '1px solid rgba(148, 163, 184, 0.18)',
            color: '#111827',
          }}
        >
          <div style={{ display: 'grid', gap: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>
              Studio Startup
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Restoring the saved scene, assets, and studio layout
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: STUDIO_THEME.shellBackground,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: STUDIO_THEME.fontFamily,
      }}
    >
      {/* Toolbar — 40px, full width, KeyShot charcoal */}
      <div
        style={{
          flexShrink: 0,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 10px',
          background: '#252525',
          borderBottom: STUDIO_THEME.border,
          color: STUDIO_THEME.baseForeground,
        }}
      >
        {/* Left: studio name + dirty indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: STUDIO_THEME.baseForeground, whiteSpace: 'nowrap' }}>
            {currentSceneEntry?.name ?? currentScene}
          </span>
          <span
            style={{
              fontSize: 10,
              color: hasUnsavedChanges ? '#f59e0b' : STUDIO_THEME.labelForeground,
              whiteSpace: 'nowrap',
            }}
          >
            {hasUnsavedChanges ? '● Unsaved' : '○ Saved'}
          </span>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={handleQuickSave}
            style={{ height: 26, padding: '0 10px', borderRadius: STUDIO_THEME.bladeBorderRadius, border: 'none', background: STUDIO_THEME.buttonBackground, color: STUDIO_THEME.buttonForeground, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 11 }}
          >
            Save
          </button>
          <button
            onClick={handleResetScene}
            style={{ height: 26, padding: '0 10px', borderRadius: STUDIO_THEME.bladeBorderRadius, border: STUDIO_THEME.border, background: 'transparent', color: hasUnsavedChanges ? STUDIO_THEME.baseForeground : STUDIO_THEME.labelForeground, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 11 }}
          >
            Reset
          </button>
          <button
            onClick={handleRefreshWorkspace}
            style={{ height: 26, padding: '0 10px', borderRadius: STUDIO_THEME.bladeBorderRadius, border: STUDIO_THEME.border, background: 'transparent', color: STUDIO_THEME.labelForeground, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 11 }}
          >
            Refresh
          </button>
          <button
            onClick={handleExportStudioState}
            style={{ height: 26, padding: '0 10px', borderRadius: STUDIO_THEME.bladeBorderRadius, border: STUDIO_THEME.border, background: 'transparent', color: STUDIO_THEME.labelForeground, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 11 }}
          >
            Export
          </button>
          {/* Separator */}
          <div style={{ width: 1, height: 20, background: STUDIO_THEME.borderColor, margin: '0 2px' }} />
          <select
            value={selectedLayoutPreset}
            onChange={(event) => handleLayoutPresetSelect(event.target.value as StudioLayoutPresetId)}
            style={{
              height: 26,
              borderRadius: STUDIO_THEME.bladeBorderRadius,
              border: STUDIO_THEME.border,
              background: '#1e1e1e',
              color: STUDIO_THEME.baseForeground,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
              padding: '0 6px',
            }}
          >
            {STUDIO_LAYOUT_PRESET_ORDER.map((presetId) => (
              <option key={presetId} value={presetId}>
                {STUDIO_LAYOUT_PRESET_DEFINITIONS[presetId].label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsEditingLights((value) => !value)}
            style={{ height: 26, padding: '0 10px', borderRadius: STUDIO_THEME.bladeBorderRadius, border: isEditingLights ? 'none' : STUDIO_THEME.border, background: isEditingLights ? STUDIO_THEME.buttonBackground : 'transparent', color: isEditingLights ? STUDIO_THEME.buttonForeground : STUDIO_THEME.labelForeground, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 11 }}
          >
            {isEditingLights ? 'Done Lights' : 'Lights'}
          </button>
          {shellActionStatus ? (
            <div
              style={{
                height: 26,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderRadius: STUDIO_THEME.bladeBorderRadius,
                background: STUDIO_THEME.containerBackground,
                color: STUDIO_THEME.baseForeground,
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}
            >
              {shellActionStatus}
            </div>
          ) : null}
        </div>
      </div>

      {/* Work area — flex row: left dock + viewport + right dock */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left dock */}
        {showLeftDock && (
        <div
          style={{
            flexShrink: 0,
            width: effectiveLeftDockWidth,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            background: STUDIO_THEME.panelBackground,
            borderRight: STUDIO_THEME.border,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <LibraryPanel
              assetsLoaded={assets.loaded}
              models={assets.models}
              hdris={assets.hdris}
              materialSets={assets.materialSets}
              materialPresetNames={assets.materialPresets}
              materialPresetDraftName={materialPresetDraftName}
              modelPath={viewerConfig.modelPath}
              hdriValue={hdriValue}
              materialGroups={materialGroups}
              onModelChange={(value) => setViewerConfig((previous) => ({ ...previous, modelPath: value }))}
              onHdriChange={(value) => setViewerConfig((previous) => ({
                ...previous,
                environment: {
                  ...previous.environment!,
                  preset: value.startsWith('/assets/') ? 'studio' : value,
                  customHdri: value.startsWith('/assets/') ? value : undefined,
                },
              }))}
              onAssetUpload={handleAssetUpload}
              onApplyMaterialSet={applyMaterialSet}
              onMaterialPresetDraftNameChange={setMaterialPresetDraftName}
              onSaveMaterialPreset={(value) => void saveMaterialPreset(value)}
              onLoadMaterialPreset={(value) => void loadMaterialPreset(value)}
              hasArtwork={Boolean(artworkUrl)}
              artworks={assets.artworks}
              artworkUrl={artworkUrl}
              isEditing={isEditing}
              designState={designState}
              onArtworkFile={(file) => void handleArtworkFile(file)}
              onArtworkSelect={(value) => {
                setArtworkUrl(value || undefined)
                setDesignState(cloneDesignState(INITIAL_DESIGN))
              }}
              onToggleEditing={() => setIsEditing((previous) => !previous)}
              onResetArtwork={() => setDesignState(cloneDesignState(INITIAL_DESIGN))}
            />
          </div>

          {/* Studios section — compact scene management below Library */}
          <div
            style={{
              flexShrink: 0,
              borderTop: STUDIO_THEME.border,
              background: STUDIO_THEME.panelBackground,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <StudiosPanel
              currentScene={currentScene}
              sceneNames={sceneNames}
              sceneMeta={sceneMeta}
              onLoadScene={(value) => void loadScene(value)}
            />
            {/* Save / name / publish controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 8px',
                borderTop: STUDIO_THEME.border,
              }}
            >
              <input
                value={sceneDraftName}
                onChange={(e) => setSceneDraftName(e.target.value)}
                placeholder="Scene name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 22,
                  padding: '0 6px',
                  border: STUDIO_THEME.border,
                  borderRadius: STUDIO_THEME.bladeBorderRadius,
                  background: STUDIO_THEME.inputBackground,
                  color: STUDIO_THEME.baseForeground,
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => void saveScene(sceneDraftName || currentScene || 'default')}
                style={primaryButtonStyle()}
              >
                Save
              </button>
              <button
                onClick={() => void publishScene()}
                style={{
                  ...secondaryButtonStyle(),
                  color: STUDIO_THEME.activeBlue,
                  borderColor: STUDIO_THEME.activeBlue,
                  flexShrink: 0,
                  height: 22,
                  padding: '0 8px',
                  borderRadius: STUDIO_THEME.bladeBorderRadius,
                  border: `1px solid ${STUDIO_THEME.activeBlue}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              >
                Pub
              </button>
            </div>
          </div>
          {/* Left resize handle */}
          <button
            type="button"
            aria-label="Resize left dock"
            onPointerDown={handleDockResizeStart('left')}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 6,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'col-resize',
              padding: 0,
              zIndex: 1,
            }}
          >
            <span
              style={{
                width: 1,
                height: '40%',
                background: activeDockResize === 'left' ? STUDIO_THEME.activeBlue : STUDIO_THEME.borderColor,
              }}
            />
          </button>
        </div>
        )}

        {/* Viewport — black background, fills remaining space */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            background: '#000000',
            touchAction: isEditing ? 'none' : 'auto',
          }}
          {...(isEditing ? bind() : {})}
        >
          <EffectViewer
            config={viewerConfig}
            artworkUrl={artworkUrl}
            designState={designState}
            isEditing={isEditing}
            showLightingHelpers={isEditingLights}
            editLights={isEditingLights}
            onLightChange={updateLightTransform}
          />
        </div>

        {/* Right dock */}
        {showRightDock && (
        <div
          style={{
            flexShrink: 0,
            width: effectiveRightDockWidth,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            background: STUDIO_THEME.panelBackground,
            borderLeft: STUDIO_THEME.border,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Right resize handle */}
          <button
            type="button"
            aria-label="Resize right dock"
            onPointerDown={handleDockResizeStart('right')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 6,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'col-resize',
              padding: 0,
              zIndex: 1,
            }}
          >
            <span
              style={{
                width: 1,
                height: '40%',
                background: activeDockResize === 'right' ? STUDIO_THEME.activeBlue : STUDIO_THEME.borderColor,
              }}
            />
          </button>
          <InspectorPanel registry={studioRegistry} />
        </div>
        )}

      </div>

      {/* Bottom bar — minimal status strip */}
      <div
        style={{
          flexShrink: 0,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          background: '#1a1a1a',
          borderTop: STUDIO_THEME.border,
          fontFamily: STUDIO_THEME.fontFamily,
          fontSize: 10,
          color: STUDIO_THEME.labelForeground,
        }}
      >
        <span>{currentSceneEntry?.name ?? currentScene}</span>
        <span
          style={{
            color: hasUnsavedChanges ? '#f59e0b' : STUDIO_THEME.labelForeground,
          }}
        >
          {hasUnsavedChanges ? '● Unsaved' : '○ Saved'}
        </span>
      </div>
    </div>
  )
}
