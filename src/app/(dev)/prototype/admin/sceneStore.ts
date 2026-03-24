import { create } from 'zustand'
import type {
  SceneConfig,
  ColorConfig,
  FaceMaterialConfig,
  BackMaterialConfig,
  FrameMaterialConfig,
  SceneSettings,
} from '../types'

// Leva works with loose Record types — this is the bridge layer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LevaSetter = (values: Record<string, any>) => void

interface SceneStore {
  // Leva setter registration (called by components inside Canvas)
  _setters: Record<string, LevaSetter>
  registerSetter: (group: string, setter: LevaSetter) => void

  // Current Leva values (synced by components on every change)
  _values: {
    'Face Material'?: FaceMaterialConfig
    'Back Material'?: BackMaterialConfig
    'Frame Material'?: FrameMaterialConfig
    'Scene'?: SceneSettings
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  syncValues: (group: string, values: any) => void

  // Page-level colors
  colors: ColorConfig
  setBackColor: (color: string) => void
  setFrameColor: (color: string) => void
  setBgColor: (color: string) => void

  // Current scene tracking
  currentScene: string
  setCurrentScene: (name: string) => void

  // Saved baseline for reset-to-saved (Framer-style)
  _baseline: {
    'Face Material'?: FaceMaterialConfig
    'Back Material'?: BackMaterialConfig
    'Frame Material'?: FrameMaterialConfig
    'Scene'?: SceneSettings
  }
  _baselineColors: ColorConfig

  // Initialization flag
  _initialized: boolean
  setInitialized: () => void

  // Build a saveable config from current state
  getConfig: (name: string) => SceneConfig

  // Apply a loaded config (sets Leva controls + colors, updates baseline)
  applyConfig: (config: SceneConfig) => void
}

const DEFAULT_COLORS: ColorConfig = {
  backColor: '#080808',
  frameColor: '#0f0f0f',
  bgColor: '#ffffff',
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  _setters: {},
  registerSetter: (group, setter) =>
    set((s) => ({ _setters: { ...s._setters, [group]: setter } })),

  _values: {},
  syncValues: (group, values) =>
    set((s) => {
      const newState: Partial<SceneStore> = { _values: { ...s._values, [group]: values } }
      // If baseline is empty for this group, initialize it from the first sync
      // This captures the initial Leva values as the baseline before any user edits
      if (!s._baseline[group as keyof typeof s._baseline]) {
        newState._baseline = { ...s._baseline, [group]: values }
      }
      return newState
    }),

  colors: { ...DEFAULT_COLORS },

  setBackColor: (color) => {
    set((s) => ({ colors: { ...s.colors, backColor: color } }))
    const setter = get()._setters['Back Material']
    if (setter) setter({ color })
  },

  setFrameColor: (color) => {
    set((s) => ({ colors: { ...s.colors, frameColor: color } }))
    const setter = get()._setters['Frame Material']
    if (setter) setter({ color })
  },

  setBgColor: (color) => {
    set((s) => ({ colors: { ...s.colors, bgColor: color } }))
  },

  currentScene: 'default',
  setCurrentScene: (name) => set({ currentScene: name }),

  _baseline: {},
  _baselineColors: { ...DEFAULT_COLORS },

  _initialized: false,
  setInitialized: () => set({ _initialized: true }),

  getConfig: (name) => {
    const s = get()
    const now = new Date().toISOString()
    return {
      name,
      created: now,
      modified: now,
      modelPath: '/assets/shapes/effect-70mm-step.glb',
      face: s._values['Face Material'] ?? {} as FaceMaterialConfig,
      back: s._values['Back Material'] ?? {} as BackMaterialConfig,
      frame: s._values['Frame Material'] ?? {} as FrameMaterialConfig,
      scene: s._values['Scene'] ?? {} as SceneSettings,
      textures: {
        normal: '/assets/materials/ultrasuede/suede-normal.png',
        roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
        height: '/assets/materials/ultrasuede/suede-height.png',
      },
      colors: { ...s.colors },
    }
  },

  applyConfig: (config) => {
    const s = get()
    if (config.face && s._setters['Face Material']) {
      s._setters['Face Material'](config.face)
    }
    if (config.back && s._setters['Back Material']) {
      s._setters['Back Material'](config.back)
    }
    if (config.frame && s._setters['Frame Material']) {
      s._setters['Frame Material'](config.frame)
    }
    if (config.scene && s._setters['Scene']) {
      s._setters['Scene'](config.scene)
    }
    if (config.colors) {
      set({ colors: { ...get().colors, ...config.colors } })
    }
    // Update baseline for reset-to-saved tracking
    set({
      _baseline: {
        'Face Material': config.face ? { ...config.face } : get()._baseline['Face Material'],
        'Back Material': config.back ? { ...config.back } : get()._baseline['Back Material'],
        'Frame Material': config.frame ? { ...config.frame } : get()._baseline['Frame Material'],
        'Scene': config.scene ? { ...config.scene } : get()._baseline['Scene'],
      },
      _baselineColors: config.colors
        ? { ...get().colors, ...config.colors }
        : get()._baselineColors,
      currentScene: config.name,
    })
  },
}))
