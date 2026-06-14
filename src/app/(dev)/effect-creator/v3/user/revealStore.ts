// Reveal transition state — every transition plays through ONE in-canvas postprocessing pass
// (RevealComposer). This store is the trigger + the chosen effect. RIGHT NOW it is a TESTING
// surface: `start()` is called only by the replay button (RevealFxPicker), NOT by Magic, so every
// effect can be auditioned on the live object on demand.
// PRODUCTION SHAPE: when Dan picks the effect, the picker is deleted and `fx` is pinned to the
// chosen name; `start()` is then re-wired into Magic completion (and other transition points).
import { create } from 'zustand'

export type RevealTransition = { name: string; glsl: string; paramsTypes?: Record<string, string>; defaultParams?: Record<string, unknown> }

// Live-tunable particle config (driven by the leva panel — ParticleControls). The model's image IS
// the particles (no fader): solid → chaotic particle-fluid → reassembled solid, in one cycle.
export interface ParticleConfig {
  density: number    // grid resolution (pixel fineness); square particles auto-tile → gap-free
  pixelSize: number  // size multiplier on the tile (1.0 = exact tile, no gaps; >1 = chunkier)
  spread: number     // how far the pixels drift apart (the dissolve distance) — position only
  flowSpeed: number  // how fast the smooth flow field evolves (lower = more elegant)
  durationMs: number // total cycle time (bigger = slower)
}

interface RevealState {
  active: boolean
  startedAt: number
  durationMs: number
  fx: string            // chosen transition name (the production default lives here)
  fromUrl?: string      // the "before" image (the flat photo)
  runToken: number      // bumps each start so the composer re-arms
  validFx: string[]     // transitions that actually compile on this driver (composer publishes)
  particle: ParticleConfig
  start: (fromUrl?: string) => void
  stop: () => void
  setFx: (name: string) => void
  setValidFx: (names: string[]) => void
  setParticle: (patch: Partial<ParticleConfig>) => void
}

export const useRevealStore = create<RevealState>((set) => ({
  active: false,
  startedAt: 0,
  durationMs: 1300,
  fx: '★ waterfall (custom)', // placeholder default until Dan picks; swap to the chosen name to pin
  fromUrl: undefined,
  runToken: 0,
  validFx: [],
  particle: { density: 520, pixelSize: 1.1, spread: 0.28, flowSpeed: 0.15, durationMs: 4200 },
  start: (fromUrl) => set((s) => ({ active: true, startedAt: performance.now(), fromUrl: fromUrl ?? s.fromUrl, runToken: s.runToken + 1 })),
  stop: () => set({ active: false }),
  setFx: (name) => set({ fx: name }),
  setValidFx: (names) => set({ validFx: names }),
  setParticle: (patch) => set((s) => ({ particle: { ...s.particle, ...patch } })),
}))
