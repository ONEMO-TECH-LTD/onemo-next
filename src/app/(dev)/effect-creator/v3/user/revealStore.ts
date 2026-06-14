// Particle-effect state — the surface-sampled hologram morph (ParticleMorph). The object's mesh
// surface is sampled into particles that deform via fractal noise and morph between shapes.
// PRODUCTION SHAPE: when Dan pins a config, the dev panel + play button are deleted and the morph
// values below become the defaults; magicStart/magicFinish stay (the Magic transition).
import { create } from 'zustand'

// Live-tunable config (driven by the leva panel — ParticleControls). Ref: cortiz2894/hologram-particles.
export interface MorphConfig {
  particleCount: number // surface samples
  pointSize: number     // particle px size
  noiseAmp: number      // disintegration distance — how far particles fly off the surface
  noiseScale: number    // swarm detail — noise frequency
  noiseSpeed: number    // swarm speed — how fast the cloud churns
  maskContrast: number  // disintegration spread — how much of the surface lifts (lower = more)
  floatAmp: number      // idle shimmer — tiny per-particle bob
  glow: number          // travel glow during the morph
  stagger: number       // puzzle stagger — 0 = all particles move together, 1 = strongly staggered
  durationMs: number    // total transition time
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
  morph: { particleCount: 80000, pointSize: 2.0, noiseAmp: 0.02, noiseScale: 26, noiseSpeed: 0.3, maskContrast: 1.4, floatAmp: 0.0025, glow: 1.0, stagger: 0.5, durationMs: 4000 },
  phase: 'cycle',
  start: () => set((s) => ({ active: true, phase: 'cycle', startedAt: performance.now(), runToken: s.runToken + 1 })),
  magicStart: () => set((s) => ({ active: true, phase: 'out', startedAt: performance.now(), runToken: s.runToken + 1 })),
  magicFinish: () => set((s) => (s.active ? { phase: 'in', startedAt: performance.now(), runToken: s.runToken + 1 } : {})),
  stop: () => set({ active: false, phase: 'cycle' }),
  setMorph: (patch) => set((s) => ({ morph: { ...s.morph, ...patch } })),
}))
