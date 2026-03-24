import { create } from 'zustand'
import type { SceneConfig } from './types'

type LevaValues = Record<string, number | string>
type LevaSetter = (values: LevaValues) => void

interface SceneStore {
  // Leva setter registration (called by components inside Canvas)
  _setters: Record<string, LevaSetter>
  registerSetter: (group: string, setter: LevaSetter) => void

  // Current Leva values (synced by components on every change)
  _values: Record<string, LevaValues>
  syncValues: (group: string, values: LevaValues) => void

  // Page-level colors (synced with Leva on set)
  colors: { backColor: string; frameColor: string; bgColor: string }
  setBackColor: (color: string) => void
  setFrameColor: (color: string) => void
  setBgColor: (color: string) => void

  // Build a saveable config from current state
  getConfig: (name: string) => SceneConfig

  // Apply a loaded config (sets Leva controls + colors)
  applyConfig: (config: SceneConfig) => void
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  _setters: {},
  registerSetter: (group, setter) =>
    set((s) => ({ _setters: { ...s._setters, [group]: setter } })),

  _values: {},
  syncValues: (group, values) =>
    set((s) => ({ _values: { ...s._values, [group]: values } })),

  colors: { backColor: '#080808', frameColor: '#0f0f0f', bgColor: '#ffffff' },

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

  getConfig: (name) => {
    const s = get()
    const now = new Date().toISOString()
    return {
      name,
      created: now,
      modified: now,
      face: { ...s._values['Face Material'] },
      back: { ...s._values['Back Material'] },
      frame: { ...s._values['Frame Material'] },
      scene: { ...s._values['Scene'] },
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
  },
}))
