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
export type MotionPattern = 'scatter' | 'explode' | 'swirl' | 'fluid' | 'wave' | 'fall'
export interface ParticleConfig {
  pattern: MotionPattern // how the pixels move when they disperse (the motion-pattern library)
  density: number        // grid resolution (pixel fineness); square particles auto-tile → gap-free
  pixelSize: number      // size multiplier on the tile (1.0 = exact tile, no gaps; >1 = chunkier)
  intensity: number      // movement intensity — how far the pixels travel when dispersed
  motionSpeed: number    // animation rate for time-based patterns (swirl/fluid/wave sway)
  durationMs: number     // total cycle time (bigger = slower)
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
  // phase drives the particle dispersion: 'cycle' = test button (timed solid→disperse→reassemble);
  // 'out' = Magic pressed (disperse + HOLD while it computes); 'in' = reassemble into the new shape.
  phase: 'cycle' | 'out' | 'in'
  start: (fromUrl?: string) => void                // test button — full timed cycle
  magicStart: (fromUrl?: string) => void           // Magic pressed — disperse + hold
  magicFinish: () => void                           // new shape ready — reassemble into it
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
  particle: { pattern: 'scatter', density: 520, pixelSize: 1.1, intensity: 0.3, motionSpeed: 0.4, durationMs: 4200 },
  phase: 'cycle',
  start: (fromUrl) => set((s) => ({ active: true, phase: 'cycle', startedAt: performance.now(), fromUrl: fromUrl ?? s.fromUrl, runToken: s.runToken + 1 })),
  magicStart: (fromUrl) => set((s) => ({ active: true, phase: 'out', startedAt: performance.now(), fromUrl: fromUrl ?? s.fromUrl, runToken: s.runToken + 1 })),
  magicFinish: () => set((s) => (s.active ? { phase: 'in', startedAt: performance.now(), runToken: s.runToken + 1 } : {})),
  stop: () => set({ active: false, phase: 'cycle' }),
  setFx: (name) => set({ fx: name }),
  setValidFx: (names) => set({ validFx: names }),
  setParticle: (patch) => set((s) => ({ particle: { ...s.particle, ...patch } })),
}))
