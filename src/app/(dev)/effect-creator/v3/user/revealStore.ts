// Particle-effect state — the surface-sampled hologram morph (ParticleMorph). The object's mesh
// surface is sampled into particles that deform via fractal noise and morph between shapes.
// PRODUCTION SHAPE: when Dan pins a config, the dev panel + play button are deleted and the morph
// values below become the defaults; magicStart/magicFinish stay (the Magic transition).
import { create } from 'zustand'

// Live-tunable config (driven by the leva panel — ParticleControls). Ref: cortiz2894/hologram-particles.
export interface MorphConfig {
  particleCount: number // surface samples
  pointSize: number     // particle px size
  noiseAmp: number      // deform amplitude (world units) along the surface normal
  noiseScale: number    // deform frequency
  noiseSpeed: number    // deform time rate
  maskContrast: number  // dissolve mask contrast (lower = more of the surface lifts off)
  floatAmp: number      // idle per-particle bob
  glow: number          // travel-glow scale during a morph
  durationMs: number    // transition timing
}

interface RevealState {
  active: boolean
  startedAt: number
  runToken: number      // bumps each trigger so the effect re-arms
  morph: MorphConfig
  // phase drives the dispersion: 'cycle' = test button (timed dissolve→reform same shape);
  // 'out' = Magic pressed (disperse the old shape + HOLD while it computes); 'in' = morph the
  // particles into the NEW shape and settle.
  phase: 'cycle' | 'out' | 'in'
  start: () => void          // test button — timed dissolve/reform cycle
  magicStart: () => void     // Magic pressed — disperse + hold
  magicFinish: () => void    // new shape ready — morph into it
  stop: () => void
  setMorph: (patch: Partial<MorphConfig>) => void
}

export const useRevealStore = create<RevealState>((set) => ({
  active: false,
  startedAt: 0,
  runToken: 0,
  morph: { particleCount: 50000, pointSize: 2.0, noiseAmp: 0.02, noiseScale: 26, noiseSpeed: 0.3, maskContrast: 1.4, floatAmp: 0.0025, glow: 1.0, durationMs: 3000 },
  phase: 'cycle',
  start: () => set((s) => ({ active: true, phase: 'cycle', startedAt: performance.now(), runToken: s.runToken + 1 })),
  magicStart: () => set((s) => ({ active: true, phase: 'out', startedAt: performance.now(), runToken: s.runToken + 1 })),
  magicFinish: () => set((s) => (s.active ? { phase: 'in', startedAt: performance.now(), runToken: s.runToken + 1 } : {})),
  stop: () => set({ active: false, phase: 'cycle' }),
  setMorph: (patch) => set((s) => ({ morph: { ...s.morph, ...patch } })),
}))
