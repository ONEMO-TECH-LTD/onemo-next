'use client'

import { create } from 'zustand'

import type { ColorConfig } from '../types'

interface SceneStore {
  colors: ColorConfig
  setBackColor: (color: string) => void
  setFrameColor: (color: string) => void
  setBgColor: (color: string) => void
}

const DEFAULT_COLORS: ColorConfig = {
  backColor: '#080808',
  frameColor: '#0f0f0f',
  bgColor: '#ffffff',
}

export const useSceneStore = create<SceneStore>((set) => ({
  colors: { ...DEFAULT_COLORS },

  setBackColor: (color) => {
    set((state) => ({ colors: { ...state.colors, backColor: color } }))
  },

  setFrameColor: (color) => {
    set((state) => ({ colors: { ...state.colors, frameColor: color } }))
  },

  setBgColor: (color) => {
    set((state) => ({ colors: { ...state.colors, bgColor: color } }))
  },
}))
