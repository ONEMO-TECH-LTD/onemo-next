import { create } from 'zustand'
import type {
  SceneConfig,
  ColorConfig,
  FaceMaterial,
  BackMaterial,
  FrameMaterial,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LevaSetter = (values: Record<string, any>) => void

const DEFAULT_TEXTURES = {
  normal: '/assets/materials/ultrasuede/suede-normal.png',
  roughness: '/assets/materials/ultrasuede/suede-roughness.jpg',
  height: '/assets/materials/ultrasuede/suede-height.png',
}

interface SceneStore {
  // Leva setter registration (camera/env only now)
  _setters: Record<string, LevaSetter>
  registerSetter: (group: string, setter: LevaSetter) => void

  // Current Leva values (camera/env)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _values: Record<string, any>
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

  // Initialization flag
  _initialized: boolean
  setInitialized: () => void

  // Build a saveable config from current state
  getConfig: (name: string) => SceneConfig

  // Apply a loaded config
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
    set((s) => ({ _values: { ...s._values, [group]: values } })),

  colors: { ...DEFAULT_COLORS },

  setBackColor: (color) => {
    set((s) => ({ colors: { ...s.colors, backColor: color } }))
  },

  setFrameColor: (color) => {
    set((s) => ({ colors: { ...s.colors, frameColor: color } }))
  },

  setBgColor: (color) => {
    set((s) => ({ colors: { ...s.colors, bgColor: color } }))
  },

  currentScene: 'default',
  setCurrentScene: (name) => set({ currentScene: name }),

  _initialized: false,
  setInitialized: () => set({ _initialized: true }),

  getConfig: (name) => {
    const s = get()
    const now = new Date().toISOString()
    // TODO: material state is now managed in AdminViewer, not here
    // This needs to be called with the current material state from AdminViewer
    return {
      name,
      created: now,
      modified: now,
      modelPath: '/assets/shapes/effect-70mm-step.glb',
      face: {
        params: { roughness: 1, metalness: 0, envMapIntensity: 0.1, normalScale: 0.15, bumpScale: 1, sheen: 1, sheenColor: '#1a1a1a', sheenRoughness: 0.8, colorMultiplier: 1 },
        textures: { ...DEFAULT_TEXTURES },
      },
      back: {
        params: { color: s.colors.backColor, roughness: 1, envMapIntensity: 0.1, normalScale: 0.15, bumpScale: 1, sheen: 1, sheenColor: '#1a1a1a', sheenRoughness: 0.8 },
        textures: { ...DEFAULT_TEXTURES },
      },
      frame: {
        params: { color: s.colors.frameColor, roughness: 0.5, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3 },
        textures: {},
      },
      scene: s._values['Scene'] || { exposure: 0.7, ambientIntensity: 0.5, envIntensity: 1.0, background: '#ffffff' },
      colors: { ...s.colors },
    }
  },

  applyConfig: (config) => {
    if (config.colors) {
      set({ colors: { ...get().colors, ...config.colors } })
    }
    // Apply scene params via Leva setter
    const s = get()
    if (config.scene && s._setters['Scene']) {
      s._setters['Scene'](config.scene)
    }
    set({ currentScene: config.name })
  },
}))
