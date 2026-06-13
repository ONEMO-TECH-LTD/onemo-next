// Reveal transition state — every transition plays through ONE in-canvas postprocessing pass
// (RevealComposer). This store is the trigger + the chosen effect. RIGHT NOW it is a TESTING
// surface: `start()` is called only by the replay button (RevealFxPicker), NOT by Magic, so every
// effect can be auditioned on the live object on demand.
// PRODUCTION SHAPE: when Dan picks the effect, the picker is deleted and `fx` is pinned to the
// chosen name; `start()` is then re-wired into Magic completion (and other transition points).
import { create } from 'zustand'

export type RevealTransition = { name: string; glsl: string; paramsTypes?: Record<string, string>; defaultParams?: Record<string, unknown> }

interface RevealState {
  active: boolean
  startedAt: number
  durationMs: number
  fx: string            // chosen transition name (the production default lives here)
  fromUrl?: string      // the "before" image (the flat photo)
  runToken: number      // bumps each start so the composer re-arms
  validFx: string[]     // transitions that actually compile on this driver (composer publishes)
  start: (fromUrl?: string) => void
  stop: () => void
  setFx: (name: string) => void
  setValidFx: (names: string[]) => void
}

export const useRevealStore = create<RevealState>((set) => ({
  active: false,
  startedAt: 0,
  durationMs: 1300,
  fx: '★ waterfall (custom)', // placeholder default until Dan picks; swap to the chosen name to pin
  fromUrl: undefined,
  runToken: 0,
  validFx: [],
  start: (fromUrl) => set((s) => ({ active: true, startedAt: performance.now(), fromUrl: fromUrl ?? s.fromUrl, runToken: s.runToken + 1 })),
  stop: () => set({ active: false }),
  setFx: (name) => set({ fx: name }),
  setValidFx: (names) => set({ validFx: names }),
}))
